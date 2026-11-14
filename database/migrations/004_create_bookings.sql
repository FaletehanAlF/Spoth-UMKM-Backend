-- =============================================================================
-- Tabel 4.5 Skema Tabel bookings
-- Pemesanan tempat oleh Tenant. `kode_booking` terisi setelah status LUNAS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bookings (
    id               SERIAL PRIMARY KEY,
    kode_booking     VARCHAR(30) UNIQUE,
    place_id         INTEGER NOT NULL REFERENCES places (id) ON DELETE RESTRICT,
    tenant_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    jenis_usaha      VARCHAR(100) NOT NULL,
    tanggal_mulai    DATE NOT NULL,
    tanggal_selesai  DATE NOT NULL,
    jumlah_durasi    INTEGER NOT NULL CHECK (jumlah_durasi > 0),
    total_harga      NUMERIC(14, 2) NOT NULL CHECK (total_harga >= 0),
    komisi_platform  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (komisi_platform >= 0),
    pendapatan_host  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (pendapatan_host >= 0),
    status           VARCHAR(25) NOT NULL DEFAULT 'MENUNGGU_PEMBAYARAN'
                     CHECK (status IN ('MENUNGGU_PEMBAYARAN', 'LUNAS', 'DIBATALKAN')),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Tanggal selesai tidak boleh sebelum tanggal mulai.
    CONSTRAINT ck_bookings_tanggal CHECK (tanggal_selesai >= tanggal_mulai)
);

-- Index untuk riwayat penyewaan dan pengecekan jadwal.
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_place_id ON bookings (place_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_kode ON bookings (kode_booking);

-- Mempercepat pengecekan jadwal bentrok (rentang tanggal per tempat).
CREATE INDEX IF NOT EXISTS idx_bookings_jadwal ON bookings (place_id, tanggal_mulai, tanggal_selesai);
