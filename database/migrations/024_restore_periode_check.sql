-- Mengembalikan constraint periode ketersediaan yang sempat ikut terhapus
-- oleh 023_drop_place_rules_and_aturan.sql.
--
-- Constraint ini menjaga kolom places.tanggal_mulai_tersedia dan
-- tanggal_selesai_tersedia: keduanya harus kosong bersamaan, dan tanggal
-- selesai tidak boleh lebih awal dari tanggal mulai. Kolom tersebut tetap
-- dipakai form "Tanggal mulai & selesai".

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cek_tanggal_ketersediaan'
      AND conrelid = 'places'::regclass
  ) THEN
    ALTER TABLE places
      ADD CONSTRAINT cek_tanggal_ketersediaan CHECK (
        (tanggal_mulai_tersedia IS NULL AND tanggal_selesai_tersedia IS NULL) OR
        (tanggal_mulai_tersedia IS NOT NULL AND tanggal_selesai_tersedia IS NOT NULL
         AND tanggal_selesai_tersedia >= tanggal_mulai_tersedia)
      );
  END IF;
END $$;
