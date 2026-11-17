import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";

const require = createRequire(import.meta.url);

function compile(path, dependencies = {}) {
  const source = fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const exports = {};
  vm.runInThisContext(`(function(exports, require) { ${compiled}\n})`)(
    exports,
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
  );
  return exports;
}

const rightsLibrary = compile("../lib/user-management/rights.ts");
const RightsDialog = compile("../components/user-management/rights-dialog.tsx", {
  "@/lib/user-management/rights": rightsLibrary,
}).default;

let id = 0;
const modules = [
  ["CUSTOMER", "Customer", 3],
  ["PRODUCT", "Product", 6],
  ["HR", "Human Resources", 13],
  ["SALES", "Sales", 7],
  ["REPORTS", "Reports", 7],
].map(([code, name, count]) => ({
  code,
  name,
  rights: Array.from({ length: count }, () => {
    id += 1;
    return { id, label: `Right ${id}` };
  }),
}));

async function setup(t, fetchHandler) {
  const dom = new JSDOM("<!doctype html><html><body><main></main></body></html>", {
    url: "http://localhost",
  });
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  const oldActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.fetch = fetchHandler;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };

  const root = createRoot(dom.window.document.querySelector("main"));
  const calls = { closed: 0, saved: 0 };
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldActEnvironment;
  });
  await act(async () => {
    root.render(React.createElement(RightsDialog, {
      userId: "test-user",
      userName: "Test User",
      onClose: () => { calls.closed += 1; },
      onSaved: () => { calls.saved += 1; },
    }));
  });
  return { document: dom.window.document, calls };
}

function button(document, text) {
  const result = [...document.querySelectorAll("button")].find((item) => item.textContent === text);
  assert.ok(result, `Missing button: ${text}`);
  return result;
}

test("loading, module selection, unsaved changes and successful save", async (t) => {
  let resolveLoad;
  const load = new Promise((resolve) => { resolveLoad = resolve; });
  let savedBody;
  const { document, calls } = await setup(t, async (_url, options) => {
    if (!options.method) return load;
    savedBody = JSON.parse(options.body);
    return Response.json({ changed: 2 });
  });
  assert.match(document.body.textContent, /Loading rights/);
  await act(async () => {
    resolveLoad(Response.json({ modules, selected: [1], readOnly: false }));
    await load;
  });

  assert.equal(document.querySelector("#um-rights-selection").textContent.trim(), "Selected 1 of 36");
  const customer = document.querySelector(".um-rights-module");
  const moduleCheckbox = customer.querySelector("input");
  assert.equal(moduleCheckbox.indeterminate, true);
  assert.equal(button(document, "Save rights").disabled, true);
  await act(async () => button(customer, "All").click());
  assert.equal(document.querySelector(".um-rights-module input").checked, true);
  assert.equal(document.querySelector("#um-rights-selection").textContent.trim(), "Selected 3 of 36");
  assert.match(document.body.textContent, /unsaved changes/i);
  await act(async () => button(document.querySelector(".um-rights-module"), "None").click());
  assert.equal(document.querySelector(".um-rights-module input").checked, false);
  await act(async () => document.querySelectorAll(".um-rights-module input")[1].click());
  assert.equal(document.querySelector(".um-rights-module input").indeterminate, true);
  await act(async () => button(document.querySelector(".um-rights-module"), "All").click());
  await act(async () => button(document, "Save rights").click());
  assert.deepEqual(savedBody.expected, [1]);
  assert.deepEqual(savedBody.selected, [1, 2, 3]);
  assert.equal(savedBody.catalogue.length, 36);
  assert.equal(calls.saved, 1);
  assert.equal(calls.closed, 1);
});

test("save errors preserve changes and cancellation closes without saving", async (t) => {
  const { document, calls } = await setup(t, async (_url, options) =>
    options.method
      ? Response.json({ error: "Save failed." }, { status: 503 })
      : Response.json({ modules, selected: [], readOnly: false }),
  );
  await act(async () => button(document.querySelector(".um-rights-module"), "All").click());
  await act(async () => button(document, "Save rights").click());
  assert.match(document.querySelector('[role="alert"]').textContent, /Save failed/);
  assert.match(document.body.textContent, /unsaved changes/i);
  assert.equal(calls.saved, 0);
  await act(async () => button(document, "Cancel").click());
  assert.equal(calls.closed, 1);
});

test("module checkbox selects and clears only that module", async (t) => {
  const { document } = await setup(t, async () =>
    Response.json({ modules, selected: [4], readOnly: false }),
  );
  const customer = document.querySelectorAll(".um-rights-module")[0];
  const product = document.querySelectorAll(".um-rights-module")[1];
  await act(async () => customer.querySelector("input").click());
  assert.ok([...customer.querySelectorAll("input")].every((input) => input.checked));
  assert.equal(product.querySelectorAll("input")[1].checked, true);
  await act(async () => customer.querySelector("input").click());
  assert.ok([...customer.querySelectorAll("input")].every((input) => !input.checked));
  assert.equal(product.querySelectorAll("input")[1].checked, true);
});

test("saving blocks edits and closing; a conflict preserves the selection", async (t) => {
  let resolveSave;
  const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
  const { document, calls } = await setup(t, async (_url, options) =>
    options.method ? pendingSave : Response.json({ modules, selected: [], readOnly: false }),
  );
  await act(async () => button(document.querySelector(".um-rights-module"), "All").click());
  await act(async () => button(document, "Save rights").click());
  assert.ok([...document.querySelectorAll('input[type="checkbox"]')].every((item) => item.disabled));
  assert.equal(button(document, "Saving...").disabled, true);
  assert.equal(button(document, "Cancel").disabled, true);
  await act(async () => {
    document.querySelector("dialog").dispatchEvent(new window.Event("cancel", { cancelable: true }));
  });
  assert.equal(calls.closed, 0);

  await act(async () => {
    resolveSave(Response.json({ error: "Rights changed. Close and reopen the dialog before saving." }, { status: 409 }));
    await pendingSave;
  });
  assert.match(document.querySelector('[role="alert"]').textContent, /Rights changed/);
  assert.equal(document.querySelector(".um-rights-module input").checked, true);
  assert.equal(button(document, "Save rights").disabled, false);
  assert.equal(calls.saved, 0);
});

test("Superadmin rights are checked and read-only", async (t) => {
  const response = Response.json({ modules, selected: modules.flatMap((m) => m.rights.map((r) => r.id)), readOnly: true });
  const { document } = await setup(t, async () => response);
  assert.match(document.body.textContent, /full system access/);
  assert.ok([...document.querySelectorAll('input[type="checkbox"]')].every((item) => item.checked && item.disabled));
  assert.equal([...document.querySelectorAll("button")].some((item) => item.textContent === "Save rights"), false);
});

test("loading failure is reported", async (t) => {
  const { document } = await setup(t, async () =>
    Response.json({ error: "Catalogue unavailable." }, { status: 503 }),
  );
  assert.match(document.querySelector('[role="alert"]').textContent, /Catalogue unavailable/);
});
