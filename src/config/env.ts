import 'dotenv/config';

import path from 'node:path';

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Daftar origin yang diizinkan untuk mengakses API.
 * Default-nya '*' supaya Flutter Web yang di-deploy ke Vercel/Netlify bisa
 * langsung terhubung.
 */
function toCorsOrigins(value: string | undefined): string[] | true {
  if (value === undefined || value.trim() === '' || value.trim() === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  db: {
    host: process.env.DB_HOST?.trim() ?? '',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME?.trim() ?? '',
    user: process.env.DB_USER?.trim() ?? '',
    password: process.env.DB_PASSWORD ?? '',
    ssl: toBoolean(process.env.DB_SSL, false),
    sslCaPath: process.env.DB_SSL_CA?.trim() || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN?.trim() || '1d',
  },
  cors: {
    origins: toCorsOrigins(process.env.CORS_ORIGINS),
  },
  upload: {
    dir: path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || 'uploads'),
    publicPath: '/uploads',
  },
} as const;

export function getJwtSecret(): string {
  if (!env.jwt.secret) {
    throw new Error('JWT_SECRET belum diatur di .env');
  }

  return env.jwt.secret;
}
