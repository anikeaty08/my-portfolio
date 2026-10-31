export const profile = {
  name: "Anikeat Yadav",
  role: "AI/ML Engineer",
  tagline: "AI Agents · Python",
  location: "Bengaluru, India",
  email: "aniketbxr1@gmail.com",
  phone: "+91 79034 22423",
  github: "https://github.com/anikeaty08",
  githubUser: "anikeaty08",
  linkedin: "https://linkedin.com/in/anikeat-yadav-9b0551338",
  intro:
    "I work on AI agents, tool orchestration, and the infrastructure behind them — building systems that can understand a task, take action, and deliver reliable results.",
};

export const experience = {
  company: "Klar Data Labs",
  role: "AI Agent Engineer Intern",
  place: "Bengaluru, India",
  period: "Apr 2026 – Oct 2026",
  points: [
    "Developed internal AI automation workflows involving document preprocessing, OCR, and vision-based extraction.",
    "Built multi-step agent workflows using the OpenAI SDK, integrating tools and structured execution paths.",
    "Implemented ReAct-based agents for reasoning, tool selection, and task execution.",
    "Integrated Amazon Bedrock Agents into internal workflows to support tool execution and agent coordination.",
  ],
};

export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  name: string;
  kind: string;
  period?: string;
  status?: string;
  summary: string;
  points?: string[];
  tags: string[];
  links: ProjectLink[];
  featured?: boolean;
}

const gh = (repo: string): ProjectLink => ({ label: "GitHub", href: `https://github.com/anikeaty08/${repo}` });

export const projects: Project[] = [
  {
    name: "Phigon",
    kind: "Agent Observability & Evaluation Platform",
    period: "Sep 2026 – Present",
    summary: "Building a platform to inspect AI agent execution, understand failures, and evaluate workflow reliability.",
    points: [
      "Captures tool calls, execution traces, and workflow outcomes.",
      "Provides evaluation workflows to identify regressions and track agent performance.",
      "Helps developers understand where an agent succeeds, fails, or behaves unexpectedly.",
    ],
    tags: ["Agent Observability", "Evaluations", "Execution Tracing"],
    links: [{ label: "phigon.online", href: "https://phigon.online" }],
    featured: true,
  },
  {
    name: "Cortex",
    kind: "Windows Desktop AI Agent",
    period: "Apr 2026 – Present",
    summary: "A desktop AI agent that translates natural-language instructions into actions across a Windows environment.",
    points: [
      "Plans and executes tasks through system-level tools.",
      "Provides step-by-step execution visibility, logs, and user controls.",
      "Connects language-model reasoning with practical desktop automation.",
    ],
    tags: ["Desktop Automation", "LLMs", "Tool Use"],
    links: [{ label: "cortexpro.info", href: "https://cortexpro.info" }],
    featured: true,
  },
  {
    name: "AstraOS",
    kind: "x86_64 Hobby Operating System",
    summary:
      "A C-based operating system kernel developed for x86_64, exploring the fundamentals of low-level systems programming.",
    points: [
      "Implements paging, physical memory allocation, and kernel heap management.",
      "Handles CPU exceptions and hardware interrupts.",
      "Built around the Limine boot protocol.",
    ],
    tags: ["C", "Operating Systems", "x86_64", "Limine"],
    links: [gh("os-kernel")],
    featured: true,
  },
  {
    name: "Quantum Drug Discovery",
    kind: "Hybrid Quantum Neural Network",
    summary:
      "Exploring hybrid quantum-classical machine learning for molecular property prediction and drug discovery.",
    points: [
      "Compares quantum and classical model predictions.",
      "Integrates molecular processing, docking, and AI-assisted candidate exploration.",
      "Combines RDKit, FastAPI, and AWS in the application workflow.",
    ],
    tags: ["Quantum ML", "RDKit", "FastAPI", "AWS"],
    links: [gh("hqnn")],
    featured: true,
  },
];

export const skills = [
  { group: "Languages", items: ["Python", "Java", "JavaScript", "TypeScript"] },
  { group: "AI / Machine Learning", items: ["PyTorch", "Scikit-learn", "Pandas", "OCR", "RAG"] },
  { group: "Agent Engineering", items: ["OpenAI SDK", "Amazon Bedrock", "Agent Orchestration", "Tool Calling"] },
  { group: "Backend & Cloud", items: ["FastAPI", "Node.js", "REST APIs", "AWS"] },
  { group: "Developer Tools", items: ["Git", "Docker", "Linux"] },
];

export const education = {
  school: "BMS Institute of Technology & Management (BMSITM)",
  degree: "B.E. in Artificial Intelligence & Machine Learning",
  place: "Bengaluru, India",
  period: "Aug 2024 – May 2028",
  cgpa: "8.85 / 10.0",
};

export const leadership = {
  org: "IEEE Computer Society, BMSITM",
  role: "Core Team Member",
  period: "2024 – Present",
  points: [
    "Help organize technical events, workshops, and hackathons for the student community.",
    "Contribute to development activities and support peers in full-stack projects.",
  ],
};
