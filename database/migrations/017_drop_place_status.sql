-- =============================================================================
-- Menghapus fitur status tempat (AKTIF/NONAKTIF).
-- Status tidak dipakai lagi: semua tempat selalu dapat dilihat dan dipesan.
-- =============================================================================

DROP INDEX IF EXISTS idx_places_status;

ALTER TABLE places DROP COLUMN IF EXISTS status;
