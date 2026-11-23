-- =============================================================================
-- Snapshot data contoh SPOTH UMKM.
-- Dihasilkan otomatis dari database (npm run seed).
--
-- Catatan: file ini hanya SALINAN data contoh, bukan sumber utama.
-- Sumber utama data contoh adalah `src/database/seed.ts`.
-- Gunakan `npm run seed` untuk mengisi ulang database.
-- =============================================================================

TRUNCATE TABLE notifications, payments, bookings, place_images, places, users RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------- users (6 baris)
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (1, 'Budi Santoso', 'host@spoth.test', '$2b$12$u4ZG4fvd3fhJ5LZdPqjWduhtbzjP6h2FFT4m//T8lMTTKP.8DZgl.', '081234567890', 'HOST', '2026-11-13T19:29:07.663Z');
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (2, 'Siti Aminah', 'host2@spoth.test', '$2b$12$u4ZG4fvd3fhJ5LZdPqjWduhtbzjP6h2FFT4m//T8lMTTKP.8DZgl.', '081234567891', 'HOST', '2026-11-13T19:29:07.726Z');
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (3, 'Andi Wijaya', 'tenant@spoth.test', '$2b$12$u4ZG4fvd3fhJ5LZdPqjWduhtbzjP6h2FFT4m//T8lMTTKP.8DZgl.', '081234567892', 'TENANT', '2026-11-13T19:29:07.781Z');
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (4, 'Dewi Lestari', 'tenant2@spoth.test', '$2b$12$u4ZG4fvd3fhJ5LZdPqjWduhtbzjP6h2FFT4m//T8lMTTKP.8DZgl.', '081234567893', 'TENANT', '2026-11-13T19:29:07.847Z');
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (6, 'Host E2E', 'host.e2e.1794623372594@spoth.test', '$2b$12$GkW7vhs6YEJ7yhMsw8NJ8.eKmIYf4nniJtl9R3D74hvUMU3lzBmcm', '081234500002', 'HOST', '2026-11-13T19:29:49.861Z');
INSERT INTO users (id, nama, email, password_hash, no_hp, role, created_at) VALUES (5, 'Tenant E2E Updated', 'tenant.e2e.1794623372594@spoth.test', '$2b$12$hbkvsQ36vT1ya8keHgR45uPL3UQJu4jhvL76AEe/GC8gniO4sWg1i', '081234500099', 'TENANT', '2026-11-13T19:29:49.366Z');

-- ---------------------------------------------------------------- places (5 baris)
INSERT INTO places (id, host_id, nama_tempat, kategori, deskripsi, alamat, kota, fasilitas, aturan, harga_normal, harga_promo, tipe_durasi, created_at, updated_at) VALUES (1, 1, 'Teras Ruko Merdeka', 'TERAS_KOMERSIAL', 'Teras ruko di jalan raya, cocok untuk kedai kopi atau gerobak makanan.', 'Jl. Merdeka No. 12', 'Depok', 'Listrik, Meja, Kursi, Parkir, WiFi', 'Tutup pukul 22.00. Dilarang membakar api di dalam teras.', '150000.00', '120000.00', 'HARIAN', '2026-11-13T19:29:07.907Z', '2026-11-13T19:29:07.907Z');
INSERT INTO places (id, host_id, nama_tempat, kategori, deskripsi, alamat, kota, fasilitas, aturan, harga_normal, harga_promo, tipe_durasi, created_at, updated_at) VALUES (2, 2, 'Lapak Josiah 2', 'LAPAK_USAHA', 'Lapak nomor 2 di pasar rakyat dengan lalu lintas tinggi setiap hari.', 'Pasar Baru Blok C No. 2', 'Depok', 'Listrik, Showcase, Air Bersih', 'Jam operasional 06.00 - 20.00. Area tidak boleh dipakai menampung barang dalam jumlah besar.', '75000.00', NULL, 'HARIAN', '2026-11-13T19:29:07.991Z', '2026-11-13T19:29:07.991Z');
INSERT INTO places (id, host_id, nama_tempat, kategori, deskripsi, alamat, kota, fasilitas, aturan, harga_normal, harga_promo, tipe_durasi, created_at, updated_at) VALUES (3, 1, 'Booth Event Kota chaired', 'BOOTH_EVENT', 'Booth event indoor di area festival dengan kapasitas hingga 20 orang.', 'Gedung Serbaguna Lt. 3', 'Jakarta', 'AC, Listrik, Sound System, WiFi', 'Hanya untuk kegiatan event. Kebersihan wajib dijaga.', '1500000.00', '1200000.00', 'HARIAN', '2026-11-13T19:29:08.072Z', '2026-11-13T19:29:08.072Z');
INSERT INTO places (id, host_id, nama_tempat, kategori, deskripsi, alamat, kota, fasilitas, aturan, harga_normal, harga_promo, tipe_durasi, created_at, updated_at) VALUES (4, 2, 'Lapak``: PasarOKE', 'LAPAK_USAHA', 'Lapak pinggir jalan dengan akses keluar-masuk kendaraan besar.', 'Jl. Raya Bogor KM 12', 'Bogor', 'Listrik, Parkir Luas, Air Bersih, Toilet', 'Tidak boleh menyimpan bahan yang mudah terbakar.', '200000.00', NULL, 'MINGGUAN', '2026-11-13T19:29:08.139Z', '2026-11-13T19:29:08.139Z');
INSERT INTO places (id, host_id, nama_tempat, kategori, deskripsi, alamat, kota, fasilitas, aturan, harga_normal, harga_promo, tipe_durasi, created_at, updated_at) VALUES (5, 6, 'Teras Ruko Merdeka E2E', 'TERAS_KOMERSIAL', 'Teras ruko untuk kedai kopi.', 'Jl. Merdeka No. 12', 'Depok', 'Listrik, Meja, Kursi, Parkir, WiFi', 'Tutup pukul 22.00', '150000.00', '120000.00', 'HARIAN', '2026-11-13T19:29:51.538Z', '2026-11-13T19:29:51.788Z');

-- ---------------------------------------------------------------- place_images (1 baris)
INSERT INTO place_images (id, place_id, url_foto) VALUES (1, 5, '/uploads/contoh-teras.jpg');

-- ---------------------------------------------------------------- bookings (3 baris)
INSERT INTO bookings (id, kode_booking, place_id, tenant_id, jenis_usaha, tanggal_mulai, tanggal_selesai, jumlah_durasi, total_harga, komisi_platform, pendapatan_host, status, created_at) VALUES (1, 'SPOTH-20261201-0001', 1, 3, 'Kedai kopi', '2026-11-30T17:00:00.000Z', '2026-12-02T17:00:00.000Z', 3, '360000.00', '36000.00', '324000.00', 'LUNAS', '2026-11-13T19:29:08.272Z');
INSERT INTO bookings (id, kode_booking, place_id, tenant_id, jenis_usaha, tanggal_mulai, tanggal_selesai, jumlah_durasi, total_harga, komisi_platform, pendapatan_host, status, created_at) VALUES (2, NULL, 2, 3, 'Warung البيت', '2026-12-04T17:00:00.000Z', '2026-12-04T17:00:00.000Z', 1, '75000.00', '7500.00', '67500.00', 'MENUNGGU_PEMBAYARAN', '2026-11-13T19:29:08.573Z');
INSERT INTO bookings (id, kode_booking, place_id, tenant_id, jenis_usaha, tanggal_mulai, tanggal_selesai, jumlah_durasi, total_harga, komisi_platform, pendapatan_host, status, created_at) VALUES (3, 'SPOTH-20261214-0001', 5, 5, 'Kedai kopi', '2026-12-13T17:00:00.000Z', '2026-12-15T17:00:00.000Z', 3, '360000.00', '36000.00', '324000.00', 'DIBATALKAN', '2026-11-13T19:29:54.403Z');

-- ---------------------------------------------------------------- payments (2 baris)
INSERT INTO payments (id, booking_id, metode, jumlah, status, paid_at, created_at) VALUES (1, 1, 'SIMULASI', '360000.00', 'BERHASIL', '2026-11-13T19:29:08.339Z', '2026-11-13T19:29:08.339Z');
INSERT INTO payments (id, booking_id, metode, jumlah, status, paid_at, created_at) VALUES (2, 3, 'SIMULASI', '360000.00', 'BERHASIL', '2026-11-13T19:29:55.980Z', '2026-11-13T19:29:55.980Z');

-- ---------------------------------------------------------------- notifications (6 baris)
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (1, 3, 'Pembayaran berhasil', 'Pembayaran untuk tempat contoh berhasil.', FALSE, '2026-11-13T19:29:08.404Z', '[object Object]');
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (2, 1, 'Pembayaran diterima', 'Tenant telah membayar tempat contoh Anda.', FALSE, '2026-11-13T19:29:08.459Z', '[object Object]');
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (3, 6, 'Pemesanan baru masuk', 'Teras Ruko Merdeka E2E dipesan oleh tenant pada 2026-12-14 s.d. 2026-12-16. Total 360000.', FALSE, '2026-11-13T19:29:54.403Z', '[object Object]');
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (5, 6, 'Pembayaran diterima', 'Tenant telah membayar Teras Ruko Merdeka E2E. Pendapatan Anda: 324000.', FALSE, '2026-11-13T19:29:55.980Z', '[object Object]');
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (4, 5, 'Pembayaran berhasil', 'Pembayaran untuk Teras Ruko Merdeka E2E berhasil. Kode booking Anda: SPOTH-20261214-0001.', TRUE, '2026-11-13T19:29:55.980Z', '[object Object]');
INSERT INTO notifications (id, user_id, judul, pesan, dibaca, created_at, metadata) VALUES (6, 6, 'Pemesanan dibatalkan', 'Pemesanan Teras Ruko Merdeka E2E oleh tenant telah dibatalkan.', FALSE, '2026-11-13T19:29:59.000Z', '[object Object]');
