-- Migration 026: sewa memakai paket mingguan/bulanan.
--
-- Sebelumnya satu tempat hanya punya satu satuan (HARIAN/MINGGUAN/BULANAN) dan
-- satu harga. Sekarang satu tempat boleh menawarkan paket mingguan dan/atau
-- bulanan sekaligus, masing-masing dengan harganya sendiri.
--
-- Setelah migrasi ini:
--   places.harga_mingguan  ada isinya bila paket mingguan ditawarkan
--   places.harga_bulanan   ada isinya bila paket bulanan ditawarkan
--   bookings.tipe_durasi   satuan yang dipilih penyewa saat memesan
--
-- Kolom lama `places.harga` dan `places.tipe_durasi` dihapus.

-- 1. Kolom paket baru.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS harga_mingguan NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS harga_bulanan NUMERIC(12, 2);

ALTER TABLE places
  ADD CONSTRAINT ck_places_harga_mingguan CHECK (harga_mingguan > 0),
  ADD CONSTRAINT ck_places_harga_bulanan CHECK (harga_bulanan > 0);

-- 2. Pindahkan harga lama ke paket yang sesuai.
--    Paket harian tidak lagi didukung, jadi harganya dianggap paket mingguan
--    agar tempat tetap bisa disewa dan pemilik dapat menyesuaikan sendiri.
UPDATE places
SET harga_mingguan = harga
WHERE tipe_durasi IN ('MINGGUAN', 'HARIAN');

UPDATE places
SET harga_bulanan = harga
WHERE tipe_durasi = 'BULANAN';

-- Hentikan proses bila ada tempat yang tidak punya paket sama sekali,
-- supaya data tidak rusak diam-diam.
DO $$
DECLARE
  jumlah_bocor INTEGER;
BEGIN
  SELECT COUNT(*) INTO jumlah_bocor
  FROM places
  WHERE harga_mingguan IS NULL AND harga_bulanan IS NULL;

  IF jumlah_bocor > 0 THEN
    RAISE EXCEPTION 'Migration 026 dibatalkan: % tempat tidak punya paket mingguan maupun bulanan', jumlah_bocor;
  END IF;
END $$;

ALTER TABLE places
  ADD CONSTRAINT ck_places_paket
  CHECK (harga_mingguan IS NOT NULL OR harga_bulanan IS NOT NULL);

-- 3. Simpan satuan sewa yang dipilih pada setiap pemesanan.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tipe_durasi VARCHAR(15);

UPDATE bookings b
SET tipe_durasi = CASE
  WHEN p.tipe_durasi = 'BULANAN' THEN 'BULANAN'
  ELSE 'MINGGUAN'
END
FROM places p
WHERE p.id = b.place_id
  AND b.tipe_durasi IS NULL;

UPDATE bookings
SET tipe_durasi = 'MINGGUAN'
WHERE tipe_durasi IS NULL;

ALTER TABLE bookings
  ALTER COLUMN tipe_durasi SET NOT NULL;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_tipe_durasi_check
  CHECK (tipe_durasi IN ('MINGGUAN', 'BULANAN'));

-- 4. Hapus kolom satuan dan harga lama.
ALTER TABLE places DROP CONSTRAINT IF EXISTS ck_places_harga;
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_harga_not_null;
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_tipe_durasi_check;
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_tipe_durasi_not_null;

DROP INDEX IF EXISTS idx_places_harga;
DROP INDEX IF EXISTS idx_places_tipe_durasi;

ALTER TABLE places DROP COLUMN IF EXISTS harga;
ALTER TABLE places DROP COLUMN IF EXISTS tipe_durasi;

-- 5. Index untuk mencari dan mengurutkan berdasarkan paket.
CREATE INDEX IF NOT EXISTS idx_places_harga_mingguan ON places (harga_mingguan);
CREATE INDEX IF NOT EXISTS idx_places_harga_bulanan ON places (harga_bulanan);
