# Password reset and first-password tokens

The migration creates `password_reset_token` for both first-time password
setup and forgotten-password recovery. It depends on Task 3's `app_user` table
and is applied by the normal `npm run db:migrate` command.

## Design and expiry configuration

| Column | Purpose |
|---|---|
| `id` | Identity primary key |
| `user_id` | Required FK to `app_user`; hard deletion of referenced users is restricted |
| `token_hash` | Unique lowercase, 64-character SHA-256 hex digest; never store the raw token |
| `purpose` | `set_password` or `reset_password` |
| `created_at`, `expires_at` | Creation and required expiry timestamps; expiry must be later than creation |
| `used_at` | `NULL` until consumed; records the exact use time |
| `requested_ip` | Optional PostgreSQL `inet` address |
| `status`, `stamp` | Active/Inactive lifecycle and latest-change stamp |

`used_at` replaces a boolean: it both answers whether the token was used and
preserves when it was consumed, which helps operational review without a
separate audit table. It cannot be cleared after use.

Keep expiry durations in application configuration, not the table:

```text
SET_PASSWORD_TOKEN_TTL=24 hours
RESET_PASSWORD_TOKEN_TTL=30 minutes
```

The partial unique index allows at most one `Active`, unused row per user and
purpose. PostgreSQL does not permit a time-dependent `expires_at > now()`
predicate in an index, so issuance first inactivates any prior active unused
row (including an expired one). Locking the user row serializes concurrent
issuance for the same account.

## Issuing a token

Generate the raw token in the trusted server, compute its SHA-256 hex digest,
then run these statements on one connection and in one transaction. `$1` is
the user ID, `$2` the purpose, `$3` the lowercase hash, `$4` the configured
interval (`24 hours` or `30 minutes`), and `$5` the optional requester IP.
If the `SELECT` returns no row, abort: the account is missing, inactive, or
blocked. If any statement fails, roll back.

```sql
BEGIN;

SELECT user_id
FROM app_user
WHERE user_id = $1
  AND status = 'Active'
  AND is_blocked = false
FOR UPDATE;

UPDATE password_reset_token
SET status = 'Inactive'
WHERE user_id = $1
  AND purpose = $2
  AND used_at IS NULL
  AND status = 'Active';

INSERT INTO password_reset_token
  (user_id, token_hash, purpose, expires_at, requested_ip)
VALUES
  ($1, $3, $2, CURRENT_TIMESTAMP + $4::interval, $5::inet)
RETURNING id;

COMMIT;
```

Send or display the raw token only after commit succeeds. The update frees the
partial unique index slot, and the index protects against callers that fail
to follow the issuance sequence.

## Validation and consumption

The application hashes the submitted raw token to lowercase SHA-256 hex and
uses the digest with the purpose in this query. No row means invalid, expired,
used, inactive, or blocked. Require an active account as well as an unblocked
one.

```sql
SELECT t.id, t.user_id, t.purpose, t.token_hash
FROM password_reset_token t
JOIN app_user u ON u.user_id = t.user_id
WHERE t.token_hash = $1
  AND t.purpose = $2
  AND t.used_at IS NULL
  AND t.expires_at > CURRENT_TIMESTAMP
  AND t.status = 'Active'
  AND u.is_blocked = false
  AND u.status = 'Active';
```

Use the indexed hash lookup and also compare fixed-length digest bytes with
the returned `token_hash` with the language's constant-time comparison
function at the application layer (for example, Node.js
`crypto.timingSafeEqual`). Only a trusted backend should access this table.
Never compare or log the raw token in logs, analytics, or error messages.

Consume a valid token with a conditional update in the same transaction as
the password change. Exactly one concurrent request can consume it:

```sql
UPDATE password_reset_token t
SET used_at = CURRENT_TIMESTAMP,
    status = 'Inactive'
FROM app_user u
WHERE t.token_hash = $1
  AND t.purpose = $2
  AND t.user_id = u.user_id
  AND t.used_at IS NULL
  AND t.expires_at > CURRENT_TIMESTAMP
  AND t.status = 'Active'
  AND u.is_blocked = false
  AND u.status = 'Active'
RETURNING t.user_id;
```

Update the password only if this returns one row; commit the token consumption
and password update together, or roll both back.

## Raw-token security

Generate at least 32 bytes using a cryptographically secure random generator
and encode them with URL-safe Base64 (base64url). Show the raw token only once:
email it to the account owner, or print it to the console in development.
Persist only the SHA-256 hash. Never log the raw token, include it in
analytics, or commit it to source control.

## Cleanup

Run this statement later from a scheduled team-managed job. It physically
removes rows that can no longer be used; the `expires_at` index supports the
expired-row portion of the cleanup.

```sql
DELETE FROM password_reset_token
WHERE used_at IS NOT NULL
   OR expires_at <= CURRENT_TIMESTAMP;
```

## Verification

The following `psql` script runs against a migrated development database.
All test accounts/tokens are inside one transaction and are rolled back.
Expected outcomes: valid token `true`; expired, used, and blocked-user tokens
`false`.

```sql
BEGIN;

INSERT INTO app_user (first_name, last_name, email)
VALUES
  ('Token', 'Valid', 'task4-valid@example.test'),
  ('Token', 'Expired', 'task4-expired@example.test'),
  ('Token', 'Used', 'task4-used@example.test'),
  ('Token', 'Blocked', 'task4-blocked@example.test');

INSERT INTO password_reset_token
  (user_id, token_hash, purpose, created_at, expires_at, used_at)
SELECT u.user_id, v.token_hash, 'reset_password', v.created_at, v.expires_at, v.used_at
FROM (VALUES
  ('task4-valid@example.test',   repeat('a', 64), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 minutes', NULL::timestamptz),
  ('task4-expired@example.test', repeat('b', 64), CURRENT_TIMESTAMP - interval '2 hours', CURRENT_TIMESTAMP - interval '1 hour', NULL::timestamptz),
  ('task4-used@example.test',    repeat('c', 64), CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '30 minutes', CURRENT_TIMESTAMP),
  ('task4-blocked@example.test', repeat('d', 64), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 minutes', NULL::timestamptz)
) AS v(email, token_hash, created_at, expires_at, used_at)
JOIN app_user u ON u.email = v.email;

UPDATE app_user SET is_blocked = true WHERE email = 'task4-blocked@example.test';

SELECT v.case_name,
       EXISTS (
         SELECT 1
         FROM password_reset_token t
         JOIN app_user u ON u.user_id = t.user_id
         WHERE t.token_hash = v.token_hash
           AND t.purpose = 'reset_password'
           AND t.used_at IS NULL
           AND t.expires_at > CURRENT_TIMESTAMP
           AND t.status = 'Active'
           AND u.is_blocked = false
           AND u.status = 'Active'
       ) AS valid
FROM (VALUES
  ('valid',   repeat('a', 64)),
  ('expired', repeat('b', 64)),
  ('used',    repeat('c', 64)),
  ('blocked', repeat('d', 64))
) AS v(case_name, token_hash)
ORDER BY v.case_name;
-- blocked false
-- expired false
-- used false
-- valid true

ROLLBACK;
```

If running the verification block in an interactive `psql` session, confirm
the final `ROLLBACK` is reported; no test rows should remain.
