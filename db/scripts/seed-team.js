'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { connect, databaseConfig, requireDevelopmentTarget } = require('./lib/database');

const ROOT = path.resolve(__dirname, '../..');
const TEAM_FILE = path.join(ROOT, 'db', 'seeds', 'team.csv');

function parseCsv(contents) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < contents.length; i += 1) {
    const character = contents[i];
    if (quoted) {
      if (character === '"' && contents[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && contents[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (character === '"') {
      throw new Error('The team CSV contains a quote inside an unquoted field.');
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The team CSV has an unterminated quoted field.');
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function parseTeam(contents) {
  const rows = parseCsv(contents);
  if (!rows.length || rows[0].map((cell) => cell.trim().toLowerCase()).join(',') !== 'name,email') {
    throw new Error('The team file must start with the header: name,email');
  }

  const seenEmails = new Set();
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== 2) throw new Error(`Team CSV row ${index + 2} must have exactly two columns.`);
    const nameParts = cells[0].trim().split(/\s+/).filter(Boolean);
    const email = cells[1].trim().toLowerCase();
    if (nameParts.length < 2) throw new Error(`Team CSV row ${index + 2} needs a first and last name.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Team CSV row ${index + 2} has an invalid email address.`);
    }
    if (seenEmails.has(email)) throw new Error(`Team CSV row ${index + 2} duplicates an email address.`);
    seenEmails.add(email);
    return {
      firstName: nameParts.shift(),
      lastName: nameParts.join(' '),
      email,
    };
  });
}

async function main() {
  requireDevelopmentTarget();
  let contents;
  try {
    contents = await fs.readFile(TEAM_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Missing db/seeds/team.csv. Copy db/seeds/team.example.csv and add the real team roster locally.');
    }
    throw error;
  }

  const team = parseTeam(contents);
  if (!team.length) throw new Error('The team CSV contains no team members.');

  const client = await connect(databaseConfig());
  try {
    await client.query('BEGIN');
    try {
      const role = await client.query(
        "SELECT role_id FROM role WHERE name = 'Superadmin' AND status = 'Active'",
      );
      if (!role.rowCount) throw new Error('Run npm run db:seed first; the active Superadmin role is missing.');

      for (const member of team) {
        await client.query(
          `INSERT INTO app_user
             (first_name, last_name, email, password_hash, role_id, must_set_password)
           VALUES ($1, $2, $3, NULL, $4, true)
           ON CONFLICT (lower(email)) DO UPDATE
           SET first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               role_id = EXCLUDED.role_id
           RETURNING user_id`,
          [member.firstName, member.lastName, member.email, role.rows[0].role_id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
  console.log(`Team seed complete. Processed ${team.length} roster member(s); no email addresses were logged.`);
}

main().catch((error) => {
  console.error(`Team seed failed: ${error.message}`);
  process.exitCode = 1;
});
