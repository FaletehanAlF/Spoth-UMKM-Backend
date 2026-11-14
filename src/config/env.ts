import 'dotenv/config';

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST?.trim() ?? '',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME?.trim() ?? '',
    user: process.env.DB_USER?.trim() ?? '',
    password: process.env.DB_PASSWORD ?? '',
    ssl: toBoolean(process.env.DB_SSL, false),
    sslCaPath: process.env.DB_SSL_CA?.trim() || undefined,
  },
};
