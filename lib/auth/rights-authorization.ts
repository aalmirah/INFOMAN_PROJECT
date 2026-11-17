
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const DEV07_RIGHT_CODES = [
  "customers.view",
  "customers.add",
  "customers.edit",
  "products.add",
  "products.edit",
  "products.delete",
  "products.price_add",
  "products.price_edit",
  "products.price_delete",
  "hr.job_add",
  "hr.job_edit",
  "hr.job_delete",
  "hr.department_add",
  "hr.department_edit",
  "hr.department_delete",
  "hr.employee_add",
  "hr.employee_edit",
  "hr.employee_delete",
  "hr.job_history_view",
  "hr.job_history_add",
  "hr.job_history_edit",
  "hr.job_history_delete",
  "sales.sale_add",
  "sales.sale_edit",
  "sales.sale_delete",
  "sales.sale_detail_view",
  "sales.sale_detail_add",
  "sales.sale_detail_edit",
  "sales.sale_detail_delete",
  "reports.top_customers",
  "reports.product_master",
  "reports.top_products",
  "reports.active_employees",
  "reports.all_employees",
  "reports.employee_job_history",
  "reports.top_sales",
] as const;

export type Dev07RightCode = (typeof DEV07_RIGHT_CODES)[number];

export function isDev07RightCode(
  value: unknown,
): value is Dev07RightCode {
  return (
    typeof value === "string" &&
    DEV07_RIGHT_CODES.some((code) => code === value)
  );
}

type AuthorizationResult =
  | {
      allowed: true;
      actor: {
        authUserId: string;
        erpUserId: number;
        role: string;
      };
    }
  | {
      allowed: false;
      status: 401 | 403 | 503;
      error: string;
    };

function denied(
  status: 401 | 403 | 503,
  error: string,
): AuthorizationResult {
  return { allowed: false, status, error };
}

export async function authorizeRight(
  rightCode: Dev07RightCode,
): Promise<AuthorizationResult> {
  try {
    if (!isDev07RightCode(rightCode)) {
      return denied(403, "Invalid permission.");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      return denied(503, "Authorization is not configured.");
    }

    // Verify the actual signed-in user from the server session.
    const cookieStore = await cookies();

    const sessionClient = createServerClient(
      supabaseUrl,
      publishableKey,
      {
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
      },
    );

    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser();

    if (authError) {
      return denied(
        authError.status === 401 || authError.status === 403
          ? 401
          : 503,
        "Your session could not be verified.",
      );
    }

    if (!user) {
      return denied(401, "Sign in to continue.");
    }

    // Use the admin client only after verifying the session.
    const admin = getSupabaseAdminClient();

    const { profile, error: profileError } =
      await getAuthProfile(admin, user.id);

    if (profileError) {
      console.error("DEV07 profile lookup failed.", {
        message: profileError.message,
      });
      return denied(503, "Authorization is temporarily unavailable.");
    }

    if (
      !profile ||
      profile.approvalStatus !== "approved" ||
      !profile.isActive ||
      profile.isBlocked ||
      profile.mustChangePassword
    ) {
      return denied(403, "Your account is not permitted to continue.");
    }

    if (!["user", "admin", "superadmin"].includes(profile.role.toLowerCase())) {
      return denied(403, "Your account role is not permitted.");
    }

    // Find the ERP account linked to this verified Auth user.
    const { data: erpUser, error: erpUserError } = await admin
      .from("app_user")
      .select("user_id, auth_user_id, role_id, status, is_blocked")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (erpUserError) {
      console.error("DEV07 ERP account lookup failed.", {
        code: erpUserError.code,
      });
      return denied(503, "Authorization is temporarily unavailable.");
    }

    if (
      !erpUser ||
      erpUser.status !== "Active" ||
      erpUser.is_blocked ||
      erpUser.auth_user_id !== user.id
    ) {
      return denied(403, "Your ERP account is not active.");
    }

    // Confirm that the ERP role matches the verified profile role.
    const { data: erpRole, error: roleError } = await admin
      .from("role")
      .select("role_id, name, status")
      .eq("role_id", erpUser.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("DEV07 ERP role lookup failed.", {
        code: roleError.code,
      });
      return denied(503, "Authorization is temporarily unavailable.");
    }

    if (
      !erpRole ||
      erpRole.status !== "Active" ||
      erpRole.name.toLowerCase() !== profile.role.toLowerCase()
    ) {
      return denied(403, "Your account role could not be verified.");
    }

    if (profile.role.toLowerCase() === "superadmin") {
      return {
        allowed: true,
        actor: {
          authUserId: user.id,
          erpUserId: erpUser.user_id,
          role: profile.role,
        },
      };
    }

    // Check the specific active right in the effective-rights view.
    const { data: right, error: rightError } = await admin
      .from("v_user_effective_rights")
      .select("granted")
      .eq("user_id", erpUser.user_id)
      .eq("right_code", rightCode)
      .eq("granted", true)
      .maybeSingle();

    if (rightError) {
      console.error("DEV07 right lookup failed.", {
        code: rightError.code,
      });
      return denied(503, "Authorization is temporarily unavailable.");
    }

    if (!right?.granted) {
      return denied(403, "You do not have permission for this action.");
    }

    return {
      allowed: true,
      actor: {
        authUserId: user.id,
        erpUserId: erpUser.user_id,
        role: profile.role,
      },
    };
  } catch (error) {
    console.error("DEV07 authorization failed.", error);
    return denied(503, "Authorization is temporarily unavailable.");
  }
}
