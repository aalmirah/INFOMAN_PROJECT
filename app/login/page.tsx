"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";

type LoginStatus = {
  kind: "error" | "success";
  message: string;
};

async function clearRejectedSession(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) {
    console.error("Rejected Supabase session could not be cleared.", {
      code: error.code,
      status: error.status,
    });
  }
}

function getQueryError(): string | null {
  return new URLSearchParams(window.location.search).get("error");
}

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const error = getQueryError();
    const messages: Record<string, string> = {
      blocked:
        "This account is currently unavailable. Contact your administrator for help.",
      inactive:
        "This account is currently inactive. Contact your administrator for help.",
      pending:
        "Your account is awaiting administrator approval. You cannot sign in yet.",
      profile:
        "We couldn't verify your account profile. Contact your administrator for help.",
      callback:
        "Sign-in could not be completed. Please try again.",
      recovery:
        "This password recovery link is invalid or expired. Request a new reset link.",
    };

    let active = true;
    const passwordChange = new URLSearchParams(window.location.search).get(
      "password",
    );
    void getSupabaseClient()
      .auth.getUser()
      .then(async ({ data: { user }, error: authError }) => {
        if (!active) return;
        if (error && messages[error]) {
          setStatus({ kind: "error", message: messages[error] });
        }
        if (authError || !user) {
          if (passwordChange === "updated") {
            setStatus({
              kind: "success",
              message: "Your password was set. Sign in with your new password.",
            });
          } else if (passwordChange === "reset") {
            setStatus({
              kind: "success",
              message: "Your password was reset. Sign in with your new password.",
            });
          }
          return;
        }

        const { profile, error: profileError } = await getAuthProfile(
          getSupabaseClient(),
          user.id,
        );
        if (!active) return;

        if (profileError || !profile) {
          await clearRejectedSession();
          setStatus({
            kind: "error",
            message:
              "We couldn't verify your account profile. Contact your administrator for help.",
          });
          return;
        }

        if (
          profile.isBlocked ||
          !profile.isActive ||
          profile.approvalStatus !== "approved"
        ) {
          await clearRejectedSession();
          setStatus({
            kind: "error",
            message: profile.isBlocked
              ? "This account is currently unavailable. Contact your administrator for help."
              : !profile.isActive
                ? "This account is currently inactive. Contact your administrator for help."
                : "Your account is awaiting administrator approval. You cannot sign in yet.",
          });
          return;
        }

        router.replace(
          profile.mustChangePassword ? "/set-password" : "/session",
        );
      })
      .catch(() => {
        if (active) {
          setStatus({
            kind: "error",
            message: "We couldn't verify your current session. Please try again.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isGoogleSigningIn) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setStatus(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setStatus({
          kind: "error",
          message:
            error?.status === 429
              ? "Too many sign-in attempts. Please wait a moment and try again."
              : "We couldn't sign you in with those details. Check your email and password and try again.",
        });
        return;
      }

      const { profile, error: profileError } = await getAuthProfile(
        supabase,
        data.user.id,
      );
      if (profileError || !profile) {
        await clearRejectedSession();
        setStatus({
          kind: "error",
          message:
            "We couldn't verify your account profile. Contact your administrator for help.",
        });
        return;
      }

      if (
        profile.isBlocked ||
        !profile.isActive ||
        profile.approvalStatus !== "approved"
      ) {
        await clearRejectedSession();
        setStatus({
          kind: "error",
          message: profile.isBlocked
            ? "This account is currently unavailable. Contact your administrator for help."
            : !profile.isActive
              ? "This account is currently inactive. Contact your administrator for help."
              : "Your account is awaiting administrator approval. You cannot sign in yet.",
        });
        return;
      }

      router.replace(
        profile.mustChangePassword ? "/set-password" : "/session",
      );
      router.refresh();
    } catch (error) {
      console.error(
        "Login could not be completed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus({
        kind: "error",
        message: "We couldn't sign you in right now. Please try again shortly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (isSubmitting || isGoogleSigningIn) return;
    setStatus(null);
    setIsGoogleSigningIn(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/session");
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });

      if (error) {
        console.error("Google sign-in could not be started.", {
          code: error.code,
          status: error.status,
        });
        setStatus({
          kind: "error",
          message: "Google sign-in could not be started. Please try again.",
        });
      }
    } catch (error) {
      console.error(
        "Google sign-in could not be started.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus({
        kind: "error",
        message: "Google sign-in could not be started. Please try again.",
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  }

  return (
    <AuthPageFrame
      activeLink="login"
      closeHref="/register"
      description="Welcome back. Enter your account info."
      title="Sign in"
    >
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">
              Email address <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              autoComplete="email"
              autoFocus
              id="login-email"
              name="email"
              placeholder="you@company.com"
              required
              type="email"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">
              Password <span className="required" aria-hidden="true">*</span>
            </label>
            <div className="functional-password-input">
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                placeholder="Enter your password"
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
          </div>

          <div className="login-recovery-link">
            <Link href="/reset-password">Forgot Password?</Link>
          </div>

          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={isSubmitting || isGoogleSigningIn}
              type="submit"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
            <div aria-hidden="true" className="form-divider">OR</div>
            <button
              className="sso-button"
              disabled={isSubmitting || isGoogleSigningIn}
              onClick={handleGoogleSignIn}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="google-mark"
                focusable="false"
                viewBox="0 0 24 24"
              >
                <path
                  fill="#4285F4"
                  d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"
                />
                <path
                  fill="#34A853"
                  d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.54 13.58a5.85 5.85 0 0 1 0-3.16V7.89H3.3a9.5 9.5 0 0 0 0 8.22l3.24-2.53Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 6.39c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.49 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.11 9.46 6.39 12 6.39Z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        </form>

        {status && (
          <div
            aria-live="polite"
            className={`status-note functional-auth-status functional-auth-status-${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            <span>{status.message}</span>
          </div>
        )}

        <p className="auth-footer">
          Don&apos;t have an account? <Link href="/register">Register</Link>
        </p>
    </AuthPageFrame>
  );
}
