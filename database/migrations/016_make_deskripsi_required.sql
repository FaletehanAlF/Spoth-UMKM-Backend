-- Migration 016: jadikan kolom deskripsi pada places NOT NULL (min 10, max 250 karakter).
-- Jalankan manual di DBeaver sesuai kebijakan proyek.

-- 1. Pastikan tidak ada nilai NULL/kosong sebelum SET NOT NULL.
UPDATE places
SET deskripsi = 'Deskripsi tempat belum diisi.'
WHERE deskripsi IS NULL OR BTRIM(deskripsi) = '';

-- 2. Batasi panjang deskripsi ke 10-250 karakter.
--    Data yang terlalu panjang dipotong agar aman.
UPDATE places
SET deskripsi = LEFT(deskripsi, 250)
WHERE CHAR_LENGTH(deskripsi) > 250;

UPDATE places
SET deskripsi = RPAD(deskripsi, 10, '.')
WHERE CHAR_LENGTH(deskripsi) < 10;

-- 3. Ubah kolom menjadi NOT NULL.
ALTER TABLE places
  ALTER COLUMN deskripsi SET NOT NULL;

-- 4. Tambahkan CHECK constraint untuk panjang deskripsi.
ALTER TABLE places
  ADD CONSTRAINT places_deskripsi_length_check
  CHECK (CHAR_LENGTH(deskripsi) BETWEEN 10 AND 250);
