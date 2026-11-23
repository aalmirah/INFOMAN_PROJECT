# Student database setup (Supabase/PostgreSQL)

Supabase is the team's hosted PostgreSQL database; it is not a different SQL
engine. This project uses the PostgreSQL protocol and a Node.js migration
runner. Follow these steps on Windows, macOS, or Linux. The npm commands are
the same on all three operating systems. No Docker or local database server is
required for the shared Supabase development project.

## Repository layout

```text
.
|-- .env.example
|-- .gitignore
|-- package.json
|-- db
|   |-- README.md
|   |-- migrations
|   |   |-- 001_hope_base_tables.sql
|   |   |-- 002_hope_sample_data.sql
|   |   |-- 003_user_management.sql
|   |   |-- 003_user_management.md
|   |   |-- 004_password_reset_token.sql
|   |   |-- 004_password_reset_token.md
|   |   |-- 005_customer_product_active_views.sql
|   |   |-- 006_customers_products_access.sql
|   |   `-- 006_customers_products_access.md
|   |-- README.md
|   |-- seeds
|   |   |-- 001_default_roles_modules_rights.sql
|   |   |-- team.example.csv
|   |   `-- team.csv                 (local only; ignored by Git)
|   |-- scripts
|   |   |-- migrate.js
|   |   |-- issue-setup-links.js
|   |   |-- seed.js
|   |   |-- seed-team.js
|   |   |-- seed-demo.js
|   |   `-- verify.js
`-- node_modules/                 (local only; ignored by Git)
```

The base schema, sample records, and user-management schema are in separate
migrations. See [migrations/README.md](migrations/README.md) for Task 2 source
limitations and assumptions, and
[migrations/003_user_management.md](migrations/003_user_management.md) for the
Task 3 design, ERD, authorization notes, and verification queries. The optional
token table in
[migrations/004_password_reset_token.md](migrations/004_password_reset_token.md)
covers first-password setup and password recovery. The optional `db/seeds`
directory remains for additional repeat-safe seed scripts.
Sprint 2 customer, product, and price-history SQL access is documented in
[migrations/006_customers_products_access.md](migrations/006_customers_products_access.md).

The repeat-safe default role/module/right catalogue is in
`db/seeds/001_default_roles_modules_rights.sql`. For team bootstrap, copy
`db/seeds/team.example.csv` to the ignored `db/seeds/team.csv`, replace its
fake rows locally with the team's names and email addresses, and never commit
that file. `.env` and `db/seeds/team.csv` are ignored by Git.

The relevant `.gitignore` rules are:

```gitignore
.env
.env.*
!.env.example
db/seeds/team.csv
```

## Team database approach

| Approach | Advantages | Trade-offs |
|---|---|---|
| (a) Each student installs PostgreSQL locally | Isolated data; safe to reset; works offline | Requires installing and updating the same PostgreSQL major version |
| (b) One shared hosted Supabase development project | Matches the team's existing service; no local server install; easy to compare integration results | Shared data/credentials, network limits, and risk from destructive commands |
| (c) Local for daily work, shared Supabase for integration | Safe local development plus a common integration target | Requires both setups and careful protection of the shared project |

**Team default: (b), the team's Supabase development project.** Use a
development project only, never production. Supabase runs PostgreSQL, so these
same numbered migrations create the same schema on Supabase and on a local
PostgreSQL installation. Do not edit the schema manually; add migrations in
filename order. The shared project is not disposable: coordinate before
running seeds, and never run `db:reset` against it. Students can optionally
install PostgreSQL locally for isolated testing.

## Setup

### 1. Get the tools and Supabase development project

Install **Node.js 20 LTS or newer** and get access to the team's Supabase
development project. A local PostgreSQL server and `psql` are optional for
this shared-database setup.

Check Node.js:

```text
node --version
npm --version
```

Expected: Node reports `v20` or newer and npm reports its version. If
PowerShell blocks the `npm` shim on Windows, run the same commands below as
`npm.cmd run ...`.

### 2. Get a development database login

The team lead should provide the Supabase development project's database
connection details from its **Connect** panel. Use a development-only login
with the permissions needed to run the migrations and seeds; do not use a
production credential or the application's runtime credential. If the team
creates a dedicated migration role, it needs to connect to the project
database and create objects in the `public` schema. Keep its password private.

If the team lead has not created a migration login, they can run this once in
the development project's Supabase SQL Editor, replacing the placeholder with
a strong password and sharing it only through the team's approved secret
channel:

```sql
CREATE ROLE hope_migrator LOGIN PASSWORD 'replace-with-a-strong-password';
GRANT CONNECT ON DATABASE postgres TO hope_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO hope_migrator;
```

Expected: `CREATE ROLE` and two `GRANT` results. This login can create and
change the project's schema but is not a database administrator; all teammates
must use the same migration login so later migrations can change objects it
created. Do not use it as the application's runtime login. If the role already
exists or migrations have already been run by a different role, ask the team
lead rather than changing ownership or dropping objects. The reset command is
intentionally separate and destructive; it is not for the shared Supabase
project.

### 3. Clone the repository

```text
git clone https://github.com/aalmirah/INFOMAN_PROJECT.git
cd INFOMAN_PROJECT
```

Expected: Git checks out the project and the working directory is the
repository root (the folder containing `package.json`).

### 4. Create your private `.env`

From the repository root, copy the committed template with this cross-platform
Node command:

```text
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
```

Expected: no output and a new `.env` file. Open `.env` in a text editor, set
the Supabase development connection values in `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, and `DB_PASSWORD`; keep `DB_ENV=development` and `DB_SSL=require`.
Use the database host and username exactly as shown in the Supabase **Connect**
panel (pooler connection settings may require a project-qualified username).
Only after the team lead confirms the shared project is the development
target, set `DB_ALLOWED_DEV_HOSTS` to its exact `DB_HOST` to enable the
development-only seed commands. Do not set reset credentials for the shared
project. `.env` is ignored by Git; never commit it or send its contents to
teammates.

### 5. Install project dependencies

Run from the repository root:

```text
npm ci
```

Expected: npm installs the locked `pg` and `dotenv` dependencies and finishes
without errors.

### 6. Apply migrations

```text
npm run db:migrate
```

Expected on a new project database:

```text
Applied 001_hope_base_tables.sql
Applied 002_hope_sample_data.sql
Applied 003_user_management.sql
Applied 004_password_reset_token.sql
Applied 005_customer_product_active_views.sql
Applied 006_customers_products_access.sql
Migrations complete. Applied 6 migration(s).
```

### 7. Load seed data

```text
npm run db:seed
```

Expected: `Ran 001_default_roles_modules_rights.sql` and `Seeding complete.
Ran 1 seed file(s).` The command can be run repeatedly. It sets up the
Superadmin, Admin, and User roles, five modules, and all 36 rights.

For one Superadmin account per teammate, first copy the example CSV:

```text
npm run db:seed:team
```

The command reads `db/seeds/team.csv`, inserts users with no password and
`must_set_password=true`, and logs only a processed count. If the file is
missing, copy `db/seeds/team.example.csv` to `db/seeds/team.csv` and edit the
copy locally. Like the other bootstrap scripts, it requires a development
database on localhost or an explicitly allowed development host. Do not
commit the real roster.

The optional Lisa Park (Admin) and Alex Rivera (User) demo seed is restricted
to `DB_ENV=development` and localhost or a host explicitly listed in
`DB_ALLOWED_DEV_HOSTS`. For a hosted development database only, add its exact
hostname to `DB_ALLOWED_DEV_HOSTS` as a comma-separated list; leave it blank
for localhost:

```text
npm run db:seed:demo
```

It creates no passwords and grants three sample rights to Lisa and two to
Alex. Omit this command for non-demo development databases.

## First-password setup links

Set `APP_BASE_URL` to the app's local URL and, if needed, configure
`SET_PASSWORD_TOKEN_TTL` (default `24 hours`). To issue/reissue setup links for
all active, unblocked accounts with no password:

```text
npm run db:issue-setup-links
```

This command is restricted to development DB targets. It invalidates any
previous active setup link for each account, stores only a SHA-256 token hash,
then prints each new one-time link to the console. Deliver the links securely;
do not save, redirect, screenshot, or commit this output. The app's
`/set-password?token=...` page hashes the submitted token, validates it with
purpose `set_password`, and, in one transaction, conditionally consumes that
token while storing the password hash and setting `must_set_password=false`.
Reject the submission if the conditional token update returns no row. Use a
password-hashing algorithm such as Argon2id in the app; never put the password
or raw token in logs.

## Pre-commit SQL secret check

After staging changes, run:

```text
npm run db:check-sql-secrets
```

It scans staged SQL and fails if it finds a bcrypt/Argon2 hash or a
case-insensitive `password=` assignment. Use it as a pre-commit check; do not
stage real credentials or roster data.

## Database verification checklist

After migrations and `npm run db:seed`, run `npm run db:verify`. It must report
3 active roles, 5 active modules, 36 active rights, and these exact counts:

| Module | Active rights |
|---|---:|
| Customer | 3 |
| Product | 6 |
| Human Resources | 13 |
| Sales | 7 |
| Reports | 7 |

The same counts can be checked directly:

```sql
SELECT module_name, active_right_count
FROM v_module_right_counts
ORDER BY module_code;

SELECT count(*) AS total_active_rights
FROM rights
WHERE status = 'Active';
-- 36
```

After the team seed, the inserted roster accounts have a NULL password hash,
`must_set_password=true`, and the Superadmin role; rerunning the seed does not
reset an already-set password. The optional demo seed creates Lisa Park as
Admin and Alex Rivera as User, with five active sample permission rows and no
new passwords. After setup-link issuance, each eligible account should have
one active unused `set_password` token; a second run leaves one active token
per eligible account and inactivates each prior token. The check script should
pass when staged SQL contains no password assignments or password hashes.

### 8. Verify the database

```text
npm run db:status
```

Expected after all current migrations have been applied:

```text
applied  001_hope_base_tables.sql
applied  002_hope_sample_data.sql
applied  003_user_management.sql
applied  004_password_reset_token.sql
applied  005_customer_product_active_views.sql
applied  006_customers_products_access.sql
Status complete. 0 pending.
```

Run the row-count, sample-data, and Sprint 2 role-filtering checks:

```text
npm run db:verify
```

Expected counts: employee 4, job 4, department 4, jobhistory 1, customer 5,
product 5, pricehist 9, sales 4, salesdetail 13, payment 4. The checks should
all report `PASS`: T-001 234.50, T-002 140.00, T-003 510.00, active sales
884.50, P-003 current price 28.00, P-004 has no current price, C-001..C-005
and P-001..P-005 status assertions, Admin/Superadmin/User view filtering,
absence of `status`/`stamp` from User views, and rejected DELETE/TRUNCATE
attempts. `db:verify` exits non-zero if any assertion fails.

To confirm the connected database version, run `SHOW server_version;` in the
Supabase SQL Editor. Expected: PostgreSQL `16` or newer.

## Available commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Apply pending numbered SQL migrations in filename order |
| `npm run db:status` | Show applied and pending migrations |
| `npm run db:seed` | Run repeat-safe SQL seed files in filename order |
| `npm run db:verify` | Print table row counts and verify sample totals, prices, view access, soft-delete guards, and foreign keys |
| `npm run db:reset` | Drop and recreate the configured development database after confirmation |
| `npm run db:seed:team` | Insert/update Superadmin accounts from ignored `db/seeds/team.csv` |
| `npm run db:seed:demo` | Add demo users and permissions on an explicitly allowed development host only |
| `npm run db:issue-setup-links` | Issue one-time console-only first-password links for eligible accounts |
| `npm run db:check-sql-secrets` | Check staged SQL for password assignments and password hashes |

Each migration runs in its own transaction. The runner records the migration
filename and SHA-256 checksum in `schema_migrations`; it refuses to continue
if an applied file changes or disappears. The reset command requires
`DB_ENV=development`, asks you to type the exact database name, refuses
protected PostgreSQL databases, and refuses every host except localhost or
one explicitly listed in `DB_RESET_ALLOWED_HOSTS`. Use reset only for a
disposable local database; do not add the shared Supabase host to this
allowlist.

## Troubleshooting

| Problem | What to check / do |
|---|---|
| Port in use | For optional local PostgreSQL, check which process uses the port and set `DB_PORT` to the server's actual port. For Supabase, use the port shown in the project's Connect panel. |
| Authentication failed | Check `DB_USER`, `DB_PASSWORD`, and `DB_HOST` in `.env`; confirm the role can log in and that the password matches. Do not paste credentials into chat or Git. |
| Permission denied | Confirm the migration login can connect and create objects in the `public` schema. Use the same migration login for all teammates so it owns the objects it creates; ask the team lead to resolve existing object ownership. Never use reset credentials on the shared Supabase project. |
| Migration checksum mismatch | Do not edit an applied migration. Restore the exact file from version control, then put the schema change in a new migration. |
| Wrong engine version | Run `SHOW server_version;` in the Supabase SQL Editor. Supabase is PostgreSQL; use PostgreSQL 16 or newer for optional local testing and keep the same major version across local environments. |

## Team rules

1. **Never edit an applied migration.** Add a new migration file instead.
2. Keep **one migration per pull request** so schema changes are reviewable.
3. **Pull the latest changes before choosing a migration number.**
4. If two people chose the same number, coordinate before merging. Keep the
   number on the migration already merged/applied; rename the other
   not-yet-applied migration to the next unused number, update any references,
   and re-run `npm run db:status`. Never rename or edit an applied migration.