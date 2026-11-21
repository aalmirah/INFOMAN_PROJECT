import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const routes = [
  ["../app/api/user-management/route.ts", "GET"],
  ["../app/api/user-management/route.ts", "POST"],
  ["../app/api/user-management/[userId]/route.ts", "PATCH"],
  ["../app/api/user-management/[userId]/rights/route.ts", "GET"],
  ["../app/api/user-management/[userId]/rights/route.ts", "PUT"],
  ["../app/api/superadmin/pending/route.ts", "GET"],
  ["../app/api/superadmin/users/[userId]/route.ts", "POST"],
];

function compile(path, dependencies) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Response, URL, process, console,
    require: (name) => {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function load(path, status, role) {
  const denied = async () => ({ actor: null, status, error: "Denied" });
  const admin = {
    getSupabaseAdminClient: () => { throw new Error("Denied request reached the database"); },
  };
  let userManagement = { getUserManagementActor: denied };
  let superadmin = { getSuperadminActor: denied };
  if (role) {
    userManagement = compile("../lib/auth/user-management.ts", {
      "server-only": {},
      "@/lib/auth/rights-authorization": {
        authorizeActor: async () => ({ allowed: true, actor: { authUserId: "test", role } }),
      },
    });
    superadmin = compile("../lib/auth/superadmin.ts", {
      "server-only": {},
      "@/lib/auth/user-management": userManagement,
      "@/lib/supabase/admin": admin,
    });
  }
  return compile(path, {
    "@/lib/supabase/admin": admin,
    "@/lib/auth/user-management": userManagement,
    "@/lib/auth/superadmin": superadmin,
    "@/lib/user-management/request": { isSameOriginRequest: () => true },
    "@/lib/user-management/rights": {},
    "@/lib/user-management/provision-erp-account": {},
  });
}

test("each protected API rejects unauthenticated and unauthorized requests before data access", async () => {
  for (const status of [401, 403]) {
    for (const [path, method] of routes) {
      const handler = load(path, status)[method];
      const request = new Request("http://localhost/api/test", { method });
      const result = await handler(request, { params: Promise.resolve({ userId: "test" }) });
      assert.equal(result.status, status, `${method} ${path}`);
    }
  }
});

test("API role guards reject Users and prevent Admin access to Superadmin endpoints", async () => {
  for (const role of ["user", "admin"]) {
    for (const [path, method] of routes) {
      if (role === "admin" && !path.includes("/superadmin/")) continue;
      const handler = load(path, 403, role)[method];
      const request = new Request("http://localhost/api/test", { method });
      const result = await handler(request, { params: Promise.resolve({ userId: "test" }) });
      assert.equal(result.status, 403, `${role}: ${method} ${path}`);
    }
  }
});
