import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const jsx = require("react/jsx-runtime");
const react = require("react");

function compile(path, dependencies) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: (name) => {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console: { error() {} },
  });
  return exports;
}

function setup(role, rights = [], counts = {}) {
  const calls = [];
  const actor = { authUserId: "id", erpUserId: 7, role, name: "Test User" };
  const permissions = {
    canAccessModule: (currentActor, list, code) =>
      currentActor.role !== "user" || list.some((right) => right.module === code),
    authorizeModule: async (code) =>
      actor.role !== "user" || rights.some((right) => right.module === code)
        ? { allowed: true, actor, rights }
        : { allowed: false, status: 403, error: "Denied" },
    hasGrantedRight: (list, code) => list.some((right) => right.code === code),
  };
  const modules = compile("../lib/dashboard/modules.ts", {});
  const dependencies = {
    "react/jsx-runtime": jsx,
    react,
    "next/link": { default: "a" },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/components/dashboard/logout-button": { default: () => null },
    "@/components/dashboard/refresh-access": { default: () => null },
    "@/lib/auth/rights-authorization": permissions,
    "@/lib/dashboard/modules": modules,
    "@/lib/dashboard/context": { getDashboardContext: async () => ({ actor, rights }) },
    "@/lib/supabase/admin": {
      getSupabaseAdminClient: () => ({
        from(table) {
          const call = { table, filters: [] };
          calls.push(call);
          return {
            select(id, options) { call.id = id; call.options = options; return this; },
            eq(column, value) { call.filters.push([column, value]); return this; },
            is(column, value) { call.filters.push([column, value]); return this; },
            then(resolve, reject) {
              const value = counts[table] ?? 0;
              return Promise.resolve(value === "error"
                ? { count: null, error: { code: "test-error" } }
                : { count: value, error: null }).then(resolve, reject);
            },
          };
        },
      }),
    },
  };
  dependencies["@/components/dashboard/sidebar"] = compile("../components/dashboard/sidebar.tsx", dependencies);
  return {
    page: compile("../app/session/page.tsx", dependencies).default,
    modulePage: compile("../components/dashboard/module-page.tsx", dependencies).default,
    settingsPage: compile("../app/system-settings/page.tsx", dependencies).default,
    calls,
  };
}

function nodes(node) {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node];
  return [node, ...nodes(node.props?.children)];
}

test("regular users see all tiles but only permitted modules in navigation", async () => {
  const { page } = setup("user", [{ code: "products.price_add", module: "PRODUCT" }]);
  const tree = nodes(await page());
  const tiles = tree.filter((node) => node?.props?.className?.startsWith("dashboard-quick-card"));
  assert.equal(tiles.length, 5);
  assert.equal(tiles.filter((node) => node.props.className.includes("no-access")).length, 4);
  const sidebar = tree.find((node) => node?.type?.name === "Sidebar");
  const nav = nodes(sidebar.type(sidebar.props)).find((node) => node?.type === "nav");
  const navText = nodes(nav).filter((node) => typeof node === "string").join(" ");
  assert.match(navText, /Products/);
  assert.doesNotMatch(navText, /Customers|User Management|System Settings/);
});

test("management links and functional module destinations follow roles", async () => {
  for (const role of ["admin", "superadmin"]) {
    const { page } = setup(role);
    const tree = nodes(await page());
    const sidebar = tree.find((node) => node?.type?.name === "Sidebar");
    const sidebarTree = nodes(sidebar.type(sidebar.props));
    const links = [...tree, ...sidebarTree].filter((node) => node?.type === "a");
    assert.ok(links.some((node) => node.props.href === "/user-management"));
    for (const href of ["/customers", "/products", "/human-resources", "/sales", "/reports"]) {
      assert.ok(links.some((node) => node.props.href === href), href);
    }
    assert.equal(links.some((node) => node.props.href === "/system-settings"), role === "superadmin");
    const nav = sidebarTree.find((node) => node?.type === "nav");
    const navText = nodes(nav).filter((node) => typeof node === "string").join(" ");
    assert.equal(navText.includes("System Settings"), role === "superadmin");
  }
});

test("statistics query only authorized tables and show empty and error states", async () => {
  const { page, calls } = setup("user", [
    { code: "reports.product_master", module: "REPORTS" },
    { code: "reports.active_employees", module: "REPORTS" },
  ], { product: 0, employee: "error" });
  const tree = nodes(await page());
  const statistics = tree.find((node) => typeof node?.type === "function" && node.type.name === "Statistics");
  const statNodes = nodes(await statistics.type(statistics.props));
  assert.deepEqual(calls.map((call) => call.table), ["product", "employee"]);
  assert.deepEqual(calls.map((call) => call.filters), [
    [["is_deleted", false]], [["is_deleted", false], ["sepdate", null]],
  ]);
  const text = statNodes.filter((node) => typeof node === "string").join(" ");
  assert.match(text, /No records/);
  assert.match(text, /Could not load count/);
  assert.match(text, /Not authorized/);
  assert.ok(statNodes.includes(0));
});

test("Admin and Superadmin counts use all four filtered tables", async () => {
  for (const role of ["admin", "superadmin"]) {
    const { page, calls } = setup(role, [], { customer: 2, product: 3, sales: 4, employee: 5 });
    const tree = nodes(await page());
    const statistics = tree.find((node) => typeof node?.type === "function" && node.type.name === "Statistics");
    const result = nodes(await statistics.type(statistics.props));
    assert.deepEqual(calls.map((call) => call.table), ["customer", "product", "sales", "employee"]);
    assert.deepEqual(calls.map((call) => call.id), ["custno", "prodcode", "transno", "empno"]);
    assert.ok(calls.every((call) => call.options.count === "exact" && call.options.head === true));
    assert.ok(calls.every((call) => call.filters.some(([column, value]) => column === "is_deleted" && value === false)));
    assert.deepEqual(calls[3].filters, [["is_deleted", false], ["sepdate", null]]);
    assert.ok(result.includes(2) && result.includes(3) && result.includes(4) && result.includes(5));
  }
});

test("direct module URLs enforce current rights and show actual assignments", async () => {
  const rights = [{ code: "PRICE_ADD", module: "PRODUCT", label: "Add Price" }];
  const { modulePage } = setup("user", rights);
  await assert.rejects(modulePage({ code: "CUSTOMER" }), /redirect:\/no-access/);
  const product = nodes(await modulePage({ code: "PRODUCT" }));
  assert.ok(product.includes("Add Price"));
  const sidebar = product.find((node) => node?.type?.name === "Sidebar");
  const links = nodes(sidebar.type(sidebar.props)).filter((node) => node?.type === "a");
  assert.ok(links.some((node) => node.props.href === "/products" && node.props["aria-current"] === "page"));
  rights.splice(0, 1);
  await assert.rejects(modulePage({ code: "PRODUCT" }), /redirect:\/no-access/);
});

test("dashboard navigation and tile update after a right is revoked", async () => {
  const rights = [{ code: "PRICE_ADD", module: "PRODUCT", label: "Add Price" }];
  const { page } = setup("user", rights);
  const linksFor = (tree) => {
    const sidebar = tree.find((node) => node?.type?.name === "Sidebar");
    return [...tree, ...nodes(sidebar.type(sidebar.props))]
      .filter((node) => node?.type === "a" && node.props.href === "/products");
  };
  assert.equal(linksFor(nodes(await page())).length, 2);
  rights.splice(0, 1);
  const updated = nodes(await page());
  assert.equal(linksFor(updated).length, 0);
  assert.ok(updated.some((node) => node?.props?.className?.includes("dashboard-quick-card-no-access") &&
    nodes(node).includes("Products")));
});

test("each business destination renders the matching protected module", () => {
  for (const [path, code] of [
    ["customers", "CUSTOMER"], ["products", "PRODUCT"], ["human-resources", "HR"],
    ["sales", "SALES"], ["reports", "REPORTS"],
  ]) {
    const component = () => null;
    const route = compile(`../app/${path}/page.tsx`, {
      "react/jsx-runtime": jsx,
      "@/components/dashboard/module-page": { default: component },
    });
    const element = route.default();
    assert.equal(element.type, component);
    assert.equal(element.props.code, code);
    assert.equal(route.dynamic, "force-dynamic");
  }
});

test("dashboard context redirects unauthenticated and denied sessions", async () => {
  for (const [status, target] of [[401, "/login"], [403, "/no-access"]]) {
    const context = compile("../lib/dashboard/context.ts", {
      "server-only": {},
      "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
      "@/lib/auth/rights-authorization": {
        authorizeActor: async () => ({ allowed: false, status, error: "Denied" }),
      },
    });
    await assert.rejects(context.getDashboardContext(), new RegExp(`redirect:${target}`));
  }
});

test("System Settings is accessible only to Superadmins", async () => {
  for (const role of ["user", "admin"]) {
    await assert.rejects(setup(role).settingsPage(), /redirect:\/no-access/);
  }
  const page = nodes(await setup("superadmin").settingsPage());
  assert.ok(page.some((node) => node?.type === "a" && node.props.href === "/user-management"));
});

test("User Management page independently enforces the verified role", async () => {
  for (const [result, redirectTo] of [
    [{ allowed: false, status: 401, error: "Denied" }, "/login"],
    [{ allowed: false, status: 403, error: "Denied" }, "/no-access"],
    [{ allowed: true, actor: { role: "user" } }, "/no-access"],
  ]) {
    const route = compile("../app/user-management/page.tsx", {
      "react/jsx-runtime": jsx,
      "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
      "@/components/user-management/user-management": { default: () => null },
      "@/components/dashboard/sidebar": { default: () => null },
      "@/lib/auth/rights-authorization": { authorizeActor: async () => result },
    });
    await assert.rejects(route.default(), new RegExp(`redirect:${redirectTo}`));
  }
  for (const role of ["admin", "superadmin"]) {
    const management = () => null;
    const route = compile("../app/user-management/page.tsx", {
      "react/jsx-runtime": jsx,
      "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
      "@/components/user-management/user-management": { default: management },
      "@/components/dashboard/sidebar": { default: () => null },
      "@/lib/auth/rights-authorization": { authorizeActor: async () => ({ allowed: true, actor: { role } }) },
    });
    assert.equal((await route.default()).type, management);
  }
});
