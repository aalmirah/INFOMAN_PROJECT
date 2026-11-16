import { getUserManagementActor } from "@/lib/auth/user-management";
import {
  hasExpectedRightsCounts,
  isIdList,
  isRecord,
  isRightId,
  isRightsModuleCode,
  RIGHTS_MODULE_CODES,
  type RightsModule,
  type RightsModuleCode,
} from "@/lib/user-management/rights";
import { isSameOriginRequest, readJsonRequestBody } from "@/lib/user-management/request";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ userId: string }> };
type Actor = { id: string; role: "admin" | "superadmin" };
type TargetRole = "user" | "admin" | "superadmin";
type ModuleRow = { module_id: number; code: RightsModuleCode; name: string };
type RightRow = { right_id: number; module_id: number; label: string };
type PermissionRow = { right_id: number };

function isTargetRole(value: unknown): value is TargetRole {
  return value === "user" || value === "admin" || value === "superadmin";
}

function isModuleRow(value: unknown): value is ModuleRow {
  return isRecord(value) && isRightId(value.module_id) &&
    isRightsModuleCode(value.code) && typeof value.name === "string";
}

function isRightRow(value: unknown): value is RightRow {
  return isRecord(value) && isRightId(value.right_id) && isRightId(value.module_id) &&
    typeof value.label === "string" && value.label.trim().length > 0;
}

function isPermissionRow(value: unknown): value is PermissionRow {
  return isRecord(value) && isRightId(value.right_id);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function authorizeTarget(actor: Actor, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: profile, error } = await supabase.from("profiles")
    .select("id, role, approval_status, is_active, is_blocked, must_change_password")
    .eq("id", userId).maybeSingle();
  if (error) {
    console.error("Rights target lookup failed.", { code: error.code });
    return { error: "Could not verify the selected user.", status: 502 } as const;
  }
  if (!profile) return { error: "User not found.", status: 404 } as const;
  if (
    !isTargetRole(profile.role) ||
    (actor.role === "admin" && profile.role !== "user")
  ) {
    return { error: "You cannot manage this user's rights.", status: 403 } as const;
  }
  if (
    profile.approval_status !== "approved" || profile.is_active !== true ||
    profile.is_blocked !== false || profile.must_change_password !== false
  ) {
    return { error: "Rights are available only for eligible active accounts.", status: 403 } as const;
  }
  return { role: profile.role } as const;
}

async function getLinkedAccount(userId: string, role: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("app_user")
    .select("user_id, role_id, status, is_blocked")
    .eq("auth_user_id", userId).maybeSingle();
  if (error) {
    console.error("Rights ERP account lookup failed.", { code: error.code });
    return null;
  }
  if (
    !isRecord(data) || !isRightId(data.user_id) || !isRightId(data.role_id) ||
    data.status !== "Active" || data.is_blocked !== false
  ) return null;

  const { data: erpRole, error: roleError } = await supabase.from("role")
    .select("name, status").eq("role_id", data.role_id).maybeSingle();
  if (roleError) {
    console.error("Rights ERP role lookup failed.", { code: roleError.code });
    return null;
  }
  if (!isRecord(erpRole) || typeof erpRole.name !== "string" ||
      erpRole.name.toLowerCase() !== role || erpRole.status !== "Active") return null;
  return data.user_id;
}

async function loadCatalogue(): Promise<RightsModule[] | null> {
  const supabase = getSupabaseAdminClient();
  const { data: modules, error: modulesError } = await supabase.from("module")
    .select("module_id, code, name").in("code", [...RIGHTS_MODULE_CODES])
    .eq("status", "Active").order("sort_order");
  if (modulesError) {
    console.error("Rights module lookup failed.", { code: modulesError.code });
    return null;
  }
  if (
    !Array.isArray(modules) || modules.length !== RIGHTS_MODULE_CODES.length ||
    !modules.every(isModuleRow) ||
    new Set(modules.map((module) => module.code)).size !== RIGHTS_MODULE_CODES.length
  ) return null;

  const { data: rights, error: rightsError } = await supabase.from("rights")
    .select("right_id, module_id, label").in("module_id", modules.map((module) => module.module_id))
    .eq("status", "Active").order("sort_order");
  if (rightsError) {
    console.error("Rights catalogue lookup failed.", { code: rightsError.code });
    return null;
  }
  if (!Array.isArray(rights) || !rights.every(isRightRow)) return null;

  const result = modules.map((module) => ({
    code: module.code,
    name: module.name,
    rights: rights.filter((right) => right.module_id === module.module_id)
      .map((right) => ({ id: right.right_id, label: right.label })),
  }));
  const allIds = result.flatMap((module) => module.rights.map((right) => right.id));
  if (!hasExpectedRightsCounts(result) ||
      new Set(allIds).size !== allIds.length) return null;
  return result;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const result = await getUserManagementActor();
  if (!result.actor) return Response.json({ error: result.error }, { status: result.status });
  if (process.env.DEV07_RIGHTS_MANAGEMENT_ENABLED !== "true") {
    return Response.json({ error: "Rights Management is not enabled." }, { status: 503 });
  }
  const { userId } = await context.params;
  if (!isUuid(userId)) return Response.json({ error: "Invalid user ID." }, { status: 400 });
  const target = await authorizeTarget(result.actor, userId);
  if ("error" in target) return Response.json({ error: target.error }, { status: target.status });

  const [actorId, targetId, modules] = await Promise.all([
    getLinkedAccount(result.actor.id, result.actor.role),
    getLinkedAccount(userId, target.role),
    loadCatalogue(),
  ]);
  if (actorId === null || targetId === null) {
    return Response.json(
      { error: "Rights Management requires eligible, linked ERP accounts. Contact an administrator." },
      { status: 503 },
    );
  }
  if (!modules) {
    console.error("Rights catalogue is incomplete or invalid.");
    return Response.json({ error: "The rights catalogue is unavailable." }, { status: 503 });
  }
  const catalogue = modules.flatMap((module) => module.rights.map((right) => right.id));
  let selected = catalogue;
  if (target.role !== "superadmin") {
    const { data, error } = await getSupabaseAdminClient().from("user_permission")
      .select("right_id").eq("user_id", targetId).eq("status", "Active")
      .in("right_id", catalogue);
    if (error || !Array.isArray(data) || !data.every(isPermissionRow)) {
      console.error("Rights assignments lookup failed.", { code: error?.code });
      return Response.json({ error: "Could not load permissions." }, { status: 502 });
    }
    selected = data.map((row) => row.right_id);
    if (!isIdList(selected) || selected.some((id) => !catalogue.includes(id))) {
      console.error("Rights assignments returned invalid data.");
      return Response.json({ error: "Could not load permissions." }, { status: 502 });
    }
  }
  return Response.json({ modules, selected, readOnly: target.role === "superadmin" }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Rights request origin is not allowed." }, { status: 403 });
  }
  const result = await getUserManagementActor();
  if (!result.actor) return Response.json({ error: result.error }, { status: result.status });
  if (process.env.DEV07_RIGHTS_MANAGEMENT_ENABLED !== "true") {
    return Response.json({ error: "Rights Management is not enabled." }, { status: 503 });
  }
  const { userId } = await context.params;
  if (!isUuid(userId)) return Response.json({ error: "Invalid user ID." }, { status: 400 });
  const body = await readJsonRequestBody(request);
  if (!isRecord(body) || Object.keys(body).length !== 3 ||
      !isIdList(body.catalogue) || !isIdList(body.expected) || !isIdList(body.selected)) {
    return Response.json({ error: "Invalid rights selection." }, { status: 400 });
  }
  const { catalogue, expected, selected } = body;
  if (expected.some((id) => !catalogue.includes(id)) ||
      selected.some((id) => !catalogue.includes(id))) {
    return Response.json({ error: "Invalid rights selection." }, { status: 400 });
  }
  const target = await authorizeTarget(result.actor, userId);
  if ("error" in target) return Response.json({ error: target.error }, { status: target.status });
  if (target.role === "superadmin") {
    return Response.json({ error: "Superadmins have full access and cannot be edited." }, { status: 403 });
  }
  const { data, error } = await getSupabaseAdminClient().rpc("dev07_save_user_permissions", {
    p_actor_auth_id: result.actor.id,
    p_target_auth_id: userId,
    p_catalogue: catalogue,
    p_expected: expected,
    p_selected: selected,
  });
  if (error) {
    console.error("Rights save failed.", { code: error.code, message: error.message });
    if (error.message === "Permissions changed; reload before saving" ||
        error.message === "Rights catalogue changed; reload before saving") {
      return Response.json({ error: "Rights changed. Close and reopen the dialog before saving." }, { status: 409 });
    }
    return Response.json({ error: "Could not save rights. Contact an administrator." }, { status: 503 });
  }
  if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) {
    console.error("Rights save returned an invalid result.");
    return Response.json({ error: "Could not verify the rights save." }, { status: 502 });
  }
  return Response.json({ changed: data }, { headers: { "Cache-Control": "no-store" } });
}
