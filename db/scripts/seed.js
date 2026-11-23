'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { connect, databaseConfig } = require('./lib/database');

const ROOT = path.resolve(__dirname, '../..');
const SEEDS_DIR = path.join(ROOT, 'db', 'seeds');

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
