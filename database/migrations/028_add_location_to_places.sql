-- Tambah koordinat lokasi (opsional) agar tempat bisa ditampilkan di peta.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
