'use strict';

const { randomUUID } = require('node:crypto');
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
    if (typeof value === 'number' && /total|P-003 current price|current price of P-003/i.test(label)) {
      return value.toFixed(2);
    }
    return String(value);
  };
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: expected ${display(expected)}, got ${display(actual)}`);
  if (!passed) failures.push(label);
}

async function verifyCustomerProductAccess(client, failures) {
  const { rows: roles } = await client.query(`
    SELECT role_id, name
    FROM role
    WHERE name IN ('Admin', 'Superadmin', 'User')
      AND status = 'Active'
    ORDER BY name
  `);
  report('active customer/product verification roles', roles.length, 3, failures);
  if (roles.length !== 3) return;

  await client.query('BEGIN');
  try {
    for (const role of roles) {
      const email = `sprint2-verify-${randomUUID()}-${role.name.toLowerCase()}@example.test`;
      const { rows } = await client.query(
        `INSERT INTO app_user (first_name, last_name, email, role_id)
         VALUES ('Sprint 2', 'Verifier', $1, $2)
         RETURNING user_id`,
        [email, role.role_id],
      );
      await client.query(
        "SELECT set_config('app.actor_user_id', $1, true)",
        [String(rows[0].user_id)],
      );

      const { rows: roleRows } = await client.query(`
        SELECT public.app_actor_role() AS actor_role,
               (SELECT count(*)::integer FROM customer_management_admin) AS customer_admin_count,
               (SELECT count(*)::integer FROM customer_active) AS customer_active_count,
               (SELECT count(*)::integer FROM customer) AS customer_base_count,
               (SELECT count(*)::integer FROM customer WHERE status = 'Active') AS customer_base_active_count,
               (SELECT count(*)::integer FROM product_management_admin) AS product_admin_count,
               (SELECT count(*)::integer FROM product_active) AS product_active_count,
               (SELECT count(*)::integer FROM product) AS product_base_count,
               (SELECT count(*)::integer FROM product WHERE status = 'Active') AS product_base_active_count,
               (SELECT count(*)::integer FROM pricehist_management_admin) AS pricehist_admin_count,
               (SELECT count(*)::integer FROM pricehist_active) AS pricehist_active_count,
               (SELECT count(*)::integer FROM pricehist) AS pricehist_base_count,
               (SELECT count(*)::integer FROM pricehist WHERE status = 'Active') AS pricehist_base_active_count
      `);
      const actual = roleRows[0];
      report(`${role.name} actor context`, actual.actor_role, role.name, failures);
      const isAdmin = role.name === 'Admin' || role.name === 'Superadmin';
      if (isAdmin) {
        report(`${role.name} customer all-row access`, actual.customer_admin_count, actual.customer_base_count, failures);
        report(`${role.name} product all-row access`, actual.product_admin_count, actual.product_base_count, failures);
        report(`${role.name} price-history all-row access`, actual.pricehist_admin_count, actual.pricehist_base_count, failures);
      } else {
        report('User customer active-only access', actual.customer_active_count, actual.customer_base_active_count, failures);
        report('User customer management view denied', actual.customer_admin_count, 0, failures);
        report('User product active-only access', actual.product_active_count, actual.product_base_active_count, failures);
        report('User product management view denied', actual.product_admin_count, 0, failures);
        report('User price-history active-only access', actual.pricehist_active_count, actual.pricehist_base_active_count, failures);
        report('User price-history management view denied', actual.pricehist_admin_count, 0, failures);
      }

      const { rows: currentPriceRows } = await client.query(`
        SELECT
          (SELECT current_price FROM product_management_admin WHERE prodcode = 'P-003') AS admin_p003_price,
          (SELECT current_price FROM product_management_admin WHERE prodcode = 'P-004') AS admin_p004_price,
          (SELECT current_price FROM product_active WHERE prodcode = 'P-003') AS active_p003_price,
          (SELECT count(*)::integer FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name IN ('customer_active', 'product_active', 'pricehist_active')
             AND column_name IN ('status', 'stamp')) AS restricted_column_count,
          (SELECT count(*)::integer FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name IN (
               'customer_management_admin',
               'product_management_admin',
               'pricehist_management_admin'
             )
             AND column_name IN ('status', 'stamp')) AS management_column_count,
          (SELECT count(*)::integer FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'product'
             AND column_name = 'current_price') AS stored_current_price_column_count
      `);
      const prices = currentPriceRows[0];
      if (isAdmin) {
        report(`${role.name} P-003 current price`, prices.admin_p003_price === null
          ? null
          : Number(prices.admin_p003_price), 28, failures);
        report(`${role.name} P-004 has no current price`, prices.admin_p004_price, null, failures);
      } else {
        report('User P-003 current price', prices.active_p003_price === null
          ? null
          : Number(prices.active_p003_price), 28, failures);
      }
      report('User views omit status and stamp columns', prices.restricted_column_count, 0, failures);
      report(`${role.name} management views expose status and stamp`, prices.management_column_count, 6, failures);
      report('Current price is not stored on product', prices.stored_current_price_column_count, 0, failures);
    }

    const { rows: deleteGuardRows } = await client.query(`
      SELECT count(*)::integer AS count
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'customer_no_hard_delete', 'customer_no_truncate',
          'product_no_hard_delete', 'product_no_truncate',
          'pricehist_no_hard_delete', 'pricehist_no_truncate'
        )
        AND tgenabled <> 'D'
    `);
    report('soft-delete guards installed', deleteGuardRows[0].count, 6, failures);

    const deleteChecks = [
      {
        label: 'customer physical delete rejected',
        sql: "DELETE FROM public.customer WHERE custno = 'C-005'",
      },
      {
        label: 'product physical delete rejected',
        sql: "DELETE FROM public.product WHERE prodcode = 'P-005'",
      },
      {
        label: 'price-history physical delete rejected',
        sql: "DELETE FROM public.pricehist WHERE prodcode = 'P-003' AND effdate = DATE '2025-02-01'",
      },
      {
        label: 'customer truncate rejected',
        sql: 'TRUNCATE TABLE public.customer CASCADE',
      },
      {
        label: 'product truncate rejected',
        sql: 'TRUNCATE TABLE public.product CASCADE',
      },
      {
        label: 'price-history truncate rejected',
        sql: 'TRUNCATE TABLE public.pricehist CASCADE',
      },
    ];
    for (const [index, check] of deleteChecks.entries()) {
      const savepoint = `soft_delete_check_${index + 1}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      let rejected = false;
      try {
        await client.query(check.sql);
      } catch (error) {
        if (!error.message.includes('Physical deletion from')) throw error;
        rejected = true;
      } finally {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      }
      report(check.label, rejected, true, failures);
    }
  } finally {
    await client.query('ROLLBACK');
  }
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

    const { rows: activeRoleRows } = await client.query(
      "SELECT count(*)::integer AS count FROM role WHERE status = 'Active'",
    );
    report('active default roles', activeRoleRows[0].count, 3, failures);

    const { rows: activeModuleRows } = await client.query(
      "SELECT count(*)::integer AS count FROM module WHERE status = 'Active'",
    );
    report('active modules', activeModuleRows[0].count, 5, failures);

    const expectedModuleRights = new Map([
      ['Customer', 3],
      ['Product', 6],
      ['Human Resources', 13],
      ['Sales', 7],
      ['Reports', 7],
    ]);
    const { rows: moduleRightRows } = await client.query(
      'SELECT module_name, active_right_count FROM v_module_right_counts',
    );
    const moduleRightCounts = new Map(
      moduleRightRows.map((row) => [row.module_name, row.active_right_count]),
    );
    console.log('Active rights by module:');
    for (const [moduleName, expected] of expectedModuleRights) {
      const actual = moduleRightCounts.get(moduleName);
      console.log(`${moduleName}: ${actual === undefined ? 'missing' : actual}`);
      report(`${moduleName} active rights`, actual, expected, failures);
    }

    const { rows: activeRightRows } = await client.query(
      "SELECT count(*)::integer AS count FROM rights WHERE status = 'Active'",
    );
    report('active rights count', activeRightRows[0].count, 36, failures);

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
        AND effdate <= CURRENT_DATE
      ORDER BY effdate DESC
      LIMIT 1
    `);
    const currentPrice = currentPriceRows.length === 0
      ? null
      : Number(currentPriceRows[0].unitprice);
    report('current price of P-003', currentPrice, 28, failures);

    const { rows: fixtureRows } = await client.query(`
      SELECT
        (SELECT count(*)::integer FROM customer
         WHERE custno IN ('C-001', 'C-002', 'C-003', 'C-004', 'C-005')) AS customer_samples,
        (SELECT count(*)::integer FROM customer
         WHERE custno IN ('C-001', 'C-002', 'C-003', 'C-005') AND status = 'Active') AS active_customer_samples,
        (SELECT count(*)::integer FROM customer
         WHERE custno = 'C-004' AND status = 'Inactive') AS inactive_customer_sample,
        (SELECT count(*)::integer FROM product
         WHERE prodcode IN ('P-001', 'P-002', 'P-003', 'P-004', 'P-005')) AS product_samples,
        (SELECT count(*)::integer FROM product
         WHERE prodcode IN ('P-001', 'P-002', 'P-003', 'P-005') AND status = 'Active') AS active_product_samples,
        (SELECT count(*)::integer FROM product
         WHERE prodcode = 'P-004' AND status = 'Inactive') AS inactive_product_sample
    `);
    report('customer sample IDs C-001..C-005', fixtureRows[0].customer_samples, 5, failures);
    report('active customer samples', fixtureRows[0].active_customer_samples, 4, failures);
    report('C-004 is inactive', fixtureRows[0].inactive_customer_sample, 1, failures);
    report('product sample IDs P-001..P-005', fixtureRows[0].product_samples, 5, failures);
    report('active product samples', fixtureRows[0].active_product_samples, 4, failures);
    report('P-004 is inactive', fixtureRows[0].inactive_product_sample, 1, failures);

    const { rows: noCurrentPriceRows } = await client.query(`
      SELECT NOT EXISTS (
        SELECT 1
        FROM pricehist ph
        WHERE ph.prodcode = 'P-004'
          AND ph.status = 'Active'
          AND ph.effdate <= CURRENT_DATE
          AND ph.effdate = (
            SELECT max(current_price.effdate)
            FROM pricehist current_price
            WHERE current_price.prodcode = ph.prodcode
              AND current_price.status = 'Active'
              AND current_price.effdate <= CURRENT_DATE
          )
      ) AS has_no_current_price
    `);
    report('P-004 has no current price', noCurrentPriceRows[0].has_no_current_price, true, failures);

    await verifyCustomerProductAccess(client, failures);

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
