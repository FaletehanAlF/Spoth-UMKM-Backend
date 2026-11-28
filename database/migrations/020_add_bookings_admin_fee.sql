-- =============================================================================
-- Biaya admin platform per pembayaran (Rp2.000).
--
-- Biaya ini ditambahkan ke total tagihan Tenant dan seluruhnya menjadi
-- pendapatan platform. Data lama tetap 0 karena tidak pernah dikenakan biaya.
-- =============================================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (admin_fee >= 0);

COMMENT ON COLUMN bookings.admin_fee IS
    'Biaya admin platform yang ditambahkan ke total pembayaran Tenant.';
