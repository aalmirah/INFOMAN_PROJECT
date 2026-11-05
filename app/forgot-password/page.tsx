"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AuthModal from "@/components/auth-modal";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    const email = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();
    setStatus(null);
    setIsSending(true);

    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/reset-password");
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
        email,
        { redirectTo: redirectTo.toString() },
      );

      if (error && error.status === 429) {
        setStatus({
          kind: "error",
          message: "Too many requests. Please wait a moment and try again.",
        });
        return;
      }
      if (error) {
        console.error("Password reset request failed.", {
          code: error.code,
          status: error.status,
        });
      }
      setStatus({
        kind: "success",
        message:
          "Check your email. If an account matches that email, we'll send a reset link.",
      });
    } catch (error) {
      console.error(
        "Password reset request failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus({
        kind: "error",
        message: "We couldn't send a reset link right now. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AuthModal
      titleId="forgot-password-title"
      title="Forgot password?"
      intro="Enter your email to request a reset link."
    >
      <form className="wireframe-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reset-email">Email</label>
          <input
            autoComplete="email"
            autoFocus
            id="reset-email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>
        <button
          className="wireframe-button wireframe-button-primary"
          disabled={isSending}
          type="submit"
        >
          {isSending ? "Sending..." : "Send Reset Link"}
        </button>
        {status && (
          <div
            aria-live="polite"
            className="form-alert"
            data-kind={status.kind}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </div>
        )}
      </form>
      <p className="auth-modal__footer">
        <Link className="wireframe-link" href="/login">Back to Sign In</Link>
      </p>
    </AuthModal>
  );
}
