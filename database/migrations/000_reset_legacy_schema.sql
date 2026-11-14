-- =============================================================================
-- MIGRASI PERBAIKAN SATU KALI (sudah dieksekusi di database Aiven).
--
-- Latar belakang:
-- Enam tabel SPOTH UMKM sebelumnya dibuat secara manual (misalnya lewat
-- DBeaver) dengan struktur yang BELUM sesuai SRS Subbab 4.2.2, antara lain:
--   - `places.user_id`       (SRS memakai `host_id`)
--   - `bookings.user_id`     (SRS memakai `tenant_id`)
--   - `bookings` belum punya `jenis_usaha`, `jumlah_durasi`,
--     `pendapatan_host`, dan `created_at`
--   - `users` belum punya `created_at` dan role memakai
--     `penyewa`/`pemilik` (SRS memakai `HOST`/`TENANT`)
--   - `places` belum punya `deskripsi`, `kota`, `fasilitas`, `aturan`,
--     `status`, `created_at`, dan `updated_at`
--
-- Berkas ini menghapus tabel-tabel lama tersebut (saat migrasi ini dibuat,
-- isinya masih kosong) supaya berkas 001-006 dapat membuat ulang versi
-- yang sesuai dengan SRS.
--
-- CATATAN: File ini sudah pernah dijalankan. Jangan dihapus. Jangan jalankan
-- ulang pada database yang sudah berisi data penting.
-- =============================================================================

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS place_images CASCADE;
DROP TABLE IF EXISTS places CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Mengosongkan riwayat migrasi supaya 001-006 dijalankan ulang dari awal.
DELETE FROM app_meta.schema_migrations
WHERE filename IN (
    '001_create_users.sql',
    '002_create_places.sql',
    '003_create_place_images.sql',
    '004_create_bookings.sql',
    '005_create_payments.sql',
    '006_create_notifications.sql'
);
