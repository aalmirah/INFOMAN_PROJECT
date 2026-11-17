import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const profiles = [
  { id: "user-1", role: "user", first_name: "Regular" },
  { id: "user-2", role: "user", first_name: "Other" },
  { id: "admin", role: "admin", first_name: "Admin" },
  { id: "superadmin", role: "superadmin", first_name: "Superadmin" },
].map((profile) => ({
  last_name: "Test",
  email: `${profile.id}@example.invalid`,
  approval_status: "approved",
  is_active: true,
  is_blocked: false,
  must_change_password: false,
  created_at: "2026-01-01T00:00:00Z",
  ...profile,
}));

function loadHandler(role, directory = profiles) {
  const source = fs.readFileSync(
    fileURLToPath(new URL("../app/api/user-management/route.ts", import.meta.url)),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};

  function createQuery() {
    let rows = directory;
    return {
      select() {
        return this;
      },
      order() {
        return this;
      },
      eq(column, value) {
        rows = rows.filter((row) => row[column] === value);
        return this;
      },
      in(column, values) {
        rows = rows.filter((row) => values.includes(row[column]));
        return this;
      },
      neq(column, value) {
        rows = rows.filter((row) => row[column] !== value);
        return this;
      },
      or(value) {
        const search = value.match(/^first_name\.ilike\.\*(.*?)\*/)?.[1];
        assert.ok(search);
        rows = rows.filter((row) =>
          [row.first_name, row.last_name, row.email].some((field) =>
            field.toLowerCase().includes(search.toLowerCase()),
          ),
        );
        return this;
      },
      async range(from, to) {
        return { data: rows.slice(from, to + 1), count: rows.length, error: null };
      },
    };
  }

  const dependencies = {
    "@/lib/supabase/admin": {
      getSupabaseAdminClient: () => ({ from: () => createQuery() }),
    },
    "@/lib/auth/user-management": {
      getUserManagementActor: async () => ({ actor: { id: "actor", role } }),
    },
    "@/lib/user-management/request": {},
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!Object.hasOwn(dependencies, name)) {
        throw new Error(`Unexpected dependency: ${name}`);
      }
      return dependencies[name];
    },
    Response,
    URL,
    console,
    process,
  });
  return exports.GET;
}

async function list(get, query = "") {
  const response = await get(new Request(`http://localhost/api/user-management${query}`));
  return { status: response.status, body: await response.json() };
}

test("Admin all-list includes Admin accounts while User filter remains restricted", async () => {
  const get = loadHandler("admin");
  const all = await list(get);
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.users.map((user) => user.id), [
    "user-1", "user-2", "admin",
  ]);
  assert.equal(all.body.total, 3);

  const users = await list(get, "?role=user");
  assert.equal(users.status, 200);
  assert.deepEqual(users.body.users.map((user) => user.id), ["user-1", "user-2"]);
  assert.equal(users.body.total, 2);

  const search = await list(get, "?search=Admin");
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.users.map((user) => user.id), ["admin"]);
  assert.equal(search.body.total, 1);
});

test("Admin cannot request Admin or Superadmin role filters", async () => {
  const get = loadHandler("admin");
  for (const role of ["admin", "superadmin"]) {
    const result = await list(get, `?role=${role}`);
    assert.equal(result.status, 403);
    assert.equal(result.body.error, "You cannot view that role.");
  }
});

test("Pending profiles stay out of the user directory", async () => {
  const pending = { ...profiles[0], id: "pending-user", approval_status: "pending" };
  const get = loadHandler("superadmin", [...profiles, pending]);

  const allUsers = await list(get);
  assert.equal(allUsers.status, 200);
  assert.equal(allUsers.body.total, profiles.length);
  assert.equal(
    allUsers.body.users.some((user) => user.id === pending.id),
    false,
  );

  const pendingFilter = await list(get, "?status=pending");
  assert.equal(pendingFilter.status, 200);
  assert.equal(pendingFilter.body.total, 0);
  assert.deepEqual(pendingFilter.body.users, []);
});

test("password setup restricts rights without changing the displayed account status", async () => {
  const directory = [{ ...profiles[0], must_change_password: true }];
  const result = await list(loadHandler("admin", directory));
  assert.equal(result.body.users[0].accountStatus, "active");
  assert.equal(result.body.users[0].rightsEligible, false);
});

test("Admin pagination includes Admin accounts but excludes Superadmins", async () => {
  const directory = [
    profiles[2],
    ...Array.from({ length: 26 }, (_, index) => ({
      ...profiles[0],
      id: `user-${index + 1}`,
    })),
    profiles[3],
  ];
  const result = await list(loadHandler("admin", directory), "?page=2");
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 27);
  assert.equal(result.body.totalPages, 2);
  assert.deepEqual(result.body.users.map((user) => user.id), ["user-25", "user-26"]);
});

test("Superadmin retains access to all directory roles", async () => {
  const get = loadHandler("superadmin");
  const all = await list(get);
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.users.map((user) => user.id), [
    "user-1", "user-2", "admin", "superadmin",
  ]);
  assert.equal(all.body.total, 4);

  const admins = await list(get, "?role=admin");
  assert.equal(admins.status, 200);
  assert.deepEqual(admins.body.users.map((user) => user.id), ["admin"]);
});
