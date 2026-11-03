# Student database setup (PostgreSQL)

This project uses PostgreSQL. The existing SQL in `database/` is project material;
new, versioned schema changes belong in `db/migrations/`. No application-table
migrations are included yet.

## Repository layout

```text
INFOMAN_PROJECT/
├── .env.example           # Safe connection-setting template
├── .gitignore             # Excludes .env and dependencies
├── package.json           # Cross-platform database commands
├── database/              # Existing SQL files; not run by the migration runner
└── db/
    ├── README.md           # This student setup guide
    ├── migrations/         # Ordered schema changes (empty for now)
    ├── seeds/              # Repeat-safe development seed SQL
    └── scripts/
        ├── migrate.js      # migrate, status, and guarded reset
        └── seed.js         # Runs seed files
```

`.env` is created locally from `.env.example` and is not committed.

## Team database approach

| Approach | Benefits | Trade-offs |
|---|---|---|
| Each student installs PostgreSQL locally | No shared data, works offline, easy to reset | Everyone must install and maintain a compatible server |
| One shared hosted development database | Simple onboarding and shared integration data | Requires network access; mistakes affect the whole team; free tiers can change |
| Local development plus shared integration | Fast, private daily work and one place to verify integration | Requires a local install and care to keep the hosted database development-only |

**Recommendation: (c), local for daily work and a shared hosted development
database for integration.** Use local PostgreSQL as the default in the steps
below. A free-tier hosted PostgreSQL service such as Supabase can be used for
team integration, subject to the provider's current limits. Both environments
must use the same committed migration files; do not make manual schema changes.
Keep hosted credentials private, and never run `db:reset` against a shared
database unless its host was explicitly allowlisted and the team has agreed.

## Setup on Windows, macOS, or Linux

Use the same commands in PowerShell, Terminal, or a shell. Install a supported
PostgreSQL server (version 15 or newer recommended) and Node.js 18 or newer.
The project uses PostgreSQL's native SQL and Node's cross-platform npm scripts;
no Docker or shell-specific helper is needed.

### 1. Install PostgreSQL

- **Windows:** install PostgreSQL using the official interactive installer at
  <https://www.postgresql.org/download/windows/>.
- **macOS:** install PostgreSQL using the official macOS options at
  <https://www.postgresql.org/download/macos/>.
- **Linux:** install PostgreSQL using your distribution's package manager, as
  linked from <https://www.postgresql.org/download/linux/>.

Keep the server running on port `5432` (the default).

**Expected:** the PostgreSQL server is running and accepts local connections on
port `5432`. The installer may also provide `psql`; otherwise use a PostgreSQL
client such as pgAdmin.

### 2. Create a development database and app user

Connect as the PostgreSQL administrator in `psql` or pgAdmin. Replace both
password placeholders with strong local-only passwords; do not save them in
SQL files or commit them. Execute:

```sql
CREATE ROLE infoman_app LOGIN PASSWORD 'replace-with-a-strong-app-password';
CREATE DATABASE infoman_project;
GRANT CONNECT ON DATABASE infoman_project TO infoman_app;
```

Connect to `infoman_project` as the administrator and run:

```sql
GRANT USAGE, CREATE ON SCHEMA public TO infoman_app;
```

The application role can connect and create project objects in this database,
but cannot drop the database or create other databases. The optional reset
command requires separate administrator credentials with `CREATEDB` and
permission to assign the app role as database owner; do not give those
credentials to the application.

**Expected:** the database `infoman_project` and login role `infoman_app` exist,
and the role has `USAGE` and `CREATE` on its `public` schema.

### 3. Clone the repository

If you have not cloned it yet, use your Git client or run:

```text
git clone <repository-url>
cd INFOMAN_PROJECT
```

If you already have the project, open a terminal in its repository folder.

**Expected:** the current folder contains `package.json`, `database/`, and
`db/`.

### 4. Configure your private connection

Copy `.env.example` to `.env` using your editor or file manager. This avoids
shell-specific copy commands on Windows, macOS, and Linux. Edit `.env` with the
database name, app role, and password from step 2. Keep `DB_ENV=development`,
`DB_HOST=localhost`, `DB_SSL=disable`, and leave `DB_RESET_ALLOWED_HOSTS` empty
for local work. Leave reset credentials empty unless you plan to use the reset
command.

**Expected:** `.env` contains your local settings and is ignored by Git; the
committed `.env.example` contains placeholders only.

### 5. Install project dependencies

From the repository folder, run:

```text
npm install
```

**Expected:** npm completes successfully and installs the PostgreSQL driver and
the environment-file loader.

### 6. Apply migrations

```text
npm run db:migrate
```

**Expected on a new project:** `Database is up to date. No pending migrations.`
The runner creates `schema_migrations`; no application tables are created yet.
When migration files are added later, each pending file is applied in filename
order in its own transaction and its SHA-256 checksum is stored.

### 7. Run seed files

```text
npm run db:seed
```

**Expected now:** `No seed files found.` When seed files are added, they run in
filename order in separate transactions. Every seed must be repeat-safe,
normally using `INSERT ... ON CONFLICT DO NOTHING` or an upsert, so rerunning
this command does not duplicate or damage data.

### 8. Verify the migration status

```text
npm run db:status
```

**Expected on a new project:** `No migration files found.` After the first
migration is added and applied, status lists it as `applied`; unapplied files
show as `pending`.

## Commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Apply pending migrations and reject changed/missing applied files |
| `npm run db:status` | Show each migration as applied or pending |
| `npm run db:seed` | Run repeat-safe SQL seed files |
| `npm run db:reset` | Drop and recreate a development database after safety checks and typed confirmation |

For hosted PostgreSQL that requires TLS, set `DB_SSL=require`. Reset refuses
hosts other than `localhost`, `127.0.0.1`, or `::1`, unless the exact host is
explicitly added to `DB_RESET_ALLOWED_HOSTS`. Reset also requires
`DB_ENV=development` and typed confirmation of `DB_NAME`. To reset locally,
set `DB_RESET_USER` and `DB_RESET_PASSWORD` to a development administrator
account; those credentials must never be committed.

## Troubleshooting

| Problem | What to check |
|---|---|
| PowerShell blocks `npm.ps1` | Use `npm.cmd` in place of `npm` in the same commands (for example, `npm.cmd run db:migrate`), or open Command Prompt. No execution-policy change is required. |
| Port in use | Another PostgreSQL service may already be using `5432`. Stop the duplicate service or set `DB_PORT` to the actual PostgreSQL port in `.env`. |
| Authentication failed | Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; confirm the role can log in and that the password is current. |
| Permission denied | Confirm `infoman_app` has `CONNECT` on the database and `USAGE, CREATE` on schema `public`. Reset needs a separate role with `CREATEDB` and suitable ownership privileges. |
| Migration checksum mismatch | Do not edit an applied migration. Restore its exact committed contents; make a new migration for any schema change. |
| Wrong engine version | Check the server version with `SELECT version();` in `psql` or pgAdmin. Install PostgreSQL 15 or newer and point `.env` at that server. |

## Team rules

1. Never edit or rename an applied migration. Add a new migration instead.
2. Keep one migration per pull request so schema changes are easy to review.
3. Pull the latest changes before choosing a migration number.
4. Name migrations with a unique, zero-padded number and description, for
   example `001_create_example.sql`. Files run in lexical filename order.
   Each file is wrapped in a transaction; do not put `BEGIN`/`COMMIT` in the
   file or use statements that PostgreSQL disallows inside a transaction.
5. If two people choose the same number, coordinate before merging. The author
   whose migration is still unapplied should rename it to the next unused
   number, update its pull request, and regenerate any references. Never rename
   a migration after it has been applied by anyone; create a follow-up migration
   instead.
6. Never commit `.env`, passwords, connection strings, or hosted credentials.
   Commit only placeholders in `.env.example`.
7. Keep migrations compatible across local and shared development databases;
   never rely on manual schema edits or an environment-specific migration.
