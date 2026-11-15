-- =============================================================================
-- Menambahkan kolom `jenis` pada tabel notifications.
-- Menyimpan jenis notifikasi (mis. PEMESANAN_BARU, PEMBAYARAN_BERHASIL, dll).
-- =============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS jenis VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_notifications_jenis ON notifications (jenis);