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

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.createUser({
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

    return Response.json(
      {
        message:
          "Registration successful. Your account is Pending and awaits Super Admin approval.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Supabase Auth admin request could not be completed.",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      { error: "Registration is temporarily unavailable." },
      { status: 502 },
    );
  }
}
