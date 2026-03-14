import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const NODE_ENV = process.env.NODE_ENV ?? "development";

if (!MONGODB_URI) {
  // Keep API bootable for frontend-only deployments; DB-backed endpoints will return a clear error.
  console.warn("[server] Missing MONGODB_URI. Set it in your environment (.env / Vercel env vars).");
}

let dbReady = false;
let connectPromise = null;

function maskMongoUri(uri) {
  // Never leak credentials; show only the host + db for debugging.
  // mongodb+srv://user:pass@cluster.example.net/db?x=y -> mongodb+srv://***@cluster.example.net/db
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^@]+@)?([^/]+)(\/[^?]*)?/i);
  if (!m) return "mongodb://***";
  const proto = m[1];
  const host = m[3];
  const db = m[4] ?? "";
  return `${proto}***@${host}${db}`;
}

function mongoUriHasDbName(uri) {
  // Supports both mongodb+srv://... and mongodb://host1,host2/... (URL can't parse multi-host URIs reliably).
  const beforeQuery = uri.split("?")[0] ?? "";
  const slash = beforeQuery.lastIndexOf("/");
  if (slash === -1) return false;
  const db = beforeQuery.slice(slash + 1).trim();
  return db.length > 0;
}

mongoose.connection.on("connected", () => {
  dbReady = true;
});
mongoose.connection.on("disconnected", () => {
  dbReady = false;
});
mongoose.connection.on("error", () => {
  dbReady = false;
});

export async function ensureDb() {
  if (!MONGODB_URI) return { ok: false, error: "missing_mongodb_uri" };
  if (!mongoUriHasDbName(MONGODB_URI)) return { ok: false, error: "missing_db_name" };

  if (mongoose.connection.readyState === 1) {
    dbReady = true;
    return { ok: true };
  }

  if (!connectPromise) {
    connectPromise = mongoose
      .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
      .then(() => {
        dbReady = true;
        console.log("[server] Connected to MongoDB");
        return { ok: true };
      })
      .catch((err) => {
        dbReady = false;
        connectPromise = null;
        const msg = err?.message ?? String(err);
        console.error("[server] MongoDB connection failed:", msg);
        console.error("[server] MongoDB URI (masked):", maskMongoUri(MONGODB_URI));
        console.error(
          "[server] Common fixes: (1) URL-encode special chars in password, (2) include a db name, (3) allow your IP in Atlas Network Access.",
        );
        return { ok: false, error: "db_unavailable" };
      });
  }

  return connectPromise;
}

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    publishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const Post = mongoose.models.Post ?? mongoose.model("Post", postSchema);

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false },
);

const ContactMessage = mongoose.models.ContactMessage ?? mongoose.model("ContactMessage", contactSchema);

const siteSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    skills: { type: Object, default: {} },
    projects: { type: Array, default: [] },
    updatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

const Site = mongoose.models.Site ?? mongoose.model("Site", siteSchema);

const skillsSchema = z
  .record(z.string().min(1), z.array(z.string().min(1)).max(60))
  .refine((v) => Object.keys(v).length <= 30, { message: "too_many_groups" });

const projectSchema = z
  .object({
    slug: z.string().min(2).max(60),
    title: z.string().min(2).max(120),
    impactMetric: z.string().min(2).max(140),
    oneLiner: z.string().min(5).max(240),
    role: z.string().min(2).max(80),
    tech: z.array(z.string().min(1)).min(1).max(20),
    links: z
      .object({
        live: z.string().url().optional(),
        github: z.string().url().optional(),
      })
      .default({}),
    // Optional case study; if omitted the UI will still show the card but the case study modal should be disabled.
    caseStudy: z
      .object({
        problem: z.string().min(10).max(1200),
        constraints: z.array(z.string().min(2).max(220)).min(1).max(12),
        approach: z.array(z.string().min(2).max(220)).min(1).max(12),
        results: z.array(z.string().min(2).max(220)).min(1).max(12),
      })
      .optional(),
  })
  .strict();

const projectsSchema = z.array(projectSchema).max(40);

async function getSite() {
  const doc = await Site.findOne({ key: "main" }).lean();
  if (doc) return doc;
  const created = await Site.create({ key: "main", skills: {}, projects: [], updatedAt: new Date() });
  return created.toObject();
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return res.status(401).json({ error: "missing_token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.sub !== ADMIN_EMAIL) return res.status(403).json({ error: "forbidden" });
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function createApiApp() {
  const app = express();

  app.use(
    cors({
      origin: CLIENT_ORIGIN
        ? CLIENT_ORIGIN.split(",").map((s) => s.trim())
        : NODE_ENV === "production"
          ? false
          : true,
      credentials: true,
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: "200kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", async (req, res) => {
    // Best-effort: attempt a lazy connect so health reflects reality on serverless.
    await ensureDb();
    res.json({
      ok: true,
      nodeEnv: NODE_ENV,
      dbReady,
      mongo: {
        configured: Boolean(MONGODB_URI),
        hasDbName: MONGODB_URI ? mongoUriHasDbName(MONGODB_URI) : false,
        readyState: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
        name: mongoose.connection.name || null,
        uri: MONGODB_URI ? maskMongoUri(MONGODB_URI) : null,
      },
      auth: {
        adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
        jwtSecretSet: Boolean(process.env.JWT_SECRET) && JWT_SECRET !== "dev-secret-change-me",
      },
    });
  });

  app.get("/api/posts", async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const limit = Math.min(Number(req.query.limit ?? 12), 50);
    const posts = await Post.find({}, { title: 1, excerpt: 1, publishedAt: 1 })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      posts: posts.map((p) => ({
        id: String(p._id),
        title: p.title,
        excerpt: p.excerpt,
        date: new Date(p.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
      })),
    });
  });

  app.get("/api/posts/:id", async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "invalid_id" });
    const post = await Post.findById(id, { title: 1, body: 1, publishedAt: 1 }).lean();
    if (!post) return res.status(404).json({ error: "not_found" });
    res.json({
      id: String(post._id),
      title: post.title,
      body: post.body,
      date: new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
    });
  });

  app.get("/api/site/skills", async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const s = await getSite();
    res.json({ skills: s.skills ?? {} });
  });

  app.get("/api/site/projects", async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const s = await getSite();
    res.json({ projects: s.projects ?? [] });
  });

  app.post("/api/contact", async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });

    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(120),
      message: z.string().trim().min(10).max(4000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    await ContactMessage.create({ ...parsed.data, createdAt: new Date() });
    res.status(201).json({ ok: true });
  });

  app.post("/api/admin/login", async (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    const { email, password } = parsed.data;
    if (email !== ADMIN_EMAIL) return res.status(401).json({ error: "invalid_credentials" });

    const ok = ADMIN_PASSWORD_HASH ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH) : password === ADMIN_PASSWORD;
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = jwt.sign({ sub: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  });

  app.get("/api/admin/posts", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const posts = await Post.find({}).sort({ publishedAt: -1 }).lean();
    res.json({
      posts: posts.map((p) => ({
        id: String(p._id),
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        publishedAt: new Date(p.publishedAt).toISOString().slice(0, 10),
      })),
    });
  });

  app.post("/api/admin/posts", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const schema = z.object({
      title: z.string().min(2).max(120),
      excerpt: z.string().min(10).max(280),
      body: z.string().min(10).max(12_000),
      publishedAt: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    const created = await Post.create({
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      publishedAt: new Date(parsed.data.publishedAt + "T00:00:00.000Z"),
    });
    res.status(201).json({ id: String(created._id) });
  });

  app.put("/api/admin/posts/:id", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const schema = z.object({
      title: z.string().min(2).max(120),
      excerpt: z.string().min(10).max(280),
      body: z.string().min(10).max(12_000),
      publishedAt: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      {
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        body: parsed.data.body,
        publishedAt: new Date(parsed.data.publishedAt + "T00:00:00.000Z"),
      },
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.delete("/api/admin/posts/:id", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const deleted = await Post.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.get("/api/admin/site", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });
    const s = await getSite();
    res.json({ skills: s.skills ?? {}, projects: s.projects ?? [] });
  });

  app.put("/api/admin/site", requireAdmin, async (req, res) => {
    if (!MONGODB_URI) return res.status(500).json({ error: "missing_mongodb_uri" });
    if (!dbReady) await ensureDb();
    if (!dbReady) return res.status(503).json({ error: "db_unavailable" });

    const schema = z.object({
      skills: skillsSchema.optional(),
      projects: projectsSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    const update = {
      ...(parsed.data.skills ? { skills: parsed.data.skills } : {}),
      ...(parsed.data.projects ? { projects: parsed.data.projects } : {}),
      updatedAt: new Date(),
    };

    const updated = await Site.findOneAndUpdate({ key: "main" }, { $set: update }, { upsert: true, new: true }).lean();
    res.json({ ok: true, updatedAt: updated?.updatedAt ?? new Date() });
  });

  return { app };
}

