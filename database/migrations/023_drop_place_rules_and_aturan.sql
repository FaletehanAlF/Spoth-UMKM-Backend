-- Menghapus fitur "aturan ketersediaan" dan kolom teks `places.aturan`.
--
-- Keputusan produk: form tambah tempat tidak lagi meminta aturan apa pun.
-- Yang dihapus:
--   1. Tabel place_availability_rules (aturan TANGGAL/HARI/BULAN).
--   2. Kolom places.aturan (teks bebas aturan tempat).
--
-- Yang TETAP dipertahankan: kolom places.tanggal_mulai_tersedia dan
-- tanggal_selesai_tersedia. Keduanya adalah periode sewa pada form
-- ("Tanggal mulai & selesai") dan masih dipakai saat memeriksa pemesanan.

DROP TABLE IF EXISTS place_availability_rules;

ALTER TABLE places DROP CONSTRAINT IF EXISTS cek_tanggal_ketersediaan;

ALTER TABLE places DROP COLUMN IF EXISTS aturan;
