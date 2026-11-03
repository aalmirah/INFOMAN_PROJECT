'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing ${name} in the repository .env file.`);
  }
  return value;
}

function connectionConfig(database = requiredEnv('DB_NAME'), reset = false) {
  const port = Number(process.env.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer from 1 to 65535.');
  }

  const sslMode = (process.env.DB_SSL || 'disable').toLowerCase();
  if (!['disable', 'require'].includes(sslMode)) {
    throw new Error('DB_SSL must be either "disable" or "require".');
  }

  const config = {
    host: requiredEnv('DB_HOST'),
    port,
    database,
    user: reset ? (process.env.DB_RESET_USER || requiredEnv('DB_USER')) : requiredEnv('DB_USER'),
    password: reset && process.env.DB_RESET_PASSWORD !== undefined
      ? process.env.DB_RESET_PASSWORD
      : (process.env.DB_PASSWORD || ''),
    ssl: sslMode === 'require' ? { rejectUnauthorized: true } : false,
  };
  if (reset && process.env.DB_RESET_PASSWORD === undefined && process.env.DB_RESET_USER) {
    throw new Error('Set DB_RESET_PASSWORD when DB_RESET_USER is set.');
  }
  return config;
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function sqlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  const numbers = new Set();
  for (const filename of files) {
    if (!/^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/.test(filename)) {
      throw new Error(`Invalid SQL filename "${filename}". Use 001_short_description.sql.`);
    }
    const number = filename.split('_', 1)[0];
    if (numbers.has(number)) {
      throw new Error(`Duplicate migration number "${number}". Choose a unique number for each migration.`);
    }
    numbers.add(number);
  }
  return files;
}

async function connect(config = connectionConfig()) {
  const client = new Client(config);
  await client.connect();
  return client;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function migrationState(client) {
  const files = await sqlFiles(MIGRATIONS_DIR);
  const appliedResult = await client.query(
    'SELECT filename, checksum FROM schema_migrations ORDER BY filename',
  );
  const applied = new Map(appliedResult.rows.map((row) => [row.filename, row.checksum.trim()]));
  const available = new Set(files);

  for (const filename of applied.keys()) {
    if (!available.has(filename)) {
      throw new Error(`Applied migration "${filename}" is missing from db/migrations.`);
    }
  }

  const state = [];
  for (const filename of files) {
    const contents = await fs.readFile(path.join(MIGRATIONS_DIR, filename));
    const checksum = sha256(contents);
    const existing = applied.get(filename);
    if (existing && existing !== checksum) {
      throw new Error(
        `Checksum mismatch for applied migration "${filename}". Restore it from version control; never edit an applied migration.`,
      );
    }
    state.push({ filename, checksum, contents, applied: Boolean(existing) });
  }
  return state;
}

async function migrate() {
  const client = await connect();
  try {
    await ensureMigrationTable(client);
    const state = await migrationState(client);
    const pending = state.filter((migration) => !migration.applied);
    if (pending.length === 0) {
      console.log('Database is up to date. No pending migrations.');
      return;
    }

    for (const migration of pending) {
      await client.query('BEGIN');
      try {
        await client.query(migration.contents.toString('utf8'));
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [migration.filename, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${migration.filename}" failed: ${error.message}`, { cause: error });
      }
      console.log(`Applied ${migration.filename}`);
    }
    console.log(`Migrations complete. Applied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

async function status() {
  const client = await connect();
  try {
    await ensureMigrationTable(client);
    const state = await migrationState(client);
    if (state.length === 0) {
      console.log('No migration files found.');
      return;
    }
    for (const migration of state) {
      console.log(`${migration.applied ? 'applied' : 'pending'}  ${migration.filename}`);
    }
    console.log(`Status complete. ${state.filter((item) => !item.applied).length} pending.`);
  } finally {
    await client.end();
  }
}

function checkResetTarget() {
  const host = requiredEnv('DB_HOST').toLowerCase();
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const allowedHosts = (process.env.DB_RESET_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (process.env.DB_ENV !== 'development') {
    throw new Error('Reset refused: set DB_ENV=development only for a development database.');
  }
  if (!localHosts.has(host) && !allowedHosts.includes(host)) {
    throw new Error(
      `Reset refused for host "${host}". Use localhost or explicitly allow a development host in DB_RESET_ALLOWED_HOSTS.`,
    );
  }
  const database = requiredEnv('DB_NAME');
  if (['postgres', 'template0', 'template1'].includes(database)) {
    throw new Error(`Reset refused for protected database "${database}".`);
  }
  return database;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function reset() {
  const database = checkResetTarget();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let answer;
  try {
    answer = await rl.question(
      `This permanently drops and recreates development database "${database}". Type the database name to continue: `,
    );
  } finally {
    rl.close();
  }
  if (answer !== database) {
    throw new Error('Reset cancelled: confirmation did not match the database name.');
  }

  const config = connectionConfig('postgres', true);
  const client = await connect(config);
  try {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`);
    await client.query(
      `CREATE DATABASE ${quoteIdentifier(database)} OWNER ${quoteIdentifier(requiredEnv('DB_USER'))}`,
    );
    console.log(`Development database "${database}" was recreated.`);
  } finally {
    await client.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (command === 'migrate') return migrate();
  if (command === 'status') return status();
  if (command === 'reset') return reset();
  throw new Error('Usage: npm run db:migrate | db:status | db:reset');
}

main().catch((error) => {
  console.error(`Database command failed: ${error.message}`);
  process.exitCode = 1;
});
