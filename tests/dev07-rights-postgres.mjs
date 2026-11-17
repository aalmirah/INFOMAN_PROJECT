import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function docker(args, input) {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120000 });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `docker exited with ${result.status}`);
  }
  return result.stdout.trim();
}

function concurrentProvision(container) {
  const sql = `
    BEGIN;
    SELECT public.dev07_provision_profile('10000000-0000-4000-8000-000000000009');
    SELECT pg_sleep(2);
    COMMIT;
  `;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec", "-i", container, "psql", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "dev07_provision_test",
    ]);
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(errors || `Provisioning client exited with ${code}`));
      else resolve(output.trim());
    });
    child.stdin.end(sql);
  });
  return Promise.all([run(), run()]);
}

async function guardRace(container, firstSql, secondSql, expectedError, options = {}) {
  const args = [
    "exec", "-i", container, "psql", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "dev07_provision_test",
  ];
  const first = spawn("docker", args);
  let firstErrors = "";
  let readyOutput = "";
  first.stderr.on("data", (chunk) => { firstErrors += chunk; });
  const firstExit = new Promise((resolve, reject) => {
    first.on("error", reject);
    first.on("close", (code) => resolve(code));
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Guard race setup timed out.")), 15000);
    first.stdout.on("data", (chunk) => {
      readyOutput += chunk;
      if (readyOutput.includes("GUARD_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    first.on("close", () => {
      clearTimeout(timer);
      reject(new Error(firstErrors || "Guard race setup exited before locking."));
    });
  });
  let second;
  try {
    first.stdin.write(`BEGIN;\n${firstSql}\nSELECT 'GUARD_READY';\n`);
    await ready;
    second = spawn("docker", args);
    let secondErrors = "";
    second.stderr.on("data", (chunk) => { secondErrors += chunk; });
    const secondExit = new Promise((resolve, reject) => {
      second.on("error", reject);
      second.on("close", (code) => resolve(code));
    });
    second.stdin.end(`SET application_name = 'dev07_guard_race';\n${secondSql}\n`);
    let waiting = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const count = docker([
        "exec", container, "psql", "-qAt", "-U", "postgres", "-d", "dev07_provision_test",
        "-c", "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'dev07_guard_race' AND wait_event_type = 'Lock'",
      ]);
      if (count === "1") {
        waiting = true;
        break;
      }
    }
    if (!waiting) throw new Error("Competing guard operation did not wait for a lock.");
    first.stdin.end(`${options.firstFinishSql || "COMMIT;"}\n`);
    const [firstCode, secondCode] = await Promise.all([firstExit, secondExit]);
    const expectedResult = expectedError === null
      ? firstCode === 0 && secondCode === 0
      : options.errorOnEither
      ? (firstCode === 0 && secondCode !== 0 && secondErrors.includes(expectedError)) ||
        (secondCode === 0 && firstCode !== 0 && firstErrors.includes(expectedError))
      : firstCode === 0 && secondCode !== 0 && secondErrors.includes(expectedError);
    if (!expectedResult) {
      throw new Error(`Unexpected guard race result: ${firstErrors} ${secondErrors}`);
    }
  } finally {
    if (first.exitCode === null) first.kill();
    if (second && second.exitCode === null) second.kill();
  }
}

let container;
try {
  container = docker([
    "run", "--detach", "--rm", "--pull=never", "--network", "none",
    "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
    "--env", "POSTGRES_DB=dev07_synthetic_test", "postgres:17",
  ]);
  if (!/^[a-f0-9]{64}$/.test(container)) throw new Error("Invalid Docker container ID.");

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync("docker", [
      "exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres",
      "-d", "dev07_synthetic_test",
    ], { stdio: "ignore" });
    if (result.status === 0) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (!ready) throw new Error("The isolated PostgreSQL container did not become ready.");

  for (const path of [
    "./dev07-rights-synthetic-baseline.sql",
    "../docs/dev07_atomic_rights_save_proposal.sql",
    "./dev07-rights-synthetic-checks.sql",
  ]) {
    const sql = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    const output = docker(
      ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_synthetic_test"],
      `SET dev07.synthetic_test = 'yes';\n${sql}`,
    );
    console.log(output);
  }

  docker(["exec", container, "createdb", "-U", "postgres", "dev07_provision_test"]);
  for (const path of [
    "./dev07-provisioning-synthetic-baseline.sql",
    "../docs/dev07_account_provisioning_proposal.sql",
    "./dev07-provisioning-synthetic-checks.sql",
  ]) {
    const sql = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    const output = docker(
      ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_provision_test"],
      `SET dev07.synthetic_test = 'yes';\n${sql}`,
    );
    console.log(output);
  }
  const ids = await concurrentProvision(container);
  if (!ids[0] || ids[0] !== ids[1]) throw new Error("Concurrent provisioning returned different IDs.");
  const count = docker([
    "exec", container, "psql", "-qAt", "-U", "postgres", "-d", "dev07_provision_test",
    "-c", "SELECT count(*) FROM public.app_user WHERE auth_user_id = '10000000-0000-4000-8000-000000000009'",
  ]);
  if (count !== "1") throw new Error("Concurrent provisioning did not create exactly one account.");
  console.log("Concurrent provisioning test passed.");

  for (const path of [
    "../docs/dev07_auth_soft_delete_proposal.sql",
    "./dev07-soft-delete-synthetic-checks.sql",
  ]) {
    const sql = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    console.log(docker(
      ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_provision_test"],
      `SET dev07.synthetic_test = 'yes';\n${sql}`,
    ));
  }
  const insert = (id) => `INSERT INTO public.app_user
    (auth_user_id, first_name, last_name, email, role_id, status, is_blocked, must_set_password)
    VALUES ('${id}', 'Test', 'User', '${id}@example.invalid', 1, 'Active', false, false);`;
  const softDelete = (id) => `UPDATE auth.users SET deleted_at = now() WHERE id = '${id}';`;
  const firstId = "10000000-0000-4000-8000-000000000010";
  const secondId = "10000000-0000-4000-8000-000000000011";
  const thirdId = "10000000-0000-4000-8000-000000000012";
  const fourthId = "10000000-0000-4000-8000-000000000013";
  const updateLink = (id, email) => `UPDATE public.app_user
    SET auth_user_id = '${id}' WHERE email = '${email}';`;
  await guardRace(container, insert(firstId), softDelete(firstId),
    "Cannot soft-delete an Auth user linked to an ERP account");
  await guardRace(container, softDelete(secondId), insert(secondId),
    "Cannot link a soft-deleted Auth user");
  await guardRace(container, updateLink(thirdId, "race-update-12@example.invalid"), softDelete(thirdId),
    "Cannot soft-delete an Auth user linked to an ERP account");
  await guardRace(container, softDelete(fourthId), updateLink(fourthId, "race-update-13@example.invalid"),
    "Cannot link a soft-deleted Auth user");
  const brokenLinks = docker([
    "exec", container, "psql", "-qAt", "-U", "postgres", "-d", "dev07_provision_test",
    "-c", "SELECT count(*) FROM public.app_user u JOIN auth.users a ON a.id = u.auth_user_id WHERE a.deleted_at IS NOT NULL",
  ]);
  if (brokenLinks !== "0") throw new Error("Concurrency tests left a linked soft-deleted account.");
  console.log("Auth link/soft-delete concurrency tests passed.");
  for (const [sql, message] of [
    [`BEGIN ISOLATION LEVEL REPEATABLE READ; ${softDelete(firstId)} COMMIT;`,
      "Auth soft deletion requires READ COMMITTED isolation"],
    [`BEGIN ISOLATION LEVEL SERIALIZABLE; ${insert(secondId)} COMMIT;`,
      "Auth linking requires READ COMMITTED isolation"],
  ]) {
    const result = spawnSync("docker", [
      "exec", "-i", container, "psql", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "dev07_provision_test",
    ], { encoding: "utf8", input: sql, timeout: 30000 });
    if (result.error || result.status === 0 || !result.stderr.includes(message)) {
      throw new Error(`Unexpected isolation guard result: ${result.error?.message || result.stderr}`);
    }
  }
  console.log("Non-READ-COMMITTED guard tests passed.");

  docker([
    "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_provision_test",
    "-c", "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role",
  ]);
  for (const path of [
    "../docs/dev07_profile_sync_proposal.sql",
    "./dev07-sync-synthetic-checks.sql",
    "./dev07-sync-rights-synthetic-baseline.sql",
    "../docs/dev07_atomic_rights_save_proposal.sql",
  ]) {
    const sql = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    console.log(docker(
      ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_provision_test"],
      `SET dev07.synthetic_test = 'yes';\n${sql}`,
    ));
  }
  console.log("Profile synchronization tests passed.");

  const resetSyncState = () => docker([
    "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "dev07_provision_test",
    "-c", `UPDATE public.role SET status = 'Active' WHERE name = 'User';
      UPDATE public.profiles SET is_blocked = false WHERE id = '${firstId}';`,
  ]);
  const blockProfile = `UPDATE public.profiles SET is_blocked = true WHERE id = '${firstId}';`;
  const deactivateRole = "UPDATE public.role SET status = 'Inactive' WHERE name = 'User';";
  await guardRace(container, blockProfile, deactivateRole, null);
  resetSyncState();
  await guardRace(container, deactivateRole, blockProfile, null);
  resetSyncState();

  const provisionId = "10000000-0000-4000-8000-000000000009";
  const authUpdate = `UPDATE auth.users SET deleted_at = deleted_at WHERE id = '${provisionId}';`;
  const profileUpdate = `UPDATE public.profiles SET first_name = 'Synced' WHERE id = '${provisionId}';`;
  const provision = `SELECT public.dev07_provision_profile('${provisionId}');`;
  await guardRace(container, `${authUpdate} ${profileUpdate}`, provision, null);
  await guardRace(container, provision, `BEGIN; ${authUpdate} ${profileUpdate} COMMIT;`, null);
  console.log("Coordinated profile, role and Auth/provisioning races passed.");

  const save = `SELECT public.dev07_save_user_permissions(
    '10000000-0000-4000-8000-000000000014', '${firstId}',
    ARRAY(SELECT generate_series(1, 36)::bigint), ARRAY[]::bigint[], ARRAY[]::bigint[]);`;
  for (const [sql, message] of [
    [blockProfile, "Profile and role updates require READ COMMITTED isolation"],
    [deactivateRole, "Profile and role updates require READ COMMITTED isolation"],
    [provision, "Account provisioning requires READ COMMITTED isolation"],
    [save, "Rights saving requires READ COMMITTED isolation"],
  ]) {
    for (const isolation of ["REPEATABLE READ", "SERIALIZABLE"]) {
      const result = spawnSync("docker", [
        "exec", "-i", container, "psql", "-qAt", "-v", "ON_ERROR_STOP=1",
        "-U", "postgres", "-d", "dev07_provision_test",
      ], { encoding: "utf8", input: `BEGIN ISOLATION LEVEL ${isolation}; ${sql} COMMIT;`, timeout: 30000 });
      if (result.error || result.status === 0 || !result.stderr.includes(message)) {
        throw new Error(`Unexpected synchronization isolation result: ${result.error?.message || result.stderr}`);
      }
    }
  }
  console.log("Synchronization isolation guard tests passed.");
  await guardRace(container, deactivateRole, save, "Target is not eligible for editable rights");
  resetSyncState();
  await guardRace(container, save, deactivateRole, null);
  resetSyncState();
  console.log("Coordinated role and rights-save races passed.");

  await guardRace(container,
    `SELECT id FROM public.profiles WHERE id = '${firstId}' FOR UPDATE;`,
    "UPDATE public.role SET status = 'Inactive' WHERE name = 'User';",
    "deadlock detected",
    {
      firstFinishSql: `UPDATE public.profiles SET is_blocked = true WHERE id = '${firstId}'; COMMIT;`,
      errorOnEither: true,
    });
  const consistent = docker([
    "exec", container, "psql", "-qAt", "-U", "postgres", "-d", "dev07_provision_test",
    "-c", `SELECT count(*) = 1 AND bool_and(u.is_blocked IS NOT DISTINCT FROM p.is_blocked
      AND u.status IS NOT DISTINCT FROM CASE WHEN p.is_blocked OR r.status <> 'Active'
        THEN 'Inactive' ELSE 'Active' END)
      FROM public.profiles p JOIN public.app_user u ON u.auth_user_id = p.id
      JOIN public.role r ON r.role_id = u.role_id WHERE p.id = '${firstId}'
      `,
  ]);
  if (consistent !== "t") throw new Error("Synchronization deadlock left inconsistent account state.");
  console.log("Profile/role deadlock rollback test passed.");
} catch (error) {
  console.error("Synthetic PostgreSQL test failed:", error.message);
  process.exitCode = 1;
} finally {
  if (container && /^[a-f0-9]{64}$/.test(container)) {
    try {
      docker(["stop", container]);
    } catch (error) {
      console.error("Could not stop the synthetic test container:", error.message);
      process.exitCode = 1;
    }
  }
}
