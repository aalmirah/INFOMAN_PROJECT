import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const modules = [
  ["CUSTOMER", "Customer", 3],
  ["PRODUCT", "Product", 6],
  ["HR", "Human Resources", 13],
  ["SALES", "Sales", 7],
  ["REPORTS", "Reports", 7],
].map(([code, name], index) => ({ module_id: index + 1, code, name, status: "Active" }));
let nextRight = 1;
const rights = modules.flatMap((module, index) =>
  Array.from({ length: [3, 6, 13, 7, 7][index] }, () => {
    const id = nextRight++;
    return { right_id: id, module_id: module.module_id, label: `Right ${id}`, status: "Active" };
  }),
);

function compile(path, dependencies, context = {}) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...context,
  });
  return exports;
}

function setup({ actorRole = "admin", targetRole = "user", enabled = true,
  targetChanges = {}, actorAccountChanges = {}, targetAccountChanges = {}, moduleRows = modules,
  rightRows = rights, rpcError = null, linked = true, actor = true } = {}) {
  const calls = [];
  const profile = {
    id: targetId,
    role: targetRole,
    approval_status: "approved",
    is_active: true,
    is_blocked: false,
    must_change_password: false,
    ...targetChanges,
  };
  const roleId = { user: 1, admin: 2, superadmin: 3 };
  const account = (authId, role) => ({
    auth_user_id: authId,
    user_id: authId === actorId ? 10 : 20,
    role_id: roleId[role],
    status: "Active",
    is_blocked: false,
    must_set_password: false,
  });
  const tables = {
    profiles: [profile],
    app_user: linked ? [
      { ...account(actorId, actorRole), ...actorAccountChanges },
      { ...account(targetId, targetRole), ...targetAccountChanges },
    ] : [],
    role: [
      { role_id: 1, name: "User", status: "Active" },
      { role_id: 2, name: "Admin", status: "Active" },
      { role_id: 3, name: "Superadmin", status: "Active" },
    ],
    module: moduleRows,
    rights: rightRows,
    user_permission: [
      { user_id: 20, right_id: 1, status: "Active" },
      { user_id: 20, right_id: 2, status: "Inactive" },
    ],
  };

  const supabase = {
    from(table) {
      calls.push({ table });
      let rows = tables[table];
      assert.ok(rows, `Unexpected table ${table}`);
      const query = {
        select() { return this; },
        eq(column, value) { rows = rows.filter((row) => row[column] === value); return this; },
        in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return this; },
        order() { return this; },
        async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
        then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args: JSON.parse(JSON.stringify(args)) });
      return rpcError ? { data: null, error: rpcError } : { data: 2, error: null };
    },
  };
  const rightsLibrary = compile("../lib/user-management/rights.ts", {}, { Set });
  const route = compile("../app/api/user-management/[userId]/rights/route.ts", {
    "@/lib/auth/user-management": {
      getUserManagementActor: async () => actor
        ? { actor: { id: actorId, role: actorRole } }
        : { actor: null, error: "Administrator access is required.", status: 403 },
    },
    "@/lib/user-management/rights": rightsLibrary,
    "@/lib/user-management/request": {
      isSameOriginRequest: (request) => request.headers.get("origin") === "http://localhost",
      readJsonRequestBody: (request) => request.json(),
    },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => supabase },
  }, {
    Response,
    process: { env: { DEV07_RIGHTS_MANAGEMENT_ENABLED: enabled ? "true" : "false" } },
    console: { error() {} },
  });
  return { ...route, calls };
}

const context = { params: Promise.resolve({ userId: targetId }) };
const getRequest = () => new Request(`http://localhost/api/user-management/${targetId}/rights`);
const putRequest = (body, origin = "http://localhost") => new Request(
  `http://localhost/api/user-management/${targetId}/rights`,
  { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) },
);
const selection = {
  catalogue: rights.map((right) => right.right_id),
  expected: [1],
  selected: [2],
};

test("disabled and unauthorized requests cannot access the database", async () => {
  for (const options of [{ enabled: false }, { actor: false }]) {
    const route = setup(options);
    const response = await route.GET(getRequest(), context);
    assert.equal(response.status, options.enabled === false ? 503 : 403);
    assert.equal(route.calls.length, 0);
  }
});

test("Admin cannot manage Admin or ineligible User rights", async () => {
  for (const options of [
    { targetRole: "admin" },
    { targetRole: "superadmin" },
    { targetChanges: { must_change_password: true } },
    { targetChanges: { is_blocked: true } },
    { targetChanges: { must_change_password: null } },
  ]) {
    const route = setup(options);
    const response = await route.GET(getRequest(), context);
    assert.equal(response.status, 403);
    assert.ok(!route.calls.some((call) => call.table === "user_permission"));
  }
});

test("GET loads the five modules and active permissions through the UUID link", async () => {
  const route = setup();
  const response = await route.GET(getRequest(), context);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.modules.map((module) => module.rights.length), [3, 6, 13, 7, 7]);
  assert.deepEqual(body.selected, [1]);
  assert.equal(body.readOnly, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unlinked accounts fail closed; Superadmin rights are read-only", async () => {
  const missing = await setup({ linked: false }).GET(getRequest(), context);
  assert.equal(missing.status, 503);
  const route = setup({ actorRole: "superadmin", targetRole: "superadmin" });
  const response = await route.GET(getRequest(), context);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.readOnly, true);
  assert.equal(body.selected.length, 36);
  assert.ok(!route.calls.some((call) => call.table === "user_permission"));
  const save = await route.PUT(putRequest(selection), context);
  assert.equal(save.status, 403);
  assert.ok(!route.calls.some((call) => call.rpc));
});

test("incomplete catalogue and mismatched target role fail closed", async () => {
  const missingModule = setup({ moduleRows: modules.slice(0, 4) });
  assert.equal((await missingModule.GET(getRequest(), context)).status, 503);
  const missingRight = setup({ rightRows: rights.slice(1) });
  assert.equal((await missingRight.GET(getRequest(), context)).status, 503);
  const misplacedRight = setup({
    rightRows: rights.map((right) =>
      right.right_id === 4 ? { ...right, module_id: 1 } : right),
  });
  assert.equal((await misplacedRight.GET(getRequest(), context)).status, 503);
  const mismatchedRole = setup({ targetAccountChanges: { role_id: 2 } });
  assert.equal((await mismatchedRole.GET(getRequest(), context)).status, 503);
});

test("ERP password flags do not block rights when profiles are eligible", async () => {
  const route = setup({
    actorAccountChanges: { must_set_password: true },
    targetAccountChanges: { must_set_password: true },
  });
  assert.equal((await route.GET(getRequest(), context)).status, 200);
  assert.equal((await route.PUT(putRequest(selection), context)).status, 200);
});

test("save passes the verified actor and snapshots to the atomic RPC", async () => {
  const route = setup();
  const response = await route.PUT(putRequest(selection), context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { changed: 2 });
  const rpc = route.calls.find((call) => call.rpc);
  assert.equal(rpc.rpc, "dev07_save_user_permissions");
  assert.deepEqual(rpc.args, {
    p_actor_auth_id: actorId,
    p_target_auth_id: targetId,
    p_catalogue: selection.catalogue,
    p_expected: [1],
    p_selected: [2],
  });
});

test("unauthorized or ineligible saves never call the permission RPC", async () => {
  for (const [options, expectedStatus] of [
    [{ enabled: false }, 503],
    [{ actor: false }, 403],
    [{ targetRole: "admin" }, 403],
    [{ targetRole: "superadmin" }, 403],
    [{ targetChanges: { is_blocked: true } }, 403],
    [{ targetChanges: { is_active: false } }, 403],
    [{ targetChanges: { must_change_password: true } }, 403],
  ]) {
    const route = setup(options);
    const response = await route.PUT(putRequest(selection), context);
    assert.equal(response.status, expectedStatus);
    assert.ok(!route.calls.some((call) => call.rpc));
  }
});

test("Superadmin can save Admin rights through the atomic RPC", async () => {
  const route = setup({ actorRole: "superadmin", targetRole: "admin" });
  assert.equal((await route.PUT(putRequest(selection), context)).status, 200);
  assert.equal(route.calls.find((call) => call.rpc).args.p_actor_auth_id, actorId);
});

test("save rejects origin and invalid input, and surfaces database conflicts", async () => {
  const route = setup();
  assert.equal((await route.PUT(putRequest(selection, "http://other"), context)).status, 403);
  assert.equal((await route.PUT(putRequest({ ...selection, actor: targetId }), context)).status, 400);
  assert.equal((await route.PUT(putRequest({ ...selection, selected: [2, 2] }), context)).status, 400);
  assert.equal((await route.PUT(putRequest({ ...selection, selected: [Number.MAX_SAFE_INTEGER + 1] }), context)).status, 400);
  assert.equal((await route.PUT(putRequest({ ...selection, selected: [999] }), context)).status, 400);
  assert.ok(!route.calls.some((call) => call.rpc));

  const stale = setup({ rpcError: { code: "P0001", message: "Permissions changed; reload before saving" } });
  assert.equal((await stale.PUT(putRequest(selection), context)).status, 409);
  const unavailable = setup({ rpcError: { code: "PGRST202", message: "Function not found" } });
  assert.equal((await unavailable.PUT(putRequest(selection), context)).status, 503);
});
