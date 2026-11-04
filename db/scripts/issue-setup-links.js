'use strict';

const crypto = require('node:crypto');
const { connect, databaseConfig, requireDevelopmentTarget } = require('./lib/database');

function setupPageUrl(baseUrl) {
  let url;
  try {
    url = new URL('/set-password', baseUrl);
  } catch {
    throw new Error('APP_BASE_URL must be a valid absolute URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('APP_BASE_URL must use HTTP or HTTPS and must not contain credentials.');
  }
  if (url.search || url.hash) throw new Error('APP_BASE_URL must not include a query string or fragment.');
  return url;
}

async function main() {
  requireDevelopmentTarget();
  if (!process.env.APP_BASE_URL) throw new Error('Set APP_BASE_URL in .env to the application base URL.');
  const setupUrl = setupPageUrl(process.env.APP_BASE_URL);
  const tokenTtl = process.env.SET_PASSWORD_TOKEN_TTL || '24 hours';
  const client = await connect(databaseConfig());
  let issuedCount = 0;

  try {
    const candidates = await client.query(
      `SELECT user_id
       FROM app_user
       WHERE password_hash IS NULL
         AND status = 'Active'
         AND is_blocked = false
       ORDER BY user_id`,
    );

    for (const candidate of candidates.rows) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
      await client.query('BEGIN');
      try {
        const locked = await client.query(
          `SELECT user_id
           FROM app_user
           WHERE user_id = $1
             AND password_hash IS NULL
             AND status = 'Active'
             AND is_blocked = false
           FOR UPDATE`,
          [candidate.user_id],
        );
        if (!locked.rowCount) {
          await client.query('ROLLBACK');
          continue;
        }

        await client.query(
          `UPDATE app_user
           SET must_set_password = true
           WHERE user_id = $1
             AND must_set_password = false`,
          [candidate.user_id],
        );
        await client.query(
          `UPDATE password_reset_token
           SET status = 'Inactive'
           WHERE user_id = $1
             AND purpose = 'set_password'
             AND used_at IS NULL
             AND status = 'Active'`,
          [candidate.user_id],
        );
        await client.query(
          `INSERT INTO password_reset_token (user_id, token_hash, purpose, expires_at)
           VALUES ($1, $2, 'set_password', CURRENT_TIMESTAMP + $3::interval)`,
          [candidate.user_id, tokenHash, tokenTtl],
        );
        await client.query('COMMIT');
        const link = new URL(setupUrl);
        link.searchParams.set('token', rawToken);
        console.log(link.toString());
        issuedCount += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }

  console.log(`Issued ${issuedCount} one-time setup link(s). Deliver securely; this output is not saved.`);
}

main().catch((error) => {
  console.error(`Setup-link command failed: ${error.message}`);
  process.exitCode = 1;
});
