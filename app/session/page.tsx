"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErpShell, { type ShellRole } from "@/components/erp-shell";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

const metrics = [
  {
    label: "Total Customers",
    note: "Ready for your first customer",
    path: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    value: "0",
  },
  {
    label: "Products",
    note: "No products added yet",
    path: "m4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4",
    value: "0",
  },
  {
    label: "Open Orders",
    note: "No open orders",
    path: "M4 6h16v13H4zM7 3v6M17 3v6M4 10h16",
    value: "0",
  },
  {
    label: "Revenue MTD",
    note: "No revenue recorded",
    path: "M12 2v20M17 6.5c0-1.7-2.2-3-5-3S7 4.8 7 6.5s2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3",
    value: "$0",
  },
];

const quickActions = [
  { label: "View Customers", icon: "👥", tone: "customers", access: ["user", "admin", "superadmin"] },
  { label: "Manage Products", icon: "📦", tone: "products", access: ["user", "admin", "superadmin"] },
  { label: "Human Resources", icon: "💼", tone: "hr", access: ["admin", "superadmin"] },
  { label: "Sales Pipeline", icon: "📊", tone: "sales", access: ["user", "admin", "superadmin"] },
];

function welcomeCopy(role: ShellRole | null) {
  if (role === "superadmin") {
    return "You have full system access. You can manage all modules and assign roles to any user.";
  }
  if (role === "admin") {
    return "You can manage most modules and user rights (except Superadmin accounts).";
  }
  if (role === "user") {
    return "You have access to the core modules assigned to you. Contact an Admin for elevated permissions.";
  }
  return "Your authorized workspace will appear here.";
}

export default function SessionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<ShellRole | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSupabaseClient()
      .auth.getUser()
      .then(async ({ data: { user }, error }) => {
        if (!active) return;
        if (error) {
          setStatus("We couldn't verify your session. Please try again.");
          return;
        }
        if (!user) {
          router.replace("/login");
          return;
        }

        const { profile, error: profileError } = await getAuthProfile(
          getSupabaseClient(),
          user.id,
        );
        if (!active) return;
        if (profileError || !profile) {
          setStatus("We couldn't verify your account profile. Please try again.");
          return;
        }

        if (profile.isBlocked || !profile.isActive) {
          const { error: signOutError } = await getSupabaseClient().auth.signOut();
          if (signOutError) {
            console.error("Unavailable account session could not be cleared.", {
              code: signOutError.code,
              status: signOutError.status,
            });
          }
          router.replace(profile.isBlocked ? "/login?error=blocked" : "/login?error=inactive");
          return;
        }
        if (profile.approvalStatus !== "approved") {
          router.replace("/login?error=pending");
          return;
        }
        if (profile.mustChangePassword) {
          router.replace("/set-password");
          return;
        }

        const profileName = [profile.firstName, profile.lastName]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(" ");
        setName(profileName || null);
        if (
          profile.role === "user" ||
          profile.role === "admin" ||
          profile.role === "superadmin"
        ) {
          setRole(profile.role);
        } else {
          setStatus("Your account has an unsupported role. Contact an administrator.");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("We couldn't verify your session. Please try again.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const canManageUsers = role === "admin" || role === "superadmin";
  const visibleActions = quickActions.filter((action) => role && action.access.includes(role));

  return (
    <ErpShell active="dashboard" role={role} title="Dashboard">
      {status && <p className="dashboard-status" role="alert">{status}</p>}

      <section className="welcome-banner" aria-labelledby="welcome-title">
        <h2 id="welcome-title">
          {isLoading
            ? "Loading your workspace..."
            : `Welcome${name ? `, ${name}` : role === "superadmin" ? ", SuperAdmin" : role === "admin" ? ", Admin" : ", User"}!`}
        </h2>
        <p>{welcomeCopy(role)}</p>
      </section>

      <section className="metric-grid" aria-label="Key metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-card__heading">
              <span className="dashboard-icon-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d={metric.path} /></svg>
              </span>
              <span>{metric.label}</span>
            </div>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="quick-actions" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">Quick Actions</h2>
        <div className="quick-actions__grid">
          {visibleActions.map((action) => (
            <span
              aria-disabled="true"
              className="button button-secondary"
              key={action.label}
              title="Coming soon"
            >
              <span
                className={`dashboard-icon-badge dashboard-icon-badge--button dashboard-icon-badge--${action.tone}`}
                aria-hidden="true"
              >
                {action.icon}
              </span>
              {action.label}
            </span>
          ))}
          {canManageUsers && (
            <Link className="button button-primary" href="/user-management">
              <span
                className="dashboard-icon-badge dashboard-icon-badge--button dashboard-icon-badge--users"
                aria-hidden="true"
              >
                🔑
              </span>
              Manage Users
            </Link>
          )}
          {role === "superadmin" && (
            <span aria-disabled="true" className="button button-secondary" title="Coming soon">
              <span
                className="dashboard-icon-badge dashboard-icon-badge--button dashboard-icon-badge--settings"
                aria-hidden="true"
              >
                ⚙️
              </span>
              System Settings
            </span>
          )}
        </div>
      </section>
    </ErpShell>
  );
}
