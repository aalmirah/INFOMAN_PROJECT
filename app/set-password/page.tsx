"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile, error } = await getAuthProfile(supabase, user.id);
      if (!active) return;

      if (error || !profile) {
        setStatus(
          "We couldn't verify your account profile. Contact your administrator for help.",
        );
        return;
      }
      if (
        profile.isBlocked ||
        !profile.isActive ||
        profile.approvalStatus !== "approved"
      ) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Rejected Supabase session could not be cleared.", {
            code: signOutError.code,
            status: signOutError.status,
          });
        }
        router.replace(
          profile.isBlocked
            ? "/login?error=blocked"
            : !profile.isActive
              ? "/login?error=inactive"
              : "/login?error=pending",
        );
        return;
      }
      if (!profile.mustChangePassword) {
        router.replace("/session");
        return;
      }

      setIsReady(true);
    })().catch((error: unknown) => {
      console.error(
        "First-login password setup could not be initialized.",
        error instanceof Error ? error.name : "Unknown error",
      );
      if (active) {
        setStatus("We couldn't load password setup. Please try signing in again.");
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (password.length < 6) {
      setStatus("Use a password with at least 6 characters.");
      return;
    }
    if (password !== confirmation) {
      setStatus("Passwords do not match.");
      return;
    }

    setStatus(null);
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setStatus(
          updateError.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "We couldn't update your password. Check the requirements and try again.",
        );
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setStatus(
          "Your password was changed, but we couldn't verify your setup session. Contact your administrator.",
        );
        return;
      }

      const { profile, error: profileError } = await getAuthProfile(
        supabase,
        user.id,
      );
      if (profileError || !profile || profile.mustChangePassword) {
        console.error(
          "Password changed, but the first-login requirement was not cleared.",
          profileError instanceof Error
            ? { message: profileError.message }
            : { profileFound: Boolean(profile) },
        );
        setStatus(
          "Your password was changed, but we couldn't finish account setup. Contact your administrator.",
        );
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Password was set but logout failed.", {
          code: signOutError.code,
          status: signOutError.status,
        });
        setStatus(
          "Your password was set, but we couldn't end the setup session. Please try signing out again.",
        );
        return;
      }

      router.replace("/login?password=updated");
      router.refresh();
    } catch (error) {
      console.error(
        "First-login password update failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus("We couldn't update your password right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="auth-layout functional-auth">
      <section className="auth-card" aria-labelledby="set-password-title">
        <header className="auth-header">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">H</span>
            <span>HOPE Inc. ERP</span>
          </Link>
          <h1 id="set-password-title">Set your password</h1>
          <p>Choose a new password to finish setting up your account.</p>
        </header>

        {isReady ? (
          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="new-password">
                New password <span className="required" aria-hidden="true">*</span>
              </label>
              <div className="functional-password-input">
                <input
                  autoComplete="new-password"
                  autoFocus
                  id="new-password"
                  minLength={6}
                  name="password"
                  placeholder="Enter a new password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-visibility"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="form-help">Use at least 6 characters.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">
                Confirm password <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                autoComplete="new-password"
                id="confirm-password"
                minLength={6}
                name="confirmation"
                placeholder="Re-enter your new password"
                required
                type={showPassword ? "text" : "password"}
              />
            </div>
            <div className="form-actions">
              <button
                className="button button-primary"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving password..." : "Save password"}
              </button>
            </div>
          </form>
        ) : (
          <p aria-live="polite" className="form-help">
            {status ?? "Checking your account..."}
          </p>
        )}

        {status && isReady && (
          <div aria-live="polite" className="status-note functional-auth-status" role="alert">
            <span>{status}</span>
          </div>
        )}

        <p className="auth-footer">
          <Link href="/login">Back to Sign In</Link>
        </p>
      </section>
    </main>
  );
}
