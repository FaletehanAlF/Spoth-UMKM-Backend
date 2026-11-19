import { readFileSync } from 'node:fs';

import { Pool, type PoolClient, type PoolConfig } from 'pg';

import { env } from './env.js';

function buildSslConfig(): PoolConfig['ssl'] {
  if (!env.db.ssl) {
    return undefined;
  }
  if (env.db.sslCaPath) {
    return {
      ca: readFileSync(env.db.sslCaPath, 'utf8'),
      rejectUnauthorized: true,
    };
  }

  // Production wajib memverifikasi sertifikat server. Jangan pernah fallback
  // ke TLS tanpa verifikasi karena membuka peluang man-in-the-middle.
  if (env.isProduction) {
    throw new Error(
      'DB_SSL_CA wajib diisi saat NODE_ENV=production dan DB_SSL=true. ' +
        'Unduh CA Aiven lalu isi path-nya (lihat README).',
    );
  }

  console.warn(
    '[database] DB_SSL_CA is not set. TLS is encrypted but the Aiven CA certificate is not verified. ' +
      'Set DB_SSL_CA before deploying to production.',
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

/**
 * Client database yang dipakai di dalam satu transaksi.
 * `pg` memberi turunan tipe `PoolClient` yang sudah mewarisi method query.
 */
export type DbClient = PoolClient;

/**
 * Menjalankan callback di dalam satu transaksi database.
 *
 * - Callback menerima `client` (satu koneksi khusus).
 * - Jika callback melempar error, transaksi di-rollback.
 * - Jika callback sukses, transaksi di-commit.
 *
 * Transaksi dipakai pada pembuatan pemesanan (validasi jadwal anti
 * double booking) dan pembayaran simulasi (pembuatan E-Pass).
 */
export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
