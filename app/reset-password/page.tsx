"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthModal from "@/components/auth-modal";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSupabaseClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!active) return;
        if (!user) {
          router.replace("/login?error=recovery");
          return;
        }
        setIsReady(true);
      })
      .catch(() => {
        if (active) {
          setStatus("We couldn't verify your reset link. Please request a new one.");
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus(
          error.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "We couldn't reset your password. Check the requirements or request a new link.",
        );
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login?password=reset");
      router.refresh();
    } catch (error) {
      console.error(
        "Password reset failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus("We couldn't reset your password right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const toggle = (controls: string) => (
    <button
      aria-controls={controls}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="password-toggle"
      onClick={() => setShowPassword((value) => !value)}
      type="button"
    >
      {showPassword ? "Hide" : "Show"}
    </button>
  );

  return (
    <AuthModal
      titleId="reset-password-title"
      title="Set a new password"
      intro="Choose a secure password for your account."
    >
      {isReady ? (
        <form className="wireframe-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reset-new-password">New password</label>
            <div className="wireframe-input-action">
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
              {toggle("reset-new-password")}
            </div>
          </div>
          <div className="field">
            <label htmlFor="reset-confirm-password">Confirm password</label>
            <div className="wireframe-input-action">
              <input
                autoComplete="new-password"
                id="reset-confirm-password"
                minLength={6}
                name="confirmation"
                placeholder="Re-enter your password"
                required
                type={showPassword ? "text" : "password"}
              />
              {toggle("reset-confirm-password")}
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
          {status ?? "Checking your reset link..."}
        </p>
      )}
      <p className="auth-modal__footer">
        <Link className="wireframe-link" href="/login">Back to Sign In</Link>
      </p>
    </AuthModal>
  );
}
