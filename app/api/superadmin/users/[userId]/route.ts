import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSuperadminActor,
  isLastActiveSuperadmin,
  LAST_SUPERADMIN_MESSAGE,
} from "@/lib/auth/superadmin";
import {
  isSameOriginRequest,
  readJsonRequestBody,
} from "@/lib/user-management/request";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const ACTIONS = ["approve", "reject", "promote", "demote"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Request origin is not allowed." }, 403);
  }

  const result = await getSuperadminActor();
  if (!result.actor) {
    return json({ error: result.error }, result.status);
  }

  const { userId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: "Invalid user ID." }, 400);
  }

  const body = await readJsonRequestBody(request);
  const action =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).action
      : undefined;
  if (!isAction(action)) {
    return json(
      { error: "Action must be approve, reject, promote, or demote." },
      400,
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("id, role, approval_status, is_active, is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) {
    console.error("Superadmin target lookup failed.", { code: lookupError.code });
    return json({ error: "Could not verify the selected user." }, 502);
  }
  if (!target) {
    return json({ error: "User not found." }, 404);
  }

  if (target.role === "superadmin") {
    // Every action here would delete or demote a Superadmin, so the last one is always protected.
    const isLast = await isLastActiveSuperadmin(target.id);
    if (isLast === null) {
      return json({ error: "Could not verify Superadmin safety. Action blocked." }, 503);
    }
    if (isLast) {
      return json({ error: LAST_SUPERADMIN_MESSAGE }, 409);
    }
    return json(
      { error: "Superadmin accounts cannot be changed from this screen." },
      403,
    );
  }
  if (target.id === result.actor.id) {
    return json({ error: "You cannot change your own account." }, 403);
  }

  if (action === "approve") {
    const { data, error } = await supabase
      .from("profiles")
      .update({ approval_status: "approved", must_change_password: true })
      .eq("id", userId)
      .eq("role", "user")
      .eq("approval_status", "pending")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Approve failed.", { code: error.code });
      return json({ error: "Could not approve this account. Please try again." }, 502);
    }
    if (!data) {
      return json({ error: "This account is no longer pending approval." }, 409);
    }
    return json({ success: true, message: "Account approved." });
  }

  if (action === "reject") {
    if (target.role !== "user" || target.approval_status !== "pending") {
      return json({ error: "Only pending accounts can be rejected." }, 409);
    }
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Reject failed.", { status: error.status });
      return json({ error: "Could not reject this account. Please try again." }, 502);
    }
    return json({ success: true, message: "Account rejected and removed." });
  }

  const promoting = action === "promote";
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: promoting ? "admin" : "user" })
    .eq("id", userId)
    .eq("role", promoting ? "user" : "admin")
    .eq("approval_status", "approved")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Role change failed.", { code: error.code });
    return json({ error: "Could not change this role. Please try again." }, 502);
  }
  if (!data) {
    return json(
      {
        error: promoting
          ? "Only approved Users can be promoted to Admin."
          : "Only Admins can be demoted to User.",
      },
      409,
    );
  }
  return json({
    success: true,
    message: promoting ? "User promoted to Admin." : "Admin demoted to User.",
  });
}
