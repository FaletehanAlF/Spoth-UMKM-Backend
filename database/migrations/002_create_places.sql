-- =============================================================================
-- Tabel 4.3 Skema Tabel places
-- Tempat yang disewakan oleh Host (lapak usaha, teras komersial, booth event).
-- =============================================================================

CREATE TABLE IF NOT EXISTS places (
    id           SERIAL PRIMARY KEY,
    host_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    nama_tempat  VARCHAR(150) NOT NULL,
    kategori     VARCHAR(30) NOT NULL
                 CHECK (kategori IN ('LAPAK_USAHA', 'TERAS_KOMERSIAL', 'BOOTH_EVENT')),
    deskripsi    TEXT,
    alamat       VARCHAR(255) NOT NULL,
    kota         VARCHAR(80) NOT NULL,
    fasilitas    TEXT,
    aturan       TEXT,
    harga_normal NUMERIC(12, 2) NOT NULL CHECK (harga_normal > 0),
    harga_promo  NUMERIC(12, 2) CHECK (harga_promo IS NULL OR harga_promo > 0),
    tipe_durasi  VARCHAR(15) NOT NULL
                 CHECK (tipe_durasi IN ('HARIAN', 'MINGGUAN', 'BULANAN')),
    status       VARCHAR(15) NOT NULL DEFAULT 'AKTIF'
                 CHECK (status IN ('AKTIF', 'NONAKTIF')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Harga promo tidak boleh lebih besar dari harga normal
    -- (SRS Tabel 4.8 No. 10: harga promo lebih besar harus ditolak).
    CONSTRAINT ck_places_harga_promo CHECK (
        harga_promo IS NULL OR harga_promo <= harga_normal
    )
);

-- Index untuk pencarian & filter tempat.
CREATE INDEX IF NOT EXISTS idx_places_host_id ON places (host_id);
CREATE INDEX IF NOT EXISTS idx_places_kategori ON places (kategori);
CREATE INDEX IF NOT EXISTS idx_places_status ON places (status);
CREATE INDEX IF NOT EXISTS idx_places_tipe_durasi ON places (tipe_durasi);
CREATE INDEX IF NOT EXISTS idx_places_harga ON places (COALESCE(harga_promo, harga_normal));

-- Mempercepat pencarian teks (nama, deskripsi, kota, fasilitas).
CREATE INDEX IF NOT EXISTS idx_places_search ON places
    USING GIN (to_tsvector('simple', nama_tempat || ' ' || COALESCE(deskripsi, '') || ' ' || kota));
