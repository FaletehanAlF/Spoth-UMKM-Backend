# Spoth UMKM Backend

Backend aplikasi SPOTH UMKM menggunakan Express.js + TypeScript.

## Menjalankan backend

1. Salin `.env.example` menjadi `.env`.
2. Isi `DB_PASSWORD` dengan password database Aiven.
3. Jalankan:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - menjalankan server dalam mode watch.
- `npm run build` - compile TypeScript ke folder `dist`.
- `npm run start` - menjalankan hasil build.
- `npm run typecheck` - cek tipe TypeScript tanpa emit file.

## Database

Backend menggunakan PostgreSQL Aiven melalui `pg` connection pool.

Environment variable yang dibutuhkan:

| Variable | Keterangan |
|---|---|
| `DB_HOST` | Host PostgreSQL Aiven |
| `DB_PORT` | Port PostgreSQL Aiven |
| `DB_NAME` | Nama database |
| `DB_USER` | User database (sebaiknya user DML, bukan admin/DDL) |
| `DB_PASSWORD` | Password database (jangan di-commit) |
| `DB_SSL` | `true` untuk koneksi TLS |
| `DB_SSL_CA` | Path ke CA certificate Aiven (`ca.pem`). **Wajib** saat production dengan `DB_SSL=true` |
| `JWT_SECRET` | Secret JWT, minimal 32 karakter di production |
| `JWT_EXPIRES_IN` | Masa berlaku token, default `1d` |
| `CORS_ORIGINS` | Allowlist origin frontend, dipisah koma |
| `TRUST_PROXY` | Jumlah hop reverse proxy untuk `X-Forwarded-For` |

Cara mendapatkan CA certificate Aiven:

1. Buka Aiven Console.
2. Pilih service PostgreSQL.
3. Buka bagian **Overview**.
4. Unduh **CA Certificate** (`ca.pem`).
5. Simpan file tersebut, misalnya di `certs/aiven-ca.pem`.
6. Isi `DB_SSL_CA=./certs/aiven-ca.pem` pada `.env`.

Dengan `DB_SSL_CA` terisi, TLS diverifikasi penuh (`rejectUnauthorized: true`).
Di development tanpa CA, server tetap berjalan dengan peringatan. Di production,
server menolak start bila `DB_SSL=true` tetapi `DB_SSL_CA` kosong.

Catatan keamanan: user database runtime sebaiknya bukan user admin. Gunakan
user dengan hak DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) saja, bukan DDL.

## Deployment (production)

- Set `NODE_ENV=production`.
- Isi `CORS_ORIGINS` dengan domain frontend. Server menolak start jika kosong
  atau berisi `*` di production.
- Isi `DB_SSL_CA` dan `JWT_SECRET` (minimal 32 karakter). Server menolak start
  jika konfigurasi ini tidak lengkap.
- Sesuaikan `TRUST_PROXY` dengan topologi:
  - server langsung terbuka: kosong / `0`
  - satu reverse proxy (Nginx/Render/Railway): `1`
  - Cloudflare + Nginx: `2`
  Jangan gunakan `TRUST_PROXY=true`, karena header bisa dipalsukan untuk
  melewati rate limiter.
- Rate limiter memakai memory store bawaan. Untuk beberapa instance server,
  gunakan shared store (misalnya Redis) agar limit berlaku global.
- Migrasi `012_add_user_token_version.sql` menambahkan `users.token_version`.
  Setelah deploy, token lama tanpa `ver` akan ditolak sehingga **semua pengguna
  perlu login ulang**. Logout menaikkan versi token dan membatalkan seluruh
  sesi user tersebut (bukan hanya perangkat yang logout).

## Seed data contoh

Seed hanya berjalan dengan flag eksplisit dan tidak pernah di production:

```bash
ALLOW_SEED=true npm run seed
```

Password akun contoh diambil dari `SEED_PASSWORD` atau dibuat acak (tidak
dicetak ke log). Seed menghapus seluruh data sebelum mengisi data contoh,
jadi jangan dijalankan pada database berisi data nyata.

## Health check

Endpoint `GET /api/health` mengecek koneksi database dengan query `SELECT NOW()`.

- `200` - database terhubung.
- `503` - database tidak terhubung.

## Struktur folder

```text
Spoth-UMKM-Beckend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── middlewares/
│   ├── modules/
│   ├── routes/
│   └── utils/
├── database/
│   ├── migrations/
│   └── seeds/
├── .env.example
├── package.json
└── tsconfig.json
```

Fitur aplikasi akan dikelompokkan di dalam `src/modules`, misalnya `auth`, `users`, `tempat`, `pemesanan`, `pembayaran`, `e-pass`, dan `riwayat`.
