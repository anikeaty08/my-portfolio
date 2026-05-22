import path from "node:path";
import express from "express";
import mongoose from "mongoose";
import { createApiApp, ensureDb } from "../server/apiApp.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing ADMIN_EMAIL or SMOKE_ADMIN_PASSWORD");
  process.exit(1);
}

const db = await ensureDb();
console.log(`ensureDb=${JSON.stringify(db)}`);

const { app } = createApiApp();
const dist = path.resolve("dist");

app.use(express.static(dist));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not_found" });
  res.sendFile(path.join(dist, "index.html"));
});

const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});

const base = `http://127.0.0.1:${server.address().port}`;

async function request(label, urlPath, options = {}) {
  const signal = AbortSignal.timeout(15_000);
  const res = await fetch(base + urlPath, { ...options, signal });
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  console.log(`${label}: ${res.status} ${contentType.split(";")[0]}`);
  if (!res.ok) console.log(`${label} body=${JSON.stringify(body)}`);
  return { res, body };
}

try {
  await request("home", "/");
  await request("admin-page", "/admin");
  await request("health", "/api/health");

  const login = await request("admin-login", "/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!login.res.ok) throw new Error("admin login failed");

  const headers = {
    authorization: `Bearer ${login.body.token}`,
    "content-type": "application/json",
  };

  const originalSite = await request("admin-site-get", "/api/admin/site", { headers });

  const project = {
    slug: "single-origin-smoke",
    title: "Single Origin Smoke",
    impactMetric: "API save check",
    oneLiner: "Temporary project used to verify deployed-style project updates.",
    role: "Tester",
    tech: ["React", "MongoDB"],
    links: {},
    coverImage: "/api/assets/0123456789abcdef01234567",
    screenshots: [{ src: "/api/assets/0123456789abcdef01234567", caption: "placeholder" }],
  };

  const save = await request("admin-site-put", "/api/admin/site", {
    method: "PUT",
    headers,
    body: JSON.stringify({ projects: [project], skills: { Testing: ["API", "MongoDB"] } }),
  });
  if (!save.res.ok) throw new Error("admin site save failed");

  const publicProjects = await request("public-projects", "/api/site/projects");
  console.log(
    `public-projects-count=${publicProjects.body.projects?.length ?? "n/a"} firstSlug=${
      publicProjects.body.projects?.[0]?.slug ?? ""
    }`,
  );

  await request("cleanup", "/api/admin/site", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      projects: originalSite.body.projects ?? [],
      skills: originalSite.body.skills ?? {},
    }),
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect().catch(() => {});
}
