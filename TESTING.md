# Testing Backend (Node/TypeScript)

## Prasyarat
- Node.js terpasang
- File `.env` terisi (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, dll)

## Pengujian Otomatis
```bash
npm run typecheck
npm test
```

## Checklist Manual
- [ ] `GET /api/health` mengembalikan `success: true`
- [ ] Register dan login berhasil
- [ ] CRUD tempat (host) berfungsi
- [ ] Booking dan pembayaran berfungsi
- [ ] Notifikasi realtime (Socket.IO) berfungsi
- [ ] Upload foto ke Cloudinary berfungsi

## Reset Data (DBeaver)
- Hapus semua tempat + user kecuali `faletehanalfarabi09@gmail.com`:
  `database/reset_all_except_faletehan.sql`
- Hapus hanya tempat dan turunannya:
  `database/reset_places_only.sql`

## Catatan
- Folder `dist`, `uploads`, `docs`, `scripts`, `src/modules` sudah dibersihkan karena tidak diperlukan.
- `routes/index.ts` adalah pengumpul semua route + health check.
