import UserManagement from "@/components/user-management/user-management";
import Sidebar from "@/components/dashboard/sidebar";
import { authorizeActor } from "@/lib/auth/rights-authorization";
import { redirect } from "next/navigation";

export default async function UserManagementPage() {
  const result = await authorizeActor();
  if (!result.allowed) {
    if (result.status === 401) redirect("/login");
    if (result.status === 403) redirect("/no-access");
    return <main className="dashboard-content"><p role="alert">{result.error}</p></main>;
  }
  if (result.actor.role === "user") redirect("/no-access");
  return <UserManagement sidebar={<Sidebar actor={result.actor} rights={[]} current="/user-management" />} />;
}
