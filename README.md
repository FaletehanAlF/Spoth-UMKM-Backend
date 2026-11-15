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
| `DB_USER` | User database |
| `DB_PASSWORD` | Password database (jangan di-commit) |
| `DB_SSL` | `true` untuk koneksi TLS |
| `DB_SSL_CA` | Opsional, path ke CA certificate Aiven (`ca.pem`) |

Cara mendapatkan CA certificate Aiven:

1. Buka Aiven Console.
2. Pilih service PostgreSQL.
3. Buka bagian **Overview**.
4. Unduh **CA Certificate** (`ca.pem`).
5. Simpan file tersebut, misalnya di `certs/aiven-ca.pem`.
6. Isi `DB_SSL_CA=./certs/aiven-ca.pem` pada `.env`.

Dengan `DB_SSL_CA` terisi, TLS diverifikasi penuh (`rejectUnauthorized: true`).

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
