-- Menyiapkan tabel payments untuk pembayaran lewat Midtrans Snap.
--
-- Perubahan:
-- 1. Kolom baru untuk menyimpan data transaksi Midtrans.
-- 2. Membuang batasan "satu booking hanya boleh punya satu baris pembayaran"
--    supaya tenant bisa mencoba bayar lagi setelah transaksi kedaluwarsa.
-- 3. Memperluas pilihan status pembayaran.
--
-- Jalankan file ini sebelum server versi Midtrans dipakai.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS snap_token TEXT,
  ADD COLUMN IF NOT EXISTS redirect_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS transaction_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS midtrans_response JSONB;

-- Satu order_id Midtrans hanya boleh dipakai satu baris pembayaran.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments (order_id)
  WHERE order_id IS NOT NULL;

-- Index bantu saat webhook mencari pembayaran berdasarkan booking.
CREATE INDEX IF NOT EXISTS idx_payments_booking_created
  ON payments (booking_id, created_at DESC);

-- Batasan lama dibuang tanpa harus menebak namanya: cari semua CHECK/UNIQUE
-- pada tabel payments yang menyebut kolom status atau booking_id.
DO $$
DECLARE
  batasan RECORD;
  indeks RECORD;
BEGIN
  FOR batasan IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'payments'::regclass
      AND contype IN ('c', 'u')
      AND (
        pg_get_constraintdef(oid) ILIKE '%status%'
        OR pg_get_constraintdef(oid) ILIKE '%booking_id%'
      )
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', batasan.conname);
  END LOOP;

  -- 005_create_payments.sql membuat indeks unik sendiri (bukan constraint),
  -- sehingga harus dibuang terpisah agar satu booking bisa dicoba berkali-kali.
  FOR indeks IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%booking_id%'
      AND indexname NOT LIKE '%created_at%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', indeks.indexname);
  END LOOP;
END $$;

-- Status pembayaran sekarang mengikuti istilah Midtrans:
-- PENDING   -> transaksi dibuat, belum dibayar
-- BERHASIL  -> dibayar (settlement/capture)
-- GAGAL     -> ditolak bank / gagal
-- EXPIRED   -> melewati batas waktu
-- DIBATALKAN-> dibatalkan
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('PENDING', 'BERHASIL', 'GAGAL', 'EXPIRED', 'DIBATALKAN'));

ALTER TABLE payments
  ALTER COLUMN status SET DEFAULT 'PENDING';

-- Kolom metode sekarang diisi dari jenis pembayaran Midtrans (qris, bank_transfer, ...).
ALTER TABLE payments
  ALTER COLUMN metode TYPE VARCHAR(40);
