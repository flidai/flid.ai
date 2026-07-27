import logoMarkup from "../logo.txt?raw";

const capabilities = [
  {
    number: "01",
    title: "Data foundations",
    description:
      "Trusted platforms, pipelines, and governance that make your data ready for people, products, and AI.",
    detail: "PLATFORMS · PIPELINES · QUALITY",
  },
  {
    number: "02",
    title: "Applied AI",
    description:
      "Useful AI products designed around your workflows, with the safeguards and observability needed for production.",
    detail: "ASSISTANTS · AUTOMATION · MODELS",
  },
  {
    number: "03",
    title: "Decision systems",
    description:
      "Analytics and intelligent tools that turn operational complexity into clear, timely action.",
    detail: "ANALYTICS · FORECASTING · INSIGHT",
  },
];

const approach = [
  {
    number: "01",
    title: "Frame the right problem",
    description:
      "We connect technical possibilities to a measurable business outcome.",
  },
  {
    number: "02",
    title: "Build for reality",
    description:
      "We design the product and the data foundation together, so the result is reliable from day one.",
  },
  {
    number: "03",
    title: "Make it stick",
    description:
      "We work alongside your team and leave behind systems they can understand, operate, and extend.",
  },
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`logo-graphic ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: logoMarkup }}
    />
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#top" aria-label="Flid home">
            <Logo className="brand-mark" />
            <span className="wordmark">flid</span>
            <span className="domain">.ai</span>
          </a>

          <nav className="primary-nav" aria-label="Primary navigation">
            <a href="#capabilities">Capabilities</a>
            <a href="#approach">Approach</a>
            <a className="nav-contact" href="mailto:hello@flid.ai">
              Let&apos;s talk <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            Data &amp; artificial intelligence
          </p>
          <h1>
            Turn complex data into <em>clear decisions.</em>
          </h1>
          <p className="hero-intro">
            Flid builds dependable data systems and AI products that move from
            ambitious idea to everyday use.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="mailto:hello@flid.ai">
              Start a conversation <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-secondary" href="#capabilities">
              Explore our work <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="signal-halo signal-halo-one" />
          <div className="signal-halo signal-halo-two" />
          <div className="signal-note signal-note-top">
            <span>signal</span>
            <strong>verified</strong>
          </div>
          <Logo className="hero-mark" />
          <div className="signal-note signal-note-bottom">
            <span>system</span>
            <strong>in motion</strong>
          </div>
          <div className="axis axis-x" />
          <div className="axis axis-y" />
        </div>

        <div className="hero-foot">
          <p>Strategy is only valuable when it becomes a working system.</p>
          <span>DESIGNED IN COPENHAGEN · BUILT FOR ANYWHERE</span>
        </div>
      </section>

      <section className="capabilities section" id="capabilities">
        <div className="shell">
          <div className="section-heading">
            <p className="section-label">What we build</p>
            <h2>
              From raw information
              <br />
              to real-world advantage.
            </h2>
            <p>
              We bring data engineering, product thinking, and applied AI
              together—because useful intelligence depends on all three.
            </p>
          </div>

          <div className="capability-grid">
            {capabilities.map((capability) => (
              <article className="capability-card" key={capability.number}>
                <div className="card-top">
                  <span>{capability.number}</span>
                  <span className="card-arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
                <span className="card-detail">{capability.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="principle section">
        <div className="shell principle-grid">
          <div className="principle-mark" aria-hidden="true">
            <Logo />
          </div>
          <blockquote>
            <p>
              AI should not be a layer of theatre. It should make the work
              simpler, the decisions sharper, and the business stronger.
            </p>
            <footer>— THE FLID PRINCIPLE</footer>
          </blockquote>
        </div>
      </section>

      <section className="approach section" id="approach">
        <div className="shell">
          <div className="approach-header">
            <p className="section-label">How we work</p>
            <h2>Small senior teams. One clear outcome.</h2>
          </div>

          <ol className="approach-list">
            {approach.map((step) => (
              <li key={step.number}>
                <span className="approach-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="contact section" id="contact">
        <div className="shell contact-inner">
          <p className="section-label">Start somewhere useful</p>
          <h2>
            Have a data or AI challenge
            <br />
            worth solving?
          </h2>
          <a className="contact-link" href="mailto:hello@flid.ai">
            hello@flid.ai <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <a className="brand footer-brand" href="#top" aria-label="Flid home">
            <Logo className="brand-mark" />
            <span className="wordmark">flid</span>
            <span className="domain">.ai</span>
          </a>
          <p>Data systems and AI products built for real-world use.</p>
          <span>© {new Date().getFullYear()} Flid</span>
        </div>
      </footer>
    </main>
  );
}
