'use strict';

const crypto = require('node:crypto');
const { Client } = require('pg');
const { connect, databaseConfig } = require('./lib/database');

const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
const failures = [];

function customerKey(testNumber) {
  return `Z${testNumber}${suffix.slice(0, 3)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function transaction(client, callback) {
  await client.query('BEGIN');
  try {
    await callback();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function setAppUser(client, user) {
  await client.query("SELECT set_config('app.current_user', $1, true)", [user]);
}

async function insertCustomer(client, key, name = 'Audit Test') {
  await client.query(
    `INSERT INTO customer (custno, custname, address, payterm)
     VALUES ($1, $2, 'Audit Test Address', 'COD')`,
    [key, name],
  );
}

async function latestAudit(client, tableName, recordKey) {
  const result = await client.query(
    `SELECT id, action, app_user, db_user, occurred_at, old_values, new_values
     FROM audit_log
     WHERE table_name = $1 AND record_key = $2
     ORDER BY id DESC
     LIMIT 1`,
    [tableName, recordKey],
  );
  assert(result.rowCount === 1, `expected an audit row for ${tableName}/${recordKey}`);
  return result.rows[0];
}

async function test(name, callback) {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function main() {
  const config = databaseConfig();
  const client = await connect(config);
  try {
    const requiredObjects = await client.query(`
      SELECT
        to_regclass('public.audit_log') IS NOT NULL AS audit_log_exists,
        (SELECT count(*)::integer FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND NOT t.tgisinternal
           AND t.tgname = 'zz_audit_log') AS audit_trigger_count
    `);
    assert(requiredObjects.rows[0].audit_log_exists, 'run db:migrate before the audit tests');
    const expectedTables = await client.query(`
      SELECT count(*)::integer AS count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
            AND c.table_name = t.table_name
            AND c.column_name = 'status'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
            AND c.table_name = t.table_name
            AND c.column_name = 'stamp'
        )
    `);
    assert(
      Number(requiredObjects.rows[0].audit_trigger_count) === Number(expectedTables.rows[0].count),
      'not every status/stamp table has an audit trigger',
    );

    await test('1. INSERT records app user, CREATED action, and matching stamp', async () => {
      await transaction(client, async () => {
        await setAppUser(client, 'lisa@hope.com');
        const key = customerKey(1);
        await insertCustomer(client, key);
        const row = await latestAudit(client, 'customer', key);
        const stamp = await client.query('SELECT stamp FROM customer WHERE custno = $1', [key]);
        assert(row.action === 'CREATED', 'insert audit action was not CREATED');
        assert(row.app_user === 'lisa@hope.com', 'application identity was not recorded');
        assert(
          stamp.rows[0].stamp === `CREATED ${row.app_user} ${formatStamp(row.occurred_at)}`,
          'stamp does not match the audit user and timestamp',
        );
      });
    });

    await test('2. UPDATE records the second logged-in user as EDITED', async () => {
      await transaction(client, async () => {
        const key = customerKey(2);
        await setAppUser(client, 'lisa@hope.com');
        await insertCustomer(client, key);
        await setAppUser(client, 'admin@hope.com');
        await client.query('UPDATE customer SET custname = $1 WHERE custno = $2', ['Edited Name', key]);
        const row = await latestAudit(client, 'customer', key);
        assert(row.action === 'EDITED', 'update action was not EDITED');
        assert(row.app_user === 'admin@hope.com', 'update did not record the second user');
      });
    });

    await test('3. Soft delete and reactivation record DELETED and RESTORED', async () => {
      await transaction(client, async () => {
        const key = customerKey(3);
        await setAppUser(client, 'lisa@hope.com');
        await insertCustomer(client, key);
        await setAppUser(client, 'admin@hope.com');
        await client.query("UPDATE customer SET status = 'Inactive' WHERE custno = $1", [key]);
        await client.query("UPDATE customer SET status = 'Active' WHERE custno = $1", [key]);
        const actions = await client.query(
          `SELECT action FROM audit_log
           WHERE table_name = 'customer' AND record_key = $1
           ORDER BY id`,
          [key],
        );
        assert(
          actions.rows.map((row) => row.action).join(',') === 'CREATED,DELETED,RESTORED',
          'unexpected create/delete/restore actions',
        );
      });
    });

    await test('4. Missing app user falls back to system without blocking a write', async () => {
      await transaction(client, async () => {
        const key = customerKey(4);
        await insertCustomer(client, key);
        const row = await latestAudit(client, 'customer', key);
        const stamp = await client.query('SELECT stamp FROM customer WHERE custno = $1', [key]);
        assert(row.app_user === 'system', 'missing identity did not fall back to system');
        assert(stamp.rows[0].stamp.startsWith('CREATED system '), 'system stamp was not applied');
      });
    });

    await test('5. A committed transaction-local user does not leak to the next transaction', async () => {
      await client.query('BEGIN');
      await setAppUser(client, 'lisa@hope.com');
      await client.query('COMMIT');
      await transaction(client, async () => {
        const key = customerKey(5);
        await insertCustomer(client, key);
        const row = await latestAudit(client, 'customer', key);
        assert(row.app_user === 'system', 'previous transaction user leaked through connection reuse');
      });
    });

    await test('6. Two sessions independently record their own users', async () => {
      const first = await connect(config);
      const second = await connect(config);
      try {
        await Promise.all([first.query('BEGIN'), second.query('BEGIN')]);
        await Promise.all([
          setAppUser(first, 'session-one@hope.com'),
          setAppUser(second, 'session-two@hope.com'),
        ]);
        const firstKey = `A6${suffix.slice(0, 3)}`;
        const secondKey = `B6${suffix.slice(0, 3)}`;
        await Promise.all([
          insertCustomer(first, firstKey, 'Session One'),
          insertCustomer(second, secondKey, 'Session Two'),
        ]);
        const [firstAudit, secondAudit] = await Promise.all([
          latestAudit(first, 'customer', firstKey),
          latestAudit(second, 'customer', secondKey),
        ]);
        assert(firstAudit.app_user === 'session-one@hope.com', 'first session has wrong app user');
        assert(secondAudit.app_user === 'session-two@hope.com', 'second session has wrong app user');
      } finally {
        await Promise.allSettled([first.query('ROLLBACK'), second.query('ROLLBACK')]);
        await Promise.all([first.end(), second.end()]);
      }
    });

    await test('7. user_permission changes are audited without password or token hashes', async () => {
      await transaction(client, async () => {
        const roles = await client.query(
          "SELECT role_id, name FROM role WHERE name IN ('Admin', 'User') AND status = 'Active'",
        );
        const roleIds = new Map(roles.rows.map((row) => [row.name, row.role_id]));
        assert(roleIds.has('Admin') && roleIds.has('User'), 'seed active Admin and User roles first');
        const users = await client.query(
          `INSERT INTO app_user (first_name, last_name, email, password_hash, role_id)
           VALUES
             ('Audit', 'Admin', $1, 'DO_NOT_AUDIT_PASSWORD_HASH', $3),
             ('Audit', 'Target', $2, 'DO_NOT_AUDIT_PASSWORD_HASH', $4)
           RETURNING user_id, email`,
          [
            `audit-admin-${suffix.toLowerCase()}@example.test`,
            `audit-target-${suffix.toLowerCase()}@example.test`,
            roleIds.get('Admin'),
            roleIds.get('User'),
          ],
        );
        const admin = users.rows.find((row) => row.email.startsWith('audit-admin-'));
        const target = users.rows.find((row) => row.email.startsWith('audit-target-'));
        const right = await client.query(
          "SELECT right_id FROM rights WHERE code = 'CUSTOMER_ADD' AND status = 'Active'",
        );
        assert(right.rowCount === 1, 'seed the active CUSTOMER_ADD right first');

        await setAppUser(client, admin.email);
        await client.query("SELECT set_config('app.actor_user_id', $1, true)", [String(admin.user_id)]);
        await client.query(
          'INSERT INTO user_permission (user_id, right_id, granted_by) VALUES ($1, $2, $3)',
          [target.user_id, right.rows[0].right_id, admin.user_id],
        );
        await client.query(
          "UPDATE user_permission SET status = 'Inactive' WHERE user_id = $1 AND right_id = $2",
          [target.user_id, right.rows[0].right_id],
        );

        const permissionKey = `${target.user_id}|${right.rows[0].right_id}`;
        const permissionAudit = await client.query(
          `SELECT action FROM audit_log
           WHERE table_name = 'user_permission' AND record_key = $1
           ORDER BY id`,
          [permissionKey],
        );
        assert(
          permissionAudit.rows.map((row) => row.action).join(',') === 'CREATED,DELETED',
          'permission grant/revoke was not audited as CREATED/DELETED',
        );

        const sensitiveAudit = await client.query(
          `SELECT COALESCE(bool_or(old_values ? 'password_hash' OR new_values ? 'password_hash'), false)
                    AS has_password_hash_key,
                  COALESCE(bool_or(old_values ? 'token_hash' OR new_values ? 'token_hash'), false)
                    AS has_token_hash_key,
                  COALESCE(bool_or(
                    old_values::text LIKE '%DO_NOT_AUDIT_PASSWORD_HASH%'
                    OR new_values::text LIKE '%DO_NOT_AUDIT_PASSWORD_HASH%'
                  ), false) AS contains_password_value
           FROM audit_log
           WHERE (table_name = 'app_user' AND record_key IN ($1, $2))
              OR (table_name = 'password_reset_token' AND record_key = $3)`,
          [
            String(admin.user_id),
            String(target.user_id),
            'audit-token-' + suffix,
          ],
        );
        assert(!sensitiveAudit.rows[0].has_password_hash_key, 'password_hash key leaked into audit JSON');
        assert(!sensitiveAudit.rows[0].has_token_hash_key, 'token_hash key leaked into audit JSON');
        assert(!sensitiveAudit.rows[0].contains_password_value, 'password hash value leaked into audit JSON');

        const tokenHash = crypto.createHash('sha256').update(`audit-token-${suffix}`).digest('hex');
        await client.query(
          `INSERT INTO password_reset_token (user_id, token_hash, purpose, expires_at)
           VALUES ($1, $2, 'reset_password', CURRENT_TIMESTAMP + interval '30 minutes')`,
          [target.user_id, tokenHash],
        );
        const tokenAudit = await latestAudit(
          client,
          'password_reset_token',
          (await client.query(
            'SELECT id::text FROM password_reset_token WHERE token_hash = $1',
            [tokenHash],
          )).rows[0].id,
        );
        assert(!tokenAudit.new_values?.token_hash, 'token hash key leaked into audit JSON');
        assert(!JSON.stringify(tokenAudit.new_values).includes(tokenHash), 'token hash value leaked into audit JSON');
      });
    });

    await test('8. UPDATE and DELETE of audit_log are rejected', async () => {
      await transaction(client, async () => {
        const key = customerKey(8);
        await setAppUser(client, 'audit-tamper-test');
        await insertCustomer(client, key);
        const audit = await latestAudit(client, 'customer', key);
        for (const [label, statement] of [
          ['UPDATE', 'UPDATE audit_log SET app_user = app_user WHERE id = $1'],
          ['DELETE', 'DELETE FROM audit_log WHERE id = $1'],
        ]) {
          await client.query('SAVEPOINT audit_immutable_check');
          let rejected = false;
          try {
            await client.query(statement, [audit.id]);
          } catch {
            rejected = true;
          }
          await client.query('ROLLBACK TO SAVEPOINT audit_immutable_check');
          await client.query('RELEASE SAVEPOINT audit_immutable_check');
          assert(rejected, `${label} on audit_log unexpectedly succeeded`);
        }
      });
    });

    await test('9. Rolling back a write leaves no audit row', async () => {
      const key = customerKey(9);
      await client.query('BEGIN');
      try {
        await setAppUser(client, 'rollback-test@hope.com');
        await insertCustomer(client, key);
        const withinTransaction = await latestAudit(client, 'customer', key);
        assert(withinTransaction.action === 'CREATED', 'expected test audit row inside transaction');
      } finally {
        await client.query('ROLLBACK');
      }
      const remaining = await client.query(
        `SELECT count(*)::integer AS count
         FROM audit_log
         WHERE table_name = 'customer' AND record_key = $1`,
        [key],
      );
      assert(remaining.rows[0].count === 0, 'audit row persisted after transaction rollback');
    });
  } finally {
    await client.end();
  }

  if (failures.length) {
    throw new Error(`${failures.length} audit test(s) failed: ${failures.join(', ')}`);
  }
}

function formatStamp(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute} ${values.dayPeriod}`;
}

main().catch((error) => {
  console.error(`Audit test command failed: ${error.message}`);
  process.exitCode = 1;
});
