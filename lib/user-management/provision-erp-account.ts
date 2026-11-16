import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProfileRole = "user" | "admin" | "superadmin";
export type ErpAccountStatus = "Active" | "Inactive";

const ERP_ROLE_NAMES: Record<ProfileRole, string> = {
  user: "User",
  admin: "Admin",
  superadmin: "Superadmin",
};

type ProvisionErpAccountOptions = {
  authUserId: string;
  profileRole: ProfileRole;
  status: ErpAccountStatus;
  isBlocked?: boolean;
};

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function namesFromMetadata(metadata: Record<string, unknown>) {
  const fullName = metadataValue(metadata, ["full_name", "name"]);
  const nameParts = fullName?.split(/\s+/) ?? [];
  const metadataFirstName = metadataValue(metadata, ["first_name", "given_name"]);
  const firstName = metadataFirstName ?? nameParts[0] ?? null;
  const metadataLastName = metadataValue(metadata, ["last_name", "family_name"]);
  const lastName =
    metadataLastName ??
    (firstName === nameParts[0] ? nameParts.slice(1).join(" ") : null);

  if (!firstName || !lastName) {
    throw new Error("Auth user metadata must include a first and last name.");
  }

  return { firstName, lastName };
}

export async function ensureErpAccount({
  authUserId,
  profileRole,
  status,
  isBlocked,
}: ProvisionErpAccountOptions): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(authUserId);
  const authUser = authData?.user;

  if (authError || !authUser) {
    throw new Error("Could not retrieve the user from Supabase Auth.");
  }

  const email =
    typeof authUser.email === "string"
      ? authUser.email.trim().toLowerCase()
      : "";
  if (!email) {
    throw new Error("The Auth user does not have an email address.");
  }

  const metadata =
    authUser.user_metadata && typeof authUser.user_metadata === "object"
      ? (authUser.user_metadata as Record<string, unknown>)
      : {};
  const { firstName, lastName } = namesFromMetadata(metadata);

  const erpRoleName = ERP_ROLE_NAMES[profileRole];
  if (!erpRoleName) {
    throw new Error("The profile role cannot be mapped to an ERP role.");
  }

  const { data: erpRole, error: roleError } = await supabase
    .from("role")
    .select("role_id")
    .eq("name", erpRoleName)
    .eq("status", "Active")
    .maybeSingle();

  if (roleError || !erpRole) {
    throw new Error(`The active ERP ${erpRoleName} role could not be found.`);
  }

  const account = {
    auth_user_id: authUserId,
    first_name: firstName,
    last_name: lastName,
    email,
    role_id: erpRole.role_id,
    status,
    ...(isBlocked === undefined ? {} : { is_blocked: isBlocked }),
  };
  const { error: upsertError } = await supabase
    .from("app_user")
    .upsert(account, { onConflict: "auth_user_id" });

  if (upsertError) {
    throw new Error("The ERP account could not be created or synchronized.");
  }
}
