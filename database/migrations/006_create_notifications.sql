-- =============================================================================
-- Tabel 4.7 Skema Tabel notifications
-- Pemberitahuan aktivitas pemesanan untuk Host dan Tenant.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    judul      VARCHAR(100) NOT NULL,
    pesan      TEXT NOT NULL,
    dibaca     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Kolom tambahan (tidak ada di SRS Tabel 4.7) yang berfungsi menyimpan
    -- data pendukung dalam format JSON, misalnya `booking_id` agar frontend
    -- bisa membuka detail pemesanan langsung dari notifikasi.
    metadata   JSONB
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dibaca ON notifications (user_id, dibaca);
