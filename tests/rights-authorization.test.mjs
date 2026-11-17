import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const actorId = "11111111-1111-4111-8111-111111111111";

function compile(path, dependencies, context = {}) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!Object.hasOwn(dependencies, name)) {
        throw new Error(`Unexpected dependency: ${name}`);
      }
      return dependencies[name];
    },
    ...context,
  });
  return exports;
}

function setup({ role = "superadmin", profileChanges = {}, accountChanges = {}, rightGranted = false } = {}) {
  const tables = {
    app_user: [{
      auth_user_id: actorId,
      user_id: 7,
      role_id: { user: 1, admin: 2, superadmin: 3 }[role],
      status: "Active",
      is_blocked: false,
      ...accountChanges,
    }],
    role: [
      { role_id: 1, name: "User", status: "Active" },
      { role_id: 2, name: "Admin", status: "Active" },
      { role_id: 3, name: "Superadmin", status: "Active" },
    ],
    v_user_effective_rights: rightGranted
      ? [{ user_id: 7, right_code: "customers.view", granted: true }]
      : [],
  };
  const profile = {
    role,
    approvalStatus: "approved",
    isActive: true,
    isBlocked: false,
    mustChangePassword: false,
    ...profileChanges,
  };
  let viewLookups = 0;
  const admin = {
    from(table) {
      let rows = tables[table] ?? [];
      const filters = [];
      if (table === "v_user_effective_rights") viewLookups += 1;
      return {
        select() { return this; },
        eq(column, value) {
          filters.push([column, value]);
          return this;
        },
        async maybeSingle() {
          const row = rows.find((candidate) =>
            filters.every(([column, value]) => candidate[column] === value),
          );
          return { data: row ?? null, error: null };
        },
      };
    },
  };
  const auth = compile("../lib/auth/rights-authorization.ts", {
    "server-only": {},
    "@supabase/ssr": {
      createServerClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) },
      }),
    },
    "next/headers": {
      cookies: async () => ({ getAll: () => [], set() {} }),
    },
    "@/lib/auth/profile": {
      getAuthProfile: async () => ({ profile, error: null }),
    },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => admin },
  }, {
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
      },
    },
    console: { error() {} },
  });
  return { auth, get viewLookups() { return viewLookups; } };
}

test("Verified Superadmins are authorized for all 36 DEV07 rights", async () => {
  const resultSet = setup();
  const { auth } = resultSet;
  assert.equal(auth.DEV07_RIGHT_CODES.length, 36);
  for (const rightCode of auth.DEV07_RIGHT_CODES) {
    const result = await auth.authorizeRight(rightCode);
    assert.equal(result.allowed, true, rightCode);
    if (result.allowed) assert.equal(result.actor.role, "superadmin");
  }
  assert.equal(resultSet.viewLookups, 0);
});

test("Superadmin authorization still requires an eligible linked account", async () => {
  const inactive = setup({ profileChanges: { isActive: false } });
  const inactiveResult = await inactive.auth.authorizeRight("customers.view");
  assert.equal(inactiveResult.allowed, false);
  if (!inactiveResult.allowed) assert.equal(inactiveResult.status, 403);
  assert.equal(inactive.viewLookups, 0);

  const blockedErpAccount = setup({ accountChanges: { is_blocked: true } });
  const blockedResult = await blockedErpAccount.auth.authorizeRight("customers.view");
  assert.equal(blockedResult.allowed, false);
  if (!blockedResult.allowed) assert.equal(blockedResult.status, 403);
  assert.equal(blockedErpAccount.viewLookups, 0);
});

test("Regular User authorization remains governed by effective rights", async () => {
  const denied = setup({ role: "user" });
  const deniedResult = await denied.auth.authorizeRight("customers.view");
  assert.equal(deniedResult.allowed, false);
  if (!deniedResult.allowed) assert.equal(deniedResult.status, 403);
  assert.equal(denied.viewLookups, 1);

  const granted = setup({ role: "user", rightGranted: true });
  const grantedResult = await granted.auth.authorizeRight("customers.view");
  assert.equal(grantedResult.allowed, true);
  assert.equal(granted.viewLookups, 1);
});
