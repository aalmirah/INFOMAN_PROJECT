import { createClient } from "@supabase/supabase-js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName =
    typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fields: Record<string, string> = {};

  if (!firstName) fields.firstName = "First name is required.";
  else if (firstName.length > 100) {
    fields.firstName = "First name must be 100 characters or fewer.";
  }

  if (!lastName) fields.lastName = "Last name is required.";
  else if (lastName.length > 100) {
    fields.lastName = "Last name must be 100 characters or fewer.";
  }

  if (!email) {
    fields.email = "Email is required.";
  } else if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fields.email = "Enter a valid email address.";
  }

  if (!password.trim()) {
    fields.password = "Password is required.";
  } else if (Array.from(password).length < 6) {
    fields.password = "Password must be at least 6 characters long.";
  }

  if (Object.keys(fields).length > 0) {
    return Response.json(
      { error: "Please correct the invalid fields.", fields },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return Response.json(
      { error: "Registration is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabasePublishableKey);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`,
        },
      },
    });

    if (error) {
      if (error.code === "weak_password") {
        const reasons =
          "reasons" in error && Array.isArray(error.reasons)
            ? error.reasons.filter(
                (reason): reason is string => typeof reason === "string",
              )
            : [];
        const message = reasons.includes("length")
          ? "Password must be at least 6 characters long."
          : "Choose a different password and try again.";

        return Response.json(
          { error: message, fields: { password: message } },
          { status: 400 },
        );
      }

      if (error.status === 429) {
        return Response.json(
          { error: "Too many registration attempts. Please try again later." },
          { status: 429 },
        );
      }

      if (error.status === 400) {
        return Response.json(
          {
            error:
              "Registration details were rejected. Check the email and password requirements.",
          },
          { status: 400 },
        );
      }

      console.error("Supabase Auth signup failed.", {
        status: error.status,
        code: error.code,
      });
      return Response.json(
        { error: "Registration is temporarily unavailable." },
        { status: 502 },
      );
    }

    return Response.json(
      {
        message:
          "Registration successful. Your account is Pending and awaits Super Admin approval.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Supabase Auth signup request could not be completed.",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      { error: "Registration is temporarily unavailable." },
      { status: 502 },
    );
  }
}
