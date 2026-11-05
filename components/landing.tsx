import Link from "next/link";

const previews = [
  {
    label: "Customer management",
    title: "Customers",
    tone: "pink",
    path: "M4 19V8l8-4 8 4v11M8 19v-6h8v6M7 9h.01M12 9h.01M17 9h.01",
  },
  {
    label: "Product catalog",
    title: "Products",
    tone: "teal",
    path: "m4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4",
  },
  {
    label: "People and access",
    title: "Human Resources",
    tone: "teal",
    path: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    label: "Sales operations",
    title: "Sales",
    tone: "pink",
    path: "M4 19h16M6 17V9M10 17v-5M14 17V7M18 17V4",
  },
];

const modules = [
  {
    title: "Customer Management",
    description: "Organize customer records and relationships in one workspace.",
    path: "M4 19V8l8-4 8 4v11M8 19v-6h8v6",
  },
  {
    title: "Product Catalog",
    description: "Maintain a clear, centralized view of products and availability.",
    path: "m4 8 8-4 8 4-8 4-8-4ZM4 12l8 4 8-4M4 16l8 4 8-4",
  },
  {
    title: "Human Resources",
    description: "Manage people, roles, and access with consistent controls.",
    path: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  },
  {
    title: "Sales",
    description: "Track sales activity and operational opportunities.",
    path: "M4 19h16M6 17V9M10 17v-5M14 17V7M18 17V4",
  },
];

export default function Landing({ children }: { children?: React.ReactNode }) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Hope, Inc. ERP home">
          <span className="landing-brand__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 5h4v5h6V5h4v14h-4v-5H9v5H5z" /></svg>
          </span>
          <span>
            <strong>Hope, Inc.</strong>
            <small>ERP</small>
          </span>
        </Link>
        <nav className="landing-nav" aria-label="Account navigation">
          <Link className="landing-nav__link" href="/login">Sign In</Link>
          <Link className="landing-button landing-button--primary" href="/register">
            Register
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">
              <span className="landing-eyebrow__dot" />ONE UNIFIED SYSTEM
            </p>
            <h1 id="landing-title">Run your entire business with confidence</h1>
            <p className="landing-hero__summary">
              Hope, Inc. ERP unifies Customer Management, Product Catalog, Human
              Resources, and Sales into one powerful platform. Built for teams of
              every size.
            </p>
            <div className="landing-actions">
              <Link
                className="landing-button landing-button--primary landing-button--large"
                href="/login"
              >
                Sign In to Dashboard <span aria-hidden="true">→</span>
              </Link>
              <Link
                className="landing-button landing-button--secondary landing-button--large"
                href="/register"
              >
                Register
              </Link>
            </div>
          </div>

          {children ? (
            <div className="landing-preview-grid">{children}</div>
          ) : (
            <div className="landing-preview-grid" aria-label="Core module previews">
              {previews.map((preview) => (
                <article
                  className={`landing-preview-card landing-preview-card--${preview.tone}`}
                  key={preview.title}
                >
                  <span className="landing-icon-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d={preview.path} /></svg>
                  </span>
                  <span className="landing-preview-card__label">{preview.label}</span>
                  <strong>{preview.title}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="landing-divider" aria-labelledby="modules-title">
          <span />
          <h2 id="modules-title">Everything you need to grow</h2>
          <span />
          <p>Core modules. User roles. A unified system.</p>
        </section>

        <section className="landing-modules project-container" aria-label="Core modules">
          {modules.map((module) => (
            <article className="landing-module-card" key={module.title}>
              <div className="landing-module-card__top">
                <span className="landing-icon-badge landing-icon-badge--small" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d={module.path} /></svg>
                </span>
              </div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <Link href="/login">
                Open module <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
