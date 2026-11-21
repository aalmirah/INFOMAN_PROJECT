import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthProfile } from "@/lib/auth/profile";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isRightsModuleCode, type RightsModuleCode } from "@/lib/user-management/rights";

// The dotted codes also exist in the separately maintained DEV07 QA catalogue.
const RIGHT_CODES = {
  "customers.view": null,
  "customers.add": "CUSTOMER_ADD",
  "customers.edit": "CUSTOMER_EDIT",
  "customers.delete": "CUSTOMER_DELETE",
  "products.add": "PRODUCT_ADD",
  "products.edit": "PRODUCT_EDIT",
  "products.delete": "PRODUCT_DELETE",
  "products.price_add": "PRICE_ADD",
  "products.price_edit": "PRICE_EDIT",
  "products.price_delete": "PRICE_DELETE",
  "hr.job_add": "JOB_ADD",
  "hr.job_edit": "JOB_EDIT",
  "hr.job_delete": "JOB_DELETE",
  "hr.department_add": "DEPARTMENT_ADD",
  "hr.department_edit": "DEPARTMENT_EDIT",
  "hr.department_delete": "DEPARTMENT_DELETE",
  "hr.employee_add": "EMPLOYEE_ADD",
  "hr.employee_edit": "EMPLOYEE_EDIT",
  "hr.employee_delete": "EMPLOYEE_DELETE",
  "hr.job_history_view": "JOBHISTORY_VIEW",
  "hr.job_history_add": "JOBHISTORY_ADD",
  "hr.job_history_edit": "JOBHISTORY_EDIT",
  "hr.job_history_delete": "JOBHISTORY_DELETE",
  "sales.sale_add": "SALE_ADD",
  "sales.sale_edit": "SALE_EDIT",
  "sales.sale_delete": "SALE_DELETE",
  "sales.sale_detail_view": "SALEDETAIL_VIEW",
  "sales.sale_detail_add": "SALEDETAIL_ADD",
  "sales.sale_detail_edit": "SALEDETAIL_EDIT",
  "sales.sale_detail_delete": "SALEDETAIL_DELETE",
  "reports.top_customers": "REPORT_TOP_CUSTOMERS",
  "reports.product_master": "REPORT_PRODUCT_MASTER",
  "reports.top_products": "REPORT_TOP_PRODUCTS",
  "reports.active_employees": "REPORT_ACTIVE_EMPLOYEES",
  "reports.all_employees": "REPORT_ALL_EMPLOYEES",
  "reports.employee_job_history": "REPORT_EMPLOYEE_JOBHISTORY",
  "reports.top_sales": "REPORT_TOP_SALES",
} as const;

export type Dev07RightCode = keyof typeof RIGHT_CODES;
export const DEV07_RIGHT_CODES = Object.keys(RIGHT_CODES) as Dev07RightCode[];

export function isDev07RightCode(value: unknown): value is Dev07RightCode {
  return typeof value === "string" && Object.hasOwn(RIGHT_CODES, value);
}

export type AuthorizedActor = {
  authUserId: string;
  erpUserId: number;
  role: "user" | "admin" | "superadmin";
  name: string;
};

type Denied = { allowed: false; status: 401 | 403 | 503; error: string };
type ActorResult = { allowed: true; actor: AuthorizedActor } | Denied;
export type GrantedRight = { code: string; module: RightsModuleCode; label: string };
type RightsResult = { allowed: true; rights: GrantedRight[] } | Denied;
type ModuleResult = { allowed: true; actor: AuthorizedActor; rights: GrantedRight[] } | Denied;

function denied(status: 401 | 403 | 503, error: string): Denied {
  return { allowed: false, status, error };
}

export async function authorizeActor(): Promise<ActorResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !process.env.SUPABASE_SECRET_KEY) {
    return denied(503, "Authorization is not configured.");
  }

  const cookieStore = await cookies();
  try {
    const sessionClient = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    });
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError) {
      return denied(
        authError.status === 401 || authError.status === 403 || authError.name === "AuthSessionMissingError" ? 401 : 503,
        "Your session could not be verified.",
      );
    }
    if (!user) return denied(401, "Sign in to continue.");

    const admin = getSupabaseAdminClient();
    const { profile, error: profileError } = await getAuthProfile(admin, user.id);
    if (profileError) {
      console.error("Authorization profile lookup failed.", { message: profileError.message });
      return denied(503, "Authorization is temporarily unavailable.");
    }
    if (!profile || profile.approvalStatus !== "approved" || !profile.isActive ||
        profile.isBlocked || profile.mustChangePassword) {
      return denied(403, "Your account is not permitted to continue.");
    }
    const role = profile.role.toLowerCase();
    if (role !== "user" && role !== "admin" && role !== "superadmin") {
      return denied(403, "Your account role is not permitted.");
    }
    const { data: erpUser, error: erpUserError } = await admin.from("app_user")
      .select("user_id, auth_user_id, role_id, status, is_blocked")
      .eq("auth_user_id", user.id).maybeSingle();
    if (erpUserError) {
      console.error("Authorization ERP account lookup failed.", { code: erpUserError.code });
      return denied(503, "Authorization is temporarily unavailable.");
    }
    if (!erpUser || !Number.isSafeInteger(erpUser.user_id) || erpUser.user_id <= 0 ||
        erpUser.status !== "Active" || erpUser.is_blocked !== false ||
        erpUser.auth_user_id !== user.id) {
      return denied(403, "Your ERP account is not active.");
    }
    const { data: erpRole, error: roleError } = await admin.from("role")
      .select("name, status").eq("role_id", erpUser.role_id).maybeSingle();
    if (roleError) {
      console.error("Authorization ERP role lookup failed.", { code: roleError.code });
      return denied(503, "Authorization is temporarily unavailable.");
    }
    if (!erpRole || erpRole.status !== "Active" || typeof erpRole.name !== "string" ||
        erpRole.name.toLowerCase() !== role) {
      return denied(403, "Your account role could not be verified.");
    }
    return {
      allowed: true,
      actor: {
        authUserId: user.id,
        erpUserId: erpUser.user_id,
        role,
        name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || user.email || "User",
      },
    };
  } catch (error) {
    console.error("Authorization failed.", error);
    return denied(503, "Authorization is temporarily unavailable.");
  }
}

export async function getGrantedRights(actor: AuthorizedActor): Promise<RightsResult> {
  try {
    const admin = getSupabaseAdminClient();
    const [modulesResult, catalogueResult, grantsResult] = await Promise.all([
      admin.from("module").select("module_id, code").eq("status", "Active"),
      admin.from("rights").select("module_id, code, label").eq("status", "Active"),
      actor.role === "superadmin"
        ? Promise.resolve({ data: [], error: null })
        : admin.from("v_user_effective_rights").select("right_code")
          .eq("user_id", actor.erpUserId).eq("granted", true),
    ]);
    if (modulesResult.error || catalogueResult.error || grantsResult.error ||
        !Array.isArray(modulesResult.data) || !Array.isArray(catalogueResult.data) ||
        !Array.isArray(grantsResult.data) ||
        !catalogueResult.data.every((right) =>
          Number.isSafeInteger(right.module_id) && typeof right.code === "string" &&
          typeof right.label === "string" && right.label.trim().length > 0) ||
        !grantsResult.data.every((right) => typeof right.right_code === "string")) {
      console.error("Authorization rights lookup failed.", {
        module: modulesResult.error?.code,
        catalogue: catalogueResult.error?.code,
        grants: grantsResult.error?.code,
      });
      return denied(503, "Permissions are temporarily unavailable.");
    }
    const modules = new Map<number, RightsModuleCode>();
    for (const row of modulesResult.data) {
      if (Number.isSafeInteger(row.module_id) && isRightsModuleCode(row.code)) {
        modules.set(row.module_id, row.code);
      }
    }
    const granted = new Set(grantsResult.data.map((right) => right.right_code));
    const rights: GrantedRight[] = [];
    for (const right of catalogueResult.data) {
      const moduleCode = modules.get(right.module_id);
      if (moduleCode && typeof right.code === "string" && typeof right.label === "string" &&
          (actor.role === "superadmin" || granted.has(right.code))) {
        rights.push({ code: right.code, module: moduleCode, label: right.label });
      }
    }
    return { allowed: true, rights };
  } catch (error) {
    console.error("Authorization rights lookup failed.", error);
    return denied(503, "Permissions are temporarily unavailable.");
  }
}

export function canAccessModule(
  actor: AuthorizedActor,
  rights: GrantedRight[],
  moduleCode: RightsModuleCode,
): boolean {
  return actor.role !== "user" || rights.some((right) => right.module === moduleCode);
}

export async function authorizeModule(moduleCode: RightsModuleCode): Promise<ModuleResult> {
  if (!isRightsModuleCode(moduleCode)) return denied(403, "Invalid module.");
  const result = await authorizeActor();
  if (!result.allowed) return result;
  const rights = await getGrantedRights(result.actor);
  if (!rights.allowed) return rights;
  if (!canAccessModule(result.actor, rights.rights, moduleCode)) {
    return denied(403, "You do not have permission for this module.");
  }
  return { allowed: true, actor: result.actor, rights: rights.rights };
}

export async function authorizeRight(rightCode: Dev07RightCode): Promise<ActorResult> {
  if (!isDev07RightCode(rightCode)) return denied(403, "Invalid permission.");
  const result = await authorizeActor();
  if (!result.allowed) return result;
  const rights = await getGrantedRights(result.actor);
  if (!rights.allowed) return rights;
  const databaseCode = RIGHT_CODES[rightCode];
  if (!rights.rights.some((right) => right.code === rightCode || right.code === databaseCode)) {
    return denied(403, "You do not have permission for this action.");
  }
  return result;
}

export function hasGrantedRight(
  rights: { code: string }[],
  rightCode: Dev07RightCode,
): boolean {
  return rights.some((right) => right.code === rightCode || right.code === RIGHT_CODES[rightCode]);
}
