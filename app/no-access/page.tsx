import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-content">
        <h1>Access denied</h1>
        <p>You do not have permission to access this page. Contact an administrator if you need access.</p>
        <Link className="button button-primary" href="/session">Return to Dashboard</Link>
      </section>
    </main>
  );
}
