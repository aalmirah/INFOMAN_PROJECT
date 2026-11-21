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
import {
  ensureErpAccount,
  type ErpAccountStatus,
  type ProfileRole,
} from "@/lib/user-management/provision-erp-account";

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

async function syncErpAccount(
  userId: string,
  profileRole: ProfileRole,
  status: ErpAccountStatus,
  isBlocked: boolean | undefined,
  failureMessage: string,
): Promise<Response | null> {
  try {
    await ensureErpAccount({
      authUserId: userId,
      profileRole,
      status,
      isBlocked,
    });
    return null;
  } catch (error) {
    console.error("ERP account synchronization failed.", {
      userId,
      profileRole,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: failureMessage }, 502);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const result = await getSuperadminActor();
  if (!result.actor) {
    return json({ error: result.error }, result.status);
  }

  if (!isSameOriginRequest(request)) {
    return json({ error: "Request origin is not allowed." }, 403);
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
    .select("id, role, approval_status, is_active, is_blocked, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) {
    console.error("Superadmin target lookup failed.", { code: lookupError.code });
    return json({ error: "Could not verify the selected user." }, 502);
  }
  if (!target) {
    return json({ error: "User not found." }, 404);
  }

  if (target.id === result.actor.id) {
    return json({ error: "You cannot change your own account." }, 403);
  }

  if (target.role === "superadmin") {
    if (action !== "demote") {
      return json(
        { error: "Superadmin accounts can only be demoted to Admin." },
        403,
      );
    }
    const isLast = await isLastActiveSuperadmin(target.id);
    if (isLast === null) {
      return json({ error: "Could not verify Superadmin safety. Action blocked." }, 503);
    }
    if (isLast) {
      return json({ error: LAST_SUPERADMIN_MESSAGE }, 409);
    }
  }

  if (action === "approve") {
    if (target.role !== "user") {
      return json({ error: "Only pending User accounts can be approved." }, 409);
    }
    if (target.approval_status === "approved") {
      if (!target.is_active || target.is_blocked) {
        return json({ error: "Only active, unblocked accounts can be approved." }, 409);
      }
      const syncError = await syncErpAccount(
        userId,
        "user",
        "Active",
        undefined,
        "The account is approved, but its ERP account could not be synchronized. Contact an administrator.",
      );
      return syncError ?? json({
        success: true,
        message: "Account is approved and its ERP account is synchronized.",
      });
    }

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
    const syncError = await syncErpAccount(
      userId,
      "user",
      "Active",
      undefined,
      "The account was approved, but ERP account provisioning failed. Please retry or contact an administrator.",
    );
    if (syncError) return syncError;
    return json({ success: true, message: "Account approved." });
  }

  if (action === "reject") {
    if (target.role !== "user" || target.approval_status !== "pending") {
      return json({ error: "Only pending accounts can be rejected." }, 409);
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({ approval_status: "rejected" })
      .eq("id", userId)
      .eq("role", "user")
      .eq("approval_status", "pending")
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Reject failed.", { code: error.code });
      return json({ error: "Could not reject this account. Please try again." }, 502);
    }
    if (!data) {
      return json({ error: "Only pending accounts can be rejected." }, 409);
    }
    return json({ success: true, message: "Account rejected. The user will be told on their next sign-in." });
  }

  const promoting = action === "promote";
  const demotingSuperadmin = action === "demote" && target.role === "superadmin";
  const previousRole = promoting
    ? "user"
    : demotingSuperadmin
      ? "superadmin"
      : "admin";
  const nextRole = promoting || demotingSuperadmin ? "admin" : "user";
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", userId)
    .eq("role", previousRole)
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
          : demotingSuperadmin
            ? "Only approved Superadmins can be demoted to Admin."
            : "Only Admins can be demoted to User.",
      },
      409,
    );
  }
  const erpStatus =
    target.is_active === true && target.is_blocked === false
      ? "Active"
      : "Inactive";
  const syncError = await syncErpAccount(
    userId,
    nextRole,
    erpStatus,
    target.is_blocked,
    "The profile role was changed, but ERP account synchronization failed. Contact an administrator.",
  );
  if (syncError) return syncError;
  return json({
    success: true,
    message: promoting
      ? "User promoted to Admin."
      : demotingSuperadmin
        ? "Superadmin demoted to Admin."
        : "Admin demoted to User.",
  });
}
