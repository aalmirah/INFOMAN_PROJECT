import Link from "next/link";
import LogoutButton from "@/components/dashboard/logout-button";
import { canAccessModule, type AuthorizedActor, type GrantedRight } from "@/lib/auth/rights-authorization";
import { DASHBOARD_MODULES } from "@/lib/dashboard/modules";

export default function Sidebar({
  actor,
  rights,
  current,
}: {
  actor: AuthorizedActor;
  rights: GrantedRight[];
  current: string;
}) {
  const links = [
    { href: "/session", name: "Dashboard" },
    ...DASHBOARD_MODULES.filter((item) => canAccessModule(actor, rights, item.code)),
    ...(actor.role !== "user" ? [{ href: "/user-management", name: "User Management" }] : []),
    ...(actor.role === "superadmin" ? [{ href: "/system-settings", name: "System Settings" }] : []),
  ];
  return (
    <aside className="app-sidebar">
      <Link className="brand brand-on-dark" href="/session" prefetch={false}>
        <span className="brand-mark" aria-hidden="true">H</span><span>HOPE Inc. ERP</span>
      </Link>
      <nav className="app-nav" aria-label="Main navigation">
        {links.map((link) => (
          <Link className={`app-nav-link${link.href === current ? " is-active" : ""}`}
            aria-current={link.href === current ? "page" : undefined}
            href={link.href} key={link.href} prefetch={false}>
            {link.name}
          </Link>
        ))}
      </nav>
      <div className="dashboard-sidebar-account">
        <div className="dashboard-sidebar-user"><strong>{actor.name}</strong><span>{actor.role}</span></div>
        <LogoutButton />
      </div>
    </aside>
  );
}
