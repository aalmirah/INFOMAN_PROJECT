"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";

export default function ResetPasswordRequestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const redirectTo = new URL(
        "/auth/callback?next=/reset-password/confirm",
        window.location.origin,
      ).toString();
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
        email,
        { redirectTo },
      );

      if (error) {
        console.warn("Password reset request failed.", {
          name: error.name,
          code: error.code,
          status: error.status,
          message: error.message,
        });
        setStatus({
          kind: "error",
          message:
            "We couldn't process the request right now. Please try again later.",
        });
        return;
      }

      setStatus({
        kind: "success",
        message:
          "If an account exists with this email, a password reset link will be sent. Check your spam or junk folder.",
      });
    } catch (error) {
      console.warn(
        "Password reset request could not be completed.",
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "Unknown error",
      );
      setStatus({
        kind: "error",
        message:
          "We couldn't process the request right now. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageFrame
      activeLink="login"
      description="Enter your email to request a reset link."
      title="Forgot password?"
    >
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reset-email">Email</label>
            <input
              autoComplete="email"
              autoFocus
              id="reset-email"
              maxLength={320}
              name="email"
              placeholder="name@example.com"
              required
              type="email"
            />
          </div>
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending reset link..." : "Send Reset Link"}
            </button>
          </div>
        </form>

        {status && (
          <div
            aria-live="polite"
            className={`status-note functional-auth-status functional-auth-status-${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            <strong>{status.kind === "success" ? "Check your email" : "Request failed"}</strong>
            <span>{status.message}</span>
          </div>
        )}

        <p className="auth-footer">
          <Link href="/login">Back to Sign In</Link>
        </p>
    </AuthPageFrame>
  );
}
