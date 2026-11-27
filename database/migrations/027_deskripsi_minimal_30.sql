-- Migration 027: deskripsi tempat minimal 30 karakter tanpa batas atas.
--
-- Sebelumnya deskripsi dibatasi 10-250 karakter oleh
-- places_deskripsi_length_check. Sekarang:
--   deskripsi tetap TEXT (bebas panjang),
--   minimal 30 karakter supaya tempat tidak tersimpan tanpa penjelasan,
--   batas maksimal 250 dihapus.
--
-- Data lama yang lebih pendek dari 30 karakter dirapikan lebih dulu agar
-- constraint baru tidak gagal dipasang. Hanya baris yang memang terlalu
-- pendek yang disentuh; deskripsi yang sudah wajar dibiarkan apa adanya.

-- 1. Lengkapi deskripsi lama yang belum mencapai 30 karakter.
UPDATE places
SET deskripsi = RPAD(BTRIM(deskripsi), 30, '.')
WHERE CHAR_LENGTH(BTRIM(deskripsi)) < 30;

-- 2. Ganti constraint panjang lama dengan aturan baru.
ALTER TABLE places
  DROP CONSTRAINT IF EXISTS places_deskripsi_length_check;

ALTER TABLE places
  ADD CONSTRAINT places_deskripsi_length_check
  CHECK (CHAR_LENGTH(BTRIM(deskripsi)) >= 30);
