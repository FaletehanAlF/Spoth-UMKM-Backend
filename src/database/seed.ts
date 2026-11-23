import { randomBytes } from 'node:crypto';

import bcrypt from 'bcrypt';

import { closeDatabasePool, pool } from '../config/database.js';
import { COMMISSION_RATE } from '../config/constants.js';
import { calculatePrice } from '../utils/pricing.js';

/**
 * Mengisi database dengan data contoh (akun, tempat, pemesanan).
 *
 * Hanya boleh dijalankan dengan flag eksplisit:
 *   ALLOW_SEED=true npm run seed
 *
 * Script ini menolak berjalan di production dan menghapus seluruh data
 * (TRUNCATE) sebelum mengisi data contoh. Jangan jalankan pada database
 * yang berisi data nyata.
 *
 * Password akun contoh diambil dari `SEED_PASSWORD`, atau dibuat acak dan
 * TIDAK dicetak ke log. Tidak ada lagi password default yang diketahui publik.
 */

/** Menolak seed pada production atau tanpa flag eksplisit. */
function assertSeedAllowed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seed ditolak: NODE_ENV=production. Data production tidak boleh dihapus atau diisi data contoh.',
    );
  }

  if (process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'Seed ditolak. Jalankan dengan flag eksplisit: ALLOW_SEED=true npm run seed',
    );
  }
}

/** Password akun contoh: dari env, atau acak (tidak pernah dicetak). */
function resolveSeedPassword(): string {
  const fromEnv = process.env.SEED_PASSWORD?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  return randomBytes(18).toString('base64url');
}

const PASSWORD = resolveSeedPassword();

interface SeedUser {
  nama: string;
  email: string;
  role: 'HOST' | 'TENANT';
  no_hp: string;
}

const USERS: SeedUser[] = [
  { nama: 'Budi Santoso', email: 'host@spoth.test', role: 'HOST', no_hp: '081234567890' },
  { nama: 'Siti Aminah', email: 'host2@spoth.test', role: 'HOST', no_hp: '081234567891' },
  { nama: 'Andi Wijaya', email: 'tenant@spoth.test', role: 'TENANT', no_hp: '081234567892' },
  { nama: 'Dewi Lestari', email: 'tenant2@spoth.test', role: 'TENANT', no_hp: '081234567893' },
];

interface SeedPlace {
  nama_tempat: string;
  kategori: 'LAPAK_USAHA' | 'TERAS_KOMERSIAL' | 'BOOTH_EVENT';
  deskripsi: string;
  alamat: string;
  kota: string;
  fasilitas: string;
  aturan: string;
  harga_normal: number;
  harga_promo: number | null;
  tipe_durasi: 'HARIAN' | 'MINGGUAN' | 'BULANAN';
  foto: string[];
}

const PLACES: SeedPlace[] = [
  {
    nama_tempat: 'Teras Ruko Merdeka',
    kategori: 'TERAS_KOMERSIAL',
    deskripsi: 'Teras ruko di jalan raya, cocok untuk kedai kopi atau gerobak makanan.',
    alamat: 'Jl. Merdeka No. 12',
    kota: 'Depok',
    fasilitas: 'Listrik, Meja, Kursi, Parkir, WiFi',
    aturan: 'Tutup pukul 22.00. Dilarang membakar api di dalam teras.',
    harga_normal: 150000,
    harga_promo: 120000,
    tipe_durasi: 'HARIAN',
    foto: [],
  },
  {
    nama_tempat: 'Lapak Josiah 2',
    kategori: 'LAPAK_USAHA',
    deskripsi: 'Lapak nomor 2 di pasar rakyat dengan lalu lintas tinggi setiap hari.',
    alamat: 'Pasar Baru Blok C No. 2',
    kota: 'Depok',
    fasilitas: 'Listrik, Showcase, Air Bersih',
    aturan: 'Jam operasional 06.00 - 20.00. Area tidak boleh dipakai menampung barang dalam jumlah besar.',
    harga_normal: 75000,
    harga_promo: null,
    tipe_durasi: 'HARIAN',
    foto: [],
  },
  {
    nama_tempat: 'Booth Event Kota chaired',
    kategori: 'BOOTH_EVENT',
    deskripsi: 'Booth event indoor di area festival dengan kapasitas hingga 20 orang.',
    alamat: 'Gedung Serbaguna Lt. 3',
    kota: 'Jakarta',
    fasilitas: 'AC, Listrik, Sound System, WiFi',
    aturan: 'Hanya untuk kegiatan event. Kebersihan wajib dijaga.',
    harga_normal: 1500000,
    harga_promo: 1200000,
    tipe_durasi: 'HARIAN',
    foto: [],
  },
  {
    nama_tempat: 'Lapak``: PasarOKE',
    kategori: 'LAPAK_USAHA',
    deskripsi: 'Lapak pinggir jalan dengan akses keluar-masuk kendaraan besar.',
    alamat: 'Jl. Raya Bogor KM 12',
    kota: 'Bogor',
    fasilitas: 'Listrik, Parkir Luas, Air Bersih, Toilet',
    aturan: 'Tidak boleh menyimpan bahan yang mudah terbakar.',
    harga_normal: 200000,
    harga_promo: null,
    tipe_durasi: 'MINGGUAN',
    foto: [],
  },
];

async function seed(): Promise<void> {
  assertSeedAllowed();

  console.log('[seed] ALLOW_SEED=true terdeteksi. Menghapus seluruh data lama...');

  await pool.query('TRUNCATE TABLE notifications, payments, bookings, place_images, places, users RESTART IDENTITY CASCADE');

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  console.log('[seed] Membuat akun pengguna...');

  const userIds = new Map<string, number>();

  for (const user of USERS) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users (nama, email, password_hash, no_hp, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.nama, user.email, passwordHash, user.no_hp, user.role],
    );

    userIds.set(user.email, result.rows[0].id);
  }

  console.log('[seed] Membuat data tempat...');

  const placeIds: number[] = [];

  for (const [index, place] of PLACES.entries()) {
    const hostEmail = index % 2 === 0 ? 'host@spoth.test' : 'host2@spoth.test';
    const hostId = userIds.get(hostEmail);

    const result = await pool.query<{ id: number }>(
      `INSERT INTO places (
         host_id, nama_tempat, kategori, deskripsi, alamat, kota,
         fasilitas, aturan, harga_normal, harga_promo, tipe_durasi
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        hostId,
        place.nama_tempat,
        place.kategori,
        place.deskripsi,
        place.alamat,
        place.kota,
        place.fasilitas,
        place.aturan,
        place.harga_normal,
        place.harga_promo,
        place.tipe_durasi,
      ],
    );

    const placeId = result.rows[0].id;
    placeIds.push(placeId);

    for (const url of place.foto) {
      await pool.query('INSERT INTO place_images (place_id, url_foto) VALUES ($1, $2)', [
        placeId,
        url,
      ]);
    }
  }

  console.log('[seed] Membuat contoh pemesanan & pembayaran...');

  const tenantId = userIds.get('tenant@spoth.test');
  const hostId = userIds.get('host@spoth.test');

  const contohPemesanan = [
    {
      place_id: placeIds[0],
      tenant_id: tenantId,
      jenis_usaha: 'Kedai kopi',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-03',
      jumlah_durasi: 3,
      status: 'LUNAS' as const,
    },
    {
      place_id: placeIds[1],
      tenant_id: tenantId,
      jenis_usaha: 'Warung البيت',
      tanggal_mulai: '2026-12-05',
      tanggal_selesai: '2026-12-05',
      jumlah_durasi: 1,
      status: 'MENUNGGU_PEMBAYARAN' as const,
    },
  ];

  for (const [index, pemesanan] of contohPemesanan.entries()) {
    const placeResult = await pool.query<{ harga_normal: string; harga_promo: string | null }>(
      'SELECT harga_normal, harga_promo FROM places WHERE id = $1',
      [pemesanan.place_id],
    );

    const place = placeResult.rows[0];
    const harga = calculatePrice(
      Number(place.harga_normal),
      place.harga_promo === null ? null : Number(place.harga_promo),
      pemesanan.jumlah_durasi,
      COMMISSION_RATE,
    );

    const kodeBooking =
      pemesanan.status === 'LUNAS'
        ? `SPOTH-${pemesanan.tanggal_mulai.replace(/-/g, '')}-${String(index + 1).padStart(4, '0')}`
        : null;

    const bookingResult = await pool.query<{ id: number }>(
      `INSERT INTO bookings (
         kode_booking, place_id, tenant_id, jenis_usaha, tanggal_mulai,
         tanggal_selesai, jumlah_durasi, total_harga, komisi_platform,
         pendapatan_host, status
       )
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        kodeBooking,
        pemesanan.place_id,
        pemesanan.tenant_id,
        pemesanan.jenis_usaha,
        pemesanan.tanggal_mulai,
        pemesanan.tanggal_selesai,
        pemesanan.jumlah_durasi,
        harga.total_harga,
        harga.komisi_platform,
        harga.pendapatan_host,
        pemesanan.status,
      ],
    );

    const bookingId = bookingResult.rows[0].id;

    if (pemesanan.status === 'LUNAS') {
      await pool.query(
        `INSERT INTO payments (booking_id, metode, jumlah, status, paid_at)
         VALUES ($1, 'SIMULASI', $2, 'BERHASIL', NOW())`,
        [bookingId, harga.total_harga],
      );

      await pool.query(
        `INSERT INTO notifications (user_id, judul, pesan, metadata)
         VALUES ($1, 'Pembayaran berhasil', $2, $3::jsonb)`,
        [
          pemesanan.tenant_id,
          'Pembayaran untuk tempat contoh berhasil.',
          JSON.stringify({ booking_id: String(bookingId), tipe: 'PEMBAYARAN_BERHASIL' }),
        ],
      );

      await pool.query(
        `INSERT INTO notifications (user_id, judul, pesan, metadata)
         VALUES ($1, 'Pembayaran diterima', $2, $3::jsonb)`,
        [
          hostId,
          'Tenant telah membayar tempat contoh Anda.',
          JSON.stringify({ booking_id: String(bookingId), tipe: 'PEMBAYARAN_BERHASIL' }),
        ],
      );
    }
  }

  console.log('');
  console.log('[seed] Selesai. Data contoh berhasil dibuat.');
  console.log('');
  console.log('Akun yang tersedia (password mengikuti SEED_PASSWORD atau acak):');
  console.log('  - Host   : host@spoth.test   (Budi Santoso)');
  console.log('  - Host   : host2@spoth.test  (Siti Aminah)');
  console.log('  - Tenant : tenant@spoth.test (Andi Wijaya)');
  console.log('  - Tenant : tenant2@spoth.test (Dewi Lestari)');
  console.log('');
}

seed()
  .then(async () => {
    await closeDatabasePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[seed] Gagal menjalankan seed:', error);
    await closeDatabasePool();
    process.exit(1);
  });
