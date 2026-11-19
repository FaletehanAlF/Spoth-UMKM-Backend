-- =============================================================================
-- 012_add_user_token_version.sql
-- Menambahkan kolom token_version ke tabel users.
--
-- Tujuan: mendukung pembatalan sesi secara terkontrol (logout membatalkan
-- seluruh sesi user), bukan sekadar menunggu token kedaluwarsa.
--
-- KEPENTINGAN:
-- - Additif & backward-compatible: tidak mengubah baris apa pun.
-- - Idempotent: boleh dijalankan berulang.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
