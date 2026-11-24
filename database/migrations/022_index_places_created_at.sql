-- Mempercepat daftar "tempat terbaru" di beranda penyewa.
-- Query beranda mengurutkan places berdasarkan created_at menurun.
CREATE INDEX IF NOT EXISTS idx_places_created_at ON places (created_at DESC, id DESC);
