-- =============================================================================
-- 009_create_place_availability_rules.sql
-- Aturan ketersediaan tempat berbasis tanggal/hari/bulan (SRS Subbab 3.3).
-- Host dapat menentukan periode/jadwal kapan tempat tersedia atau tidak.
--
-- Catatan produk: aturan BARU default `tersedia = FALSE` ("Tidak tersedia").
-- Host harus mengubahnya secara eksplisit bila ingin menandai tersedia.
-- =============================================================================

CREATE TABLE IF NOT EXISTS place_availability_rules (
    id              SERIAL PRIMARY KEY,
    place_id        INTEGER NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    tipe_aturan     VARCHAR(15) NOT NULL
                    CHECK (tipe_aturan IN ('TANGGAL', 'HARI', 'BULAN')),
    tanggal_mulai   DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    hari            INTEGER CHECK (hari IS NULL OR (hari BETWEEN 0 AND 6)),
    bulan           INTEGER CHECK (bulan IS NULL OR (bulan BETWEEN 1 AND 12)),
    tersedia        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_avail_tanggal CHECK (tanggal_selesai >= tanggal_mulai),
    CONSTRAINT ck_avail_tipe CHECK (
        (tipe_aturan = 'TANGGAL' AND hari IS NULL AND bulan IS NULL) OR
        (tipe_aturan = 'HARI'   AND hari IS NOT NULL AND bulan IS NULL) OR
        (tipe_aturan = 'BULAN'  AND bulan IS NOT NULL AND hari IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_avail_place_id ON place_availability_rules (place_id);
CREATE INDEX IF NOT EXISTS idx_avail_tanggal ON place_availability_rules (place_id, tanggal_mulai, tanggal_selesai);