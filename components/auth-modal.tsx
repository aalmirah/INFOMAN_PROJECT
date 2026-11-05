import Link from "next/link";
import Landing from "@/components/landing";

type AuthModalProps = {
  titleId: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
};

export default function AuthModal({ titleId, title, intro, children }: AuthModalProps) {
  return (
    <Landing>
      <div className="auth-modal">
        <section
          className="auth-modal__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <Link className="auth-modal__close" href="/" aria-label="Close dialog">
            ✕
          </Link>
          <div className="auth-modal__brand">HOPE, INC.</div>
          <h2 id={titleId}>{title}</h2>
          {intro && <p className="auth-modal__intro">{intro}</p>}
          {children}
        </section>
      </div>
    </Landing>
  );
}
