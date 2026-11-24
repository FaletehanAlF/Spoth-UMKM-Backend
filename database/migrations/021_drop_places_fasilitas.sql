-- =============================================================================
-- Menghapus fitur fasilitas tempat.
--
-- Fasilitas tidak lagi diisi maupun ditampilkan di aplikasi, sehingga kolom
-- `places.fasilitas` tidak diperlukan lagi.
-- =============================================================================

ALTER TABLE places DROP COLUMN IF EXISTS fasilitas;
