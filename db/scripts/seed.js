'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const SEEDS_DIR = path.join(ROOT, 'db', 'seeds');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

function databaseConfig() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
  for (const name of required) {
    if (!process.env[name]) {
      throw new Error(`Missing ${name} in the repository .env file.`);
    }
  }
  const port = Number(process.env.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer from 1 to 65535.');
  }
  const sslMode = (process.env.DB_SSL || 'disable').toLowerCase();
  if (!['disable', 'require'].includes(sslMode)) {
    throw new Error('DB_SSL must be either "disable" or "require".');
  }
  return {
    host: process.env.DB_HOST,
    port,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    ssl: sslMode === 'require' ? { rejectUnauthorized: true } : false,
  };
}

async function connect(config) {
  const client = new Client({ ...config, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}

async function main() {
  const entries = await fs.readdir(SEEDS_DIR, { withFileTypes: true });
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
      throw new Error(`Duplicate seed number "${number}". Choose a unique number for each seed.`);
    }
    numbers.add(number);
  }
  if (files.length === 0) {
    console.log('No seed files found.');
    return;
  }

  const client = await connect(databaseConfig());
  try {
    for (const filename of files) {
      const contents = await fs.readFile(path.join(SEEDS_DIR, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(contents);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Seed "${filename}" failed: ${error.message}`, { cause: error });
      }
      console.log(`Ran ${filename}`);
    }
    console.log(`Seeding complete. Ran ${files.length} seed file(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Seed command failed: ${error.message}`);
  process.exitCode = 1;
});
