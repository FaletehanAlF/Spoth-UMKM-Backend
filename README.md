# Spoth UMKM Backend

Backend aplikasi SPOTH UMKM menggunakan Express.js + TypeScript.

## Menjalankan backend

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - menjalankan server dalam mode watch.
- `npm run build` - compile TypeScript ke folder `dist`.
- `npm run start` - menjalankan hasil build.
- `npm run typecheck` - cek tipe TypeScript tanpa emit file.

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
```
