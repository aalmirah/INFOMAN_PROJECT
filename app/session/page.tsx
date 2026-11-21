import Link from "next/link";
import { Suspense } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import RefreshAccess from "@/components/dashboard/refresh-access";
import { canAccessModule, hasGrantedRight, type Dev07RightCode } from "@/lib/auth/rights-authorization";
import { getDashboardContext } from "@/lib/dashboard/context";
import { DASHBOARD_MODULES } from "@/lib/dashboard/modules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const stats: {
  label: string;
  table: string;
  id: string;
  right?: Dev07RightCode;
  currentEmployees?: boolean;
}[] = [
  { label: "Total Customers", table: "customer", id: "custno" },
  { label: "Total Products", table: "product", id: "prodcode", right: "reports.product_master" },
  { label: "Total Sales", table: "sales", id: "transno" },
  { label: "Current Employees", table: "employee", id: "empno", right: "reports.active_employees", currentEmployees: true },
];

async function Statistics({ allowed }: { allowed: boolean[] }) {
  const admin = getSupabaseAdminClient();
  const results = await Promise.all(stats.map(async (stat, index) => {
    if (!allowed[index]) return null;
    let query = admin.from(stat.table).select(stat.id, { count: "exact", head: true })
      .eq("is_deleted", false);
    if (stat.currentEmployees) query = query.is("sepdate", null);
    const { count, error } = await query;
    if (error || count === null) {
      console.error("Dashboard statistic lookup failed.", { table: stat.table, code: error?.code });
      return "Unavailable";
    }
    return count;
  }));
  return (
    <section className="dashboard-stats" aria-label="Dashboard statistics">
      {stats.map((stat, index) => (
        <article className="dashboard-stat-card" key={stat.table}>
          <span>{stat.label}</span>
          <strong>{results[index] ?? "—"}</strong>
          <small>{!allowed[index] ? "Not authorized" : results[index] === "Unavailable" ? "Could not load count" : results[index] === 0 ? "No records" : "Current total"}</small>
        </article>
      ))}
    </section>
  );
}

function StatisticsLoading() {
  return (
    <section className="dashboard-stats" aria-label="Dashboard statistics" aria-busy="true">
      {stats.map((stat) => (
        <article className="dashboard-stat-card" key={stat.table}>
          <span>{stat.label}</span><strong>—</strong><small>Loading...</small>
        </article>
      ))}
    </section>
  );
}

export default async function SessionPage() {
  const context = await getDashboardContext();
  if ("error" in context) return <main className="dashboard-content"><p role="alert">{context.error}</p></main>;
  const { actor, rights } = context;
  const allowedStats = stats.map((stat) =>
    actor.role !== "user" || (stat.right !== undefined && hasGrantedRight(rights, stat.right)),
  );
  const canManageUsers = actor.role === "admin" || actor.role === "superadmin";

  return (
    <div className="app-shell">
      <RefreshAccess />
      <Sidebar actor={actor} rights={rights} current="/session" />
      <main className="app-main">
        <header className="app-header dashboard-page-header">
          <h1>Dashboard</h1>
          <div className="dashboard-header-actions"><span className="role-badge">{actor.role}</span></div>
        </header>
        <p className="dashboard-signed-in">Signed in as {actor.name}</p>
        <section className="welcome-banner">
          <h2>Welcome, {actor.name}</h2>
          <p>Here is an overview of your HOPE Inc. ERP workspace.</p>
        </section>
        <Suspense fallback={<StatisticsLoading />}><Statistics allowed={allowedStats} /></Suspense>
        <section aria-labelledby="quick-actions">
          <div className="dashboard-section-heading">
            <h2 id="quick-actions">Quick Actions</h2>
            <p>Open a module to see your assigned access.</p>
          </div>
          <div className="dashboard-quick-grid">
            {DASHBOARD_MODULES.map((item) => canAccessModule(actor, rights, item.code) ? (
              <Link className="dashboard-quick-card" href={item.href} key={item.code} prefetch={false}>
                <span className={`dashboard-quick-icon dashboard-icon-${item.color}`} aria-hidden="true">{item.icon}</span>
                <strong>{item.name}</strong><span className="sr-only">{item.description}</span><small className="sr-only">Open module</small>
              </Link>
            ) : (
              <article className="dashboard-quick-card dashboard-quick-card-disabled dashboard-quick-card-no-access" key={item.code}>
                <span className={`dashboard-quick-icon dashboard-icon-${item.color}`} aria-hidden="true">{item.icon}</span>
                <strong>{item.name}</strong><small className="sr-only">No permission</small>
              </article>
            ))}
            {canManageUsers && (
              <Link className="dashboard-quick-card" href="/user-management" prefetch={false}>
                <span className="dashboard-quick-icon dashboard-icon-neutral" aria-hidden="true">UM</span>
                <strong>User Management</strong><small className="sr-only">Manage users</small>
              </Link>
            )}
            {actor.role === "superadmin" && (
              <Link className="dashboard-quick-card" href="/system-settings" prefetch={false}>
                <span className="dashboard-quick-icon dashboard-icon-neutral" aria-hidden="true">SS</span>
                <strong>System Settings</strong><small className="sr-only">Open settings</small>
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
