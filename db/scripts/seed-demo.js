'use strict';

const { connect, databaseConfig, requireDevelopmentTarget } = require('./lib/database');

const DEMO_USERS = [
  { firstName: 'Lisa', lastName: 'Park', email: 'lisa.park@example.test', role: 'Admin' },
  { firstName: 'Alex', lastName: 'Rivera', email: 'alex.rivera@example.test', role: 'User' },
];
const DEMO_PERMISSIONS = [
  { email: 'lisa.park@example.test', right: 'CUSTOMER_ADD' },
  { email: 'lisa.park@example.test', right: 'CUSTOMER_EDIT' },
  { email: 'lisa.park@example.test', right: 'PRODUCT_ADD' },
  { email: 'alex.rivera@example.test', right: 'CUSTOMER_ADD' },
  { email: 'alex.rivera@example.test', right: 'REPORT_TOP_CUSTOMERS' },
];

async function main() {
  const config = databaseConfig();
  requireDevelopmentTarget(config);
  const client = await connect(config);
  try {
    await client.query('BEGIN');
    try {
      const roles = await client.query(
        "SELECT role_id, name FROM role WHERE status = 'Active' AND name IN ('Admin', 'User')",
      );
      const roleIds = new Map(roles.rows.map((row) => [row.name, row.role_id]));
      if (!roleIds.has('Admin') || !roleIds.has('User')) {
        throw new Error('Run npm run db:seed first; active Admin and User roles are required.');
      }

      const users = new Map();
      for (const user of DEMO_USERS) {
        const result = await client.query(
          `INSERT INTO app_user
             (first_name, last_name, email, password_hash, role_id, must_set_password)
           VALUES ($1, $2, $3, NULL, $4, true)
           ON CONFLICT (lower(email)) DO UPDATE
           SET first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               role_id = EXCLUDED.role_id
           RETURNING user_id`,
          [user.firstName, user.lastName, user.email, roleIds.get(user.role)],
        );
        users.set(user.email, result.rows[0].user_id);
      }

      const rightCodes = [...new Set(DEMO_PERMISSIONS.map((permission) => permission.right))];
      const rights = await client.query(
        `SELECT right_id, code
         FROM rights
         WHERE status = 'Active' AND code = ANY($1::text[])`,
        [rightCodes],
      );
      const rightIds = new Map(rights.rows.map((row) => [row.code, row.right_id]));
      if (rightIds.size !== rightCodes.length) {
        throw new Error('Run npm run db:seed first; one or more demo rights are missing or inactive.');
      }

      await client.query('SELECT set_config(\'app.actor_user_id\', $1, true)', [
        String(users.get('lisa.park@example.test')),
      ]);
      for (const permission of DEMO_PERMISSIONS) {
        await client.query(
          `INSERT INTO user_permission (user_id, right_id, granted_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, right_id) DO UPDATE
            SET status = 'Active'
            WHERE user_permission.status <> 'Active'`,
          [users.get(permission.email), rightIds.get(permission.right), users.get('lisa.park@example.test')],
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
  console.log('Development demo seed complete: 2 demo accounts and 5 permission assignments.');
  console.log('No passwords were created. Run npm run db:issue-setup-links to issue setup links.');
}

main().catch((error) => {
  console.error(`Development demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
