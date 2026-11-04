'use strict';

const dotenv = require('dotenv');
const { Client } = require('pg');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
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
    connectionTimeoutMillis: 10000,
  };
}

function report(label, actual, expected, failures) {
  const passed = actual === expected;
  const display = (value) => {
    if (typeof value === 'number' && /total|price/i.test(label)) {
      return value.toFixed(2);
    }
    return String(value);
  };
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: expected ${display(expected)}, got ${display(actual)}`);
  if (!passed) failures.push(label);
}

async function main() {
  const client = new Client(databaseConfig());
  try {
    await client.connect();
  } catch (error) {
    const details = Array.isArray(error.errors)
      ? error.errors.map((cause) => cause.message).filter(Boolean).join('; ')
      : error.message;
    const connectionError = new Error(
      `Could not connect to the database${error.code ? ` (${error.code})` : ''}: ${details || 'unknown connection error'}`,
      { cause: error },
    );
    await client.end();
    throw connectionError;
  }
  const failures = [];

  try {
    const tables = [
      'employee',
      'job',
      'department',
      'jobhistory',
      'customer',
      'product',
      'pricehist',
      'sales',
      'salesdetail',
      'payment',
    ];
    console.log('Row counts:');
    for (const table of tables) {
      const { rows } = await client.query(`SELECT count(*)::integer AS count FROM ${table}`);
      console.log(`${table}: ${rows[0].count}`);
    }

    const saleTotals = await client.query(`
      SELECT s.transno,
             COALESCE(SUM(sd.quantity * effective_price.unitprice), 0)::numeric(12, 2) AS total
      FROM sales s
      LEFT JOIN salesdetail sd ON sd.transno = s.transno AND sd.status = 'Active'
      LEFT JOIN LATERAL (
        SELECT ph.unitprice
        FROM pricehist ph
        WHERE ph.prodcode = sd.prodcode
          AND ph.effdate <= s.salesdate
          AND ph.status = 'Active'
        ORDER BY ph.effdate DESC
        LIMIT 1
      ) effective_price ON true
      WHERE s.transno IN ('T-001', 'T-002', 'T-003')
      GROUP BY s.transno
    `);
    const totals = new Map(saleTotals.rows.map((row) => [row.transno, Number(row.total)]));
    for (const [transno, expected] of [['T-001', 234.5], ['T-002', 140], ['T-003', 510]]) {
      report(`${transno} total`, totals.get(transno), expected, failures);
    }

    const { rows: activeSalesRows } = await client.query(`
      SELECT COALESCE(SUM(sd.quantity * effective_price.unitprice), 0)::numeric(12, 2) AS total
      FROM sales s
      JOIN salesdetail sd ON sd.transno = s.transno AND sd.status = 'Active'
      LEFT JOIN LATERAL (
        SELECT ph.unitprice
        FROM pricehist ph
        WHERE ph.prodcode = sd.prodcode
          AND ph.effdate <= s.salesdate
          AND ph.status = 'Active'
        ORDER BY ph.effdate DESC
        LIMIT 1
      ) effective_price ON true
      WHERE s.status = 'Active'
    `);
    report('active sales total', Number(activeSalesRows[0].total), 884.5, failures);

    const { rows: currentPriceRows } = await client.query(`
      SELECT unitprice
      FROM pricehist
      WHERE prodcode = 'P-003' AND status = 'Active'
      ORDER BY effdate DESC
      LIMIT 1
    `);
    const currentPrice = currentPriceRows.length === 0
      ? null
      : Number(currentPriceRows[0].unitprice);
    report('current price of P-003', currentPrice, 28, failures);

    const { rows: noCurrentPriceRows } = await client.query(`
      SELECT NOT EXISTS (
        SELECT 1
        FROM pricehist ph
        WHERE ph.prodcode = 'P-004'
          AND ph.status = 'Active'
          AND ph.effdate = (
            SELECT max(current_price.effdate)
            FROM pricehist current_price
            WHERE current_price.prodcode = ph.prodcode
              AND current_price.status = 'Active'
          )
      ) AS has_no_current_price
    `);
    report('P-004 has no current price', noCurrentPriceRows[0].has_no_current_price, true, failures);

    const { rows: orphanRows } = await client.query(`
      SELECT sum(orphan_count)::integer AS count
      FROM (
        SELECT count(*) AS orphan_count FROM jobhistory child
          LEFT JOIN employee parent ON parent.empno = child.empno WHERE parent.empno IS NULL
        UNION ALL
        SELECT count(*) FROM jobhistory child
          LEFT JOIN job parent ON parent.jobcode = child.jobcode WHERE parent.jobcode IS NULL
        UNION ALL
        SELECT count(*) FROM jobhistory child
          LEFT JOIN department parent ON parent.deptcode = child.deptcode WHERE parent.deptcode IS NULL
        UNION ALL
        SELECT count(*) FROM sales child
          LEFT JOIN customer parent ON parent.custno = child.custno WHERE parent.custno IS NULL
        UNION ALL
        SELECT count(*) FROM sales child
          LEFT JOIN employee parent ON parent.empno = child.empno WHERE parent.empno IS NULL
        UNION ALL
        SELECT count(*) FROM salesdetail child
          LEFT JOIN sales parent ON parent.transno = child.transno WHERE parent.transno IS NULL
        UNION ALL
        SELECT count(*) FROM salesdetail child
          LEFT JOIN product parent ON parent.prodcode = child.prodcode WHERE parent.prodcode IS NULL
        UNION ALL
        SELECT count(*) FROM payment child
          LEFT JOIN sales parent ON parent.transno = child.transno WHERE parent.transno IS NULL
        UNION ALL
        SELECT count(*) FROM pricehist child
          LEFT JOIN product parent ON parent.prodcode = child.prodcode WHERE parent.prodcode IS NULL
      ) orphan_checks
    `);
    report('orphan foreign keys', orphanRows[0].count, 0, failures);
  } finally {
    await client.end();
  }

  if (failures.length > 0) {
    throw new Error(`Verification failed: ${failures.join(', ')}.`);
  }
}

main().catch((error) => {
  console.error(`Database verification failed: ${error.message}`);
  process.exitCode = 1;
});
