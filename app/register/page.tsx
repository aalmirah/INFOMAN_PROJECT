"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthModal from "@/components/auth-modal";
import GoogleLogo from "@/components/google-logo";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

type RegistrationStatus = {
  kind: "success" | "error";
  message: string;
};

type RegistrationFieldErrors = Partial<
  Record<"firstName" | "lastName" | "email", string>
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFieldErrors(value: unknown): RegistrationFieldErrors {
  if (!isRecord(value)) return {};

  return {
    ...(typeof value.firstName === "string" && { firstName: value.firstName }),
    ...(typeof value.lastName === "string" && { lastName: value.lastName }),
    ...(typeof value.email === "string" && { email: value.email }),
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  useEffect(() => {
    const callbackUrl = new URL(window.location.href);
    const isGoogleRegistration = callbackUrl.searchParams.get("oauth") === "google";
    let hasHandledGoogleRegistration = false;
    let active = true;

    async function completeGoogleRegistration(accessToken: string) {
      if (hasHandledGoogleRegistration) return;
      hasHandledGoogleRegistration = true;
      setIsGoogleSigningIn(true);

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });
        const result: unknown = await response.json();

        if (!isRecord(result)) {
          throw new Error("Invalid registration response.");
        }
        if (!response.ok) {
          setStatus({
            kind: "error",
            message:
              typeof result.error === "string"
                ? result.error
                : "Google registration could not be completed.",
          });
          return;
        }

        setStatus({
          kind: "success",
          message:
            typeof result.message === "string"
              ? result.message
              : "Your registration is awaiting administrator approval.",
        });
        setIsWaitingForApproval(true);
      } catch {
        setStatus({
          kind: "error",
          message: "Google registration could not be completed. Please try again.",
        });
      } finally {
        callbackUrl.searchParams.delete("oauth");
        window.history.replaceState(
          {},
          "",
          `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`,
        );
        setIsGoogleSigningIn(false);
      }
    }

    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          isGoogleRegistration &&
          event === "SIGNED_IN" &&
          session?.access_token
        ) {
          void completeGoogleRegistration(session.access_token);
        }
      });

      void (async () => {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (!active || error || !user || isGoogleRegistration) return;

        const { profile } = await getAuthProfile(supabase, user.id);
        if (active && profile?.approvalStatus === "pending") {
          setIsWaitingForApproval(true);
          setStatus({
            kind: "success",
            message:
              "Your registration is pending administrator approval. This page will continue checking automatically.",
          });
        }
      })().catch((error: unknown) => {
        console.error(
          "Existing registration session could not be checked.",
          error instanceof Error ? error.name : "Unknown error",
        );
      });

      if (isGoogleRegistration) {
        void supabase.auth.getSession().then(({ data: sessionData, error }) => {
          if (error) {
            console.error("Google registration session could not be read.", {
              code: error.code,
            });
            setStatus({
              kind: "error",
              message:
                "Google registration could not be verified. Please try again.",
            });
            return;
          }
          if (sessionData.session?.access_token) {
            void completeGoogleRegistration(sessionData.session.access_token);
          }
        });
      }

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch (error) {
      console.error(
        "Supabase Auth could not be initialized.",
        error instanceof Error ? error.name : "Unknown error",
      );
    }
  }, [router]);

  useEffect(() => {
    if (!isWaitingForApproval) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkApproval() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          setIsWaitingForApproval(false);
          router.replace("/login");
          return;
        }

        const { profile, error } = await getAuthProfile(supabase, user.id);
        if (error || !profile) {
          throw error ?? new Error("Account profile is unavailable.");
        }

        if (profile.isBlocked || !profile.isActive) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            console.error("Rejected registration session could not be cleared.", {
              code: signOutError.code,
              status: signOutError.status,
            });
          }
          setIsWaitingForApproval(false);
          router.replace(
            profile.isBlocked
              ? "/login?error=blocked"
              : "/login?error=inactive",
          );
          return;
        }

        if (profile.approvalStatus === "approved") {
          setIsWaitingForApproval(false);
          router.replace(
            profile.mustChangePassword ? "/set-password" : "/session",
          );
          router.refresh();
          return;
        }
      } catch (error) {
        console.error(
          "Registration approval status could not be checked.",
          error instanceof Error ? error.name : "Unknown error",
        );
      }

      if (active) {
        timer = setTimeout(checkApproval, 5000);
      }
    }

    void checkApproval();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [isWaitingForApproval, router]);

  async function handleGoogleSignIn() {
    if (isGoogleSigningIn || isSubmitting) return;

    setStatus(null);
    setIsGoogleSigningIn(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/register?oauth=google");
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error("Google OAuth sign-in failed.", {
          status: error.status,
          code: error.code,
        });
        setStatus({
          kind: "error",
          message:
            "Google sign-in could not be started. Please try again or contact an administrator.",
        });
      }
    } catch (error) {
      console.error(
        "Google OAuth sign-in could not be started.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setStatus({
        kind: "error",
        message:
          "Google sign-in could not be started. Please try again or contact an administrator.",
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isGoogleSigningIn) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    setStatus(null);
    setFieldErrors({});

    const nameErrors: RegistrationFieldErrors = {};
    if (!firstName) nameErrors.firstName = "First name is required.";
    if (!lastName) nameErrors.lastName = "Last name is required.";
    if (Object.keys(nameErrors).length > 0) {
      setFieldErrors(nameErrors);
      setStatus({
        kind: "error",
        message: "Please enter your first and last name.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setStatus({
          kind: "error",
          message: "The registration service returned an invalid response.",
        });
        return;
      }

      if (!isRecord(result)) {
        setStatus({
          kind: "error",
          message: "The registration service returned an invalid response.",
        });
        return;
      }

      if (!response.ok) {
        setFieldErrors(getFieldErrors(result.fields));
        setStatus({
          kind: "error",
          message:
            typeof result.error === "string"
              ? result.error
              : "Registration failed. Please try again.",
        });
        return;
      }

      if (typeof result.tokenHash !== "string" || !result.tokenHash) {
        setStatus({
          kind: "error",
          message:
            "Your account was created, but we couldn't start its approval session. Contact an administrator.",
        });
        return;
      }

      const { error: sessionError } = await getSupabaseClient().auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      });
      if (sessionError) {
        console.error("Registration approval session could not be started.", {
          code: sessionError.code,
          status: sessionError.status,
        });
        setStatus({
          kind: "error",
          message:
            "Your account was created, but we couldn't start its approval session. Contact an administrator.",
        });
        return;
      }

      form.reset();
      setFieldErrors({});
      setIsWaitingForApproval(true);
      setStatus({
        kind: "success",
        message:
          typeof result.message === "string"
            ? result.message
            : "Your registration is pending administrator approval. This page will continue checking automatically.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Could not connect to the registration service. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthModal titleId="register-title" title="Create your account">
        <form className="wireframe-form" onSubmit={handleSubmit}>
          <div className="auth-modal__name-row">
            <div className="field">
              <label htmlFor="register-first-name">
                First name <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                disabled={isWaitingForApproval}
                id="register-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="Your first name"
                maxLength={80}
                required
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    firstName: undefined,
                  }));
                  setStatus(null);
                }}
                aria-invalid={Boolean(fieldErrors.firstName)}
                aria-describedby={
                  fieldErrors.firstName
                    ? "register-first-name-error"
                    : undefined
                }
              />
              {fieldErrors.firstName && (
                <p
                  className="field-error"
                  id="register-first-name-error"
                  role="status"
                >
                  <span className="field-error-icon" aria-hidden="true">
                    !
                  </span>
                  <span>{fieldErrors.firstName}</span>
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="register-last-name">
                Last name <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                disabled={isWaitingForApproval}
                id="register-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Your last name"
                maxLength={80}
                required
                onChange={() => {
                  setFieldErrors((current) => ({
                    ...current,
                    lastName: undefined,
                  }));
                  setStatus(null);
                }}
                aria-invalid={Boolean(fieldErrors.lastName)}
                aria-describedby={
                  fieldErrors.lastName
                    ? "register-last-name-error"
                    : undefined
                }
              />
              {fieldErrors.lastName && (
                <p
                  className="field-error"
                  id="register-last-name-error"
                  role="status"
                >
                  <span className="field-error-icon" aria-hidden="true">
                    !
                  </span>
                  <span>{fieldErrors.lastName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="register-email">
              Email address{" "}
              <span className="required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              disabled={isWaitingForApproval}
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              maxLength={320}
              required
              onChange={() => {
                setFieldErrors((current) => ({
                  ...current,
                  email: undefined,
                }));
                setStatus(null);
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "register-email-error" : undefined
              }
            />
            {fieldErrors.email && (
              <p
                className="field-error"
                id="register-email-error"
                role="status"
              >
                <span className="field-error-icon" aria-hidden="true">
                  !
                </span>
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          <button
            className="wireframe-button wireframe-button-primary"
            type="submit"
            disabled={
              isSubmitting || isGoogleSigningIn || isWaitingForApproval
            }
          >
            {isSubmitting ? "Registering..." : "Register"}
          </button>
          <button
            className="wireframe-button google-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={
              isSubmitting || isGoogleSigningIn || isWaitingForApproval
            }
          >
            <GoogleLogo />
            <span>
              {isGoogleSigningIn
                ? "Connecting to Google..."
                : "Continue with Google"}
            </span>
          </button>

          {status && (
            <div
              className="form-alert"
              data-kind={status.kind}
              role={status.kind === "error" ? "alert" : "status"}
              aria-live={status.kind === "error" ? "assertive" : "polite"}
            >
              <strong>
                {status.kind === "success"
                  ? "Registration submitted. "
                  : "Registration failed. "}
              </strong>
              {status.message}
            </div>
          )}
        </form>

        <p className="auth-modal__footer">
          Already registered?{" "}
          <Link className="wireframe-link" href="/login">Sign In</Link>
        </p>
    </AuthModal>
  );
}
