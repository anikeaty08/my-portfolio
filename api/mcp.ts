/**
 * MCP server for this portfolio (Streamable HTTP transport, stateless JSON responses).
 * Point any MCP client — Claude, ChatGPT connectors, Cursor, VS Code — at https://anikeaty08.tech/api/mcp
 * and ask about Anikeat's projects, skills or how to get in touch.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import projects from "../src/projects.json" with { type: "json" }; // attribute required: Vercel runs this as plain ESM
import skills from "../src/skills.json" with { type: "json" };

type Json = Record<string, unknown>;
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Json };

const PROFILE = {
  name: "Anikeat Yadav",
  role: "Agentic AI & Full-Stack Developer",
  location: "Bengaluru, India",
  status: "Open to opportunities",
  education: "B.E. AIML @ BMSIT · CGPA 8.85 · 2028",
  summary: "Builds AI agents that do real work — and the tools, protocols and guardrails that make them safe to trust.",
  website: "https://www.anikeaty08.tech",
  github: "https://github.com/anikeaty08",
  email: "aniketbxr1@gmail.com",
};

const TOOLS = [
  { name: "get_profile", description: "Who Anikeat is: role, focus, education, location and availability.", inputSchema: { type: "object", properties: {} } },
  {
    name: "list_projects",
    description: "Featured projects with one-line summaries. Optionally filter by a technology or keyword (e.g. 'MCP', 'TypeScript', 'agents').",
    inputSchema: { type: "object", properties: { filter: { type: "string", description: "Technology or keyword to filter by" } } },
  },
  {
    name: "get_project",
    description: "Full case study for one project: problem, approach, results, stack and links.",
    inputSchema: { type: "object", properties: { slug: { type: "string", enum: projects.map((p) => p.slug) } }, required: ["slug"] },
  },
  { name: "get_skills", description: "Skills grouped by area (languages, AI & agents, web, web3, systems).", inputSchema: { type: "object", properties: {} } },
  { name: "get_contact", description: "How to reach Anikeat about roles or collaborations.", inputSchema: { type: "object", properties: {} } },
];

function text(value: unknown) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function callTool(name: string, args: Json) {
  switch (name) {
    case "get_profile":
      return text(PROFILE);
    case "list_projects": {
      const f = String(args.filter ?? "").toLowerCase();
      const list = projects
        .filter((p) => !f || [p.title, p.tagline, p.oneLiner, ...p.tech].join(" ").toLowerCase().includes(f))
        .map((p) => ({ slug: p.slug, title: p.title, tagline: p.tagline, summary: p.oneLiner, tech: p.tech, links: p.links }));
      return text(list.length ? list : `No featured project matches "${args.filter}".`);
    }
    case "get_project": {
      const p = projects.find((q) => q.slug === args.slug);
      if (!p) return { ...text(`Unknown project "${args.slug}". Use list_projects to see slugs.`), isError: true };
      return text(p);
    }
    case "get_skills":
      return text(skills);
    case "get_contact":
      return text({ email: PROFILE.email, github: PROFILE.github, website: PROFILE.website, note: "Replies usually within a day." });
    default:
      return null;
  }
}

function handle(msg: Rpc): Json | null {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined) return null; // notifications (e.g. notifications/initialized) get no response
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "anikeat-portfolio", version: "1.0.0" },
        instructions: "Answer questions about Anikeat Yadav's work. Start with get_profile or list_projects.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const result = callTool(String(msg.params?.name ?? ""), (msg.params?.arguments as Json) ?? {});
      return result ? reply(result) : fail(-32602, `Unknown tool: ${msg.params?.name}`);
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

async function readBody(req: IncomingMessage & { body?: unknown }) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

export default async function mcp(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version, mcp-session-id, authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST, OPTIONS");
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "This is an MCP endpoint. POST JSON-RPC 2.0 messages to it from an MCP client." }));
  }
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
  }
  const batch = Array.isArray(body);
  const responses = (batch ? (body as Rpc[]) : [body as Rpc]).map(handle).filter(Boolean);
  if (!responses.length) {
    res.statusCode = 202;
    return res.end();
  }
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(batch ? responses : responses[0]));
}
