-- ==============================
-- Tabel master kategori tempat.
-- Sumber data dropdown kategori pada form tambah/edit tempat.
-- Relasi (lunak): categories.nama ≈ places.kategori (VARCHAR 50).
-- is_preset = TRUE untuk kategori bawaan, FALSE untuk kategori custom dari Host.
-- ==============================

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  nama        VARCHAR(50)  NOT NULL UNIQUE,
  is_preset   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by  INTEGER      NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Kategori bawaan (preset).
INSERT INTO categories (nama, is_preset) VALUES
  ('LAPAK_USAHA',     TRUE),
  ('TERAS_KOMERSIAL', TRUE),
  ('BOOTH_EVENT',     TRUE)
ON CONFLICT (nama) DO NOTHING;

-- Daftarkan kategori custom yang SUDAH ADA di places (kalau ada) agar
-- tidak ada kategori yang "hilang" dari dropdown.
INSERT INTO categories (nama, is_preset)
SELECT DISTINCT TRIM(kategori), FALSE
FROM places
WHERE TRIM(kategori) <> ''
  AND TRIM(kategori) NOT IN (SELECT nama FROM categories)
ON CONFLICT (nama) DO NOTHING;
