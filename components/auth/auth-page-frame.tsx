import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageFrameProps = {
  activeLink: "login" | "register";
  children: ReactNode;
  closeHref?: string;
  description: string;
  title: string;
};

export function AuthPageFrame({
  activeLink,
  children,
  closeHref = "/login",
  description,
  title,
}: AuthPageFrameProps) {
  return (
    <main className="auth-showcase">
      <header className="showcase-nav">
        <div className="showcase-nav-inner">
          <Link className="showcase-brand" href="/">
            <span className="showcase-brand-mark" aria-hidden="true">
              H
            </span>
            <span className="showcase-brand-name">
              Hope, Inc.
              <small>ERP</small>
            </span>
          </Link>
          <nav aria-label="Account navigation" className="showcase-nav-links">
            <Link
              aria-current={activeLink === "login" ? "page" : undefined}
              className={activeLink === "login" ? "is-active" : undefined}
              href="/login"
            >
              Sign In
            </Link>
            <Link
              aria-current={activeLink === "register" ? "page" : undefined}
              className={`showcase-register-link${activeLink === "register" ? " is-active" : ""}`}
              href="/register"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <div className="showcase-content">
        <section aria-label="About Hope Inc. ERP" className="showcase-intro">
          <p className="showcase-eyebrow">
            <span aria-hidden="true" />
            One unified system
          </p>
          <h1>Run your entire business with confidence</h1>
          <p className="showcase-description">
            Hope, Inc. ERP unifies Customer Management, Product Catalog, Human
            Resources, and Sales into one powerful platform. Built for teams of
            every size.
          </p>
          <div className="showcase-actions">
            <Link className="button button-primary" href="/login">
              Sign In to Dashboard <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/register">
              Register
            </Link>
          </div>
        </section>

        <section aria-label={title} className="showcase-auth-card">
          <div className="showcase-card-toolbar">
            <span className="showcase-card-label">HOPE, INC.</span>
            <Link
              aria-label="Close and return"
              className="showcase-card-close"
              href={closeHref}
            >
              ×
            </Link>
          </div>
          <header className="showcase-card-heading">
            <h2>{title}</h2>
            <p>{description}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
