import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

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

function profile(id, role) {
  return {
    id,
    role,
    approval_status: "approved",
    is_active: true,
    is_blocked: false,
    must_change_password: false,
  };
}

function profileClient(target, calls = []) {
  return {
    calls,
    from(table) {
      assert.equal(table, "profiles");
      const filters = [];
      let update = null;
      return {
        select() { return this; },
        update(value) {
          update = value;
          return this;
        },
        eq(column, value) {
          filters.push({ kind: "eq", column, value });
          return this;
        },
        in(column, value) {
          filters.push({ kind: "in", column, value });
          return this;
        },
        neq(column, value) {
          filters.push({ kind: "neq", column, value });
          return this;
        },
        async maybeSingle() {
          const matches = filters.every((filter) => {
            if (filter.kind === "eq") return target[filter.column] === filter.value;
            if (filter.kind === "in") return filter.value.includes(target[filter.column]);
            return target[filter.column] !== filter.value;
          });
          calls.push({ filters, update });
          if (update && matches) Object.assign(target, update);
          return {
            data: matches ? (update ? { id: target.id } : target) : null,
            error: null,
          };
        },
      };
    },
  };
}

function compileUserManagementAuth(target) {
  return compile("../lib/auth/user-management.ts", {
    "server-only": {},
    "@/lib/auth/rights-authorization": {
      authorizeActor: async () => ({
        allowed: true,
        actor: { authUserId: target.id, erpUserId: 1, role: target.role, name: "Test" },
      }),
    },
  }, {
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
        SUPABASE_SECRET_KEY: "test-secret",
      },
    },
    console: { error() {} },
  });
}

function setupPatch(actorRole, targetProfile, lastSuperadmin = false) {
  const calls = [];
  const supabase = profileClient(targetProfile, calls);
  let lastCheckCount = 0;
  const userManagementAuth = compileUserManagementAuth(targetProfile);
  const route = compile("../app/api/user-management/[userId]/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => supabase },
    "@/lib/auth/user-management": {
      canManageProfile: userManagementAuth.canManageProfile,
      getUserManagementActor: async () => ({ actor: { id: actorId, role: actorRole } }),
    },
    "@/lib/auth/superadmin": {
      isLastActiveSuperadmin: async () => {
        lastCheckCount += 1;
        return lastSuperadmin;
      },
      LAST_SUPERADMIN_MESSAGE: "Last Superadmin is protected.",
    },
    "@/lib/user-management/request": {
      isSameOriginRequest: () => true,
      readJsonRequestBody: (request) => request.json(),
    },
  }, { Response, console: { error() {} } });

  return {
    calls,
    get lastCheckCount() { return lastCheckCount; },
    patch(body, userId = targetProfile.id) {
      const request = new Request(`http://localhost/api/user-management/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return route.PATCH(request, { params: Promise.resolve({ userId }) });
    },
  };
}

test("Superadmin may manage other roles but never their own account", () => {
  const auth = compileUserManagementAuth(profile(actorId, "superadmin"));
  const actor = { id: actorId, role: "superadmin" };
  for (const role of ["user", "admin", "superadmin"]) {
    assert.equal(auth.canManageProfile(actor, { id: targetId, role }), true);
  }
  assert.equal(auth.canManageProfile(actor, { id: actorId, role: "superadmin" }), false);

  const admin = { id: actorId, role: "admin" };
  assert.equal(auth.canManageProfile(admin, { id: targetId, role: "user" }), true);
  assert.equal(auth.canManageProfile(admin, { id: targetId, role: "admin" }), false);
  assert.equal(auth.canManageProfile(admin, { id: targetId, role: "superadmin" }), false);
});

test("Regular Users cannot obtain a User Management actor", async () => {
  const auth = compileUserManagementAuth(profile(actorId, "user"));
  const result = await auth.getUserManagementActor();
  assert.equal(result.actor, null);
  assert.equal(result.status, 403);
});

test("User Management propagates unauthenticated and denied account results", async () => {
  for (const status of [401, 403, 503]) {
    const auth = compile("../lib/auth/user-management.ts", {
      "server-only": {},
      "@/lib/auth/rights-authorization": {
        authorizeActor: async () => ({ allowed: false, status, error: "Denied" }),
      },
    });
    const result = await auth.getUserManagementActor();
    assert.equal(result.actor, null);
    assert.equal(result.status, status);
  }
});

test("Superadmin can update another Superadmin, but cannot update themself", async () => {
  const peer = setupPatch("superadmin", profile(targetId, "superadmin"));
  const peerResponse = await peer.patch({ firstName: "Updated", lastName: "Name" });
  assert.equal(peerResponse.status, 200);
  assert.deepEqual({ ...peer.calls.at(-1).update }, {
    first_name: "Updated",
    last_name: "Name",
  });
  assert.ok(peer.calls.at(-1).filters.some((filter) =>
    filter.kind === "in" && filter.value.includes("superadmin")));
  assert.ok(peer.calls.at(-1).filters.some((filter) =>
    filter.kind === "neq" && filter.column === "id" && filter.value === actorId));

  const self = setupPatch("superadmin", profile(actorId, "superadmin"));
  const selfResponse = await self.patch({ firstName: "Changed", lastName: "Name" });
  assert.equal(selfResponse.status, 403);
  assert.equal(self.calls.some((call) => call.update), false);
  assert.equal(self.lastCheckCount, 0);
});

test("Admin can manage Users only; the last Superadmin cannot be blocked", async () => {
  const fellowAdmin = setupPatch("admin", profile(targetId, "admin"));
  assert.equal((await fellowAdmin.patch({ firstName: "Changed", lastName: "Name" })).status, 403);
  assert.equal(fellowAdmin.calls.some((call) => call.update), false);

  const user = setupPatch("admin", profile(targetId, "user"));
  assert.equal((await user.patch({ firstName: "Updated", lastName: "Name" })).status, 200);

  const last = setupPatch("superadmin", profile(targetId, "superadmin"), true);
  assert.equal((await last.patch({ isBlocked: true })).status, 409);
  assert.equal(last.calls.some((call) => call.update), false);
});

function setupSuperadminAction(
  targetProfile,
  lastSuperadmin = false,
  provisioningError = null,
) {
  const calls = [];
  const erpCalls = [];
  const supabase = profileClient(targetProfile, calls);
  let lastCheckCount = 0;
  const route = compile("../app/api/superadmin/users/[userId]/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => supabase },
    "@/lib/auth/superadmin": {
      getSuperadminActor: async () => ({
        actor: { id: actorId, role: "superadmin" },
      }),
      isLastActiveSuperadmin: async () => {
        lastCheckCount += 1;
        return lastSuperadmin;
      },
      LAST_SUPERADMIN_MESSAGE: "Last Superadmin is protected.",
    },
    "@/lib/user-management/provision-erp-account": {
      ensureErpAccount: async (options) => {
        erpCalls.push({ ...options });
        if (provisioningError) throw provisioningError;
      },
    },
    "@/lib/user-management/request": {
      isSameOriginRequest: () => true,
      readJsonRequestBody: (request) => request.json(),
    },
  }, { Response, console: { error() {} } });

  return {
    calls,
    erpCalls,
    get lastCheckCount() { return lastCheckCount; },
    post(userId = targetProfile.id, action = "demote") {
      const request = new Request(`http://localhost/api/superadmin/users/${userId}`, {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      return route.POST(request, { params: Promise.resolve({ userId }) });
    },
  };
}

test("Superadmin may demote another Superadmin, but not themself or the last one", async () => {
  const peer = setupSuperadminAction(profile(targetId, "superadmin"));
  const peerResponse = await peer.post();
  assert.equal(peerResponse.status, 200);
  assert.equal((await peerResponse.json()).message, "Superadmin demoted to Admin.");
  assert.deepEqual({ ...peer.calls.at(-1).update }, { role: "admin" });
  assert.deepEqual(peer.erpCalls, [{
    authUserId: targetId,
    profileRole: "admin",
    status: "Active",
    isBlocked: false,
  }]);

  const self = setupSuperadminAction(profile(actorId, "superadmin"));
  assert.equal((await self.post()).status, 403);
  assert.equal(self.lastCheckCount, 0);
  assert.equal(self.calls.some((call) => call.update), false);

  const last = setupSuperadminAction(profile(targetId, "superadmin"), true);
  assert.equal((await last.post()).status, 409);
  assert.equal(last.calls.some((call) => call.update), false);
});

test("Approving a pending User provisions an ERP account only after approval", async () => {
  const pending = { ...profile(targetId, "user"), approval_status: "pending" };
  const action = setupSuperadminAction(pending);
  const response = await action.post(targetId, "approve");

  assert.equal(response.status, 200);
  assert.equal(pending.approval_status, "approved");
  assert.equal(pending.must_change_password, true);
  assert.deepEqual(action.erpCalls, [{
    authUserId: targetId,
    profileRole: "user",
    status: "Active",
    isBlocked: undefined,
  }]);
});

test("Approval does not report success when ERP provisioning fails", async () => {
  const pending = { ...profile(targetId, "user"), approval_status: "pending" };
  const action = setupSuperadminAction(pending, false, new Error("ERP unavailable"));
  const response = await action.post(targetId, "approve");

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /ERP account provisioning failed/);
  assert.equal(pending.approval_status, "approved");
});

test("An approved User can retry ERP provisioning without changing approval", async () => {
  const approved = profile(targetId, "user");
  const action = setupSuperadminAction(approved);
  const response = await action.post(targetId, "approve");

  assert.equal(response.status, 200);
  assert.equal(action.erpCalls.length, 1);
  assert.equal(approved.approval_status, "approved");
});

test("Promoting an approved User synchronizes the ERP role", async () => {
  const user = profile(targetId, "user");
  const action = setupSuperadminAction(user);
  const response = await action.post(targetId, "promote");

  assert.equal(response.status, 200);
  assert.equal(user.role, "admin");
  assert.deepEqual(action.erpCalls, [{
    authUserId: targetId,
    profileRole: "admin",
    status: "Active",
    isBlocked: false,
  }]);
});

test("ERP role-sync status ignores must_change_password", async () => {
  const cases = [
    {
      is_active: true,
      is_blocked: false,
      must_change_password: true,
      expectedStatus: "Active",
    },
    {
      is_active: false,
      is_blocked: false,
      must_change_password: false,
      expectedStatus: "Inactive",
    },
    {
      is_active: true,
      is_blocked: true,
      must_change_password: false,
      expectedStatus: "Inactive",
    },
  ];

  for (const { expectedStatus, ...overrides } of cases) {
    const user = { ...profile(targetId, "user"), ...overrides };
    const action = setupSuperadminAction(user);
    const response = await action.post(targetId, "promote");

    assert.equal(response.status, 200);
    assert.equal(action.erpCalls[0].status, expectedStatus);
  }
});

test("A role-change provisioning failure is returned instead of success", async () => {
  const user = profile(targetId, "user");
  const action = setupSuperadminAction(user, false, new Error("ERP unavailable"));
  const response = await action.post(targetId, "promote");

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /profile role was changed/);
  assert.equal(user.role, "admin");
});

function setupErpProvisioner() {
  const writes = [];
  const roleLookups = [];
  const authUser = {
    email: "  Alice@Example.COM ",
    user_metadata: {
      first_name: "Alice",
      full_name: "Alice Smith",
    },
  };
  const erpRoles = {
    User: { role_id: 1 },
    Admin: { role_id: 2 },
    Superadmin: { role_id: 3 },
  };
  const supabase = {
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: authUser }, error: null }),
      },
    },
    from(table) {
      if (table === "role") {
        const filters = [];
        return {
          select() { return this; },
          eq(column, value) {
            filters.push({ column, value });
            return this;
          },
          async maybeSingle() {
            roleLookups.push(filters);
            return {
              data: erpRoles[filters.find((filter) => filter.column === "name")?.value] ?? null,
              error: null,
            };
          },
        };
      }
      assert.equal(table, "app_user");
      return {
        async upsert(account, options) {
          writes.push({ account: { ...account }, options: { ...options } });
          return { error: null };
        },
      };
    },
  };
  const provisioner = compile("../lib/user-management/provision-erp-account.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => supabase },
  });
  return { ensureErpAccount: provisioner.ensureErpAccount, roleLookups, writes };
}

test("ERP provisioning maps profile roles and uses Auth metadata with an idempotent upsert", async () => {
  const provisioner = setupErpProvisioner();
  for (const [profileRole, roleId] of [
    ["user", 1],
    ["admin", 2],
    ["superadmin", 3],
  ]) {
    await provisioner.ensureErpAccount({
      authUserId: targetId,
      profileRole,
      status: "Active",
    });
    const write = provisioner.writes.at(-1);
    assert.deepEqual(write.account, {
      auth_user_id: targetId,
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
      role_id: roleId,
      status: "Active",
    });
    assert.deepEqual(write.options, { onConflict: "auth_user_id" });
  }
});
