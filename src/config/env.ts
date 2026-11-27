import 'dotenv/config';

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

/**
 * Nilai untuk `app.set('trust proxy', ...)` pada Express.
 *
 * - `n` (angka) -> memakai jumlah hop dari header `X-Forwarded-For`.
 * - `"loopback"`, `"all"`, atau alamat IP -> diteruskan sebagai string.
 * - Belum di-set -> `undefined` (Express memakai default `false`).
 *
 * Catatan keamanan: jangan pakai `true` (security issue).
 * Gunakan angka (mis. `1`), `"loopback"`, atau daftar IP.
 */
function toTrustProxy(value: string | undefined): string | number | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  // Angka: jumlah hop yang dikaitkan dengan proxy.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed.toLowerCase() === 'true') {
    throw new Error(
      'TRUST_PROXY=true tidak diizinkan karena header X-Forwarded-For bisa dipalsukan. ' +
        'Gunakan jumlah hop (mis. 1) atau daftar IP proxy.',
    );
  }

  return trimmed;
}

/**
 * Konfigurasi origin CORS dari `CORS_ORIGINS`.
 *
 * - Kosong di production -> `[]` (ditolak; `validateProductionConfig` gagal).
 * - Kosong di development -> `'dev-localhost'` (hanya localhost/127.0.0.1
 *   dengan port berapa pun, agar Flutter Web tetap bisa dipakai).
 * - `'*'` -> `true` (semua origin; hanya untuk development).
 * - Selain itu -> array origin yang diizinkan.
 */
export type CorsOriginConfig = string[] | true | 'dev-localhost';

function toCorsOrigins(
  value: string | undefined,
  isProduction: boolean,
): CorsOriginConfig {
  const raw = value?.trim() ?? '';

  if (raw === '') {
    return isProduction ? [] : 'dev-localhost';
  }

  if (raw === '*') {
    return true;
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

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
    origins: toCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV === 'production'),
  },
  trustProxy: toTrustProxy(process.env.TRUST_PROXY),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    folder: process.env.CLOUDINARY_FOLDER?.trim() || 'spoth-umkm',
  },
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY?.trim() ?? '',
    signatureSecretKey: process.env.MIDTRANS_SIGNATURE_SECRET_KEY?.trim() ?? '',
    isProduction: toBoolean(process.env.MIDTRANS_IS_PRODUCTION, false),
  },
} as const;

/**
 * Memeriksa konfigurasi produksi yang diperlukan sebelum server berjalan.
 *
 * Dijalankan pada `server.ts` (fail-fast): jika konfigurasi kritis tidak
 * terpenuhi di production, aplikasi ditolak saat start. Perubahan di sini
 * hanya memengaruhi proses start, bukan bentuk respons API.
 */
export function validateProductionConfig(): void {
  if (!env.isProduction) {
    return;
  }

  // 1. TLS database: gunakan CA Aiven untuk verifikasi sertifikat penuh.
  if (env.db.ssl && !env.db.sslCaPath) {
    throw new Error('DB_SSL_CA wajib diisi pada NODE_ENV=production saat DB_SSL=true.');
  }

  // 2. CORS: production harus memiliki allowlist origin.
  if (env.cors.origins === true) {
    throw new Error('CORS_ORIGINS "*" tidak diizinkan pada NODE_ENV=production; isi daftar origin.');
  }

  if (!Array.isArray(env.cors.origins) || env.cors.origins.length === 0) {
    throw new Error('CORS_ORIGINS wajib diisi (allowlist) pada NODE_ENV=production.');
  }

  // 3. JWT Secret: harus cukup kuat di production.
  if (env.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET minimal 32 karakter di NODE_ENV=production.');
  }

  // 4. Midtrans: pembayaran tidak akan berjalan tanpa server key.
  if (!env.midtrans.serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY wajib diisi pada NODE_ENV=production.');
  }

  if (env.midtrans.isProduction === false) {
    console.warn(
      '[midtrans] MIDTRANS_IS_PRODUCTION=false, transaksi memakai sandbox.',
    );
  }
}

/**
 * Memeriksa konfigurasi Midtrans dan memberi peringatan bila belum lengkap.
 *
 * Format key Midtrans bisa berubah (sejak Oktober 2026 Server Key dibuat lewat
 * dashboard dan hanya ditampilkan sekali), jadi jangan menebak environment dari
 * awalan key. Keabsahan key tetap diverifikasi oleh Midtrans saat transaksi.
 */
export function validateMidtransConfig(): void {
  if (!env.midtrans.serverKey) {
    console.warn(
      '[midtrans] MIDTRANS_SERVER_KEY belum diisi. Pembayaran belum bisa diproses.',
    );
    return;
  }

  console.log(
    `[midtrans] Mode ${env.midtrans.isProduction ? 'production' : 'sandbox'}.`,
  );

  if (!env.midtrans.signatureSecretKey) {
    console.log(
      '[midtrans] MIDTRANS_SIGNATURE_SECRET_KEY belum diisi; verifikasi ' +
        'webhook memakai Server Key (kompatibel dengan integrasi lama).',
    );
  }
}

/**
 * Menentukan apakah sebuah origin boleh mengakses API/Socket.IO.
 * Origin kosong (request non-browser seperti mobile/curl) selalu diizinkan
 * karena CORS hanya berlaku untuk browser.
 */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  if (env.cors.origins === true) {
    return true;
  }

  if (env.cors.origins === 'dev-localhost') {
    return LOCALHOST_ORIGIN.test(origin);
  }

  return env.cors.origins.includes(origin);
}

export function getJwtSecret(): string {
  if (!env.jwt.secret) {
    throw new Error('JWT_SECRET belum diatur di .env');
  }

  return env.jwt.secret;
}

/**
 * Memastikan konfigurasi Cloudinary sudah terisi di .env.
 * Dipakai oleh modul konfigurasi Cloudinary sebelum melakukan upload.
 */
export function getCloudinaryConfig(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
} {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new Error('Konfigurasi Cloudinary belum lengkap di .env');
  }

  return env.cloudinary;
}
