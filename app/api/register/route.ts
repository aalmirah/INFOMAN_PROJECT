import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_REQUEST_BYTES = 16 * 1024;

async function readRequestBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  let requestOrigin: string;

  try {
    requestOrigin = origin ? new URL(origin).origin : "";
  } catch {
    requestOrigin = "";
  }

  if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
    return Response.json(
      { error: "Registration request origin is not allowed." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let body: unknown;

  try {
    const requestBody = await readRequestBody(request);
    if (requestBody === null) {
      return Response.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }
    body = JSON.parse(requestBody);
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
  const authorization = request.headers.get("authorization");
  const fields: Record<string, string> = {};

  if (!authorization?.startsWith("Bearer ")) {
    if (!firstName) fields.firstName = "First name is required.";
    else if (firstName.length > 80) {
      fields.firstName = "First name must be 80 characters or fewer.";
    }

    if (!lastName) fields.lastName = "Last name is required.";
    else if (lastName.length > 80) {
      fields.lastName = "Last name must be 80 characters or fewer.";
    }

    if (!email) {
      fields.email = "Email is required.";
    } else if (
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      fields.email = "Enter a valid email address.";
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json(
      { error: "Please correct the invalid fields.", fields },
      { status: 400 },
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return Response.json(
      { error: "Registration is not configured on the server." },
      { status: 503 },
    );
  }

  if (authorization?.startsWith("Bearer ")) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !publishableKey) {
        return Response.json(
          { error: "Registration is not configured on the server." },
          { status: 503 },
        );
      }

      const supabase = getSupabaseAdminClient();
      const authClient = createClient(
        supabaseUrl,
        publishableKey,
        {
          auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
          },
        },
      );
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(authorization.slice("Bearer ".length));

      if (authError || !user?.email) {
        return Response.json(
          { error: "Google registration could not be verified." },
          { status: 401 },
        );
      }

      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id, role, approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (lookupError) {
        console.error("Supabase profile lookup failed after Google signup.", {
          code: lookupError.code,
          message: lookupError.message,
        });
        return Response.json(
          { error: "Registration is temporarily unavailable." },
          { status: 502 },
        );
      }

      if (existingProfile) {
        return Response.json(
          {
            message:
              existingProfile.approval_status === "pending"
                ? "Registration successful. Your account is Pending and awaits Super Admin approval."
                : "This Google account already has a profile. Its existing access status was preserved.",
          },
          { status: 200 },
        );
      }

      return Response.json(
        {
          error:
            "Your account exists, but its profile was not created. Please contact an administrator.",
        },
        { status: 502 },
      );
    } catch (error) {
      console.error(
        "Google registration could not be completed.",
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "Unknown error" },
      );
      return Response.json(
        { error: "Registration is temporarily unavailable." },
        { status: 502 },
      );
    }
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
      },
    });

    if (error) {
      console.error("Supabase Auth admin user creation failed.", {
        status: error.status,
        code: error.code,
        message: error.message,
      });

      if (error.status === 429) {
        return Response.json(
          { error: "Too many registration attempts. Please try again later." },
          { status: 429 },
        );
      }

      if (error.status && error.status >= 500) {
        return Response.json(
          { error: "Registration is temporarily unavailable." },
          { status: 502 },
        );
      }

      return Response.json(
        { error: "Registration could not be completed. Please try again." },
        { status: 400 },
      );
    }

    const user = data.user;
    if (!user) {
      console.error("Supabase Auth user creation returned no user.");
      return Response.json(
        { error: "Registration is temporarily unavailable." },
        { status: 502 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "user" ||
      profile.approval_status !== "pending"
    ) {
      console.error("Signup profile was not created as expected.", {
        code: profileError?.code,
        message: profileError?.message,
        profileFound: Boolean(profile),
        role: profile?.role,
        approvalStatus: profile?.approval_status,
      });

      try {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(
          user.id,
        );
        if (cleanupError) {
          console.error("Auth user cleanup failed after profile creation error.", {
            status: cleanupError.status,
            code: cleanupError.code,
            message: cleanupError.message,
          });
        }
      } catch (cleanupError) {
        console.error(
          "Auth user cleanup could not be completed after profile creation error.",
          cleanupError instanceof Error
            ? { name: cleanupError.name, message: cleanupError.message }
            : { name: "Unknown error" },
        );
      }

      return Response.json(
        { error: "Registration could not be completed. Please try again." },
        { status: 502 },
      );
    }

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    const tokenHash = linkData?.properties?.hashed_token;

    if (linkError || !tokenHash) {
      console.error("Registration session could not be initialized.", {
        code: linkError?.code,
        message: linkError?.message,
        tokenGenerated: Boolean(tokenHash),
      });

      try {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(
          user.id,
        );
        if (cleanupError) {
          console.error("Auth user cleanup failed after session setup error.", {
            status: cleanupError.status,
            code: cleanupError.code,
            message: cleanupError.message,
          });
        }
      } catch (cleanupError) {
        console.error(
          "Auth user cleanup could not be completed after session setup error.",
          cleanupError instanceof Error
            ? { name: cleanupError.name, message: cleanupError.message }
            : { name: "Unknown error" },
        );
      }

      return Response.json(
        { error: "Registration could not be completed. Please try again." },
        { status: 502 },
      );
    }

    return Response.json(
      {
        message:
          "Registration successful. Your account is Pending and awaits Super Admin approval.",
        tokenHash,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "Supabase Auth admin request could not be completed.",
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Unknown error" },
    );
    return Response.json(
      { error: "Registration is temporarily unavailable." },
      { status: 502 },
    );
  }
}
