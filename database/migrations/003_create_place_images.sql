-- =============================================================================
-- Tabel 4.4 Skema Tabel place_images
-- Foto-foto dari sebuah tempat (relasi 1:N dari `places`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS place_images (
    id        SERIAL PRIMARY KEY,
    place_id  INTEGER NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    url_foto  VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_images_place_id ON place_images (place_id);
