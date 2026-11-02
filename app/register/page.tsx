"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  useEffect(() => {
    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          setStatus({
            kind: "success",
            message:
              "Google sign-in successful. Your account is Pending and awaits Super Admin approval.",
          });
        }
      });

      return () => data.subscription.unsubscribe();
    } catch (error) {
      console.error(
        "Supabase Auth could not be initialized.",
        error instanceof Error ? error.name : "Unknown error",
      );
    }
  }, []);

  async function handleGoogleSignIn() {
    if (isGoogleSigningIn || isSubmitting) return;

    setStatus(null);
    setIsGoogleSigningIn(true);

    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/register`,
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

      form.reset();
      setFieldErrors({});
      setStatus({
        kind: "success",
        message:
          typeof result.message === "string"
            ? result.message
            : "Your registration request was submitted.",
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
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="register-title">
        <header className="auth-header">
          <Link className="brand" href="/register">
            <span className="brand-mark" aria-hidden="true">
              H
            </span>
            <span>HOPE Inc. ERP</span>
          </Link>
          <h1 id="register-title">Create your account</h1>
          <p>Join Hope Inc. ERP</p>
        </header>

        <div className="status-note role-note" role="note">
          <span>
            New accounts are created as User. Superadmin and Admin roles can
            only be assigned by existing administrators.
          </span>
        </div>

        <form
          className="form-stack"
          onSubmit={handleSubmit}
        >
          <div className="register-name-fields">
            <div className="field">
              <label htmlFor="register-first-name">
                First name <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="register-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="Your first name"
                maxLength={100}
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
                id="register-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Your last name"
                maxLength={100}
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

          <div className="form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting || isGoogleSigningIn}
            >
              {isSubmitting ? "Registering..." : "Register"}
            </button>
            <div className="form-divider" aria-hidden="true">
              OR
            </div>
            <button
              className="sso-button"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isGoogleSigningIn}
            >
              <svg
                className="google-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
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
              {isGoogleSigningIn ? "Connecting to Google..." : "Continue with Google"}
            </button>
          </div>
        </form>

        {status && (
          <div
            className={`status-note submission-status submission-status-${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
            aria-live={status.kind === "error" ? "assertive" : "polite"}
          >
            <strong>
              {status.kind === "success"
                ? "Registration submitted"
                : "Registration failed"}
            </strong>
            <span>{status.message}</span>
          </div>
        )}

        <p className="auth-footer">
          Already have an account?{" "}
          <span className="sign-in-disabled" aria-disabled="true">
            Sign in
          </span>
        </p>
      </section>
    </main>
  );
}
