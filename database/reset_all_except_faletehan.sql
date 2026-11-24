-- Reset total: hapus semua tempat dan semua user kecuali
-- faletehanalfarabi09@gmail.com. Jalankan di DBeaver.
-- categories tetap dipertahankan.

BEGIN;

DELETE FROM payments;
DELETE FROM bookings;
DELETE FROM notifications;
DELETE FROM place_images;
DELETE FROM places;

DELETE FROM users
WHERE LOWER(email) <> LOWER('faletehanalfarabi09@gmail.com');

-- Reset sequence tempat/booking/payment.
ALTER SEQUENCE IF EXISTS places_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;

COMMIT;

-- Verifikasi:
-- SELECT (SELECT COUNT(*) FROM users) AS users,
--        (SELECT COUNT(*) FROM places) AS places,
--        (SELECT COUNT(*) FROM bookings) AS bookings,
--        (SELECT COUNT(*) FROM payments) AS payments,
--        (SELECT COUNT(*) FROM notifications) AS notifications;
-- SELECT id, nama, email, role FROM users;
