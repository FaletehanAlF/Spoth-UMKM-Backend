-- =============================================================================
-- 010_sync_places_availability_columns.sql
-- Menyelaraskan kolom tanggal ketersediaan pada tabel places dengan backend.
-- Kolom ini sudah ada di beberapa database (ditambahkan manual). Migration ini
-- memastikan keberadaan dan constraint-nya konsisten di semua environment.
-- AMAN: tidak menghapus data, menggunakan IF NOT EXISTS.
-- =============================================================================

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS tanggal_mulai_tersedia DATE,
  ADD COLUMN IF NOT EXISTS tanggal_selesai_tersedia DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cek_tanggal_ketersediaan'
  ) THEN
    ALTER TABLE places
      ADD CONSTRAINT cek_tanggal_ketersediaan CHECK (
        (tanggal_mulai_tersedia IS NULL AND tanggal_selesai_tersedia IS NULL) OR
        (tanggal_mulai_tersedia IS NOT NULL AND tanggal_selesai_tersedia IS NOT NULL
         AND tanggal_selesai_tersedia >= tanggal_mulai_tersedia)
      );
  END IF;
END $$;