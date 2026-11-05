import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserManagementActor } from "@/lib/auth/user-management";

export const LAST_SUPERADMIN_MESSAGE =
  "This is the last remaining Superadmin. It cannot be deleted, demoted, blocked, or disabled. Create or promote another Superadmin first.";

type SuperadminActorResult =
  | { actor: { id: string; role: "superadmin" }; error?: never; status?: never }
  | { actor: null; error: string; status: 401 | 403 | 503 };

export async function getSuperadminActor(): Promise<SuperadminActorResult> {
  const result = await getUserManagementActor();
  if (!result.actor) {
    return { actor: null, error: result.error, status: result.status };
  }
  if (result.actor.role !== "superadmin") {
    return {
      actor: null,
      error: "Superadmin access is required.",
      status: 403,
    };
  }
  return { actor: { id: result.actor.id, role: "superadmin" } };
}

// Returns true when no other active Superadmin exists, null when it cannot be verified.
export async function isLastActiveSuperadmin(
  targetId: string,
): Promise<boolean | null> {
  const { count, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "superadmin")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .neq("id", targetId);

  if (error) {
    console.error("Superadmin count lookup failed.", { code: error.code });
    return null;
  }
  return (count ?? 0) === 0;
}
