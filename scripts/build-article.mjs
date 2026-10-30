// Builds the RAG article from its source.
//   src/data/rag-article.src.md  contains lines like  @@code:chunk@@
//   scripts/askdocs.py           contains regions     # [[region: chunk]] ... # [[end: chunk]]
// Pipeline snippets are copied from askdocs.py. The small first example is copied from
// first_rag.py. Both files and their tests are published for download.
// Run from the project root:  node scripts/build-article.mjs
import fs from "fs";

const py = fs.readFileSync("scripts/askdocs.py", "utf8").replace(/\r\n/g, "\n");
const regions = {};
for (const m of py.matchAll(/# \[\[region: (\w+)\]\]\n([\s\S]*?)# \[\[end: \1\]\]/g)) {
  regions[m[1]] = m[2].replace(/^\n+|\n+$/g, "");
}

let src = fs.readFileSync("src/data/rag-article.src.md", "utf8").replace(/\r\n/g, "\n");
const quickstart = fs.readFileSync("scripts/first_rag.py", "utf8").replace(/\r\n/g, "\n").trim();
if (!src.includes("@@quickstart@@")) throw new Error("missing quickstart marker");
src = src.replaceAll("@@quickstart@@", "```python\n" + quickstart + "\n```");
const used = new Set();
src = src.replace(/^@@code:(\w+)@@$/gm, (_, name) => {
  if (!(name in regions)) throw new Error(`unknown code region: ${name}`);
  used.add(name);
  return "```python\n" + regions[name] + "\n```";
});

const testCount = (fs.readFileSync("scripts/test_askdocs.py", "utf8").match(/^def test_/gm) || []).length;
src = src.replaceAll("@@TEST_COUNT@@", String(testCount));
const unused = Object.keys(regions).filter((r) => !used.has(r));
fs.writeFileSync("src/data/rag-article.md", src);
fs.mkdirSync("public/articles", { recursive: true });
fs.copyFileSync("scripts/askdocs.py", "public/articles/askdocs.py");
fs.copyFileSync("scripts/test_askdocs.py", "public/articles/test_askdocs.py");
fs.copyFileSync("scripts/first_rag.py", "public/articles/first_rag.py");
fs.copyFileSync("scripts/test_first_rag.py", "public/articles/test_first_rag.py");
fs.copyFileSync("scripts/rag_investigation.py", "public/articles/rag_investigation.py");
fs.copyFileSync("scripts/test_rag_investigation.py", "public/articles/test_rag_investigation.py");
fs.copyFileSync("scripts/model_evidence_run.py", "public/articles/model_evidence_run.py");
fs.copyFileSync("scripts/model-trace.txt", "public/articles/model-trace.txt");
console.log(`article built: ${src.length} chars, ${used.size} code regions used`);
if (unused.length) console.log("regions not shown in the article:", unused.join(", "));
