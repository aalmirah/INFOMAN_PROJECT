import Link from "next/link";
import { redirect } from "next/navigation";
import RefreshAccess from "@/components/dashboard/refresh-access";
import Sidebar from "@/components/dashboard/sidebar";
import { getDashboardContext } from "@/lib/dashboard/context";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const context = await getDashboardContext();
  if ("error" in context) return <main className="dashboard-content"><p role="alert">{context.error}</p></main>;
  const { actor, rights } = context;
  if (actor.role !== "superadmin") redirect("/no-access");
  return (
    <div className="app-shell">
      <RefreshAccess />
      <Sidebar actor={actor} rights={rights} current="/system-settings" />
      <main className="app-main">
        <header className="app-header"><div><p className="eyebrow">Administration</p><h1>System Settings</h1></div></header>
        <section className="table-card" aria-labelledby="settings-access-title">
          <h2 id="settings-access-title">Administration</h2>
          <p>Manage user accounts, approvals and assigned rights in User Management.</p>
          <Link className="button button-primary" href="/user-management" prefetch={false}>Open User Management</Link>
          <p className="form-help">Other system configuration controls are not implemented.</p>
        </section>
      </main>
    </div>
  );
}
