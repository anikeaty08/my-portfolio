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
    "I work on planning, tool use, document reading, and the checks that help these systems run reliably.",
};

export const experience = {
  company: "Klar Data Labs",
  role: "AI Agent Engineer Intern",
  place: "Bengaluru, India",
  period: "Apr 2026 – Oct 2026",
  points: [
    "Worked on internal AI automation systems involving document preprocessing, OCR and vision model workflows.",
    "Built agent orchestration workflows using the OpenAI SDK/API for multi-step automation and tool-based execution.",
    "Developed ReAct agent workflows for reliable task execution and automation.",
    "Integrated Amazon Bedrock agents into internal AI workflows, focusing on agent coordination and tool execution.",
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
    kind: "Agent Monitoring & Evaluation Platform",
    period: "Sep 2026 – Present",
    summary: "A platform for seeing how AI agents work, finding failures, and measuring whether changes make them more reliable.",
    points: [
      "Tracks tool calls, execution traces, and outcomes across agent workflows.",
      "Runs evaluations and feeds the results back into development.",
    ],
    tags: ["Observability", "Evals", "Agents"],
    links: [{ label: "phigon.online", href: "https://phigon.online" }],
    featured: true,
  },
  {
    name: "Cortex",
    kind: "Windows Desktop AI Agent",
    period: "Apr 2026 – Present",
    summary: "A Windows desktop agent that turns plain language requests into actions on the computer, with controls you can follow.",
    points: [
      "Plans tasks and uses system tools to carry them out.",
      "Shows each step as it runs, with logs and user controls.",
    ],
    tags: ["Desktop", "LLM", "Tool use"],
    links: [{ label: "cortexpro.info", href: "https://cortexpro.info" }],
    featured: true,
  },
  {
    name: "AstraOS",
    kind: "x86_64 hobby operating system",
    summary:
      "A hobby operating system kernel built in C for x86_64, from boot to memory management and hardware interrupts.",
    points: [
      "Sets up paging, physical allocation, and a heap for kernel memory.",
      "Handles CPU exceptions and hardware interrupts through the PIC.",
    ],
    tags: ["C", "Kernel", "x86_64", "Limine"],
    links: [gh("os-kernel")],
    featured: true,
  },
  {
    name: "Quantum Drug Discovery",
    kind: "Hybrid Quantum Neural Network (HQNN)",
    summary:
      "A drug discovery platform that uses a hybrid quantum neural network to predict molecule properties and explore new candidates.",
    points: [
      "Compares quantum and classical predictions side by side.",
      "Connects molecule design, docking, and AI guided research with spending controls.",
    ],
    tags: ["HQNN", "RDKit", "FastAPI", "AWS"],
    links: [gh("hqnn")],
    featured: true,
  },
];

export const skills = [
  { group: "Languages", items: ["Python", "Java", "JavaScript", "TypeScript"] },
  { group: "AI / ML", items: ["PyTorch", "scikit-learn", "Pandas", "OCR", "RAG"] },
  { group: "AI Engineering", items: ["OpenAI SDK/API", "AWS", "Amazon Bedrock", "AI Agents"] },
  { group: "Backend", items: ["FastAPI", "Node.js", "REST APIs"] },
  { group: "Tools", items: ["Git", "Docker", "Linux"] },
];

export const education = {
  school: "BMS Institute of Technology & Management (BMSITM)",
  degree: "B.E. in Artificial Intelligence & Machine Learning",
  place: "Bengaluru, India",
  period: "Aug 2024 – May 2028",
  cgpa: "8.85 / 10.0",
};

export const leadership = {
  org: "IEEE Computer Society (CIS), BMSITM",
  role: "Core Team Member",
  period: "2024 – Present",
  points: [
    "Organized technical events, workshops and hackathons for the student community.",
    "Contributed to web development tracks and mentored peers on full-stack development.",
  ],
};
