import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const projects = [
  {
    slug: "cortex",
    title: "Cortex",
    impactMetric: "Desktop agent + social agent + background intelligence",
    oneLiner: "An AI agent experience for full desktop control, social workflows, and quiet background automation.",
    role: "Co-creator",
    tech: ["AI Agents", "Automation", "Windows", "Desktop Control", "Social Workflows", "Background Intelligence"],
    links: { live: "https://www.cortexpro.info" },
    caseStudy: {
      problem:
        "Your system deserves more than commands. Cortex explores a more natural way to experience your computer by giving it understanding, context, and the ability to act.",
      constraints: [
        "Operate across desktop tasks like a human without making the workflow feel heavy",
        "Handle WhatsApp, email, comments, social workflows, and content uploads",
        "Run tasks quietly in the background while responding in the user's style",
        "Understand the screen and take action instead of only executing commands",
      ],
      approach: [
        "Designed a desktop agent for full PC control and workflow execution",
        "Added social-agent flows for email, comments, content uploads, and engagement",
        "Built background intelligence for inbox summaries, auto-replies, reminders, backups, and file organization",
        "Focused the product story on human-computer interaction that feels like collaboration",
      ],
      results: [
        "Published the live Cortex site at cortexpro.info",
        "Shaped the feature set around desktop control, social workflows, form filling, email, and calendar automation",
        "Positioned Cortex as an early step toward agentic human-computer interaction",
      ],
    },
  },
  {
    slug: "ragg",
    title: "raGG",
    impactMetric: "Agentic RAG + search + streaming UI",
    oneLiner: "An agentic retrieval system with planning, tool use, web search, and a clean streaming interface.",
    role: "Builder",
    tech: ["TypeScript", "RAG", "AI Agents", "Search", "Streaming"],
    links: { live: "https://ra-gg.vercel.app", github: "https://github.com/anikeaty08/raGG" },
    caseStudy: {
      problem: "Build a RAG system that can plan, retrieve, use tools, and expose enough trace detail to debug answers.",
      constraints: [
        "Keep the UI readable while agent steps are happening",
        "Support search and retrieval flows without hiding failures",
        "Make source/tool traces understandable for review",
      ],
      approach: [
        "Built a full-stack app around agentic retrieval and web search",
        "Added streaming responses so the interface feels responsive",
        "Structured the project so providers and retrieval steps can evolve independently",
      ],
      results: [
        "Deployed a live demo",
        "Created a production-shaped agent UI with visible workflow states",
        "Kept the repo public for iteration and review",
      ],
    },
  },
  {
    slug: "polychat-3",
    title: "PolyChat",
    impactMetric: "Polygon chat + wallet-first UX",
    oneLiner: "A Web3 chat app on Polygon with wallet-oriented flows and a product-style messaging interface.",
    role: "Full-stack builder",
    tech: ["TypeScript", "Polygon", "Web3", "Chat", "React"],
    links: { live: "https://polychat-3-six.vercel.app/", github: "https://github.com/anikeaty08/polychat-3" },
    caseStudy: {
      problem: "Create a decentralized chat experience that keeps wallet identity useful without making the UX feel strange.",
      constraints: [
        "Keep auth and messaging states clear",
        "Make Web3 interactions understandable for normal users",
        "Ship a demo-ready interface quickly",
      ],
      approach: [
        "Built the chat interface and wallet-based user flow",
        "Focused on responsive layout and clear message states",
        "Deployed the app for public testing",
      ],
      results: [
        "Published a live Polygon-focused chat product",
        "Documented the project through a public GitHub repo",
        "Turned a Web3 primitive into a familiar messaging experience",
      ],
    },
  },
  {
    slug: "equi-clear",
    title: "EquiClear",
    impactMetric: "ZK auction protocol concept",
    oneLiner: "A privacy-preserving auction protocol project exploring fair clearing and zero-knowledge design.",
    role: "Builder",
    tech: ["TypeScript", "ZK", "Aleo", "Auction Protocol", "Web3"],
    links: { live: "https://equi-clear.vercel.app", github: "https://github.com/anikeaty08/equiClear" },
    caseStudy: {
      problem: "Explore auction mechanics where bids can stay private while the outcome remains fair and explainable.",
      constraints: [
        "Keep privacy and fairness visible in the product story",
        "Separate protocol ideas from the frontend interaction model",
        "Make a technical protocol understandable in a demo",
      ],
      approach: [
        "Built a frontend around the auction flow",
        "Structured the project around zero-knowledge protocol concepts",
        "Used a clear project page to explain actions and outcomes",
      ],
      results: [
        "Deployed a public demo",
        "Published the implementation on GitHub",
        "Created a focused protocol showcase for privacy-preserving auctions",
      ],
    },
  },
  {
    slug: "safeguard",
    title: "PoolGuard / safeGuard",
    impactMetric: "AI liquidity pool safety",
    oneLiner: "A Polygon-focused safety tool for analyzing liquidity pools and surfacing risk signals.",
    role: "Builder",
    tech: ["TypeScript", "Polygon", "AI", "DeFi", "Risk Analysis"],
    links: { github: "https://github.com/anikeaty08/safeGuard" },
    caseStudy: {
      problem: "DeFi users need quick safety signals before interacting with risky liquidity pools.",
      constraints: [
        "Summarize complex risk factors quickly",
        "Keep the interface actionable instead of overwhelming",
        "Combine AI analysis with Web3 product flows",
      ],
      approach: [
        "Built a product-style risk analysis interface",
        "Organized signals around user-facing safety decisions",
        "Focused the repo on Polygon hackathon-style delivery",
      ],
      results: [
        "Published the public repository",
        "Created a foundation for pool scanning and safer DeFi workflows",
        "Shaped a demo around AI-assisted risk explanation",
      ],
    },
  },
  {
    slug: "os-kernel",
    title: "AstraOS / OS Kernel",
    impactMetric: "x86 systems learning project",
    oneLiner: "A low-level operating-system project covering kernel structure, memory, interrupts, and systems fundamentals.",
    role: "Systems builder",
    tech: ["C", "x86", "Kernel", "Systems", "QEMU"],
    links: { github: "https://github.com/anikeaty08/os-kernel" },
    caseStudy: {
      problem: "Learn operating-system fundamentals by implementing the core pieces instead of only reading about them.",
      constraints: [
        "Keep low-level subsystems understandable",
        "Use repeatable build/run tooling",
        "Make debugging possible while working close to hardware concepts",
      ],
      approach: [
        "Built kernel components in C",
        "Worked through memory, interrupts, and process-level concepts",
        "Kept the repo structured for continued systems learning",
      ],
      results: [
        "Published a public OS development repo",
        "Built practical experience with low-level architecture",
        "Created a base for deeper kernel experiments",
      ],
    },
  },
  {
    slug: "visualizer",
    title: "ML Visualizer",
    impactMetric: "Python ML/EDA plotting toolkit",
    oneLiner: "A Python visualization project for machine-learning plots, EDA helpers, and model-analysis workflows.",
    role: "Python builder",
    tech: ["Python", "Machine Learning", "Data Visualization", "Matplotlib", "EDA"],
    links: { github: "https://github.com/anikeaty08/visualizer" },
    caseStudy: {
      problem: "Reduce repeated ML plotting work by collecting useful visualization helpers in one project.",
      constraints: [
        "Support common EDA and model-analysis use cases",
        "Keep functions easy to run while learning",
        "Make the repo useful as both a toolkit and a reference",
      ],
      approach: [
        "Built reusable Python visualization utilities",
        "Organized plots around ML learning workflows",
        "Kept the project public for iteration",
      ],
      results: [
        "Published a Python ML visualization repo",
        "Created a reusable base for experiments and demos",
        "Improved speed for analysis and presentation workflows",
      ],
    },
  },
  {
    slug: "smart-attendance",
    title: "Smart Attendance",
    impactMetric: "Campus workflow app",
    oneLiner: "A TypeScript attendance platform for BMSIT workflows with a deployed web interface.",
    role: "Builder",
    tech: ["TypeScript", "Web App", "Attendance", "Automation"],
    links: { live: "https://www.bmsit.online/", github: "https://github.com/anikeaty08/smart-attendance" },
    caseStudy: {
      problem: "Create a cleaner digital workflow for attendance-style campus operations.",
      constraints: [
        "Keep repeated operational actions fast",
        "Make the interface accessible from the web",
        "Ship a deployable TypeScript app",
      ],
      approach: [
        "Built a web app around attendance management flows",
        "Deployed the project publicly",
        "Kept the repo available for ongoing iteration",
      ],
      results: [
        "Published a live web app",
        "Added another practical operations project to the portfolio",
        "Demonstrated TypeScript app delivery beyond demos",
      ],
    },
  },
  {
    slug: "veilpay",
    title: "VeilPay",
    impactMetric: "Private payment interface",
    oneLiner: "A TypeScript Web3 payment project focused on private, clean transaction flows.",
    role: "Builder",
    tech: ["TypeScript", "Web3", "Payments", "Privacy"],
    links: { live: "https://veil-pay-peach.vercel.app", github: "https://github.com/anikeaty08/veilPay" },
    caseStudy: {
      problem: "Explore a payment interface where privacy and clarity are central to the transaction experience.",
      constraints: [
        "Make payment actions feel simple",
        "Keep the privacy concept legible",
        "Ship a public Web3 demo",
      ],
      approach: [
        "Built the transaction-focused interface in TypeScript",
        "Designed around a cleaner payment flow",
        "Deployed the project for public access",
      ],
      results: [
        "Published a live VeilPay demo",
        "Added a privacy-payments project to the Web3 set",
        "Kept the implementation available on GitHub",
      ],
    },
  },
  {
    slug: "adnod",
    title: "adNod",
    impactMetric: "Ad tech / Web3 deployment",
    oneLiner: "A deployed TypeScript project exploring ad-node style product mechanics.",
    role: "Builder",
    tech: ["TypeScript", "Web App", "Web3", "Deployment"],
    links: { live: "https://ad-nod.vercel.app", github: "https://github.com/anikeaty08/adNod" },
    caseStudy: {
      problem: "Build and deploy an ad-node concept as a practical web product experiment.",
      constraints: [
        "Keep the demo deployable",
        "Make the product concept understandable from the UI",
        "Move quickly from repo to live site",
      ],
      approach: [
        "Implemented the project in TypeScript",
        "Shipped a Vercel deployment",
        "Kept the repo public for continued work",
      ],
      results: [
        "Published a live demo",
        "Added another product experiment to the portfolio",
        "Demonstrated fast TypeScript deployment workflow",
      ],
    },
  },
];

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });

const db = mongoose.connection.db;
await db.collection("posts").deleteMany({});
await db.collection("assets").deleteMany({});
await db.collection("sites").replaceOne(
  { key: "main" },
  {
    key: "main",
    skills: {},
    projects,
    updatedAt: new Date(),
  },
  { upsert: true },
);

const site = await db.collection("sites").findOne({ key: "main" }, { projection: { _id: 0, projects: 1, skills: 1 } });
console.log(
  JSON.stringify(
    {
      ok: true,
      posts: await db.collection("posts").countDocuments(),
      assets: await db.collection("assets").countDocuments(),
      projects: site?.projects?.length ?? 0,
      firstProject: site?.projects?.[0]?.slug ?? null,
      skillGroups: Object.keys(site?.skills ?? {}).length,
    },
    null,
    2,
  ),
);

await mongoose.disconnect();
