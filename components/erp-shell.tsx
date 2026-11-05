"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export type ShellRole = "user" | "admin" | "superadmin";

type ErpShellProps = {
  active: "dashboard" | "user-management";
  role: ShellRole | null;
  title: string;
  children: React.ReactNode;
};

const modules = [
  { label: "Customers", icon: "👥" },
  { label: "Products", icon: "📦" },
  { label: "Human Resources", icon: "💼" },
  { label: "Sales", icon: "📈" },
  { label: "Reports", icon: "📋" },
];

const userModules = ["Customers", "Products", "Sales"];

export default function ErpShell({ active, role, title, children }: ErpShellProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = role ? role.toUpperCase() : "ACCOUNT";
  const canManageUsers = role === "admin" || role === "superadmin";
  const visibleModules =
    role === "user" ? modules.filter((item) => userModules.includes(item.label)) : modules;

  async function handleSignOut() {
    if (isSigningOut) return;
    setError(null);
    setIsSigningOut(true);

    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) {
        console.error("Supabase sign-out failed.", {
          code: signOutError.code,
          status: signOutError.status,
        });
        setError("We couldn't sign you out. Please try again.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (caught) {
      console.error(
        "Supabase sign-out failed.",
        caught instanceof Error ? caught.name : "Unknown error",
      );
      setError("We couldn't sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="erp-shell" data-role={role ?? "user"}>
      <aside className="erp-sidebar">
        <Link className="erp-sidebar__brand" href="/">
          HOPE, INC. ERP
        </Link>
        <Link
          aria-current={active === "dashboard" ? "page" : undefined}
          className="erp-sidebar__link"
          href="/session"
        >
          <span className="erp-sidebar__icon" aria-hidden="true">📊</span>
          <span>Dashboard</span>
        </Link>
        <nav className="erp-sidebar__nav" aria-label="ERP navigation">
          <div className="erp-sidebar__nav-group">
            <p className="erp-sidebar__nav-heading">MODULES</p>
            {visibleModules.map((item) => (
              <span
                aria-disabled="true"
                className="erp-sidebar__link erp-sidebar__link--disabled"
                key={item.label}
              >
                <span className="erp-sidebar__icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          {canManageUsers && (
            <div className="erp-sidebar__nav-group">
              <p className="erp-sidebar__nav-heading">ADMINISTRATION</p>
              <Link
                aria-current={active === "user-management" ? "page" : undefined}
                className="erp-sidebar__link"
                href="/user-management"
              >
                <span className="erp-sidebar__icon" aria-hidden="true">🔑</span>
                <span>User Management</span>
              </Link>
              {role === "superadmin" && (
                <span
                  aria-disabled="true"
                  className="erp-sidebar__link erp-sidebar__link--disabled"
                >
                  <span className="erp-sidebar__icon" aria-hidden="true">⚙️</span>
                  <span>System Settings</span>
                </span>
              )}
            </div>
          )}
        </nav>
        <p className="erp-sidebar__footer">
          Signed in as <strong>{roleLabel}</strong>
          <br />
          <button
            className="erp-sidebar__logout"
            disabled={isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            {isSigningOut ? "Signing out..." : "Log out"}
          </button>
          {error && <span className="erp-sidebar__error" role="alert">{error}</span>}
        </p>
      </aside>

      <main className="erp-main">
        <header className="erp-header">
          <div>
            <h1>{title}</h1>
          </div>
          <span className="role-pill">{roleLabel}</span>
        </header>
        {children}
      </main>
    </div>
  );
}
