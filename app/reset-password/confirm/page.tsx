"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validatePasswordPair } from "@/lib/auth/password-validation";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";

export default function ResetPasswordConfirmPage() {
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
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;
      if (authError || !user) {
        router.replace("/login?error=recovery");
        return;
      }

      const { profile, error } = await getAuthProfile(supabase, user.id);
      if (!active) return;
      if (
        error ||
        !profile ||
        profile.isBlocked ||
        !profile.isActive ||
        profile.approvalStatus !== "approved"
      ) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Rejected password recovery session could not be cleared.", {
            code: signOutError.code,
            status: signOutError.status,
          });
        }
        router.replace(
          profile?.isBlocked
            ? "/login?error=blocked"
            : profile && !profile.isActive
              ? "/login?error=inactive"
              : profile && profile.approvalStatus === "rejected"
                ? "/login?error=rejected"
                : profile && profile.approvalStatus !== "approved"
                ? "/login?error=pending"
                : "/login?error=profile",
        );
        return;
      }

      setIsReady(true);
    })().catch((error: unknown) => {
      console.error(
        "Password recovery session could not be initialized.",
        error instanceof Error ? error.name : "Unknown error",
      );
      if (active) {
        setStatus("The reset link may be invalid or expired. Request a new link.");
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
    const validationError = validatePasswordPair(password, confirmation);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setStatus(null);
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login?error=recovery");
        return;
      }

      const { profile, error: profileError } = await getAuthProfile(
        supabase,
        user.id,
      );
      if (
        profileError ||
        !profile ||
        profile.isBlocked ||
        !profile.isActive ||
        profile.approvalStatus !== "approved"
      ) {
        setStatus(
          "This account is not eligible to reset its password. Contact your administrator.",
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setStatus(
          updateError.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "We couldn't update your password. Check the requirements and try again.",
        );
        return;
      }

      let clearResponse: Response;
      try {
        clearResponse = await fetch("/api/auth/recovery-complete", {
          method: "POST",
        });
      } catch {
        setStatus(
          "Your password was updated, but we couldn't safely finish the recovery session. Please try again.",
        );
        return;
      }
      if (!clearResponse.ok) {
        console.error("Password reset marker could not be cleared.", {
          status: clearResponse.status,
        });
        setStatus(
          "Your password was updated, but we couldn't safely finish the recovery session. Please try again.",
        );
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Password was reset but sign-out failed.", {
          code: signOutError.code,
          status: signOutError.status,
        });
        setStatus(
          "Your password was updated, but we couldn't end the recovery session. Please try signing out.",
        );
        return;
      }

      router.replace("/login?password=reset");
      router.refresh();
    } catch (error) {
      console.error(
        "Password reset could not be completed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus("We couldn't update your password right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthPageFrame
      activeLink="login"
      description="Enter and confirm your new password."
      title="Set a new password"
    >
        {isReady ? (
          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="reset-new-password">New password</label>
              <div className="functional-password-input">
                <input
                  autoComplete="new-password"
                  autoFocus
                  id="reset-new-password"
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
              <label htmlFor="reset-confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                id="reset-confirm-password"
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
                {isSaving ? "Saving password..." : "Save new password"}
              </button>
            </div>
          </form>
        ) : (
          <p aria-live="polite" className="form-help">
            {status ?? "Verifying your reset link..."}
          </p>
        )}

        {status && isReady && (
          <div
            aria-live="polite"
            className="status-note functional-auth-status"
            role="alert"
          >
            <span>{status}</span>
          </div>
        )}

        <p className="auth-footer">
          <Link href="/login">Back to Sign In</Link>
        </p>
    </AuthPageFrame>
  );
}
