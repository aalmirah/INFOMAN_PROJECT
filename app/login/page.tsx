"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthModal from "@/components/auth-modal";
import GoogleLogo from "@/components/google-logo";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

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
        "This password setup link is invalid or expired. Contact your administrator to request a new link.",
    };

    let active = true;
    const passwordParam = new URLSearchParams(window.location.search).get(
      "password",
    );
    const passwordUpdated = passwordParam === "updated";
    const passwordReset = passwordParam === "reset";
    void getSupabaseClient()
      .auth.getUser()
      .then(async ({ data: { user }, error: authError }) => {
        if (!active) return;
        if (error && messages[error]) {
          setStatus({ kind: "error", message: messages[error] });
        }
        if (authError || !user) {
          if (passwordReset) {
            setStatus({
              kind: "success",
              message: "Your password was reset. Sign in with your new password.",
            });
          } else if (passwordUpdated) {
            setStatus({
              kind: "success",
              message: "Your password was set. Sign in with your new password.",
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
    <AuthModal
      titleId="login-title"
      title="Sign in"
      intro="Welcome back. Enter your account info."
    >
      <form className="wireframe-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            autoComplete="email"
            autoFocus
            id="login-email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div className="wireframe-input-action">
            <input
              autoComplete="current-password"
              id="login-password"
              name="password"
              placeholder="Enter your password"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-controls="login-password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <Link
          className="wireframe-link field-help"
          href="/forgot-password"
        >
          Forgot password?
        </Link>

        <button
          className="wireframe-button wireframe-button-primary"
          disabled={isSubmitting || isGoogleSigningIn}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
        <button
          className="wireframe-button google-btn"
          disabled={isSubmitting || isGoogleSigningIn}
          onClick={handleGoogleSignIn}
          type="button"
        >
          <GoogleLogo />
          <span>Continue with Google</span>
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
        New to Hope, Inc.?{" "}
        <Link className="wireframe-link" href="/register">Register</Link>
      </p>
    </AuthModal>
  );
}