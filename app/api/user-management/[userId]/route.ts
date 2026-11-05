import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canManageProfile,
  getUserManagementActor,
} from "@/lib/auth/user-management";
import {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "User update request origin is not allowed." },
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

  const { userId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return Response.json({ error: "Invalid user ID." }, { status: 400 });
  }

  const body = await readJsonRequestBody(request);
  if (!isRecord(body)) {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("User Management target lookup failed.", {
      code: profileError.code,
    });
    return Response.json(
      { error: "Could not verify the selected user." },
      { status: 502 },
    );
  }
  if (!profile) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }
  if (profile.role === "superadmin" && body.isBlocked === true) {
    const isLast = await isLastActiveSuperadmin(profile.id);
    if (isLast === null) {
      return Response.json(
        { error: "Could not verify Superadmin safety. Action blocked." },
        { status: 503 },
      );
    }
    if (isLast) {
      return Response.json(
        { error: LAST_SUPERADMIN_MESSAGE },
        { status: 409 },
      );
    }
  }
  if (!canManageProfile(result.actor, profile)) {
    return Response.json(
      { error: "You are not allowed to manage this account." },
      { status: 403 },
    );
  }

  const keys = Object.keys(body);
  let update: { first_name: string; last_name: string } | { is_blocked: boolean };
  if (
    keys.length === 2 &&
    keys.includes("firstName") &&
    keys.includes("lastName") &&
    typeof body.firstName === "string" &&
    typeof body.lastName === "string"
  ) {
    const firstName = body.firstName.trim();
    const lastName = body.lastName.trim();
    if (
      !firstName ||
      firstName.length > 80 ||
      !lastName ||
      lastName.length > 80
    ) {
      return Response.json(
        { error: "Names must be between 1 and 80 characters." },
        { status: 400 },
      );
    }
    update = { first_name: firstName, last_name: lastName };
  } else if (
    keys.length === 1 &&
    keys[0] === "isBlocked" &&
    typeof body.isBlocked === "boolean"
  ) {
    update = { is_blocked: body.isBlocked };
  } else {
    return Response.json(
      { error: "Only name edits or block/unblock changes are allowed." },
      { status: 400 },
    );
  }

  let updateQuery = supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);
  if (result.actor.role === "admin") {
    updateQuery = updateQuery.eq("role", "user");
  } else {
    updateQuery = updateQuery
      .in("role", ["user", "admin"])
      .neq("id", result.actor.id);
  }

  const { data: updatedProfile, error: updateError } = await updateQuery
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("User Management update failed.", {
      code: updateError.code,
    });
    return Response.json(
      { error: "Could not save this user change. Please try again." },
      { status: 502 },
    );
  }
  if (!updatedProfile) {
    return Response.json(
      { error: "You are not allowed to manage this account." },
      { status: 403 },
    );
  }

  return Response.json({ success: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
