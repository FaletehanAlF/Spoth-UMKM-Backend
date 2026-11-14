-- =============================================================================
-- Tabel 4.2 Skema Tabel users
-- Menyimpan akun Host sekaligus Tenant, dibedakan lewat kolom `role`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    nama          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    no_hp         VARCHAR(20),
    role          VARCHAR(10) NOT NULL CHECK (role IN ('HOST', 'TENANT')),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Mempercepat pencarian akun berdasarkan email.
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
