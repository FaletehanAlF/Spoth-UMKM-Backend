-- =============================================================================
-- Tabel 4.6 Skema Tabel payments
-- Pembayaran simulasi (KNF-13: tidak memindahkan uang sungguhan).
-- Satu pemesanan dibayar lewat satu pembayaran (relasi 1:1).
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id         SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
    metode     VARCHAR(30) NOT NULL,
    jumlah     NUMERIC(14, 2) NOT NULL CHECK (jumlah >= 0),
    status     VARCHAR(15) NOT NULL CHECK (status IN ('BERHASIL', 'GAGAL')),
    paid_at    TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
