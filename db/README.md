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
|   |-- scripts
|   |   |-- migrate.js
|   |   `-- seed.js
|   `-- seeds
`-- node_modules/                 (local only; ignored by Git)
```

`db/migrations` and `db/seeds` intentionally contain no project schema or seed
data yet. Do not copy the older SQL files from `database/` into this workflow
without a reviewed migration plan.

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
No migration files found.
```

When migrations are added, output instead includes `Applied
NNN_description.sql` for each pending file, followed by
`Migrations complete. Applied N migration(s).`

### 7. Load seed data

```text
npm run db:seed
```

Expected before seed files have been added:

```text
No seed files found.
```

Each future seed file must be repeat-safe (for example, use
`INSERT ... ON CONFLICT DO NOTHING`). Seed files run in filename order, each
in its own transaction.

### 8. Verify migration status and server version

```text
npm run db:status
```

Expected before migrations have been added:

```text
No migration files found.
```

To confirm the connected database version, connect using the same settings
from `.env` and run `SHOW server_version;` in `psql`. Expected: PostgreSQL
`16` or newer. Once migrations exist, status lists each as `applied` or
`pending` and ends with the number pending.

## Available commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Apply pending numbered SQL migrations in filename order |
| `npm run db:status` | Show applied and pending migrations |
| `npm run db:seed` | Run repeat-safe SQL seed files in filename order |
| `npm run db:reset` | Drop and recreate the configured development database after confirmation |

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