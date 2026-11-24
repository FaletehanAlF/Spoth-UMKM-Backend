-- =============================================================================
-- Pembatasan harga: hanya satu kolom `harga` (tanpa promo).
-- =============================================================================

ALTER TABLE places DROP CONSTRAINT IF EXISTS ck_places_harga_promo;
DROP INDEX IF EXISTS idx_places_harga;

ALTER TABLE places ADD COLUMN IF NOT EXISTS harga NUMERIC(12, 2);

UPDATE places
SET harga = COALESCE(harga_promo, harga_normal)
WHERE harga IS NULL;

ALTER TABLE places ALTER COLUMN harga SET NOT NULL;
ALTER TABLE places ADD CONSTRAINT ck_places_harga CHECK (harga > 0);

ALTER TABLE places DROP COLUMN IF EXISTS harga_normal;
ALTER TABLE places DROP COLUMN IF EXISTS harga_promo;

CREATE INDEX IF NOT EXISTS idx_places_harga ON places (harga);
