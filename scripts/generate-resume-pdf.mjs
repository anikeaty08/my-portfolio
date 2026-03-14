import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const root = process.cwd();
const mdPath = path.join(root, "public", "resume.md");
const outPath = path.join(root, "public", "resume.pdf");

function stripMd(md) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const md = await fs.promises.readFile(mdPath, "utf8");
  const text = stripMd(md);

  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    info: {
      Title: "Resume",
      Creator: "studio-portfolio build",
    },
  });

  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(22).text("Resume", { align: "left" });
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(11).fillColor("#111111").text(text, {
    align: "left",
    lineGap: 2,
  });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  console.log(`[resume] wrote ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error("[resume] failed to generate PDF:", err);
  process.exitCode = 1;
});
