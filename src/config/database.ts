import { readFileSync } from 'node:fs';

import pg from 'pg';

import { env } from './env.js';

const { Pool } = pg;

function buildSslConfig(): pg.PoolConfig['ssl'] {
  if (!env.db.ssl) {
    return undefined;
  }

  // Aiven CA certificate (ca.pem) is recommended. Set DB_SSL_CA to its path
  // to enable full certificate verification against the Aiven CA.
  if (env.db.sslCaPath) {
    return {
      ca: readFileSync(env.db.sslCaPath, 'utf8'),
      rejectUnauthorized: true,
    };
  }

  // Aiven's managed certificates are not part of the system trust store.
  // Traffic is still encrypted, but certificate verification is skipped
  // until DB_SSL_CA is configured.
  console.warn(
    '[database] DB_SSL_CA is not set. TLS is encrypted but the Aiven CA certificate is not verified.',
  );

  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  ssl: buildSslConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('[database] Unexpected idle client error:', error.message);
});

export async function checkDatabaseConnection(): Promise<Date> {
  const missingVariables = [
    ['DB_HOST', env.db.host],
    ['DB_NAME', env.db.name],
    ['DB_USER', env.db.user],
    ['DB_PASSWORD', env.db.password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Database configuration is incomplete. Set ${missingVariables.join(', ')} in .env.`,
    );
  }

  const result = await pool.query<{ now: Date }>('SELECT NOW() AS now');
  const serverTime = result.rows[0]?.now;

  if (!serverTime) {
    throw new Error('Database query returned no timestamp.');
  }

  return serverTime;
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
