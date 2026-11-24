-- Reset data tempat (places) beserta data turunannya.
-- Jalankan file ini di DBeaver (Execute SQL Script) pada database SPOTH.
-- Aman dijalankan berulang; tidak menghapus users dan categories.

BEGIN;

-- 1. Hapus notifikasi yang terkait dengan booking (metadata.booking_id).
DELETE FROM notifications
WHERE metadata IS NOT NULL
  AND metadata ? 'booking_id';

-- 2. Hapus pembayaran dan booking (payments CASCADE ke bookings, tetapi
--    dihapus eksplisit agar urutan jelas).
DELETE FROM payments;
DELETE FROM bookings;

-- 3. Hapus data tempat. place_images memiliki FK CASCADE, tetapi dihapus
--    eksplisit agar urutan jelas.
DELETE FROM place_images;
DELETE FROM places;

-- 4. Reset sequence agar ID mulai dari 1 (opsional).
ALTER SEQUENCE IF EXISTS places_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;

COMMIT;

-- Verifikasi (harus 0 semua):
-- SELECT
--   (SELECT COUNT(*) FROM places) AS places,
--   (SELECT COUNT(*) FROM bookings) AS bookings,
--   (SELECT COUNT(*) FROM payments) AS payments,
--   (SELECT COUNT(*) FROM place_images) AS place_images;
