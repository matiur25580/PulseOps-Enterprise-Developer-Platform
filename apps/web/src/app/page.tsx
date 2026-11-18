const modules = [
  { title: 'Service Catalog', description: 'Discover services, ownership, lifecycle, and dependencies.', status: 'Next milestone' },
  { title: 'Incident Management', description: 'Coordinate response with timelines, severity, and runbooks.', status: 'Planned' },
  { title: 'Reliability Center', description: 'Track service-level indicators, objectives, and error budgets.', status: 'Planned' },
  { title: 'FinOps', description: 'Understand usage, budgets, and cloud-cost allocation.', status: 'Planned' },
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="PulseOps home"><span className="brand-mark">P</span><span>PulseOps</span></a>
        <span className="environment"><span /> FOUNDATION BUILD</span>
      </nav>
      <section className="hero">
        <p className="eyebrow">ENGINEERING OPERATIONS PLATFORM</p>
        <h1>Know your systems.<br /><span>Operate with confidence.</span></h1>
        <p className="intro">A unified workspace for service ownership, delivery, reliability, incident response, and cloud operations.</p>
        <div className="hero-meta"><span className="status-dot" /> Application shell is running <span className="meta-divider">/</span> API and database foundation in progress</div>
      </section>
      <section className="section-heading">
        <div><p className="eyebrow">PLATFORM MODULES</p><h2>One operational workspace</h2></div>
        <span className="counter">04 MODULES</span>
      </section>
      <section className="module-grid" aria-label="Platform modules">
        {modules.map((module, index) => (
          <article className="module-card" key={module.title}>
            <div className="module-card-top"><span className="module-index">0{index + 1}</span><span className={index === 0 ? 'tag tag-next' : 'tag'}>{module.status}</span></div>
            <h3>{module.title}</h3><p>{module.description}</p><span className="card-arrow" aria-hidden="true">↗</span>
          </article>
        ))}
      </section>
      <footer className="footer"><span>PULSEOPS / DEVELOPER PLATFORM</span><span>Built for observable, reliable engineering.</span></footer>
    </main>
  );
}
