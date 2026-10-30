import { useEffect, useState } from "react";
import { profile } from "../data/content";

const workflow = [
  "Understand the problem",
  "Design the agent workflow",
  "Connect data and tools",
  "Build and evaluate",
  "Deploy and observe",
  "Improve from feedback",
];

export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((index) => (index + 1) % workflow.length), 2400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section id="top" className="portfolio-opening" aria-label="Introduction">
      <div className="reference-frame hero-frame">
        <div className="hero-identity">
          <img src="/aniket-480.webp" width="90" height="90" alt="Portrait of Anikeat Yadav" fetchPriority="high" />
          <div><h2>{profile.name}</h2><p>{profile.role}</p></div>
        </div>
        <div className="hero-copy">
          <h1>I build AI agents that do real work.</h1>
          <p>{profile.intro}</p>
        </div>
      </div>
      <div className="opening-grid">
        <div className="reference-frame workflow-frame">
          <p className="card-kicker">The Workflow</p>
          <ol>{workflow.map((step, index) => <li key={step} className={index === active ? "active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol>
        </div>
        <div className="reference-frame philosophy-frame">
          <div><h3>Tools change. Good systems don't.</h3><p>I use the right models, data, and tools for the job. The goal stays the same: software that works when it matters.</p></div>
          <div className="tool-row" aria-label="Areas of work"><span>AI</span><span>Python</span><span>Agents</span><span>Cloud</span></div>
        </div>
      </div>
      <div className="focus-panel" id="focus">
        <p className="card-kicker">What I focus on.</p>
        <h2>Where I do my best work</h2>
        <p className="focus-intro">Four areas where AI engineering and practical execution come together.</p>
        <div className="focus-grid">
          {[
            ["01", "Agents", "Building workflows that reason, use tools, and complete real tasks."],
            ["02", "Infrastructure", "Connecting models, APIs, and data in dependable systems."],
            ["03", "Evaluation", "Tracing behavior and measuring where agents succeed or fail."],
            ["04", "Automation", "Turning repetitive work into useful, observable software."],
          ].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>
  );
}
