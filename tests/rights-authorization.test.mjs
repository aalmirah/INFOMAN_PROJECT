import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const actorId = "11111111-1111-4111-8111-111111111111";
const catalogue = {
  CUSTOMER: {
    "customers.add": "CUSTOMER_ADD", "customers.edit": "CUSTOMER_EDIT",
    "customers.delete": "CUSTOMER_DELETE",
  },
  PRODUCT: {
    "products.add": "PRODUCT_ADD", "products.edit": "PRODUCT_EDIT",
    "products.delete": "PRODUCT_DELETE", "products.price_add": "PRICE_ADD",
    "products.price_edit": "PRICE_EDIT", "products.price_delete": "PRICE_DELETE",
  },
  HR: {
    "hr.job_add": "JOB_ADD", "hr.job_edit": "JOB_EDIT", "hr.job_delete": "JOB_DELETE",
    "hr.department_add": "DEPARTMENT_ADD", "hr.department_edit": "DEPARTMENT_EDIT",
    "hr.department_delete": "DEPARTMENT_DELETE", "hr.employee_add": "EMPLOYEE_ADD",
    "hr.employee_edit": "EMPLOYEE_EDIT", "hr.employee_delete": "EMPLOYEE_DELETE",
    "hr.job_history_view": "JOBHISTORY_VIEW", "hr.job_history_add": "JOBHISTORY_ADD",
    "hr.job_history_edit": "JOBHISTORY_EDIT", "hr.job_history_delete": "JOBHISTORY_DELETE",
  },
  SALES: {
    "sales.sale_add": "SALE_ADD", "sales.sale_edit": "SALE_EDIT", "sales.sale_delete": "SALE_DELETE",
    "sales.sale_detail_view": "SALEDETAIL_VIEW", "sales.sale_detail_add": "SALEDETAIL_ADD",
    "sales.sale_detail_edit": "SALEDETAIL_EDIT", "sales.sale_detail_delete": "SALEDETAIL_DELETE",
  },
  REPORTS: {
    "reports.top_customers": "REPORT_TOP_CUSTOMERS", "reports.product_master": "REPORT_PRODUCT_MASTER",
    "reports.top_products": "REPORT_TOP_PRODUCTS", "reports.active_employees": "REPORT_ACTIVE_EMPLOYEES",
    "reports.all_employees": "REPORT_ALL_EMPLOYEES",
    "reports.employee_job_history": "REPORT_EMPLOYEE_JOBHISTORY", "reports.top_sales": "REPORT_TOP_SALES",
  },
};

function setup({ role = "user", profileChanges = {}, accountChanges = {}, granted = [],
  inactiveRight, inactiveModule, session = true, databaseError, qaRight = false } = {}) {
  const moduleRows = Object.keys(catalogue).map((code, index) => ({
    module_id: index + 1, code, status: code === inactiveModule ? "Inactive" : "Active",
  }));
  const rightRows = moduleRows.flatMap((row) =>
    Object.entries(catalogue[row.code]).map(([dotted, code]) => ({
      module_id: row.module_id, code: qaRight ? dotted : code, label: code,
      status: code === inactiveRight ? "Inactive" : "Active",
    })),
  );
  const tables = {
    app_user: [{ auth_user_id: actorId, user_id: 7, role_id: 1, status: "Active", is_blocked: false, ...accountChanges }],
    role: [{ role_id: 1, name: role, status: "Active" }],
    module: moduleRows,
    rights: rightRows,
    v_user_effective_rights: granted.map((right_code) => ({ user_id: 7, right_code, granted: true })),
  };
  const profile = {
    role, firstName: "Test", lastName: "User", approvalStatus: "approved",
    isActive: true, isBlocked: false, mustChangePassword: false, ...profileChanges,
  };
  const admin = {
    from(table) {
      let rows = tables[table];
      assert.ok(rows, `Unexpected table ${table}`);
      const response = () => ({
        data: rows, error: databaseError === table ? { code: "test-error" } : null,
      });
      return {
        select() { return this; },
        eq(column, value) { rows = rows.filter((row) => row[column] === value); return this; },
        async maybeSingle() { const result = response(); return { ...result, data: result.data[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve(response()).then(resolve, reject); },
      };
    },
  };
  const source = fs.readFileSync(fileURLToPath(new URL("../lib/auth/rights-authorization.ts", import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const dependencies = {
    "server-only": {},
    "@supabase/ssr": { createServerClient: () => ({
      auth: { getUser: async () => ({ data: { user: session ? { id: actorId } : null }, error: null }) },
    }) },
    "next/headers": { cookies: async () => ({ getAll: () => [], set() {} }) },
    "@/lib/auth/profile": { getAuthProfile: async () => ({ profile, error: null }) },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => admin },
    "@/lib/user-management/rights": { isRightsModuleCode: (code) => Object.hasOwn(catalogue, code) },
  };
  vm.runInNewContext(compiled, {
    exports, require: (name) => {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key", SUPABASE_SECRET_KEY: "test-secret" } },
    console: { error() {} },
  });
  return exports;
}

test("all 36 active database codes map to their specific DEV07 actions", async () => {
  for (const entries of Object.values(catalogue)) {
    for (const [dotted, code] of Object.entries(entries)) {
      const auth = setup({ granted: [code] });
      assert.equal((await auth.authorizeRight(dotted)).allowed, true, `${dotted} -> ${code}`);
    }
  }
});

test("missing and inactive rights fail closed, including for Superadmin", async () => {
  assert.equal((await setup({ role: "superadmin" }).authorizeRight("customers.view")).status, 403);
  assert.equal((await setup({ granted: ["CUSTOMER_ADD"], inactiveRight: "CUSTOMER_ADD" }).authorizeRight("customers.add")).status, 403);
  assert.equal((await setup({ granted: ["CUSTOMER_ADD"], inactiveModule: "CUSTOMER" }).authorizeModule("CUSTOMER")).status, 403);
  assert.equal((await setup({ granted: ["CUSTOMER_EDIT"] }).authorizeRight("customers.add")).status, 403);
  assert.equal((await setup().authorizeRight("customers.invalid")).status, 403);
});

test("QA dotted catalogue remains supported without granting a different action", async () => {
  const auth = setup({ granted: ["products.price_add"], qaRight: true });
  assert.equal((await auth.authorizeRight("products.price_add")).allowed, true);
  assert.equal((await auth.authorizeRight("products.price_edit")).status, 403);
});

test("module authorization uses any active grant, not unrelated rights", async () => {
  const auth = setup({ granted: ["PRICE_ADD"] });
  assert.equal((await auth.authorizeModule("PRODUCT")).allowed, true);
  assert.equal((await auth.authorizeModule("CUSTOMER")).status, 403);
  assert.equal((await setup({ role: "admin" }).authorizeModule("CUSTOMER")).allowed, true);
  assert.equal((await setup({ role: "admin" }).authorizeRight("customers.add")).status, 403);
});

test("authentication, profile, ERP link, and role are checked before authorization", async () => {
  assert.equal((await setup({ session: false }).authorizeActor()).status, 401);
  for (const profileChanges of [
    { isActive: false }, { isBlocked: true }, { approvalStatus: "pending" },
    { mustChangePassword: true }, { role: "other" },
  ]) {
    assert.equal((await setup({ profileChanges }).authorizeActor()).status, 403);
  }
  for (const accountChanges of [
    { is_blocked: true }, { is_blocked: null }, { status: "Inactive" },
    { auth_user_id: "different" }, { role_id: 2 },
  ]) {
    assert.equal((await setup({ accountChanges }).authorizeActor()).status, 403);
  }
  assert.equal((await setup({ databaseError: "role" }).authorizeActor()).status, 503);
  assert.equal((await setup({ databaseError: "rights" }).authorizeRight("customers.add")).status, 503);
});
