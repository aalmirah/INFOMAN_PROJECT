import Link from "next/link";
import { redirect } from "next/navigation";
import RefreshAccess from "@/components/dashboard/refresh-access";
import Sidebar from "@/components/dashboard/sidebar";
import { authorizeModule } from "@/lib/auth/rights-authorization";
import { DASHBOARD_MODULES } from "@/lib/dashboard/modules";
import type { RightsModuleCode } from "@/lib/user-management/rights";

export default async function ModulePage({ code }: { code: RightsModuleCode }) {
  const result = await authorizeModule(code);
  if (!result.allowed) {
    if (result.status === 401) redirect("/login");
    if (result.status === 403) redirect("/no-access");
    return <main className="dashboard-content"><p role="alert">{result.error}</p></main>;
  }
  const { actor, rights } = result;
  const details = DASHBOARD_MODULES.find((item) => item.code === code);
  if (!details) throw new Error(`Unknown dashboard module: ${code}`);
  const assigned = rights.filter((right) => right.module === code);

  return (
    <div className="app-shell">
      <RefreshAccess />
      <Sidebar actor={actor} rights={rights} current={details.href} />
      <main className="app-main">
        <header className="app-header">
          <div><p className="eyebrow">Business module</p><h1>{details.name}</h1></div>
        </header>
        <section className="table-card" aria-labelledby="module-access-title">
          <p>{details.description}</p>
          <h2 id="module-access-title">Your assigned permissions</h2>
          {assigned.length ? (
            <ul>{assigned.map((right) => <li key={right.code}>{right.label}</li>)}</ul>
          ) : <p>No individual permissions are currently assigned to your account for this module.</p>}
          <p className="form-help">
            These are permission assignments, not available actions. Module operations and reports are not implemented yet.
          </p>
          <Link className="button button-secondary" href="/session" prefetch={false}>Return to Dashboard</Link>
        </section>
      </main>
    </div>
  );
}
