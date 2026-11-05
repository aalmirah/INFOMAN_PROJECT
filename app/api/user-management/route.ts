import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserManagementActor } from "@/lib/auth/user-management";
import {
  isSameOriginRequest,
  readJsonRequestBody,
} from "@/lib/user-management/request";

const PROFILE_COLUMNS =
  "id, first_name, last_name, email, role, approval_status, is_active, is_blocked, created_at";
const PAGE_SIZE = 25;

function parsePage(value: string | null): number | null {
  if (value === null) return 1;
  if (!/^[1-9]\d{0,6}$/.test(value)) return null;
  return Number(value);
}

function sanitizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}@.+\- ]/gu, "")
    .trim()
    .slice(0, 100);
}

function toAccountStatus(profile: {
  is_blocked: boolean;
  is_active: boolean;
  approval_status: string;
}): "blocked" | "inactive" | "pending" | "rejected" | "active" {
  if (profile.is_blocked) return "blocked";
  if (!profile.is_active) return "inactive";
  if (profile.approval_status === "rejected") return "rejected";
  if (profile.approval_status !== "approved") return "pending";
  return "active";
}

export async function GET(request: Request): Promise<Response> {
  const result = await getUserManagementActor();
  if (!result.actor) {
    return Response.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  const requestedRole = url.searchParams.get("role") ?? "all";
  const requestedStatus = url.searchParams.get("status") ?? "all";
  const search = sanitizeSearch(url.searchParams.get("search") ?? "");

  if (
    page === null ||
    !["all", "user", "admin", "superadmin"].includes(requestedRole) ||
    !["all", "active", "pending", "rejected", "inactive", "blocked"].includes(
      requestedStatus,
    )
  ) {
    return Response.json({ error: "Invalid user list filters." }, { status: 400 });
  }

  if (
    result.actor.role === "admin" &&
    requestedRole !== "all" &&
    requestedRole !== "user" &&
    requestedRole !== "admin"
  ) {
    return Response.json({ error: "You cannot view that role." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (result.actor.role === "admin") {
    query = query.in("role", ["user", "admin"]);
  } else if (requestedRole !== "all") {
    query = query.eq("role", requestedRole);
  }

  if (requestedStatus === "blocked") {
    query = query.eq("is_blocked", true);
  } else if (requestedStatus === "inactive") {
    query = query.eq("is_blocked", false).eq("is_active", false);
  } else if (requestedStatus === "pending") {
    query = query
      .eq("is_blocked", false)
      .eq("is_active", true)
      .eq("approval_status", "pending");
  } else if (requestedStatus === "rejected") {
    query = query
      .eq("is_blocked", false)
      .eq("is_active", true)
      .eq("approval_status", "rejected");
  } else if (requestedStatus === "active") {
    query = query
      .eq("is_blocked", false)
      .eq("is_active", true)
      .eq("approval_status", "approved");
  }

  if (search) {
    query = query.or(
      `first_name.ilike.*${search}*,last_name.ilike.*${search}*,email.ilike.*${search}*`,
    );
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("User Management list query failed.", { code: error.code });
    return Response.json(
      { error: "Could not load users. Please try again." },
      { status: 502 },
    );
  }

  const users = (data ?? []).map((profile) => ({
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    role: profile.role,
    accountStatus: toAccountStatus(profile),
    createdAt: profile.created_at,
  }));
  const total = count ?? 0;

  return Response.json(
    {
      users,
      actorRole: result.actor.role,
      actorId: result.actor.id,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "User creation request origin is not allowed." },
      { status: 403 },
    );
  }

  const result = await getUserManagementActor();
  if (!result.actor) {
    return Response.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const body = await readJsonRequestBody(request);
  if (!isRecord(body)) {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    Object.keys(body).length !== 3 ||
    !Object.hasOwn(body, "firstName") ||
    !Object.hasOwn(body, "lastName") ||
    !Object.hasOwn(body, "email")
  ) {
    return Response.json({ error: "Invalid user creation fields." }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (
    !firstName ||
    firstName.length > 80 ||
    !lastName ||
    lastName.length > 80 ||
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return Response.json(
      {
        error: "Enter a valid email address and names of up to 80 characters.",
      },
      { status: 400 },
    );
  }

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
  if (error || !data.user) {
    console.error("Admin-created Auth user could not be created.", {
      code: error?.code,
      status: error?.status,
    });
    return Response.json(
      { error: "Could not add that user. Check the email and try again." },
      { status: error?.status === 429 ? 429 : 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", data.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "user" ||
    profile.approval_status !== "pending"
  ) {
    console.error("Admin-created Auth profile was not created as expected.", {
      code: profileError?.code,
      profileFound: Boolean(profile),
    });
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(
      data.user.id,
    );
    if (cleanupError) {
      console.error("Auth user cleanup failed after profile creation error.", {
        code: cleanupError.code,
        status: cleanupError.status,
      });
    }
    return Response.json(
      { error: "Could not complete user creation. Please contact an administrator." },
      { status: 502 },
    );
  }

  return Response.json(
    {
      user: {
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        role: profile.role,
        accountStatus: toAccountStatus(profile),
        createdAt: profile.created_at,
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
