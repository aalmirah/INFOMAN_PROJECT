# Application-user audit trail

## Previous behavior and recommendation

The source `audit_user()` first reads `app.username`, then falls back to
`session_user`. When the application does not set that custom setting, the
database can identify only its shared connection/login role—not the human
who authenticated in the app. Its old audit rows use `action_by` and legacy
`ADD`/`EDIT` names.

The new migration reads the transaction-local `app.current_user`, records the
database connection identity separately in `db_user`, and uses `system` when
the application identity is missing or empty. Missing identity never blocks
a write, which keeps migrations and background work reliable. **Recommendation:**
the backend must still require an authenticated identity for human-initiated
writes; reserve the `system` fallback for migrations and explicitly identified
background jobs. Only the trusted backend may connect with write credentials:
a PostgreSQL custom setting is attribution metadata, not proof of identity if
an untrusted client can execute arbitrary SQL.

## Schema and trigger behavior

`audit_log` records `id`, `table_name`, primary-key `record_key`, `action`,
`app_user`, `db_user`, `occurred_at`, and `old_values`/`new_values` JSONB.
Actions are `CREATED`, `EDITED`, `DELETED`, and `RESTORED`. An
`Active` to `Inactive` update is a soft delete; an `Inactive` to `Active`
update is a restore. No-op updates are not logged. The stamp uses the same
application identity and Manila time, for example:

```text
EDITED user1 2026-10-13 1:01 PM
```

The migration attaches triggers to every public base table that has both
`status` and `stamp`, derives audit keys from primary keys, and widens stamp
columns to fit a full app-user email. Audit values omit the `password_hash`
and `token_hash` fields for both inserts and updates. `audit_log` rejects
UPDATE, DELETE, and TRUNCATE, and direct INSERT/UPDATE/DELETE/TRUNCATE
privileges are revoked from `PUBLIC`; audit rows are inserted by the
security-definer row trigger. Older audit rows are preserved when upgrading
the supplied legacy `audit_id`/`action_by`/`action_at` table; the old action
labels are mapped to the new names, and the historical connection user is
marked `unknown` because the old schema did not retain it separately.

## Test command and expected results

On a **disposable development database**, apply migrations, seed roles and
rights, then run:

```text
npm run db:migrate
npm run db:seed
npm run db:test:audit
```

The cross-platform Node.js runner issues SQL through PostgreSQL clients and
uses two independent sessions for case 6. It prints one `PASS` per case and
exits non-zero if any case fails. Each write case is wrapped in a transaction
that rolls back; case 5 commits only the transaction-local setting, with no
data writes, then verifies it is absent in the next transaction. Case 6 rolls
back both sessions.

Expected output includes:

```text
PASS 1. INSERT records app user, CREATED action, and matching stamp
PASS 2. UPDATE records the second logged-in user as EDITED
PASS 3. Soft delete and reactivation record DELETED and RESTORED
PASS 4. Missing app user falls back to system without blocking a write
PASS 5. A committed transaction-local user does not leak to the next transaction
PASS 6. Two sessions independently record their own users
PASS 7. user_permission changes are audited without password or token hashes
PASS 8. UPDATE and DELETE of audit_log are rejected
PASS 9. Rolling back a write leaves no audit row
```

Case 8 uses the configured database connection role. The table trigger rejects
UPDATE/DELETE even for an owner-like local test connection; the migration also
revokes direct modification privileges from `PUBLIC` so application roles
inheriting public privileges cannot modify the log.

## Backend handoff

At the start of **every request transaction**, after `BEGIN` and before any
write, set the authenticated application identity transaction-locally:

```sql
SELECT set_config('app.current_user', $1, true);
```

Use the authenticated email or stable app user ID as `$1`. The final `true`
is essential: it is equivalent to `SET LOCAL` and resets on commit or rollback,
so pooled connections do not carry a user into another request.

Example using the project's Node.js `pg` driver:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(
    "SELECT set_config('app.current_user', $1, true)",
    [authenticatedUser.email],
  );
  await client.query('UPDATE customer SET custname = $1 WHERE custno = $2', [name, id]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

Do not use a plain session-level `SET`. Task 3's permission-write guard also
expects `app.actor_user_id` (the numeric app-user ID) in transactions that
grant or revoke `user_permission`; set that transaction-locally as well after
the same server-side authorization check.

Background jobs should either set `app.current_user` to a clear service
identity such as `system:nightly-import` transaction-locally, or omit it and
allow the explicit `system` fallback. Never spoof a human account for a job.
