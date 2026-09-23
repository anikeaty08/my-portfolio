export type Project = {
  slug: string;
  title: string;
  tagline: string;
  oneLiner: string;
  tech: string[];
  links: { live?: string; github?: string };
  /** GLB in /public/models, modeled by scripts/blender/build_models.py */
  model: string;
  /** Accent for the portal ring and the world on the other side of it. */
  color: string;
  /** Background gradient inside the portal world: [top, bottom]. */
  sky: [string, string];
  caseStudy: { problem: string; approach: string[]; results: string[] };
};

export const person = {
  name: "Anikeat Yadav",
  first: "ANIKEAT",
  last: "YADAV",
  role: "Student Developer",
  tagline: "I build ambitious systems — Web3, agentic AI, and code that runs close to the metal.",
  location: "Bengaluru, India",
  status: "Open to internships",
  education: "B.E. AIML @ BMSIT · CGPA 8.85 · 2028",
  email: "aniketbxr1@gmail.com",
  github: "https://github.com/anikeaty08",
  githubHandle: "@anikeaty08",
};

export const projects: Project[] = [
  {
    slug: "polychat",
    title: "PolyChat",
    tagline: "Privacy-first Web3 messaging",
    oneLiner: "Decentralized chat on Polygon: your wallet is your identity and every message is end-to-end encrypted.",
    tech: ["Next.js 14", "TypeScript", "Socket.io", "Polygon", "IPFS", "Hardhat"],
    links: { live: "https://polychat-3-six.vercel.app/", github: "https://github.com/anikeaty08/polychat-3" },
    model: "polychat",
    color: "#a78bfa",
    sky: ["#2e1065", "#0b0520"],
    caseStudy: {
      problem: "A messaging product where identity is your wallet and privacy is the default — not an afterthought.",
      approach: [
        "Wallet authentication flows (MetaMask / WalletConnect)",
        "Client-side E2E encryption; only encrypted payloads are stored",
        "Real-time transport with Socket.io and IPFS-backed media uploads",
      ],
      results: [
        "Reactions, calls, privacy toggles and responsive layouts",
        "Full stack documented: frontend, API routes, contracts",
        "Live demo deployed and iterated on hackathon timelines",
      ],
    },
  },
  {
    slug: "ragg",
    title: "raGG",
    tagline: "Agentic RAG system",
    oneLiner: "A RAG stack that behaves like a real agent: plans queries, searches the web, uses tools and streams answers.",
    tech: ["Python", "FastAPI", "Qdrant", "Next.js", "Streaming", "Tavily"],
    links: { live: "https://ra-gg.vercel.app", github: "https://github.com/anikeaty08/raGG" },
    model: "ragg",
    color: "#38bdf8",
    sky: ["#0c4a6e", "#020617"],
    caseStudy: {
      problem: "Most RAG demos are a single prompt. I wanted one that plans, retrieves in multiple hops and verifies.",
      approach: [
        "Query planning + multi-hop retrieval with re-ranking hooks",
        "Web search tooling (Tavily primary, Google fallback)",
        "Streaming responses and session management",
      ],
      results: [
        "Provider/model switching, logging, metrics and cost tracking",
        "Ingestion for GitHub, PDF and URL sources",
        "Readable docs, env references and deploy notes",
      ],
    },
  },
  {
    slug: "equiclear",
    title: "EquiClear",
    tagline: "Zero-knowledge Dutch auctions",
    oneLiner: "Private bids, fair uniform clearing price. Leo contracts on Aleo, a Rust indexer and a Next.js frontend.",
    tech: ["Aleo (Leo)", "Rust", "Next.js", "ZK proofs", "Indexer"],
    links: { live: "https://equi-clear.vercel.app", github: "https://github.com/anikeaty08/equiClear" },
    model: "equiclear",
    color: "#2dd4bf",
    sky: ["#134e4a", "#021514"],
    caseStudy: {
      problem: "Auctions leak bidder intent. This protocol keeps bids private while keeping the outcome fair.",
      approach: [
        "Contracts split into focused modules: balance, auction, bid, claim",
        "Off-chain Rust indexer tracks protocol state",
        "Frontend that makes protocol actions understandable",
      ],
      results: [
        "Clean repo layout with quick-start build and deploy scripts",
        "Documented constraints and a cross-chain roadmap",
        "Live frontend for demos and feedback",
      ],
    },
  },
  {
    slug: "poolguard",
    title: "PoolGuard",
    tagline: "AI liquidity-pool safety",
    oneLiner: "Scans Polygon liquidity pools, flags red signals with AI and records analyses on-chain.",
    tech: ["Next.js 14", "TypeScript", "Gemini API", "Solidity", "Polygon"],
    links: { github: "https://github.com/anikeaty08/safeGuard" },
    model: "poolguard",
    color: "#34d399",
    sky: ["#064e3b", "#01140d"],
    caseStudy: {
      problem: "DeFi users need safety signals in seconds, not a research afternoon.",
      approach: [
        "Two modes (Safe vs Degen) matched to user intent",
        "Contract-side registry and analytics storage",
        "UI states for results, alerts and plain-language risk explanations",
      ],
      results: [
        "Demo-ready product surface with documented routes",
        "Full install/deploy flow with env guidance",
        "Foundation for more scanners: honeypots, locks, dev wallets",
      ],
    },
  },
  {
    slug: "astraos",
    title: "AstraOS",
    tagline: "An x86_64 operating system",
    oneLiner: "A hobby kernel in C: interrupts, paging, a preemptive scheduler, VFS, FAT16 and a built-in shell.",
    tech: ["C", "x86_64", "Limine", "Paging", "QEMU"],
    links: { github: "https://github.com/anikeaty08/os-kernel" },
    model: "astraos",
    color: "#fb923c",
    sky: ["#7c2d12", "#140602"],
    caseStudy: {
      problem: "Learn OS fundamentals by building them end to end: boot, memory, interrupts, processes, drivers.",
      approach: [
        "IDT/IRQ handling, PIC remap, serial debug output, timer ticks",
        "Bitmap PMM, 4-level paging VMM and a coalescing heap",
        "Process control blocks with round-robin context switching",
      ],
      results: [
        "Readable kernel layout with build/run recipes",
        "Shell with ps, mem, ls, cat, uptime, shutdown",
        "Ready for user mode, syscalls, an ELF loader and SMP",
      ],
    },
  },
  {
    slug: "mlviz",
    title: "ml_visualizer",
    tagline: "82 ML plots, one import",
    oneLiner: "A Python toolkit for ML and EDA visuals. Every plot runs with zero arguments and accepts real sklearn models.",
    tech: ["Python", "Matplotlib", "Seaborn", "Plotly", "scikit-learn"],
    links: { github: "https://github.com/anikeaty08/visualizer" },
    model: "mlviz",
    color: "#f472b6",
    sky: ["#831843", "#12030b"],
    caseStudy: {
      problem: "ML plotting code is repetitive. I wanted “one import, one function” that stays customizable.",
      approach: [
        "A catalogue of plot_* utilities with consistent parameters",
        "Interactive iplot_* variants with graceful dependency checks",
        "A companion cookbook explaining each plot from scratch",
      ],
      results: [
        "82 static plots, 9 interactive, 10 math helpers",
        "Faster debugging: learning curves, ROC, bias/variance, clustering",
        "Import → call → see the graph",
      ],
    },
  },
];

export const about = {
  lead: "I build by shipping. I like problems with real constraints — privacy vs UX, performance vs complexity — and interfaces that stay legible under pressure.",
  body: "I sit at the boundary between systems and product: designing the state model, writing the kernel scheduler, and then making the whole thing feel intentional.",
  facts: [
    { k: "Projects shipped", v: "16" },
    { k: "Kernels written", v: "2" },
    { k: "Hackathon podium", v: "3rd" },
    { k: "CGPA", v: "8.85" },
  ],
  highlights: [
    "3rd rank — AI-based task scheduler, technical event",
    "IEEE-CIS BMSIT — organizing hackathons (2025 – present)",
    "Web3 builds on Polygon and Aleo; agentic AI demos with real integrations",
  ],
};

export const skills: { orbit: string; items: string[] }[] = [
  { orbit: "Languages", items: ["TypeScript", "Python", "Java", "C", "Rust", "Solidity"] },
  { orbit: "Web", items: ["React", "Next.js", "Three.js", "Node.js", "FastAPI", "WebSockets"] },
  { orbit: "Web3", items: ["Polygon", "Hardhat", "Aleo / Leo", "IPFS", "Wallet auth"] },
  { orbit: "AI / ML", items: ["PyTorch", "scikit-learn", "RAG", "Qdrant", "Pandas"] },
  { orbit: "Systems", items: ["x86_64", "Paging", "Schedulers", "QEMU", "Linux", "Docker"] },
];
