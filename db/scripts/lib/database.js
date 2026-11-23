'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../..');
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

async function connect(config = databaseConfig()) {
  const client = new Client({ ...config, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    return client;
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
}

function requireDevelopmentTarget(config = databaseConfig()) {
  if ((process.env.DB_ENV || '').toLowerCase() !== 'development') {
    throw new Error('This command requires DB_ENV=development.');
  }

  const normalizeHost = (host) => host.toLowerCase().replace(/^\[|\]$/g, '');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const allowedHosts = (process.env.DB_ALLOWED_DEV_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host.trim()))
    .filter(Boolean);
  const host = normalizeHost(config.host);
  if (!localHosts.has(host) && !allowedHosts.includes(host)) {
    throw new Error(
      'Refusing to run: DB_HOST must be localhost or listed in DB_ALLOWED_DEV_HOSTS.',
    );
  }
}

module.exports = { connect, databaseConfig, requireDevelopmentTarget };
