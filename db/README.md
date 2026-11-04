# Student database setup (PostgreSQL)

This project uses PostgreSQL and a Node.js migration runner. Follow these steps
on Windows, macOS, or Linux. The npm commands are the same on all three
operating systems. No Docker is required.

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
|   |   `-- README.md
|   |-- seeds
|   |   |-- 001_default_roles_modules_rights.sql
|   |   |-- team.example.csv
|   |   `-- team.csv                 (local only; ignored by Git)
|   |-- scripts
|   |   |-- migrate.js
|   |   |-- check-sql-secrets.js
|   |   |-- issue-setup-links.js
|   |   |-- seed.js
|   |   |-- seed-team.js
|   |   |-- seed-demo.js
|   |   |-- lib
|   |   |   `-- database.js
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
| (a) Each student installs PostgreSQL locally | No shared credentials or network dependency; safe to reset; works offline | Each student installs and updates the same PostgreSQL major version |
| (b) One shared hosted free-tier database | Easy to compare integration results; no local server install | Shared credentials/data, network limits, free-tier changes, and destructive-command risk |
| (c) Local for daily work, shared for integration | Safe local development plus a common integration target | Requires both setups and careful protection of the shared database |

**Default: (a), local PostgreSQL for each student.** It is the simplest and
safest beginner setup. Use PostgreSQL 16 or newer, and use the exact same
migration files and filename order everywhere. The migrations, rather than
manual database edits, define the schema, so running them against another
PostgreSQL development database produces the same schema. The team can add a
shared integration database later without changing the migration files; never
use `db:reset` against a shared database.

## Setup

### 1. Install the tools

Install **Node.js 20 LTS or newer** and **PostgreSQL 16 or newer**. For
PostgreSQL, install the server and command-line client (`psql`) using the
official installer for your operating system or your operating system's
package manager. Keep the PostgreSQL server running.

Check the tools:

```text
node --version
npm --version
psql --version
```

Expected: Node reports `v20` or newer, npm reports its version, and `psql`
reports PostgreSQL `16` or newer. If PowerShell blocks the `npm` shim on
Windows, run the same npm commands below as `npm.cmd run ...`.

### 2. Create the development database and app user

Open `psql` as the PostgreSQL administrator (`postgres` on a typical local
installation):

```text
psql -U postgres -d postgres
```

At the `postgres=#` prompt, create a login used only by this project and make
it the owner of the development database. Replace the sample password with a
strong local password. The app role needs ownership of this database so it
can create project tables during migrations; do not use this account as a
server administrator.

```sql
CREATE ROLE infoman_app LOGIN PASSWORD 'replace-with-a-strong-local-password';
CREATE DATABASE infoman_project OWNER infoman_app;
\q
```

Expected: `CREATE ROLE`, `CREATE DATABASE`, then the `psql` session closes.
If the role or database already exists, do not delete it blindly; ask the team
or use the existing local setup.

The reset command is intentionally separate and destructive. To use it, set
`DB_RESET_USER` and `DB_RESET_PASSWORD` to a local PostgreSQL administrator
account that can drop/create databases and assign ownership to `infoman_app`.
Do not grant extra privileges to `infoman_app` just to enable reset.

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
`DB_PASSWORD` to the password for `infoman_app`, and keep `DB_ENV=development`,
`DB_HOST=localhost`, `DB_PORT=5432`, and `DB_SSL=disable` for a standard local
installation. Only set `DB_RESET_USER` and `DB_RESET_PASSWORD` if you intend
to use the local reset command. `.env` is ignored by Git; never commit it or
send its contents to teammates.

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
Migrations complete. Applied 2 migration(s).
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

## Task 5 verification checklist

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

Expected after the first migration:

```text
applied  001_hope_base_tables.sql
applied  002_hope_sample_data.sql
Status complete. 0 pending.
```

Run the row-count and data checks:

```text
npm run db:verify
```

Expected counts: employee 4, job 4, department 4, jobhistory 1, customer 5,
product 5, pricehist 9, sales 4, salesdetail 13, payment 4. The checks should
all report `PASS`: T-001 234.50, T-002 140.00, T-003 510.00, active sales
884.50, P-003 current price 28.00, P-004 has no current price, and zero orphan
foreign keys. `db:verify` exits non-zero if any assertion fails.

To confirm the connected database version, connect using the same settings
from `.env` and run `SHOW server_version;` in `psql`. Expected: PostgreSQL
`16` or newer.

## Available commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Apply pending numbered SQL migrations in filename order |
| `npm run db:status` | Show applied and pending migrations |
| `npm run db:seed` | Run repeat-safe SQL seed files in filename order |
| `npm run db:verify` | Print table row counts and verify sample totals, prices, and foreign keys |
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
one explicitly listed in `DB_RESET_ALLOWED_HOSTS`. Leave that allowlist empty
for this local setup.

## Troubleshooting

| Problem | What to check / do |
|---|---|
| Port in use | Check whether PostgreSQL is already running and which port it uses. Set `DB_PORT` in `.env` to the server's actual port; do not start a second server on the same port. |
| Authentication failed | Check `DB_USER`, `DB_PASSWORD`, and `DB_HOST` in `.env`; confirm the role can log in and that the password matches. Do not paste credentials into chat or Git. |
| Permission denied | Confirm the database exists and is owned by `infoman_app`. The app role needs permission to create and alter project objects in this database. Reset also needs its separate admin credentials. |
| Migration checksum mismatch | Do not edit an applied migration. Restore the exact file from version control, then put the schema change in a new migration. |
| Wrong engine version | Run `psql --version` and `SHOW server_version;`. Install/use PostgreSQL 16 or newer and have every teammate use the same major version. |

## Team rules

1. **Never edit an applied migration.** Add a new migration file instead.
2. Keep **one migration per pull request** so schema changes are reviewable.
3. **Pull the latest changes before choosing a migration number.**
4. If two people chose the same number, coordinate before merging. Keep the
   number on the migration already merged/applied; rename the other
   not-yet-applied migration to the next unused number, update any references,
   and re-run `npm run db:status`. Never rename or edit an applied migration.