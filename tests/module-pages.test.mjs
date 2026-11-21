import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const jsx = require("react/jsx-runtime");
const routes = [
  ["customers", "CUSTOMER", "CUSTOMER_ADD"],
  ["products", "PRODUCT", "PRICE_ADD"],
  ["human-resources", "HR", "JOBHISTORY_VIEW"],
  ["sales", "SALES", "SALEDETAIL_VIEW"],
  ["reports", "REPORTS", "REPORT_TOP_CUSTOMERS"],
];

function compile(path, dependencies, context = {}) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
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

function setup({ role = "user", granted = [], authenticated = true, failedTable } = {}) {
  const authUserId = "11111111-1111-4111-8111-111111111111";
  const moduleRows = routes.map(([, code], index) => ({
    module_id: index + 1, code, status: "Active",
  }));
  const tables = {
    app_user: [{ user_id: 7, auth_user_id: authUserId, role_id: 1, status: "Active", is_blocked: false }],
    role: [{ role_id: 1, name: role, status: "Active" }],
    module: moduleRows,
    rights: routes.map(([, , code], index) => ({
      module_id: index + 1, code, label: code, status: "Active",
    })),
    v_user_effective_rights: granted.map((code) => ({ user_id: 7, right_code: code, granted: true })),
  };
  const admin = {
    from(table) {
      let rows = tables[table];
      assert.ok(rows, `Unexpected table ${table}`);
      const response = () => ({ data: rows, error: failedTable === table ? { code: "test-error" } : null });
      return {
        select() { return this; },
        eq(column, value) { rows = rows.filter((row) => row[column] === value); return this; },
        async maybeSingle() { const result = response(); return { ...result, data: result.data[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve(response()).then(resolve, reject); },
      };
    },
  };
  const rightsLibrary = compile("../lib/user-management/rights.ts", {});
  const auth = compile("../lib/auth/rights-authorization.ts", {
    "server-only": {},
    "@supabase/ssr": {
      createServerClient: () => ({
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: authUserId } : null }, error: null }) },
      }),
    },
    "next/headers": { cookies: async () => ({ getAll: () => [], set() {} }) },
    "@/lib/auth/profile": {
      getAuthProfile: async () => ({
        profile: { role, firstName: "Test", lastName: "User", approvalStatus: "approved",
          isActive: true, isBlocked: false, mustChangePassword: false },
        error: null,
      }),
    },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => admin },
    "@/lib/user-management/rights": rightsLibrary,
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key", SUPABASE_SECRET_KEY: "test-secret" } },
    console: { error() {} },
  });
  const redirect = (path) => { throw new Error(`redirect:${path}`); };
  const modules = compile("../lib/dashboard/modules.ts", {});
  const dependencies = {
    "react/jsx-runtime": jsx,
    "next/link": { default: "a" },
    "next/navigation": { redirect },
    "@/components/dashboard/refresh-access": { default: () => null },
    "@/components/dashboard/sidebar": { default: () => null },
    "@/lib/auth/rights-authorization": auth,
    "@/lib/dashboard/modules": modules,
  };
  const modulePage = compile("../components/dashboard/module-page.tsx", dependencies).default;
  const dashboardContext = compile("../lib/dashboard/context.ts", {
    "server-only": {},
    "next/navigation": { redirect },
    "@/lib/auth/rights-authorization": auth,
  });
  const settings = compile("../app/system-settings/page.tsx", {
    ...dependencies,
    "@/lib/dashboard/context": dashboardContext,
  }).default;

  return {
    auth,
    settings,
    async render(path) {
      const route = compile(`../app/${path}/page.tsx`, {
        "react/jsx-runtime": jsx,
        "@/components/dashboard/module-page": { default: modulePage },
      }).default;
      const element = route();
      return element.type(element.props);
    },
  };
}

function nodes(node) {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node];
  return [node, ...nodes(node.props?.children)];
}

test("each direct module URL requires an active permission for that module", async () => {
  for (const [path, code, right] of routes) {
    const granted = setup({ granted: [right] });
    assert.equal((await granted.auth.authorizeModule(code)).allowed, true);
    assert.ok(nodes(await granted.render(path)).includes(right), path);

    const denied = setup({ granted: ["UNRELATED_RIGHT"] });
    assert.equal((await denied.auth.authorizeModule(code)).status, 403);
    await assert.rejects(denied.render(path), /redirect:\/no-access/, path);
  }
});

test("Admin and Superadmin can open every business module", async () => {
  for (const role of ["admin", "superadmin"]) {
    const app = setup({ role });
    for (const [path, code] of routes) {
      assert.equal((await app.auth.authorizeModule(code)).allowed, true, `${role}: ${path}`);
      assert.ok(nodes(await app.render(path)).some((node) => node?.type === "main"));
    }
  }
});

test("unauthenticated direct URLs redirect to login; lookup failures show an error", async () => {
  const anonymous = setup({ authenticated: false });
  const unavailable = setup({ failedTable: "rights" });
  for (const [path, code] of routes) {
    assert.equal((await anonymous.auth.authorizeModule(code)).status, 401);
    await assert.rejects(anonymous.render(path), /redirect:\/login/, path);
    assert.equal((await unavailable.auth.authorizeModule(code)).status, 503);
    const tree = nodes(await unavailable.render(path));
    assert.ok(tree.some((node) => node?.props?.role === "alert"), path);
    assert.ok(tree.includes("Permissions are temporarily unavailable."), path);
  }
});

test("System Settings requires an authenticated Superadmin", async () => {
  await assert.rejects(setup({ authenticated: false }).settings(), /redirect:\/login/);
  for (const role of ["user", "admin"]) {
    await assert.rejects(setup({ role }).settings(), /redirect:\/no-access/);
  }
  assert.ok(nodes(await setup({ role: "superadmin" }).settings()).includes("System Settings"));
});
