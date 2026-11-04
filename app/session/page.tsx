"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function SessionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSupabaseClient()
      .auth.getUser()
      .then(({ data: { user }, error }) => {
        if (!active) return;
        if (error) {
          setStatus("We couldn't verify your session. Please try again.");
          return;
        }
        if (!user) {
          router.replace("/login");
          return;
        }
        setEmail(user.email ?? null);
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

  async function handleSignOut() {
    if (isSigningOut) return;
    setStatus(null);
    setIsSigningOut(true);

    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        console.error("Supabase sign-out failed.", {
          code: error.code,
          status: error.status,
        });
        setStatus("We couldn't sign you out. Please try again.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Supabase sign-out failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus("We couldn't sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <main className="auth-layout functional-auth">
      <section className="auth-card" aria-labelledby="session-title">
        <header className="auth-header">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">H</span>
            <span>HOPE Inc. ERP</span>
          </Link>
          <h1 id="session-title">You&apos;re signed in</h1>
          <p>
            The Dashboard is not available yet. This temporary page lets you
            verify your session and sign out.
          </p>
        </header>

        {email && <p className="form-help">Signed in as {email}</p>}

        {status && (
          <div
            aria-live="polite"
            className="status-note functional-auth-status"
            role="alert"
          >
            <span>{status}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={isLoading || isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            {isSigningOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </section>
    </main>
  );
}
