-- =============================================================================
-- 011_sync_place_availability_tersedia_default.sql
--
-- Membawa DEFAULT kolom `tersedia` dari TRUE menjadi FALSE, sehingga default
-- yang dipakai database menyamakan dengan keputusan produk yang disebutkan
-- pada audit frontend/backend (frontend default FALSE, backend default FALSE).
--
-- KEPENTINGAN:
-- - HANYA mengubah DEFAULT kolom. Tidak mengubah isi baris apa pun.
-- - Idempotent: boleh dijalankan berulang.
-- - Ringan: tanpa penghapusan, tanpa rebuild tabel, tanpa dampak data.
-- =============================================================================

DO $$
BEGIN
    -- Guard: table mungkin tidak ada pada database baru (dalam hal yang tidak
    -- normal, migration ini tetap tidak menghapus apa pun).
    IF to_regclass('public.place_availability_rules') IS NOT NULL THEN
        ALTER TABLE place_availability_rules
            ALTER COLUMN tersedia SET DEFAULT FALSE;
    END IF;
END $$;
