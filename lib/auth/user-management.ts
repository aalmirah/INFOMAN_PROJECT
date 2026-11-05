import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return {
      actor: null,
      error: "User Management is not configured on the server.",
      status: 503,
    };
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();
  if (authError) {
    return {
      actor: null,
      error: "Your session could not be verified. Sign in again.",
      status:
        authError.status === 401 || authError.status === 403 ? 401 : 503,
    };
  }
  if (!user) {
    return {
      actor: null,
      error: "Sign in to manage users.",
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await getSupabaseAdminClient()
    .from("profiles")
    .select(
      "id, role, approval_status, is_active, is_blocked, must_change_password",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("User Management actor profile lookup failed.", {
      code: profileError.code,
    });
    return {
      actor: null,
      error: "User Management is temporarily unavailable.",
      status: 503,
    };
  }

  if (
    !profile ||
    profile.is_blocked ||
    !profile.is_active ||
    profile.approval_status !== "approved" ||
    profile.must_change_password
  ) {
    return {
      actor: null,
      error: "Your account is not permitted to manage users.",
      status: 403,
    };
  }

  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return {
      actor: null,
      error: "Administrator access is required.",
      status: 403,
    };
  }

  return {
    actor: {
      id: user.id,
      role: profile.role,
    },
  };
}

export function canManageProfile(
  actor: UserManagementActor,
  profile: ManagedProfile,
): boolean {
  if (profile.id === actor.id || profile.role === "superadmin") {
    return false;
  }
  if (actor.role === "superadmin") {
    return profile.role === "user" || profile.role === "admin";
  }
  return profile.role === "user";
}
