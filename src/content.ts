import projectData from "./projects.json";
import skillData from "./skills.json";

// Featured projects and skills live in JSON so the Blender world build (scripts/blender/build_world.py)
// renders exactly the same content on the island.

export type Project = {
  slug: string;
  title: string;
  tagline: string;
  oneLiner: string;
  tech: string[];
  links: { live?: string; github?: string; npm?: string; pypi?: string };
  /** Accent for the project board, cards and panels. */
  color: string;
  caseStudy: { problem: string; approach: string[]; results: string[] };
};

export const projects = projectData as Project[];

export const person = {
  name: "Anikeat Yadav",
  first: "ANIKEAT",
  last: "YADAV",
  role: "Agentic AI & Full-Stack Developer",
  tagline: "I build AI agents that do real work — and the tools, protocols and guardrails that make them safe to trust.",
  location: "Bengaluru, India",
  status: "Open to opportunities",
  education: "B.E. AIML @ BMSIT · CGPA 8.85 · 2028",
  email: "aniketbxr1@gmail.com",
  github: "https://github.com/anikeaty08",
  githubHandle: "@anikeaty08",
};

export type Experience = { org: string; role: string; dates: string; points: string[] };

export const experience: Experience[] = [
  {
    org: "IEEE-CIS, BMSIT",
    role: "Organizing team",
    dates: "2025 – present",
    points: ["Organize hackathons and web-development tracks", "Support participants from onboarding to demo day"],
  },
];

export const about = {
  lead: "I build agentic systems end to end — the agent loop, the tools it calls, and the safety rails around it.",
  body: "Recent work spans AI developer tools, MCP servers that let agents use real services, and on-chain trust layers for autonomous agents. I also wrote an x86_64 kernel to understand how systems work underneath.",
  facts: [
    { k: "Public repositories", v: "50+" },
    { k: "Agentic projects", v: "5+" },
    { k: "Hackathon podium", v: "3rd" },
    { k: "CGPA", v: "8.85" },
  ],
  highlights: [
    "Built commit-orchestra, a fail-closed AI-agent Git CLI that reviews, commits and opens PRs",
    "Built MCP servers and CLIs that let AI agents use real-world services",
    "3rd rank — AI-based task scheduler at a technical event",
    "IEEE-CIS BMSIT — organizing hackathons (2025 – present)",
  ],
};

export const skills = (skillData as { group: string; color: string; items: string[] }[]).map((s) => ({ orbit: s.group, color: s.color, items: s.items }));
