-- ==============================
-- Allow custom place categories.
-- Drop the CHECK constraint on places.kategori so owners can input
-- custom category names (e.g., "Warung Minuman", "Gallery").
-- ==============================

ALTER TABLE places
  ALTER COLUMN kategori TYPE VARCHAR(50);

ALTER TABLE places
  DROP CONSTRAINT IF EXISTS places_kategori_check;

COMMENT ON COLUMN places.kategori IS 'Kategori tempat; sudah tersedia LAPAK_USAHA, TERAS_KOMERSIAL, BOOTH_EVENT dan kategori lain dari pemilik (cara input: kategori custom saat membuat tempat).';
