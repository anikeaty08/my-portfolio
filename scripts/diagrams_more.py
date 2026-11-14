"""The older RAG article diagrams, redrawn in the same black-and-white hand-drawn style.

Uses the Diagram class from make-diagrams.py, so the look is identical.
Run from the project root:  python scripts/diagrams_more.py
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location("kit", Path(__file__).with_name("make-diagrams.py"))
kit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kit)
Diagram, SOFT = kit.Diagram, kit.SOFT


def across(d, x1, x2, y, bend=-0.25, dashed=False):
    d.arrow(x1, y, x2, y, bend=bend, dashed=dashed)


def down(d, x, y1, y2, bend=0.12, dashed=False):
    d.arrow(x, y1, x, y2, bend=bend, dashed=dashed)


# ---------------------------------------------------------------------------
def rag_architecture():
    d = Diagram("rag-architecture", 1180, 480, "Where the two failures entered")
    d.text(40, 92, "BEFORE THE QUESTION: build the index", size=20)
    top = [("Rule pages\ncurrent + archived", ""), ("Status filter\nexclude the archive", "bold"),
           ("Clean and chunk\nkeep source IDs", ""), ("Search index\neligible evidence", "")]
    for i, (text, style) in enumerate(top):
        x = 40 + i * 290
        d.box(x, 115, 230, 100, text, size=18, style=style)
        if i < 3:
            across(d, x + 238, x + 282, 165)
    d.text(40, 282, "AFTER THE QUESTION: retrieve and answer", size=20)
    low = [("Student question\nsame meaning,\nnew words", ""), ("Rewrite query\nbridge the\nparaphrase", ""),
           ("Retrieve + rerank\ninspect candidate\nIDs", ""), ("Answer + citation\ncheck against\nthe source", "bold")]
    for i, (text, style) in enumerate(low):
        x = 40 + i * 290
        d.box(x, 315, 230, 120, text, size=18, style=style)
        if i < 3:
            across(d, x + 238, x + 282, 375)
    d.arrow(1020, 222, 740, 308, bend=-0.22)
    d.save()


def rag_retrieval():
    d = Diagram("rag-retrieval", 820, 800, "Search wide, then pick the best few")
    cx = 410
    d.box(cx - 100, 85, 200, 56, "Question", size=20)
    down(d, cx, 143, 188)
    d.box(cx - 100, 190, 200, 56, "Rewrite", size=20)
    d.arrow(cx - 40, 248, 205, 318, bend=0.06)
    d.arrow(cx + 40, 248, 615, 318, bend=-0.06)
    d.box(60, 320, 290, 64, "Dense: finds meaning", size=19)
    d.box(470, 320, 290, 64, "BM25: finds exact words", size=19)
    d.arrow(205, 386, cx - 40, 448, bend=0.06)
    d.arrow(615, 386, cx + 40, 448, bend=-0.06)
    d.box(cx - 120, 450, 240, 56, "Merge results", size=20)
    d.text(cx + 150, 478, "30 to 100 candidates", size=17, color=SOFT)
    down(d, cx, 508, 553)
    d.box(cx - 130, 555, 260, 56, "Rerank top candidates", size=20)
    d.text(cx + 160, 583, "cut down to about 5", size=17, color=SOFT)
    down(d, cx, 613, 658)
    d.box(cx - 150, 660, 300, 60, "Evidence for the answer", size=20, style="bold")
    d.text(cx, 765, "Wide first so the right chunk is not missed. Narrow second so the model is not flooded.", size=17, anchor="middle", color=SOFT)
    d.save()


def rag_triad():
    d = Diagram("rag-triad", 980, 600, "The evaluation triangle")
    d.box(390, 90, 200, 64, "Question", size=21)
    d.box(40, 400, 290, 70, "Retrieved context", size=21)
    d.box(650, 400, 290, 70, "Answer", size=21, style="bold")
    d.arrow(420, 160, 200, 394, bend=0.12)
    d.text(60, 250, "Context relevance\nWas the right material\nfound?", size=18)
    d.arrow(336, 438, 644, 438, bend=-0.2)
    d.text(490, 505, "Faithfulness\nIs the answer backed by the context?", size=18, anchor="middle")
    d.arrow(560, 160, 780, 394, bend=-0.12)
    d.text(760, 250, "Answer relevance\nDoes it address\nthe question?", size=18)
    d.text(490, 570, "Each edge asks a different question, so each can fail on its own.", size=18, anchor="middle", color=SOFT)
    d.save()


def chunking():
    d = Diagram("chunking", 1100, 520, "Three ways to cut a document")
    d.box(430, 85, 240, 62, "Long document", size=21)
    cols = [(60, "Fixed windows", "Small chunks\nwith overlap"),
            (410, "Parent and child", "Search the child,\nreturn the parent"),
            (760, "Semantic breaks", "Cut where the\ntopic changes")]
    for (x, name, result), bend in zip(cols, (0.08, 0.0, -0.08)):
        d.arrow(550, 150, x + 140, 232, bend=bend)
        d.box(x, 235, 280, 70, name, size=21)
        down(d, x + 140, 308, 372)
        d.box(x, 375, 280, 90, result, size=19, style="bold")
    d.text(550, 500, "No size is best for everyone. Read a few real chunks before you choose.", size=18, anchor="middle", color=SOFT)
    d.save()


def chunking_architectures():
    d = Diagram("chunking-architectures", 1000, 590, "Where the answer's context comes from")
    d.text(500, 88, "The same document can be indexed in four different ways.", size=19, anchor="middle", color=SOFT)
    rows = [("Naive chunks", "One vector per chunk"), ("Late chunking", "Context-aware chunk vectors"),
            ("Parent and child", "Search the child, return the parent"), ("Multiple views", "Search the views, return the passage")]
    for i, (a, b) in enumerate(rows):
        y = 120 + i * 115
        d.box(40, y, 330, 80, a, size=21)
        across(d, 380, 552, y + 40, bend=-0.12)
        d.box(560, y, 420, 80, b, size=19, style="bold")
    d.save()


def hybrid_fusion():
    d = Diagram("hybrid-fusion", 960, 900, "Combining dense and keyword rankings")
    cx = 480
    d.box(cx - 100, 85, 200, 56, "Question", size=20)
    down(d, cx, 143, 188)
    d.box(cx - 150, 190, 300, 56, "Route by query type", size=20)
    d.arrow(cx - 60, 248, 250, 318, bend=0.07)
    d.arrow(cx + 60, 248, 710, 318, bend=-0.07)
    d.box(110, 320, 280, 60, "Dense ranking", size=20)
    d.box(570, 320, 280, 60, "BM25 ranking", size=20)
    d.arrow(200, 382, 200, 510, bend=0.05)
    d.arrow(300, 382, 650, 508, bend=0.04)
    d.arrow(760, 382, 760, 510, bend=-0.05)
    d.arrow(660, 382, 310, 508, bend=-0.04)
    d.box(60, 512, 340, 66, "Reciprocal rank fusion\n(uses rank only)", size=19)
    d.box(540, 512, 360, 66, "Weighted normalized scores\n(uses score sizes)", size=19)
    d.arrow(230, 582, 440, 668, bend=0.07)
    d.arrow(730, 582, 520, 668, bend=-0.07)
    d.box(cx - 150, 670, 300, 60, "One candidate list", size=20, style="bold")
    down(d, cx, 732, 778)
    d.box(cx - 100, 780, 200, 56, "Rerank", size=20)
    d.text(cx, 874, "You pick one fusion method. The picture shows both so you can compare them.", size=17, anchor="middle", color=SOFT)
    d.save()


def lost_in_the_middle():
    d = Diagram("lost-in-the-middle", 1000, 560, "Evidence position can change answer quality")
    d.text(500, 88, "Models tend to use evidence near the start or the end more reliably.", size=19, anchor="middle", color=SOFT)
    base = 440
    d.line(120, base, 960, base)
    heights = [260, 190, 120, 190, 260]
    names = ["Beginning", "Early", "Middle", "Late", "End"]
    for i, (h, name) in enumerate(zip(heights, names)):
        x = 150 + i * 165
        d.box(x, base - h, 120, h, "", style="bold" if i in (0, 4) else ("dashed" if i == 2 else ""))
        d.text(x + 60, base + 22, name, size=19, anchor="middle")
    d.text(40, 150, "More\nreliable", size=18)
    d.text(40, 340, "Less\nreliable", size=18)
    d.text(540, 515, "Where the supporting passage appears in the prompt", size=18, anchor="middle", color=SOFT)
    d.save()


def late_chunking():
    d = Diagram("late-chunking", 1000, 700, "Late chunking keeps context")
    d.box(380, 85, 240, 62, "Whole document", size=21)
    d.arrow(450, 150, 250, 228, bend=0.1)
    d.arrow(550, 150, 760, 228, bend=-0.1)
    left = ["Encode the whole\ndocument first", "Token embeddings", "Pool into chunk vectors"]
    for i, t in enumerate(left):
        y = 235 + i * 105
        d.box(100, y, 300, 70, t, size=19)
        down(d, 250, y + 68, y + 103)
    d.box(100, 550, 300, 70, "Each chunk knows the\nsurrounding text", size=19, style="bold")
    right = ["Cut into chunks\nfirst", "Encode isolated chunks"]
    for i, t in enumerate(right):
        y = 235 + i * 105
        d.box(610, y, 300, 70, t, size=19)
        down(d, 760, y + 68, y + 103)
    d.box(610, 445, 300, 70, "The boundary may\nhide the meaning", size=19, style="dashed")
    d.save()


def ingestion_methods():
    d = Diagram("ingestion-methods", 1300, 640, "Many sources, one pipeline")
    sources = ["Files", "Apps + APIs", "Databases", "Web pages", "Audio + video"]
    for i, s in enumerate(sources):
        y = 90 + i * 76
        d.box(40, y, 200, 56, s, size=19)
        d.arrow(244, y + 28, 436, 270, bend=-0.08)
    d.box(440, 235, 220, 80, "Parse + clean", size=21, style="bold")
    across(d, 664, 756, 275, bend=-0.2)
    d.box(760, 235, 240, 80, "Metadata + access", size=20)
    across(d, 1004, 1076, 275, bend=-0.2)
    d.box(1080, 235, 180, 80, "Chunk + embed", size=19)
    d.text(1170, 345, "then saved in the index", size=16, anchor="middle", color=SOFT)
    d.box(40, 520, 280, 70, "Live web search", size=20, style="dashed")
    across(d, 326, 436, 555, bend=-0.2, dashed=True)
    d.box(440, 520, 340, 70, "Question-time evidence", size=20, style="dashed")
    d.text(810, 555, "skips the index, used only when the question arrives", size=17, color=SOFT)
    d.save()


def multi_representation():
    d = Diagram("multi-representation", 1200, 600, "Many search views, one source")
    d.box(40, 245, 240, 90, "Original passage", size=21, style="bold")
    views = ["Child chunk", "Summary", "Likely question", "Proposition"]
    for i, v in enumerate(views):
        y = 100 + i * 118
        d.arrow(284, 290, 436, y + 28, bend=-0.08)
        d.box(440, y, 240, 56, v, size=19)
        d.arrow(684, y + 28, 836, 290, bend=-0.08)
    d.box(840, 245, 150, 90, "Search\nindex", size=20)
    across(d, 994, 1056, 290, bend=-0.2)
    d.box(1060, 245, 120, 90, "Return\noriginal", size=18, style="bold")
    d.text(600, 570, "Many views help the search. The model still reads the original passage.", size=18, anchor="middle", color=SOFT)
    d.save()


def encoders():
    d = Diagram("encoders", 1100, 620, "Three ways to score a match")
    d.box(240, 85, 200, 56, "Question", size=20)
    d.box(660, 85, 200, 56, "Document", size=20)
    xs = [60, 410, 760]
    names = ["Bi-encoder", "Cross-encoder", "Late interaction"]
    outs = ["Two separate vectors,\ncompare with cosine.\nFast.", "Read the pair together.\nMore precise,\nslower.", "One vector per word,\nscore with MaxSim.\nLarge index."]
    for x, name, out in zip(xs, names, outs):
        d.box(x, 270, 280, 66, name, size=21)
        d.arrow(340 if x < 700 else 340, 143, x + 100, 266, bend=0.04)
        d.arrow(760, 143, x + 180, 266, bend=-0.04)
        down(d, x + 140, 338, 400)
        d.box(x, 402, 280, 110, out, size=18, style="bold")
    d.text(550, 580, "Fast first-stage search uses the bi-encoder. The cross-encoder is saved for a short list.", size=18, anchor="middle", color=SOFT)
    d.save()


def ann_indexes():
    d = Diagram("ann-indexes", 960, 760, "Search at scale: HNSW and IVF")
    d.box(380, 85, 200, 58, "Query vector", size=20)
    d.arrow(430, 146, 250, 220, bend=0.12)
    d.arrow(530, 146, 720, 220, bend=-0.12)
    left = ["HNSW: start at the\nsparse top layer", "Jump toward nearby points", "Descend to denser layers"]
    for i, t in enumerate(left):
        y = 225 + i * 120
        d.box(70, y, 360, 70, t, size=19)
        down(d, 250, y + 68, y + 118)
    d.box(70, 585, 360, 70, "Nearby candidates", size=20, style="bold")
    right = ["IVF: find the\nnearest centroids", "Open only those clusters"]
    for i, t in enumerate(right):
        y = 225 + i * 120
        d.box(540, y, 360, 70, t, size=19)
        down(d, 720, y + 68, y + 118)
    d.box(540, 465, 360, 70, "Search the points inside", size=20, style="bold")
    d.text(480, 720, "Both skip most of the data, which is why they are fast. Both trade a little accuracy for speed.", size=17, anchor="middle", color=SOFT)
    d.save()


def web_search_rag():
    d = Diagram("web-search-rag", 960, 900, "Live web search as a source")
    x = 130
    steps = ["Question", "Search API", "Fetch pages", "Clean HTML", "Chunk + rank"]
    for i, t in enumerate(steps):
        y = 85 + i * 135
        d.box(x, y, 300, 66, t, size=21)
        if i < 4:
            down(d, x + 150, y + 68, y + 133)
    d.box(x, 760, 300, 70, "Answer with links", size=21, style="bold")
    down(d, x + 150, 693, 758)
    d.arrow(434, 388, 560, 388, bend=-0.2, dashed=True)
    d.box(564, 353, 340, 70, "Check trust\n+ freshness", size=19, style="dashed")
    d.arrow(434, 523, 560, 523, bend=-0.2, dashed=True)
    d.box(564, 488, 340, 70, "Ignore instructions\nwritten inside pages", size=19, style="dashed")
    d.save()


def crag_selfrag():
    d = Diagram("crag-selfrag", 1060, 760, "Two ways to check retrieval")
    d.box(430, 85, 200, 58, "Question", size=20)
    down(d, 530, 146, 190)
    d.box(380, 192, 300, 62, "Retrieve passages", size=20)
    d.arrow(450, 256, 260, 330, bend=0.12)
    d.arrow(610, 256, 800, 330, bend=-0.12)
    d.box(70, 333, 380, 74, "Self-RAG: the model\ncriticizes itself", size=19)
    down(d, 260, 409, 460)
    d.box(70, 462, 380, 74, "It decides if more\nretrieval is needed", size=19)
    d.arrow(260, 538, 400, 640, bend=0.1)
    d.box(620, 333, 380, 74, "Corrective RAG:\ngrade the evidence", size=19)
    d.arrow(700, 409, 480, 640, bend=0.05)
    d.text(560, 520, "good", size=19, anchor="middle")
    d.arrow(920, 409, 920, 640, bend=0.08)
    d.text(950, 520, "weak", size=19)
    d.box(250, 642, 300, 70, "Answer from the sources", size=19, style="bold")
    d.box(780, 642, 240, 70, "Search again,\nor say 'not found'", size=18, style="dashed")
    d.save()


def raptor_tree():
    d = Diagram("raptor-tree", 1000, 900, "RAPTOR: retrieve at several levels")
    d.box(520, 80, 300, 60, "Original documents", size=19)
    down(d, 670, 142, 188)
    d.box(520, 190, 300, 60, "Leaf chunks", size=19)
    down(d, 670, 252, 298)
    d.box(520, 300, 300, 60, "Cluster related chunks", size=19)
    down(d, 670, 362, 408)
    d.box(520, 410, 300, 60, "Summaries", size=19)
    down(d, 670, 472, 518)
    d.box(520, 520, 300, 60, "Cluster the summaries", size=19)
    down(d, 670, 582, 628)
    d.box(520, 630, 300, 60, "Higher-level summaries", size=19)
    d.box(40, 520, 240, 60, "Question", size=20)
    d.box(120, 780, 460, 70, "Retrieve a leaf or a summary", size=21, style="bold")
    d.arrow(160, 584, 260, 776, bend=0.1)
    d.arrow(515, 220, 440, 776, bend=0.25)
    d.arrow(515, 440, 470, 776, bend=0.15)
    d.arrow(670, 692, 560, 776, bend=-0.15)
    d.text(40, 430, "Detail questions match a leaf.\nBig-picture questions\nmatch a summary.", size=17, color=SOFT)
    d.save()


def graph_rag():
    d = Diagram("graph-rag", 1200, 640, "Graph RAG follows links a passage search may miss")
    d.text(40, 96, "LOCAL QUESTION: Where is the company that Srushti's employer supplies?", size=20)
    names = ["Srushti", "Acme", "Zenith", "Pune"]
    edges = ["works at", "supplies", "is in"]
    for i, n in enumerate(names):
        x = 40 + i * 290
        d.box(x, 150, 200, 90, n, size=24, style="bold" if n == "Pune" else "")
        if i < 3:
            across(d, x + 208, x + 282, 195, bend=-0.2)
            d.text(x + 245, 128, edges[i], size=18, anchor="middle")
    d.text(40, 330, "GLOBAL QUESTION: What themes run through thousands of reports?", size=20)
    names = ["Reports", "Linked facts", "Related groups", "Theme summaries"]
    for i, n in enumerate(names):
        x = 40 + i * 290
        d.box(x, 385, 200, 90, n, size=20, style="bold" if i == 3 else "")
        if i < 3:
            across(d, x + 208, x + 282, 430, bend=-0.2)
    d.text(600, 560, "Local questions follow a chain of links. Global questions summarize groups of facts.", size=19, anchor="middle")
    d.text(600, 596, "Both cost more to build than plain search, so try plain search first.", size=17, anchor="middle", color=SOFT)
    d.save()


def agentic_rag():
    d = Diagram("agentic-rag", 1000, 920, "Agentic RAG chooses what to read next")
    d.box(300, 85, 400, 84, "Compare our exam rule\nwith the university circular", size=20)
    down(d, 500, 171, 218)
    d.box(330, 220, 340, 72, "Choose the next\nread-only tool", size=20, style="bold")
    d.arrow(420, 294, 250, 372, bend=0.1)
    d.arrow(580, 294, 750, 372, bend=-0.1)
    d.box(60, 375, 380, 84, "Search college rules\ncheck status and access", size=19)
    d.box(560, 375, 380, 84, "Search university site\ncheck date and terms", size=19)
    d.arrow(250, 462, 420, 548, bend=0.1)
    d.arrow(750, 462, 580, 548, bend=-0.1)
    d.box(330, 550, 340, 84, "Compare both sources\nis anything missing?", size=19)
    d.arrow(680, 600, 900, 470, bend=0.35, dashed=True)
    d.text(790, 640, "If incomplete,\nsearch again", size=17, color=SOFT)
    down(d, 500, 636, 700)
    d.box(300, 702, 400, 84, "Answer with both links,\nor state the gap", size=19, style="bold")
    d.text(500, 850, "A step limit stops the loop. The agent only gets read-only tools.", size=18, anchor="middle", color=SOFT)
    d.save()


def debug_ladder():
    d = Diagram("debug-ladder", 880, 940, "Debug from the source toward the model")
    steps = ["1  Parse: is the text there?", "2  Recall: was the page found?", "3  Ranking: is it near the top?",
             "4  Context: did the prompt keep it?", "5  Model: did the answer follow it?"]
    for i, t in enumerate(steps):
        y = 90 + i * 135
        d.box(160, y, 560, 70, t, size=21)
        d.arrow(440, y + 72, 440, y + 132, bend=0.1)
    d.box(160, 770, 560, 80, "Fix the first broken step", size=22, style="bold")
    d.text(130, 118, "start\nhere", size=17, anchor="end", color=SOFT)
    d.text(440, 900, "Changing the prompt cannot help if the right page never reached the model.", size=18, anchor="middle", color=SOFT)
    d.save()


if __name__ == "__main__":
    for build in (rag_architecture, rag_retrieval, rag_triad, chunking, chunking_architectures, hybrid_fusion,
                  lost_in_the_middle, late_chunking, ingestion_methods, multi_representation, encoders,
                  ann_indexes, web_search_rag, crag_selfrag, raptor_tree, graph_rag, agentic_rag, debug_ladder):
        build()
