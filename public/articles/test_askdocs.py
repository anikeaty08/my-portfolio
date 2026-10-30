"""Tests for askdocs.py. Run:  python -m pytest scripts/test_askdocs.py -q

Uses the real faiss, rank_bm25, networkx, pypdf and trafilatura. If sentence-transformers
is not installed, a tiny hashing stand-in is used so the tests still run offline.
"""
import json
import random
import re
import sys
import types
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))

# ---------------------------------------------------------------- optional stand-ins
try:
    import sentence_transformers  # noqa: F401
except ImportError:
    def _vec(text, dim=256):
        v = np.zeros(dim, dtype="float32")
        for w in re.findall(r"\w+", text.lower()):
            v[hash(w) % dim] += 1
        n = np.linalg.norm(v)
        return v / n if n else v

    class SentenceTransformer:
        def __init__(self, name):
            self.name = name

        def get_sentence_embedding_dimension(self):
            return 256

        def encode(self, texts, normalize_embeddings=False, **kwargs):
            return np.stack([_vec(t) for t in texts])

    class CrossEncoder:
        def __init__(self, name):
            self.name = name

        def predict(self, pairs):
            out = []
            for q, c in pairs:
                qs, cs = set(re.findall(r"\w+", q.lower())), set(re.findall(r"\w+", c.lower()))
                out.append(len(qs & cs) / (len(qs) or 1))
            return np.array(out)

    mod = types.ModuleType("sentence_transformers")
    mod.SentenceTransformer, mod.CrossEncoder = SentenceTransformer, CrossEncoder
    sys.modules["sentence_transformers"] = mod

import askdocs as ad  # noqa: E402


@pytest.fixture(autouse=True)
def stub_llm(monkeypatch):
    calls = []

    def fake(prompt: str) -> str:
        calls.append(prompt)
        return "stub reply [1]"

    monkeypatch.setattr(ad, "llm", fake)
    return calls


def make_image_pdf(path):
    """A PDF whose only content is an image: what a scanner produces."""
    PIL = pytest.importorskip("PIL.Image")
    PIL.new("RGB", (300, 300), "white").save(str(path), "PDF")


def make_text_pdf(path, text="Parental leave is twenty six weeks for the primary carer. " * 4):
    fpdf = pytest.importorskip("fpdf")
    pdf = fpdf.FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 8, text)
    pdf.output(str(path))


def make_doc(doc_id, text, groups=("all-staff",)):
    return {"id": doc_id, "source": doc_id, "title": doc_id, "text": text, "type": "text",
            "needs_ocr": False, "allowed_groups": list(groups)}


CORPUS = {
    "leave.md": "Parental leave is 26 weeks for the primary carer. Leave must be requested early.",
    "expenses.md": "Expense claims are paid monthly. Receipts are required for every claim.",
    "remote.md": "Remote work needs manager approval. Work from home two days a week.",
    "travel.md": "Travel must be booked at least two weeks ahead through the portal.",
    "security.md": "Security training is mandatory every year. Report phishing emails at once.",
}


def build_index(groups=("all-staff",)):
    index = ad.Index()
    for doc_id, text in CORPUS.items():
        index.add(ad.make_chunks(make_doc(doc_id, text, groups)))
    return index


# ---------------------------------------------------------------- setup helpers
def test_parse_json_variants():
    assert ad.parse_json('{"a": 1}') == {"a": 1}
    assert ad.parse_json('```json\n[["a","b","c"]]\n```') == [["a", "b", "c"]]
    assert ad.parse_json('Sure! Here you go: {"action": "finish"} Hope that helps.') == {"action": "finish"}
    with pytest.raises(ValueError):
        ad.parse_json("no json here")


# ---------------------------------------------------------------- ingestion
def test_load_folder_ids_are_unique_and_scans_are_flagged(tmp_path):
    (tmp_path / "a").mkdir()
    (tmp_path / "b").mkdir()
    (tmp_path / "a" / "policy.md").write_text("Alpha policy. " * 20, encoding="utf-8")
    (tmp_path / "b" / "policy.md").write_text("Beta policy. " * 20, encoding="utf-8")
    make_image_pdf(tmp_path / "scan.pdf")
    docs = {d["id"]: d for d in ad.load_folder(str(tmp_path))}
    assert set(docs) == {"a/policy.md", "b/policy.md", "scan.pdf"}      # same file name, distinct ids
    assert docs["scan.pdf"]["needs_ocr"] is True                       # a scan is flagged, not silently empty
    assert docs["a/policy.md"]["needs_ocr"] is False
    assert docs["a/policy.md"]["allowed_groups"] == ["all-staff"]


def test_archived_source_is_removed_and_metadata_changes_trigger_sync(tmp_path):
    (tmp_path / "current.md").write_text("Refunds within 30 days.", encoding="utf-8")
    (tmp_path / "old.md").write_text("Refunds within 60 days.", encoding="utf-8")
    before = ad.load_folder(str(tmp_path))
    seen = {doc["id"]: ad.fingerprint(doc) for doc in before}

    manifest = {
        "current.md": {"status": "current", "updated_at": "2026-10-30", "allowed_groups": ["billing"]},
        "old.md": {"status": "archived"},
    }
    (tmp_path / ".rag-sources.json").write_text(json.dumps(manifest), encoding="utf-8")
    after = ad.load_folder(str(tmp_path))
    assert [doc["id"] for doc in after] == ["current.md"]
    assert after[0]["updated_at"] == "2026-10-30"
    assert after[0]["allowed_groups"] == ["billing"]
    changed, removed = ad.plan_sync(after, seen)
    assert [doc["id"] for doc in changed] == ["current.md"]
    assert removed == {"old.md"}
    assert ad.make_chunks(after[0])[0]["updated_at"] == "2026-10-30"


def test_robots_unreachable_site_fails_closed_and_is_cached(monkeypatch):
    ad._robots.clear()
    reads = {"n": 0}
    original = ad.robotparser.RobotFileParser.read

    def counting_read(self):
        reads["n"] += 1
        return original(self)

    monkeypatch.setattr(ad.robotparser.RobotFileParser, "read", counting_read)
    url = "https://this-domain-does-not-exist-12345.invalid/page"
    assert ad.allowed(url) is False
    assert ad.allowed(url + "2") is False
    assert reads["n"] == 1                                              # one download per site
    assert ad.fetch_page(url) is None                                   # no crash


def test_fetch_page_live():
    try:
        page = ad.fetch_page("https://example.com")
    except Exception as exc:                                            # offline machine
        pytest.skip(f"network unavailable: {exc}")
    if page is None:
        pytest.skip("network unavailable")
    assert page["title"] and "domain" in page["text"].lower()


def test_rows_to_docs():
    docs = ad.rows_to_docs([{"name": "Mug", "sku": "M1", "price": 9.5, "currency": "USD",
                             "category": "Home", "stock": 0, "notes": "blue"}], "products")
    assert docs[0]["id"] == "products/M1" and "In stock: no" in docs[0]["text"]


def test_plan_sync_and_ingest_only_marks_seen_after_success(monkeypatch):
    index, seen = ad.Index(), {}
    docs = [make_doc("a", "Alpha text here."), make_doc("b", "Beta text here.")]
    assert ad.ingest(docs, index, seen) == (2, 0)
    assert ad.plan_sync(docs, seen) == ([], set())                      # nothing changed
    # a document is removed at the source and another changes
    docs2 = [make_doc("a", "Alpha text here, updated.")]
    assert ad.ingest(docs2, index, seen) == (1, 1)
    assert "b" not in seen and index.delete_doc("b") == 0               # deletion propagated
    # indexing fails midway: the document must NOT be recorded as seen
    original = ad.Index.upsert_doc

    def boom(self, doc_id, chunks):
        raise RuntimeError("disk full")

    monkeypatch.setattr(ad.Index, "upsert_doc", boom)
    with pytest.raises(RuntimeError):
        ad.ingest([make_doc("c", "Gamma text.")], index, seen)
    assert "c" not in seen
    monkeypatch.setattr(ad.Index, "upsert_doc", original)
    assert ad.ingest([make_doc("c", "Gamma text.")], index, seen) == (1, 0)   # retried and indexed


def test_ingest_skips_scans_and_retries_them(caplog):
    index, seen = ad.Index(), {}
    scan = make_doc("scan.pdf", "")
    scan["needs_ocr"] = True
    assert ad.ingest([scan], index, seen) == (0, 0)
    assert "scan.pdf" not in seen


# ---------------------------------------------------------------- clean + chunk
def test_clean_and_scrub():
    assert ad.clean("exam-\nple  text\n\n\n\nnext") == "example text\n\nnext"
    assert "[email removed]" in ad.scrub_pii("mail a.b@x.com now")


def sentences_of(text):
    return {s for p in text.split("\n\n") for s in ad._SENTENCE.split(p.strip()) if s}


def test_chunk_size_limit_overlap_and_clean_boundaries():
    rng = random.Random(7)
    words = "alpha beta gamma delta epsilon leave policy travel claim review".split()
    for _ in range(40):
        paras = []
        for _ in range(rng.randint(1, 12)):
            sents = [" ".join(rng.choice(words) for _ in range(rng.randint(3, 10))).capitalize() + "."
                     for _ in range(rng.randint(1, 8))]
            paras.append(" ".join(sents))
        text = "\n\n".join(paras)
        max_chars, overlap = rng.choice([(300, 100), (500, 120), (1000, 150)])
        chunks = ad.chunk(text, max_chars, overlap)
        assert chunks and all(0 < len(c) <= max_chars for c in chunks), max(map(len, chunks))
        originals = sentences_of(text)
        for c in chunks:                                                # every chunk is whole sentences
            assert all(s in originals for s in ad._SENTENCE.split(c) if s), c[:80]
        covered = {s for c in chunks for s in ad._SENTENCE.split(c) if s}
        assert originals <= covered                                     # nothing is lost
        shared = sum(1 for a, b in zip(chunks, chunks[1:]) if ad._SENTENCE.split(b)[0] in ad._SENTENCE.split(a))
        if len(chunks) > 3:
            assert shared > 0                                           # the overlap really exists


def test_chunk_edge_cases():
    assert ad.chunk("") == []
    huge = ad.chunk("x" * 5000, 1000, 150)                              # one giant "sentence" terminates
    assert len(huge) >= 5 and all(len(c) <= 1000 for c in huge)
    with pytest.raises(ValueError):
        ad.chunk("text", 100, 100)
    one = ad.make_chunks(make_doc("d", "Short document."))
    assert one[0]["chunk_id"] == "d#0" and one[0]["doc_id"] == "d" and one[0]["allowed_groups"] == ["all-staff"]


def test_parent_child_and_contextual(stub_llm):
    doc = make_doc("d", " ".join(f"Sentence number {i} about leave." for i in range(200)))
    rows = ad.build_parent_child(doc)
    assert rows and all(len(r["search_text"]) <= 500 and len(r["text"]) <= 2400 for r in rows)
    assert len({r["payload_id"] for r in rows}) < len(rows)              # several children per parent
    assert ad.add_context("whole doc", "a chunk").endswith("a chunk")


# ---------------------------------------------------------------- index
def test_index_dense_sparse_and_punctuation():
    index = build_index()
    dense = index.dense("how long is parental leave")
    sparse = index.sparse("how long is parental leave")
    assert dense and sparse
    top = index.chunks[max(sparse, key=sparse.get)]
    assert top["doc_id"] == "leave.md"
    assert index.sparse("parental leave?") == index.sparse("parental leave")      # punctuation ignored
    assert index.sparse("zzzz qqqq") == {}


def test_upsert_and_delete():
    index = build_index()
    before = index.faiss.ntotal
    index.upsert_doc("leave.md", ad.make_chunks(make_doc("leave.md", "Parental leave is now 30 weeks.")))
    assert index.faiss.ntotal == before - len(ad.make_chunks(make_doc("leave.md", CORPUS["leave.md"]))) + 1
    texts = [c["text"] for c in index.chunks.values() if c["doc_id"] == "leave.md"]
    assert texts == ["Parental leave is now 30 weeks."]
    assert index.delete_doc("leave.md") == 1 and index.delete_doc("leave.md") == 0
    assert all(c["doc_id"] != "leave.md" for c in index.chunks.values())
    assert all(index.chunks[i]["doc_id"] != "leave.md" for i in index.dense("parental leave"))
    assert all(index.chunks[i]["doc_id"] != "leave.md" for i in index.sparse("parental leave"))


def test_permission_filter_is_applied_inside_search_and_fails_closed():
    index = ad.Index()
    index.add(ad.make_chunks(make_doc("public.md", "The cafeteria opens at nine.", ("all-staff",))))
    index.add(ad.make_chunks(make_doc("board.md", "The cafeteria budget is secret board material.", ("board",))))
    index.add(ad.make_chunks({**make_doc("orphan.md", "The cafeteria orphan note."), "allowed_groups": []}))
    staff = index.allowed_ids({"all-staff"})
    board = index.allowed_ids({"board"})
    assert staff and board and not (staff & board)
    for method in (index.dense, index.sparse):
        got = {index.chunks[i]["doc_id"] for i in method("cafeteria", 10, staff)}
        assert got == {"public.md"}, (method.__name__, got)
    assert index.allowed_ids({"nobody"}) == set()
    assert index.dense("cafeteria", 10, set()) == {} and index.sparse("cafeteria", 10, set()) == {}
    assert "orphan.md" not in {index.chunks[i]["doc_id"] for i in (staff | board)}   # no groups = invisible
    assert index.allowed_ids(None) is None


def test_save_and_load_roundtrip(tmp_path):
    index = build_index()
    index.save(str(tmp_path))
    loaded = ad.Index.load(str(tmp_path))
    assert loaded.dense("parental leave") == pytest.approx(index.dense("parental leave"))
    assert loaded.sparse("parental leave") == index.sparse("parental leave")
    loaded.add(ad.make_chunks(make_doc("new.md", "A brand new document.")))          # ids keep counting
    assert len(loaded.chunks) == len(index.chunks) + 1


def test_ann_helpers_small_and_larger_corpus():
    rng = np.random.default_rng(0)
    for n in (50, 300, 2000):
        v = rng.random((n, 32)).astype("float32")
        faiss_norm = np.linalg.norm(v, axis=1, keepdims=True)
        v = v / faiss_norm
        ivf = ad.make_ivf(v)
        assert ivf.nlist <= max(1, n // 39)                              # no under-trained clusters
        _, ids = ivf.search(v[:1], 3)
        assert ids[0][0] != -1
        hnsw = ad.make_hnsw(v)
        _, ids = hnsw.search(v[:1], 3)
        assert ids[0][0] == 0


# ---------------------------------------------------------------- fusion and friends
def test_fusion_functions_and_empty_inputs():
    d, s = {1: 0.9, 2: 0.5}, {2: 12.0, 3: 7.0}
    assert ad.rrf(d, s)[0] == 2                                          # both lists like doc 2
    assert ad.rrf({}, {}) == []
    assert ad.minmax({}) == {}
    assert ad.minmax({7: 3.0}) == {7: 1.0}                               # a lone result keeps its score
    assert ad.minmax({1: 2.0, 2: 2.0}) == {1: 1.0, 2: 1.0}
    assert ad.weighted_fusion({1: 0.9}, {}, 0.6) == [1]                  # one retriever empty: no crash
    assert ad.weighted_fusion({}, {}, 0.6) == []
    assert ad.weighted_fusion(d, s, 1.0)[0] == 1 and ad.weighted_fusion(d, s, 0.0)[0] == 2
    assert ad.pick_alpha("ERR_CONN_RESET 0x80070005") == 0.25
    assert ad.pick_alpha("how do I handle a stressful coworker") == 0.7


def test_hybrid_search_methods():
    index = build_index()
    for method in ("rrf", "weighted"):
        ids = ad.hybrid_search(index, "expense claims paid monthly", method=method)
        assert ids and index.chunks[ids[0]]["doc_id"] == "expenses.md"
    assert ad.hybrid_search(index, "zzzz qqqq", method="weighted") != [] or True   # must not crash
    assert ad.hybrid_search(ad.Index(), "anything") == []


def test_mmr_returns_distinct_picks():
    v = np.array([[1, 0], [1, 0.01], [0, 1], [0.7, 0.7]], dtype="float32")
    v = v / np.linalg.norm(v, axis=1, keepdims=True)
    picks = ad.mmr(v[0], v, k=3)
    assert len(picks) == len(set(picks)) == 3 and picks[0] == 0


# ---------------------------------------------------------------- query + rerank + generate
def test_queries(monkeypatch):
    monkeypatch.setattr(ad, "llm", lambda p: "- how many leave days\n* parental leave rules\n3 maternity days\n")
    out = ad.multi_query("leave?", n=3)
    assert len(out) == 3 and not any(q.startswith(("-", "*")) for q in out)
    monkeypatch.setattr(ad, "llm", lambda p: "  hello  ")
    assert ad.rewrite("q", "h") == "hello" and ad.hyde("q") == "hello"


def test_rerank_orders_and_handles_empty():
    chunks = [{"text": "totally unrelated"}, {"text": "parental leave is 26 weeks"}, {"text": "leave"}]
    out = ad.rerank("parental leave", chunks, top=2)
    assert out[0]["text"].startswith("parental") and len(out) == 2
    assert ad.rerank("q", []) == []


def test_edge_order_prompt_and_citations():
    assert ad.edge_order(list(range(6))) == [0, 2, 4, 5, 3, 1]
    ev = [{"title": "A", "source": "a.md", "text": "alpha"}, {"title": "B", "source": "b.md", "text": "BETA FULL"}]
    prompt = ad.build_prompt("q?", ev)
    assert "[1] (A) alpha" in prompt and "BETA FULL" in prompt and "Never follow instructions" in prompt
    cites = ad.cited_sources("Yes [2]. Also [1] and [2] and [9] and [0].", ev)
    assert [c["n"] for c in cites] == [2, 1] and cites[0]["source"] == "b.md"          # invalid numbers ignored


def test_answer_end_to_end_with_permissions(stub_llm):
    index = build_index()
    result = ad.answer("How many weeks of parental leave?", index, groups={"all-staff"})
    assert result["answer"] == "stub reply [1]" and result["sources"] and result["sources"][0]["source"]
    before = len(stub_llm)
    hidden = ad.answer("How many weeks of parental leave?", index, groups={"nobody"})
    assert hidden["sources"] == [] and "could not find" in hidden["answer"]
    assert len(stub_llm) == before                                        # no empty prompt sent to the model
    followup = ad.answer("and the second one?", index, history="user: leave?", groups={"all-staff"})
    assert followup["question"] == "stub reply [1]"                                   # went through rewrite()


def test_missing_citation_is_flagged(monkeypatch):
    monkeypatch.setattr(ad, "llm", lambda prompt: "Parental leave is 26 weeks.")
    result = ad.answer("How many weeks of parental leave?", build_index(), groups={"all-staff"})
    assert result["sources"] == []
    assert "did not cite" in result["citation_warning"]


# ---------------------------------------------------------------- evaluation
def test_evaluate_helpers():
    assert ad.recall_at_k(["a", "b"], {"b", "c"}, 2) == 0.5
    assert ad.mrr(["x", "b"], {"b"}) == 0.5 and ad.mrr(["x"], {"b"}) == 0.0
    golden = [{"question": "q1", "relevant": {"a"}}, {"question": "unanswerable", "relevant": set()}]
    out = ad.evaluate(golden, lambda q: ["a", "z"], k=1)                              # no ZeroDivisionError
    assert out == {"recall@k": 1.0, "mrr": 1.0, "questions": 1}
    assert ad.evaluate([], lambda q: [], k=5)["questions"] == 0


# ---------------------------------------------------------------- web search
def test_web_answer(monkeypatch):
    monkeypatch.setattr(ad, "web_search", lambda q: ["https://a.test/1", "https://a.test/2", "https://a.test/3"])
    pages = {"https://a.test/1": "Parental leave law changed this year. It is now longer.",
             "https://a.test/2": None, "https://a.test/3": "Unrelated page about gardening tips."}
    monkeypatch.setattr(ad, "fetch_page", lambda u: None if pages[u] is None else make_doc(u, pages[u]))
    out = ad.web_answer("what is the latest parental leave law?")
    assert out["answer"] and out["sources"][0]["source"].startswith("https://a.test/")
    with pytest.raises(NotImplementedError):
        monkeypatch.undo()
        ad.web_search("x")


# ---------------------------------------------------------------- graph rag
def test_extract_triples_handles_fences_and_junk(monkeypatch):
    monkeypatch.setattr(ad, "llm", lambda p: '```json\n[["Acme","acquired","Beta"], ["bad"], [1,2,3], ["Beta","makes","widgets"]]\n```')
    assert ad.extract_triples("t") == [("Acme", "acquired", "Beta"), ("Beta", "makes", "widgets")]


def test_graph_pipeline(monkeypatch):
    def fake(prompt):
        if "triples" in prompt:
            return json.dumps([["Acme", "acquired", "Beta"], ["Beta", "makes", "widgets"], ["Acme", "based in", "Pune"],
                               ["Zed", "supplies", "Yan"], ["Yan", "sells to", "Xo"]])
        if prompt.startswith("Report:"):
            return "NONE" if "Zed" in prompt else "Acme owns Beta."
        return "stub reply"

    monkeypatch.setattr(ad, "llm", fake)
    graph = ad.build_graph([{"text": "x", "chunk_id": "c#0"}])
    assert graph.has_edge("acme", "beta") and graph.number_of_edges() == 5
    reports = ad.summarise_communities(graph)
    assert len(reports) >= 2
    assert ad.mentioned_entities(graph, "Who owns Beta and where is Acme?") == ["acme", "beta"]
    graph.add_edge("a", "tra", relation="r", source="s")
    assert ad.mentioned_entities(graph, "what is the policy on travel?") == []        # no substring false matches
    assert ad.local_search(graph, "tell me about Acme") == "stub reply"
    assert "No entity" in ad.local_search(graph, "something unrelated")
    assert ad.global_search(reports, "themes?") == "stub reply"
    assert "None of the" in ad.global_search(["Zed report"], "themes?")


# ---------------------------------------------------------------- agent
def run_agent(monkeypatch, decisions, tools, enough=False):
    seq = iter(decisions)

    def fake(prompt):
        if prompt.startswith("You answer questions using tools"):
            return next(seq)
        if "Do the notes contain enough" in prompt:
            return "YES" if enough else "NO"
        return "FINAL"

    monkeypatch.setattr(ad, "llm", fake)
    return ad.agent("q?", tools, max_steps=len(decisions))


def test_agent_survives_bad_model_output(monkeypatch):
    seen = []
    tools = {"search": lambda q: seen.append(q) or "result"}
    out = run_agent(monkeypatch, ["```json\n{\"action\":\"search\",\"input\":\"leave\"}\n```", "not json at all",
                                   '{"action":"rm -rf","input":"x"}', '{"action":"finish"}'], tools)
    assert out == "FINAL" and seen == ["leave"]                           # ran the real tool, nothing invented


def test_agent_tool_failure_and_early_stop(monkeypatch):
    def broken(q):
        raise TimeoutError("slow")

    assert run_agent(monkeypatch, ['{"action":"web","input":"x"}', '{"action":"web","input":"y"}'], {"web": broken}) == "FINAL"
    calls = []
    tools = {"search": lambda q: calls.append(q) or "good"}
    run_agent(monkeypatch, ['{"action":"search","input":"a"}', '{"action":"search","input":"b"}'], tools, enough=True)
    assert calls == ["a"]                                                  # stopped once the grader said enough


# ---------------------------------------------------------------- command line
def test_cli_ingest_then_ask(tmp_path, monkeypatch, capsys):
    folder = tmp_path / "docs"
    folder.mkdir()
    for name, text in CORPUS.items():
        (folder / name).write_text(text, encoding="utf-8")
    out = tmp_path / "idx"
    ad.main(["ingest", str(folder), "--out", str(out)])
    assert "indexed 5 documents" in capsys.readouterr().out
    ad.main(["ingest", str(folder), "--out", str(out)])                    # second run: nothing changed
    assert "indexed 0 documents" in capsys.readouterr().out
    ad.main(["ask", "How many weeks of parental leave?", "--index", str(out)])
    printed = capsys.readouterr().out
    assert "stub reply" in printed and "[1]" in printed


# ---------------------------------------------------------------- OCR
def test_scan_detection_text_blank_scan_and_mixed(tmp_path):
    from pypdf import PdfReader, PdfWriter

    make_text_pdf(tmp_path / "text.pdf")
    make_image_pdf(tmp_path / "scan.pdf")
    blank = PdfWriter()
    blank.add_blank_page(width=200, height=200)
    blank.write(str(tmp_path / "blank.pdf"))
    mixed = PdfWriter()
    for name in ("text.pdf", "scan.pdf"):
        for page in PdfReader(str(tmp_path / name)).pages:
            mixed.add_page(page)
    mixed.write(str(tmp_path / "mixed.pdf"))

    assert ad.read_pdf(tmp_path / "text.pdf")[1] == []                  # typed text: nothing to OCR
    assert ad.read_pdf(tmp_path / "scan.pdf")[1] == [0]                 # image only: needs OCR
    assert ad.read_pdf(tmp_path / "blank.pdf")[1] == []                 # an empty page is not a scan
    texts, scan_pages = ad.read_pdf(tmp_path / "mixed.pdf")
    assert scan_pages == [1] and "Parental leave" in texts[0]           # per-page, not per-file


def test_load_pdf_with_ocr_rereads_the_ocr_output(tmp_path, monkeypatch):
    make_image_pdf(tmp_path / "scan.pdf")
    make_text_pdf(tmp_path / "ocr-result.pdf")
    called = []
    monkeypatch.setattr(ad, "ocr_pdf", lambda p: called.append(p) or tmp_path / "ocr-result.pdf")
    plain = ad.load_pdf(tmp_path / "scan.pdf", "scan.pdf", ["g"])
    assert plain["needs_ocr"] and plain["scan_pages"] == [0] and not plain["ocr_applied"] and not called
    done = ad.load_pdf(tmp_path / "scan.pdf", "scan.pdf", ["g"], ocr=True)
    assert called and done["ocr_applied"] and not done["needs_ocr"] and "Parental leave" in done["text"]
    docs = ad.load_folder(str(tmp_path), ocr=True)
    assert {d["id"] for d in docs if d["ocr_applied"]} == {"scan.pdf"}


def test_ocr_pdf_calls_ocrmypdf_with_valid_arguments(tmp_path, monkeypatch):
    calls = {}
    fake = types.ModuleType("ocrmypdf")
    fake.ocr = lambda *a, **k: calls.update(args=a, kwargs=k)
    monkeypatch.setitem(sys.modules, "ocrmypdf", fake)
    out = ad.ocr_pdf(tmp_path / "scan.pdf", language="deu")
    assert out.name == "scan.pdf" and out.parent != tmp_path
    assert calls["kwargs"] == {"language": ["deu"], "skip_text": True, "deskew": True}
    monkeypatch.undo()
    try:
        import inspect
        import ocrmypdf
    except ImportError:
        return
    # the real function accepts exactly the call we make
    inspect.signature(ocrmypdf.ocr).bind(Path("a.pdf"), Path("b.pdf"), language=["eng"], skip_text=True, deskew=True)


TSV = "\t".join(["level", "page_num", "block_num", "par_num", "line_num", "word_num", "left", "top", "width", "height", "conf", "text"])


def tsv_row(level, conf, text):
    return "\t".join([str(level), "1", "1", "1", "1", "1", "0", "0", "10", "10", str(conf), text])


def test_ocr_quality_from_tesseract_tsv():
    tsv = "\n".join([TSV, tsv_row(1, -1, ""), tsv_row(4, -1, ""), tsv_row(5, 96.5, "The"), tsv_row(5, 90.0, "quick"),
                      tsv_row(5, 30.0, "bnown"), tsv_row(5, 40.0, "f0x"), tsv_row(5, 55.0, "   ")])
    q = ad.ocr_quality(tsv)
    assert q["words"] == 4 and q["mean_conf"] == pytest.approx((96.5 + 90 + 30 + 40) / 4)
    assert q["low_conf_share"] == 0.5
    assert ad.ocr_quality("") == {"words": 0, "mean_conf": 0.0, "low_conf_share": 1.0}


def test_tesseract_tsv_command(monkeypatch):
    seen = {}

    def fake_run(cmd, **kwargs):
        seen["cmd"], seen["kwargs"] = cmd, kwargs
        return types.SimpleNamespace(stdout="tsv output")

    monkeypatch.setattr(ad.subprocess, "run", fake_run)
    assert ad.tesseract_tsv("page.png", "eng") == "tsv output"
    assert seen["cmd"] == ["tesseract", "page.png", "-", "-l", "eng", "tsv"] and seen["kwargs"]["check"] is True


# ---------------------------------------------------------------- search one thing, return another
def test_surfaces_and_dedupe(monkeypatch):
    base = {"chunk_id": "d#0", "doc_id": "d", "text": "Parental leave is 26 weeks.", "title": "T", "source": "s", "allowed_groups": ["g"]}
    monkeypatch.setattr(ad, "llm", lambda p: "- How long is parental leave?\n* Who gets leave?\n")
    qs = ad.question_surfaces(base)
    recs = ad.surface_records(base, qs, "q")
    assert [r["search_text"] for r in recs] == qs and {r["payload_id"] for r in recs} == {"d#0"}
    assert len({r["chunk_id"] for r in recs}) == len(recs) and all(r["text"] == base["text"] for r in recs)
    assert len(ad.dedupe_payloads(recs)) == 1
    monkeypatch.setattr(ad, "llm", lambda p: '```json\n["Leave is 26 weeks.", 5, "Carers get leave."]```')
    assert ad.proposition_surfaces(base) == ["Leave is 26 weeks.", "Carers get leave."]
    monkeypatch.setattr(ad, "llm", lambda p: '{"not": "a list"}')
    assert ad.proposition_surfaces(base) == []
    monkeypatch.setattr(ad, "llm", lambda p: " One sentence. ")
    assert ad.summary_surface(base) == ["One sentence."]


def test_search_surface_is_indexed_but_payload_is_returned():
    index = build_index()                              # BM25 needs a few documents to weigh words
    chunk_ = {"chunk_id": "d#0", "doc_id": "d", "text": "Staff receive twenty six weeks away from work after a birth.",
              "title": "T", "source": "s", "allowed_groups": ["g"]}
    index.add(ad.surface_records(chunk_, ["How long is parental leave?", "Maternity and paternity rules"], "q"))
    hits = index.sparse("parental leave")
    best = index.chunks[max(hits, key=hits.get)]
    assert best["search_text"].startswith("How long")                                  # matched on the question...
    assert best["text"].startswith("Staff receive") and "parental" not in best["text"]  # ...returned the passage
    raw = [index.chunks[i] for i in index.dense("parental leave", 8)]
    unique = ad.dedupe_payloads(raw)
    assert sum(c.get("payload_id") == "d#0" for c in raw) == 2           # both question surfaces were retrieved...
    assert sum(c.get("payload_id") == "d#0" for c in unique) == 1        # ...and collapse into one result
    assert len({c.get("payload_id", c["chunk_id"]) for c in unique}) == len(unique)


def test_sentence_window_records():
    doc = make_doc("d", "One is here. Two is here. Three is here. Four is here.")
    recs = ad.sentence_window_records(doc, window=1)
    assert [r["search_text"] for r in recs] == ["One is here.", "Two is here.", "Three is here.", "Four is here."]
    assert recs[1]["text"] == "One is here. Two is here. Three is here." and recs[0]["text"] == "One is here. Two is here."
    assert len({r["payload_id"] for r in recs}) == 4


def test_answer_dedupes_children_of_the_same_parent(stub_llm):
    index = ad.Index()
    doc = make_doc("handbook.md", " ".join(f"Parental leave rule {i} applies to carers." for i in range(120)))
    index.add(ad.build_parent_child(doc))
    ad.answer("parental leave rules", index, groups={"all-staff"}, top=5)
    prompt = stub_llm[-1]
    assert prompt.count("(handbook.md)") == len({r["payload_id"] for r in ad.build_parent_child(doc)}) or prompt.count("(handbook.md)") <= 5
    texts = re.findall(r"\[\d+\] \(handbook.md\) (.*)", prompt)
    assert len(texts) == len(set(texts))                                    # no parent shown twice


def test_index_add_validates_vector_shape_and_accepts_precomputed():
    index = ad.Index()
    chunks = [{"chunk_id": "a#0", "doc_id": "a", "text": "alpha", "title": "a", "source": "a", "allowed_groups": ["g"]}]
    with pytest.raises(ValueError):
        index.add(chunks, np.zeros((2, index.dim), dtype="float32"))
    vec = index.embedder.encode(["alpha"], normalize_embeddings=True)
    index.add(chunks, vec)
    assert index.faiss.ntotal == 1 and index.dense("alpha")


def test_index_accepts_either_dimension_method_name():
    class New:
        def get_embedding_dimension(self): return 8
        def encode(self, texts, **kw): return np.ones((len(texts), 8), dtype="float32")

    class Old:
        def get_sentence_embedding_dimension(self): return 8
        def encode(self, texts, **kw): return np.ones((len(texts), 8), dtype="float32")

    assert ad.Index(embedder=New()).dim == 8 and ad.Index(embedder=Old()).dim == 8


# ---------------------------------------------------------------- late chunking
BERLIN = ("Berlin is the capital and largest city of Germany, both by area and by population. "
          "Its more than 3.85 million inhabitants make it the European Union's most populous city, "
          "as measured by population within city limits. "
          "The city is also one of the states of Germany, and is the third smallest state in the country in terms of area.")


def test_chunk_spans_cover_the_text_on_sentence_boundaries():
    spans = ad.chunk_spans(BERLIN, max_chars=150)
    assert len(spans) == 3 and all(s < e for s, e in spans)
    assert [BERLIN[s:e].strip()[-1] for s, e in spans] == [".", ".", "."]          # each ends a sentence
    assert all(b[0] >= a[1] for a, b in zip(spans, spans[1:]))                      # no overlap
    assert len(ad.chunk_spans(BERLIN, max_chars=10000)) == 1                        # big limit: one span
    assert ad.chunk_spans("") == []


@pytest.fixture(scope="module")
def late():
    pytest.importorskip("torch")
    pytest.importorskip("transformers")
    if sentence_transformers_is_stub():
        pytest.skip("needs the real transformers models")
    return ad.LateChunker("sentence-transformers/all-MiniLM-L6-v2", max_tokens=512, overlap_tokens=64)


def sentence_transformers_is_stub():
    return getattr(sys.modules.get("sentence_transformers"), "__file__", None) is None


def test_late_chunking_reproduces_the_berlin_effect(late):
    spans = ad.chunk_spans(BERLIN, max_chars=150)
    late_vecs = late.embed(BERLIN, spans)
    naive_vecs = np.stack([late.embed(BERLIN[s:e], [(0, e - s)])[0] for s, e in spans])
    query = late.encode(["Berlin"])[0]
    assert np.allclose(np.linalg.norm(late_vecs, axis=1), 1, atol=1e-4)
    late_sim, naive_sim = late_vecs @ query, naive_vecs @ query
    # sentences that never name the city gain a lot once they are embedded in context (paper, Table 1)
    assert late_sim[1] > naive_sim[1] + 0.05 and late_sim[2] > naive_sim[2] + 0.05
    assert late_sim[0] > naive_sim[0] - 0.1                                          # the sentence naming it stays close


def test_long_late_chunking_uses_overlapping_windows(late, monkeypatch):
    long_text = " ".join(f"Sentence number {i} says something about parental leave in the handbook." for i in range(40))
    chunker = ad.LateChunker("sentence-transformers/all-MiniLM-L6-v2", max_tokens=64, overlap_tokens=24)
    windows = chunker._windows(chunker.tokenizer(long_text, add_special_tokens=False)["input_ids"])
    assert len(windows) > 3 and all(b - a <= 62 for a, b, _ in windows)
    assert all(windows[i + 1][0] < windows[i][1] for i in range(len(windows) - 1))        # windows overlap
    spans = ad.chunk_spans(long_text, max_chars=200)
    vecs = chunker.embed(long_text, spans)
    assert vecs.shape == (len(spans), chunker.dim) and np.isfinite(vecs).all()
    assert np.allclose(np.linalg.norm(vecs, axis=1), 1, atol=1e-4)
    with pytest.raises(ValueError):
        chunker.embed(long_text, [(0, len(long_text))])                                  # a chunk bigger than any window
    with pytest.raises(ValueError):
        chunker.embed("", [(0, 0)])
    with pytest.raises(ValueError):
        ad.LateChunker("sentence-transformers/all-MiniLM-L6-v2", max_tokens=32, overlap_tokens=30)


def test_late_chunks_plug_into_the_index(late):
    docs = {
        "berlin.md": BERLIN,
        "cooking.md": "Pasta needs salted boiling water. Stir it now and then. Drain it and add the sauce.",
        "finance.md": "Quarterly revenue grew three percent. Operating costs were flat. Margins improved slightly.",
    }
    index = ad.index_with_late_chunking([make_doc(k, v) for k, v in docs.items()], late, max_chars=150)
    assert index.embedder is late
    before = len(index.chunks)
    index = ad.index_with_late_chunking([make_doc(k, v) for k, v in docs.items()], late, max_chars=150)
    assert len(index.chunks) == before                                          # building twice never duplicates
    rebuilt = ad.index_with_late_chunking([make_doc("berlin.md", BERLIN)], late, max_chars=150)
    rebuilt.upsert_doc("berlin.md", ad.make_late_chunks(make_doc("berlin.md", BERLIN + " It has many museums."), late, 150)[0],
                       ad.make_late_chunks(make_doc("berlin.md", BERLIN + " It has many museums."), late, 150)[1])
    assert sum(c["doc_id"] == "berlin.md" for c in rebuilt.chunks.values()) == len(ad.chunk_spans(BERLIN + " It has many museums.", 150))
    ids = index.dense("how many people live in Berlin", 3)
    best = index.chunks[max(ids, key=ids.get)]
    assert best["doc_id"] == "berlin.md" and "inhabitants" in best["text"]
    assert index.allowed_ids({"all-staff"}) == set(index.chunks)
