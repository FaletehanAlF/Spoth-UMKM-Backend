-- =============================================================================
-- MIGRASI PENYESUAIAN SKEMA KE SRS (008_reset_to_srs_schema.sql)
--
-- Tujuan: menyelaraskan skema database yang sudah dibuat manual dengan skema
-- yang diharapkan oleh backend Spoth UMKM (SRS Subbab 4.2.2, Tabel 4.2-4.7).
--
-- KEAMANAN DATA (WAJIB DIBACA):
-- Berkas ini TIDAK PERNAH menghapus data bisnis secara otomatis. Penghapusan
-- hanya dijalankan bila KETIGA syarat berikut terpenuhi:
--   1. Skema legacy terdeteksi (places.user_id / bookings.user_id, atau
--      constraint role lama 'penyewa'/'pemilik').
--   2. Seluruh tabel bisnis benar-benar kosong (0 baris).
--   3. Operator secara eksplisit mengaktifkan reset lewat environment
--      variable ALLOW_DESTRUCTIVE_MIGRATION=true (migrate.ts akan
--      men-set GUC app.allow_destructive_reset untuk sesi migrasi).
-- Bila salah satu syarat tidak terpenuhi, migrasi DIBATALKAN dengan error
-- yang jelas sehingga tidak ada data yang hilang. Riwayat migrasi pada
-- app_meta.schema_migrations TIDAK pernah dihapus oleh berkas ini.
--
-- Pada database baru, bagian reset dilewati dan seluruh CREATE TABLE
-- IF NOT EXISTS di bawah tetap membangun skema SRS secara lengkap.
--
-- Perbedaan utama dengan skema manual sebelumnya:
--   - users.role: 'penyewa'/'pemilik'  -> 'TENANT'/'HOST'
--   - users.created_at ditambahkan
--   - places.user_id                 -> host_id
--   - places ditambahkan: deskripsi, kota, fasilitas, aturan, status,
--     created_at, updated_at, serta CHECK constraints
--   - bookings.user_id               -> tenant_id
--   - bookings.kode_booking          -> BOLEH NULL (terisi setelah LUNAS)
--   - bookings ditambahkan: jenis_usaha, jumlah_durasi, pendapatan_host,
--     created_at, status default & CHECK, constraint tanggal
--   - payments ditambahkan: created_at, status CHECK, jumlah CHECK
--   - notifications ditambahkan: created_at, metadata (JSONB), jenis
--
-- Tabel detail transaksi (payment_details) TIDAK dibuat terpisah karena:
--   - payments.jumlah = total yang dibayar
--   - breakdown (harga_satuan, jumlah_durasi, komisi_platform, pendapatan_host,
--     tanggal_mulai/selesai, jenis_usaha) sudah ada di bookings
--   - detail tempat ada di places
--   Relasi: payment (1) -> booking (1) -> place (1). Detail = JOIN.
--   Jika tetap ingin tabel itemization, lihat bagian OPSIONAL di bawah.
-- =============================================================================

-- Hapus tabel lama (urutan: anak dulu, baru induk) HANYA pada skema legacy
-- yang kosong dan sudah diizinkan secara eksplisit.
DO $$
DECLARE
    is_legacy        BOOLEAN := FALSE;
    has_business_data BOOLEAN := FALSE;
    allow_reset      TEXT;
    tbl              TEXT;
BEGIN
    allow_reset := COALESCE(current_setting('app.allow_destructive_reset', TRUE), '');

    -- Deteksi skema legacy: kolom user_id pada places/bookings, atau
    -- constraint role lama yang masih memakai 'penyewa'/'pemilik'.
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'places'
          AND column_name = 'user_id'
    ) OR EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'user_id'
    ) OR EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND pg_get_constraintdef(oid) LIKE '%penyewa%'
    ) INTO is_legacy;

    IF NOT is_legacy THEN
        RAISE NOTICE '008: skema sudah sesuai SRS. Reset destruktif dilewati.';
        RETURN;
    END IF;

    IF allow_reset <> 'on' THEN
        RAISE EXCEPTION
            '008 dibatalkan: skema legacy terdeteksi. Jalankan ulang dengan ALLOW_DESTRUCTIVE_MIGRATION=true HANYA jika seluruh data bisnis memang boleh dihapus. Tidak ada data yang dihapus.';
    END IF;

    -- Lapisan kedua: pastikan tidak ada satu pun baris data bisnis.
    FOREACH tbl IN ARRAY ARRAY[
        'notifications', 'payments', 'bookings', 'place_images', 'places', 'users'
    ]::text[]
    LOOP
        IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', tbl)
                INTO has_business_data;

            IF has_business_data THEN
                RAISE EXCEPTION
                    '008 dibatalkan: tabel % masih berisi data bisnis. Reset tidak dijalankan agar data tidak hilang.', tbl;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '008: skema legacy kosong + reset diizinkan. Tabel lama dihapus dan dibangun ulang sesuai SRS.';

    -- Penghapusan dijalankan DI DALAM blok ini supaya tidak pernah terjadi
    -- ketika skema sudah benar atau ketika data bisnis masih ada.
    EXECUTE 'DROP TABLE IF EXISTS notifications CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS payments CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS bookings CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS place_images CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS places CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS users CASCADE';
END $$;

-- Skema pelacakan migrasi (dibuat oleh backend migrate.ts). Dibuat di sini
-- supaya berkas ini bisa dijalankan langsung di DBeaver tanpa backend.
CREATE SCHEMA IF NOT EXISTS app_meta;
CREATE TABLE IF NOT EXISTS app_meta.schema_migrations (
    filename   VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 001_create_users.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    nama          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    no_hp         VARCHAR(20),
    role          VARCHAR(10) NOT NULL CHECK (role IN ('HOST', 'TENANT')),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- 002_create_places.sql
-- ---------------------------------------------------------------------------
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

    CONSTRAINT ck_places_harga_promo CHECK (
        harga_promo IS NULL OR harga_promo <= harga_normal
    )
);

CREATE INDEX IF NOT EXISTS idx_places_host_id ON places (host_id);
CREATE INDEX IF NOT EXISTS idx_places_kategori ON places (kategori);
CREATE INDEX IF NOT EXISTS idx_places_status ON places (status);
CREATE INDEX IF NOT EXISTS idx_places_tipe_durasi ON places (tipe_durasi);
CREATE INDEX IF NOT EXISTS idx_places_harga ON places (COALESCE(harga_promo, harga_normal));

CREATE INDEX IF NOT EXISTS idx_places_search ON places
    USING GIN (to_tsvector('simple', nama_tempat || ' ' || COALESCE(deskripsi, '') || ' ' || kota));

-- ---------------------------------------------------------------------------
-- 003_create_place_images.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS place_images (
    id        SERIAL PRIMARY KEY,
    place_id  INTEGER NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    url_foto  VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_images_place_id ON place_images (place_id);

-- ---------------------------------------------------------------------------
-- 004_create_bookings.sql
-- ---------------------------------------------------------------------------
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

    CONSTRAINT ck_bookings_tanggal CHECK (tanggal_selesai >= tanggal_mulai)
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_place_id ON bookings (place_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_kode ON bookings (kode_booking);
CREATE INDEX IF NOT EXISTS idx_bookings_jadwal ON bookings (place_id, tanggal_mulai, tanggal_selesai);

-- ---------------------------------------------------------------------------
-- 005_create_payments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id         SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
    metode     VARCHAR(30) NOT NULL,
    jumlah     NUMERIC(14, 2) NOT NULL CHECK (jumlah >= 0),
    status     VARCHAR(15) NOT NULL CHECK (status IN ('BERHASIL', 'GAGAL')),
    paid_at    TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);

-- ---------------------------------------------------------------------------
-- 006_create_notifications.sql + 007_add_notification_jenis.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    judul      VARCHAR(100) NOT NULL,
    pesan      TEXT NOT NULL,
    dibaca     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata   JSONB,
    jenis      VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dibaca ON notifications (user_id, dibaca);
CREATE INDEX IF NOT EXISTS idx_notifications_jenis ON notifications (jenis);

-- =============================================================================
-- OPSIONAL (TIDAK DIBUAT OTOMATIS): tabel payment_details
-- Hanya buat jika Anda benar-benar ingin itemization terpisah. Untuk alur
-- Spoth UMKM saat ini, detail transaksi sudah cukup di bookings + places.
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS payment_details (
--     id          SERIAL PRIMARY KEY,
--     payment_id  INTEGER NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
--     item_label  VARCHAR(150) NOT NULL,   -- mis. "Sewa Lapak Kuliner Baru"
--     jumlah      NUMERIC(14, 2) NOT NULL, -- harga_satuan
--     qty         INTEGER NOT NULL DEFAULT 1, -- jumlah_durasi
--     subtotal    NUMERIC(14, 2) NOT NULL,
--     created_at  TIMESTAMP NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_payment_details_payment_id ON payment_details (payment_id);
