import "server-only";

import { authorizeActor } from "@/lib/auth/rights-authorization";

export type UserManagementActor = {
  id: string;
  role: "admin" | "superadmin";
};

type ActorResult =
  | { actor: UserManagementActor; error?: never; status?: never }
  | { actor: null; error: string; status: 401 | 403 | 503 };

type ManagedProfile = {
  id: string;
  role: string;
};

export async function getUserManagementActor(): Promise<ActorResult> {
  const result = await authorizeActor();
  if (!result.allowed) {
    return { actor: null, error: result.error, status: result.status };
  }
  if (result.actor.role !== "admin" && result.actor.role !== "superadmin") {
    return {
      actor: null,
      error: "Administrator access is required.",
      status: 403,
    };
  }

  return {
    actor: {
      id: result.actor.authUserId,
      role: result.actor.role,
    },
  };
}

export function canManageProfile(
  actor: UserManagementActor,
  profile: ManagedProfile,
): boolean {
  if (profile.id === actor.id) return false;
  if (actor.role === "superadmin") {
    return (
      profile.role === "user" ||
      profile.role === "admin" ||
      profile.role === "superadmin"
    );
  }
  return profile.role === "user";
}
