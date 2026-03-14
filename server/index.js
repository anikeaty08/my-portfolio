import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiApp, ensureDb } from "./apiApp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 5174);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const { app } = createApiApp();

async function main() {
  await ensureDb();

  if (NODE_ENV === "production") {
    const dist = path.join(__dirname, "..", "dist");
    app.use(express.static(dist));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not_found" });
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.listen(PORT, () => console.log(`[server] Listening on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exitCode = 1;
});

