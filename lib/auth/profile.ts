import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthProfile = {
  approvalStatus: string;
  isActive: boolean;
  isBlocked: boolean;
  mustChangePassword: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getAuthProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: AuthProfile | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("approval_status, is_active, is_blocked, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error };
  }

  if (
    !isRecord(data) ||
    typeof data.approval_status !== "string" ||
    typeof data.is_active !== "boolean" ||
    typeof data.is_blocked !== "boolean" ||
    typeof data.must_change_password !== "boolean"
  ) {
    return {
      profile: null,
      error: new Error("The account profile is missing required auth fields."),
    };
  }

  return {
    profile: {
      approvalStatus: data.approval_status,
      isActive: data.is_active,
      isBlocked: data.is_blocked,
      mustChangePassword: data.must_change_password,
    },
    error: null,
  };
}
