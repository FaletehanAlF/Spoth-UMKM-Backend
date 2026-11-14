# Database SPOTH UMKM

Skema database SPOTH UMKM beserta cara Pengelolaannya.

---

## Ringkasan

Database menggunakan **PostgreSQL (Aiven)** dan berisi **enam tabel** pada
schema `public`, sesuai rancangan ERD pada SRS Subbab 4.2.1.

| Tabel | Isi | Relasi |
|---|---|---|
| `users` | Akun Host dan Tenant (dibedakan kolom `role`) | — |
| `places` | Tempat yang disewakan oleh Host | `host_id` → `users.id` |
| `place_images` | Foto-foto tempat | `place_id` → `places.id` |
| `bookings` | Pemesanan tempat oleh Tenant | `place_id` → `places.id`, `tenant_id` → `users.id` |
| `payments` | Pembayaran simulasi | `booking_id` → `bookings.id` (1:1) |
| `notifications` | Notifikasi aktivitas pemesanan | `user_id` → `users.id` |

Diagram relasi:

```text
users ──1:N──> places ──1:N──> place_images
  │                 │
  │                 └──1:N──> bookings ──1:1──> payments
  │                              │
  └──1:N──> notifications        └──> users (tenant_id)
```

---

## Konfigurasi koneksi

Kredensial database dibaca dari file `.env` di root project:

```env
DB_HOST=...
DB_PORT=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_SSL=true
```

File `.env` **tidak** disimpan di Git. Gunakan `.env.example` sebagai template.

Untuk mengaktifkan verifikasi TLS penuh terhadap sertifikat Aiven, unduh
**CA Certificate** (`ca.pem`) dari Aiven Console, lalu isi:

```env
DB_SSL_CA=./certs/aiven-ca.pem
```

Tanpa `DB_SSL_CA`, koneksi tetap terenkripsi, tetapi sertifikat Aiven tidak
diverifikasi (server tetap berjalan dan hanya menampilkan peringatan di log).

---

## Menjalankan migrasi

```bash
npm run migrate
```

Perintah ini menjalankan seluruh berkas pada `database/migrations/` yang belum
pernah dijalankan. Setiap berkas dijalankan di dalam satu transaksi, dan daftar
berkas yang sudah dijalankan dicatat pada tabel `app_meta.schema_migrations`.

> Tabel pencatat migrasi sengaja diletakkan pada schema terpisah (`app_meta`)
> supaya schema `public` hanya berisi enam tabel sesuai rancangan ERD.

Perintah terkait:

| Perintah | Fungsi |
|---|---|
| `npm run migrate` | Menjalankan migrasi yang belum dijalankan |
| `npm run seed` | Mengisi data contoh (akun, tempat, pemesanan) |
| `npm run db:reset` | Migrasi + seed sekaligus |

> **`npm run migrate` aman dijalankan berulang kali** — berkas yang sudah
> dijalankan akan dilewati.

---

## Daftar berkas migrasi

| Berkas | Isi |
|---|---|
| `000_reset_legacy_schema.sql` | Pembersihan satu kali tabel lama yang dibuat manual dan tidak sesuai SRS. **Jangan dihapus dan jangan dijalankan ulang.** |
| `001_create_users.sql` | Tabel `users` (SRS Tabel 4.2) |
| `002_create_places.sql` | Tabel `places` (SRS Tabel 4.3) |
| `003_create_place_images.sql` | Tabel `place_images` (SRS Tabel 4.4) |
| `004_create_bookings.sql` | Tabel `bookings` (SRS Tabel 4.5) |
| `005_create_payments.sql` | Tabel `payments` (SRS Tabel 4.6) |
| `006_create_notifications.sql` | Tabel `notifications` (SRS Tabel 4.7) |

---

## Data contoh

`npm run seed` mengisi data contoh berikut (password semua akun: `password123`):

| Peran | Email |
|---|---|
| Host | `host@spoth.test` |
| Host | `host2@spoth.test` |
| Tenant | `tenant@spoth.test` |
| Tenant | `tenant2@spoth.test` |

Salinan data contoh dalam bentuk SQL tersedia pada `database/seeds/seed_data.sql`.
Berkas tersebut hanyalah **snapshot**, sumber utamanya adalah
`src/database/seed.ts`.

> Perintah `npm run seed` **menghapus seluruh isi tabel** sebelum mengisi data
> contoh. Jangan jalankan pada database yang sudah berisi data penting.
