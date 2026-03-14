export type Accent = "acid" | "ember";

export type SocialLinks = {
  github: string;
  email?: string;
  linkedin?: string;
  x?: string;
  website?: string;
};

export type Project = {
  slug: string;
  title: string;
  impactMetric: string;
  oneLiner: string;
  role: string;
  tech: string[];
  links: { live?: string; github?: string };
  caseStudy?: {
    problem: string;
    constraints: string[];
    approach: string[];
    results: string[];
  };
};

export type ExperienceItem = {
  company: string;
  role: string;
  dates: string;
  achievements: string[];
};

export type Post = {
  id?: string;
  title: string;
  date: string;
  excerpt: string;
  body?: string;
};

export const person = {
  name: "Anikeat Yadav",
  kicker: "Student / Developer",
  tagline: "I build ambitious systems with clean UI and real constraints.",
  bioLine: "Student builder working across Web3, agentic AI, and low-level systems - shipping with clarity and craft.",
  location: "Bengaluru, India / Open to internships",
  stats: [
    { label: "Years", value: "1+" },
    { label: "Projects", value: "16" },
    { label: "Focus", value: "Web3 / AI / Systems" },
  ],
};

export const socials: SocialLinks = {
  github: "https://github.com/anikeaty08",
  email: "aniketbxr1@gmail.com",
};

export const resumeLinks = {
  html: "/resume.html",
  pdf: "/resume.pdf",
} as const;

export const resumeSnapshot = {
  lastUpdated: "Mar 14, 2026",
  contact: {
    email: "aniketbxr1@gmail.com",
    githubLabel: "github.com/anikeaty08 (@anikeaty08)",
  },
  skillChips: [
    "Java",
    "Python",
    "JavaScript/TypeScript",
    "React",
    "Node.js",
    "Solidity (Polygon)",
    "ML: scikit-learn",
    "ML: PyTorch (basics)",
    "RAG + vector search",
  ],
  highlights: [
    "CGPA 8.85 in AIML (BMSIT), expected 2028.",
    "Built Web3 apps (Polygon) and agentic AI demos with clean UI and real integrations.",
    "3rd rank for an AI-based task scheduler in a competitive technical event.",
    "IEEE-CIS: organized hackathons and supported web development tracks (2025 - present).",
  ],
} as const;

export const projects: Project[] = [
  {
    slug: "polychat",
    title: "PolyChat — Privacy‑First Web3 Messaging",
    impactMetric: "Wallet auth + E2E encryption + IPFS storage",
    oneLiner: "A decentralized messaging app on Polygon with real-time chat, privacy controls, and modern UI.",
    role: "Builder (Full‑stack)",
    tech: ["Next.js 14", "TypeScript", "Socket.io", "Polygon", "IPFS", "Hardhat"],
    links: { live: "https://polychat-3-six.vercel.app/", github: "https://github.com/anikeaty08/polychat-3" },
    caseStudy: {
      problem:
        "I wanted a messaging product where identity is your wallet and privacy is the default—not an afterthought.",
      constraints: [
        "Secure, end-to-end encrypted messages (client-side cryptography)",
        "Real-time UX with durable states and clear privacy controls",
        "Decentralized media storage that doesn’t break the interface",
      ],
      approach: [
        "Implemented wallet authentication flows (MetaMask / WalletConnect)",
        "Used TweetNaCl-style E2E encryption patterns; stored encrypted payloads",
        "Added real-time transport with Socket.io and IPFS-backed uploads for media",
      ],
      results: [
        "Built a feature-rich chat surface: reactions, calls, privacy toggles, and responsive layouts",
        "Documented a full stack (frontend, API routes, contracts) with clear setup steps",
        "Deployed a live demo and kept the project iteration-friendly for hackathon timelines",
      ],
    },
  },
  {
    slug: "ragg",
    title: "raGG — Agentic RAG System",
    impactMetric: "Multi‑model routing + web search + streaming UI",
    oneLiner: "An agentic RAG stack with query planning, tool use, multi-hop retrieval, and production-ready controls.",
    role: "Builder (Full‑stack)",
    tech: ["Python", "FastAPI", "Qdrant", "Next.js", "Streaming", "Tavily/Google Search"],
    links: { live: "https://ra-gg.vercel.app", github: "https://github.com/anikeaty08/raGG" },
    caseStudy: {
      problem:
        "I wanted a practical RAG system that behaves like a real agent: plans, searches, uses tools, and verifies answers—not just a single prompt.",
      constraints: [
        "Support multiple model providers without rewriting the app",
        "Keep a clean, explainable UI for “agent thinking” and tool traces",
        "Add guardrails for rate limits, cost tracking, and errors",
      ],
      approach: [
        "Implemented query planning + multi-hop retrieval with re-ranking hooks",
        "Added web search tooling (Tavily primary, Google fallback) and a tool execution layer",
        "Built streaming responses and session management so the UI feels immediate",
      ],
      results: [
        "Shipped provider/model switching and a production-minded feature set (logging, metrics, cost tracking)",
        "Created ingestion routes for GitHub/PDF/URL sources and a structured API surface",
        "Kept the system readable: docs, env var references, and deploy notes",
      ],
    },
  },
  {
    slug: "equiclear",
    title: "EquiClear — ZK Dutch Auction Protocol",
    impactMetric: "Uniform clearing price + bidder privacy (Aleo)",
    oneLiner: "A privacy-preserving Dutch auction design with Leo contracts, a Rust indexer, and a Next.js frontend.",
    role: "Builder",
    tech: ["Aleo (Leo)", "Rust", "Next.js", "ZK concepts", "Indexer"],
    links: { live: "https://equi-clear.vercel.app", github: "https://github.com/anikeaty08/equiClear" },
    caseStudy: {
      problem:
        "Most auction flows leak bidder intent. I explored a protocol design that keeps bids private while keeping the outcome fair.",
      constraints: [
        "Bid amounts should remain private (zero-knowledge proof model)",
        "Fair pricing for winners via uniform clearing price",
        "Composable structure: contracts + indexer + frontend",
      ],
      approach: [
        "Structured contracts into focused modules (balance, auction, bid, claim)",
        "Implemented an off-chain indexer concept for tracking protocol state cleanly",
        "Built a frontend to make protocol actions understandable and testable",
      ],
      results: [
        "Delivered a clear repo layout and quick-start scripts for building and deploying",
        "Documented constraints and future cross-chain direction for follow-up iterations",
        "Deployed a live frontend for demo and feedback loops",
      ],
    },
  },
  {
    slug: "poolguard",
    title: "PoolGuard — AI Liquidity Pool Safety",
    impactMetric: "Risk scoring + on-chain analysis registry",
    oneLiner: "An AI-powered LP safety tool for Polygon: analyze pools, flag red signals, and surface safer entries.",
    role: "Builder",
    tech: ["Next.js 14", "TypeScript", "Gemini API", "Solidity", "Polygon"],
    links: { github: "https://github.com/anikeaty08/safeGuard" },
    caseStudy: {
      problem:
        "DeFi users need fast safety signals. I built a product-like interface that turns on-chain + AI analysis into readable decisions.",
      constraints: [
        "Make complex risk factors understandable in seconds",
        "Keep UX polished (glass + motion) without sacrificing clarity",
        "Integrate AI + smart contracts in a way that remains debuggable",
      ],
      approach: [
        "Designed two user modes (Safe vs Degen) to match user intent",
        "Added contract-side primitives for registry and analytics storage",
        "Built UI states for analysis results, alerts, and risk explanations",
      ],
      results: [
        "Shipped a demo-ready product surface with clear routes and feature documentation",
        "Implemented a full install/deploy flow with environment configuration guidance",
        "Created a foundation for adding more scanners (honeypot, lock checks, dev wallet tracking)",
      ],
    },
  },
  {
    slug: "astraos",
    title: "AstraOS — x86_64 Operating System",
    impactMetric: "Preemptive multitasking + VFS + FAT16 (read-only)",
    oneLiner: "A hobby OS kernel written in C: interrupts, paging, scheduler, drivers, and a built-in shell.",
    role: "Systems Builder",
    tech: ["C", "x86_64", "Limine", "Paging", "QEMU"],
    links: { github: "https://github.com/anikeaty08/os-kernel" },
    caseStudy: {
      problem:
        "I wanted to learn OS fundamentals by building them: boot, memory, interrupts, processes, drivers—end to end.",
      constraints: [
        "Architecture separation (x86_64 specifics in one place)",
        "Predictable, debuggable kernel subsystems over “magic” abstractions",
        "Enough tooling to run and iterate quickly (Make targets + QEMU)",
      ],
      approach: [
        "Implemented IDT/IRQ handling, PIC remap, serial debug output, and timer ticks",
        "Built memory managers (bitmap PMM + 4-level paging VMM) and a coalescing heap",
        "Added process control blocks and a round-robin scheduler with context switching",
      ],
      results: [
        "Shipped a readable kernel layout with docs and build/run recipes",
        "Implemented a command shell with utilities (ps, mem, ls, cat, uptime, shutdown)",
        "Created a foundation for future work (user mode, syscalls, ELF loader, SMP)",
      ],
    },
  },
  {
    slug: "ml-visualizer",
    title: "ml_visualizer — ML Plot Gallery",
    impactMetric: "82 static plots · 9 interactive · 10 math helpers",
    oneLiner: "A Python toolkit for ML/EDA visuals with zero-argument demo defaults and plug‑in sklearn support.",
    role: "Builder (Python)",
    tech: ["Python", "Matplotlib", "Seaborn", "Plotly", "scikit-learn"],
    links: { github: "https://github.com/anikeaty08/visualizer" },
    caseStudy: {
      problem:
        "Most ML plotting code is repetitive. I wanted a “one import, one function” toolkit that still stays customizable.",
      constraints: [
        "Every plot function should run with demo data (zero arguments)",
        "Functions must accept real data and sklearn models when provided",
        "Support static and interactive chart workflows",
      ],
      approach: [
        "Built a catalogue of plot_* utilities with consistent parameter patterns",
        "Added interactive iplot_* variants and graceful dependency checks",
        "Wrote a companion cookbook file to explain how plots work from scratch",
      ],
      results: [
        "Delivered a large, documented function set with an instant gallery mode",
        "Made debugging workflows faster (learning curves, ROC, bias/variance, clustering)",
        "Kept usage intentionally simple: import → call → see the graph",
      ],
    },
  },
];

export const about = {
  paragraphs: [
    "I’m a student who builds by shipping. I like projects that force tradeoffs: privacy vs UX, performance vs complexity, and interfaces that stay legible under pressure.",
    "I’m happiest at the boundary between systems and product: designing the grid, implementing the state model, and making the whole thing feel intentional.",
  ],
  values: [
    { title: "Clarity", body: "Make the system legible—naming, hierarchy, and states earn trust." },
    { title: "Speed", body: "Performance is a feature. Every interaction should feel immediate." },
    { title: "Craft", body: "Details matter: spacing, copy, focus rings, loading states." },
    { title: "Durability", body: "Ship patterns, not one-offs. Optimize for change." },
  ],
  toolset: ["React / Next.js", "TypeScript", "Python", "C", "Rust", "Solidity", "Web3 tooling", "Accessibility"],
};

export const experience: ExperienceItem[] = [
  {
    company: "Independent Projects",
    role: "Student Developer",
    dates: "2025 - Present",
    achievements: [
      "Built and published 16 public repos across Web3 apps, agentic RAG, and OS development.",
      "Shipped full-stack demos with real integrations (wallet auth, encryption, IPFS, search tools).",
      "Designed UIs with strong hierarchy, keyboard navigation, and clear system states.",
    ],
  },
  {
    company: "Hackathons / Sprints",
    role: "Builder",
    dates: "2026",
    achievements: [
      "Built Polygon-focused prototypes: privacy messaging (PolyChat) and LP risk analysis (PoolGuard).",
      "Delivered demo-ready documentation and setup flows for fast team iteration.",
      "Kept scope crisp: clear features, strong UX, and stable deployments for judging.",
    ],
  },
  {
    company: "Systems Learning Track",
    role: "OS / Low-level Builder",
    dates: "2025 - 2026",
    achievements: [
      "Built x86 kernels (AstraOS + huggingOs) to learn interrupts, memory, drivers, and scheduling.",
      "Documented build/run tooling (QEMU, bootloaders, Make targets) for repeatable iteration.",
      "Focused on readable subsystems and debuggability over \"magic\" solutions.",
    ],
  },
];

export const skills = {
  Frontend: ["React", "Next.js", "TypeScript", "Accessibility", "CSS systems", "Motion"],
  Backend: ["Node.js", "Python", "FastAPI", "MongoDB", "Vector DBs (Qdrant)", "Auth"],
  DevOps: ["Vercel deploys", "Docker basics", "GitHub Actions", "Linux/WSL", "Env management"],
  Design: ["UI hierarchy", "Typography", "Interaction design", "Design tokens", "Content-first UX"],
  "ML / AI": ["Python", "NumPy", "Pandas", "scikit-learn", "PyTorch (basics)", "RAG + vector search", "Evaluation"],
} as const;

export const posts: Post[] = [
  {
    title: "What OS dev taught me about UI states",
    date: "Mar 02, 2026",
    excerpt:
      "Interrupts, timers, and schedulers made me rethink “loading” and “responsiveness” on the web. This is how systems thinking improved my interfaces.",
    body:
      "Building kernels forced me to think in states, not vibes. A UI is basically a scheduler: events arrive, handlers run, and the system must stay readable.\n\nThe big lesson is that users do not experience your app as one timeline. They experience it as state transitions. The moment a request starts, the app owes them a visible state: pending, partial, confirmed, failed, and recoverable.\n\nIf a state is ambiguous, the UI feels slow even when it is fast. If a state is explicit, the UI feels calm even when it is doing a lot.",
  },
  {
    title: "Building a Web3 app without making UX weird",
    date: "Feb 16, 2026",
    excerpt:
      "Wallet auth and encryption are powerful, but the interface still needs rhythm: clear states, safe defaults, and low-friction flows.",
    body:
      "Web3 UX gets weird when the app makes the wallet the UI. The fix is to treat the wallet as one step in a normal product flow.\n\nI try to keep three things consistent: (1) clear pre-auth browsing, (2) a single obvious connect action, and (3) a post-connect state model that does not spam popups.\n\nThe user should always know what the app is doing, what the wallet is doing, and what will happen next.",
  },
  {
    title: "Agentic RAG: the parts that actually matter",
    date: "Jan 05, 2026",
    excerpt:
      "Multi-hop retrieval and tool traces aren’t “nice-to-haves”—they’re how you debug and trust the system. A quick note from building raGG.",
    body:
      "RAG becomes useful when you can observe it. The two features that changed everything for me were tool traces and retrieval inspection.\n\nIf you cannot answer: which sources were retrieved, why they ranked, and which tool calls happened, you cannot fix failures. A clean UI for traces is not polish. It is the debugging surface.\n\nOnce you can see the pipeline, you can add guardrails: citations, verification steps, and cheap evaluation that catches bad outputs early.",
  },
];

export const sectionOrder = [
  { id: "top", label: "Top" },
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "resume", label: "Resume" },
  { id: "writing", label: "Writing" },
  { id: "contact", label: "Contact" },
];
