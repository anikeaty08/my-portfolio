import { useEffect, useState } from "react";
import { profile } from "../data/content";

const workflow = [
  "Understand the task",
  "Design the workflow",
  "Connect models, tools and data",
  "Build and test",
  "Evaluate reliability",
  "Deploy, monitor and improve",
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
          <h1>I build AI systems that turn tasks into outcomes.</h1>
          <p>{profile.intro}</p>
        </div>
      </div>
      <div className="opening-grid">
        <div className="reference-frame workflow-frame">
          <p className="card-kicker">From problem to production</p>
          <ol>{workflow.map((step, index) => <li key={step} className={index === active ? "active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol>
        </div>
        <div className="reference-frame philosophy-frame">
          <div><h3>The model is only one part of the system.</h3><p>I focus on the orchestration, integrations, and evaluation that make AI applications useful beyond a demo.</p></div>
          <div className="tool-row" aria-label="Areas of work"><span>AI</span><span>Python</span><span>Agents</span><span>Cloud</span></div>
        </div>
      </div>
      <div className="focus-panel" id="focus">
        <p className="card-kicker">What I focus on</p>
        <h2>Areas of focus</h2>
        <p className="focus-intro">The parts of AI engineering I work on most.</p>
        <div className="focus-grid">
          {[
            ["01", "AI Agents", "Designing agents that plan tasks, use tools, and execute multi-step workflows."],
            ["02", "AI Infrastructure", "Building the connections between models, APIs, data sources, and applications."],
            ["03", "Evaluation & Observability", "Tracing agent execution, identifying failure points, and measuring system performance."],
            ["04", "Intelligent Automation", "Turning manual processes into structured, repeatable, and monitorable workflows."],
          ].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>
  );
}
