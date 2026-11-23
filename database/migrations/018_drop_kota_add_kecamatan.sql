-- =============================================================================
-- Pembatasan sistem: kota = Depok. Kecamatan adalah dropdown yang ditetapkan
-- oleh aplikasi. Kolom `kota` tidak dipakai lagi, diganti dengan `kecamatan`.
-- =============================================================================

-- Index dulu jika masih ada, lalu hapus kolom kota lama.
DROP INDEX IF EXISTS idx_places_kota;
ALTER TABLE places DROP COLUMN IF EXISTS kota;

-- Kecamatan system (daftar lengkap). Default kecamatan untuk baris lama:
-- `Pancoran Mas` karena system tempat sudah Depok.
ALTER TABLE places ADD COLUMN IF NOT EXISTS kecamatan VARCHAR(100) NOT NULL
    DEFAULT 'Pancoran Mas';
