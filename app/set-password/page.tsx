"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthModal from "@/components/auth-modal";
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
              : profile.approvalStatus === "rejected"
                ? "/login?error=rejected"
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
    <AuthModal
      titleId="set-password-title"
      title="Set a new password"
      intro="Choose a secure password for your account."
    >

        {isReady ? (
          <form className="wireframe-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <div className="wireframe-input-action">
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
                  aria-controls="new-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <fieldset className="wireframe-requirements">
              <legend>Password requirements</legend>
              <label>At least 6 characters</label>
            </fieldset>

            <div className="field">
              <label htmlFor="confirm-password">Confirm password</label>
              <div className="wireframe-input-action">
                <input
                  autoComplete="new-password"
                  id="confirm-password"
                  minLength={6}
                  name="confirmation"
                  placeholder="Re-enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-controls="confirm-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              className="wireframe-button wireframe-button-primary"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving password..." : "Save new password"}
            </button>

            {status && (
              <div aria-live="polite" className="form-alert" data-kind="error" role="alert">
                {status}
              </div>
            )}
          </form>
        ) : (
          <p aria-live="polite" className="form-help">
            {status ?? "Checking your account..."}
          </p>
        )}

        <p className="auth-modal__footer">
          <Link className="wireframe-link" href="/login">Back to Sign In</Link>
        </p>
    </AuthModal>
  );
}
