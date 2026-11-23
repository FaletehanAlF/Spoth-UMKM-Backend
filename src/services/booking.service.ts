import { pool, withTransaction } from '../config/database.js';
import { COMMISSION_RATE } from '../config/constants.js';
import type { Queryable } from '../types/database.js';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_CODE_PREFIX,
  BOOKING_STATUS,
} from '../types/domain.js';
import { AppError, conflict, forbidden, notFound } from '../utils/app-error.js';
import { calculateEndDate, today } from '../utils/date.js';
import { buildPaginatedResult, toOffset, type PaginatedResult } from '../utils/pagination.js';
import { calculatePrice } from '../utils/pricing.js';
import {
  findScheduleConflicts,
} from './place.service.js';
import {
  getAvailabilityPeriodConflicts,
} from './availability.logic.js';
import { findAvailabilityRuleConflicts } from './placeAvailability.service.js';
import type { PlaceRow } from '../types/place.types.js';
import { createNotification } from './notification.service.js';
import type {
  BookingQuery,
  BookingResponse,
  BookingRow,
  CreateBookingInput,
  PricePreviewResponse,
} from '../types/booking.types.js';

/** Kolom yang selalu diambil saat membaca data pemesanan. */
const BOOKING_COLUMNS = `
  b.id::text              AS id,
  b.kode_booking          AS kode_booking,
  b.place_id::text        AS place_id,
  b.tenant_id::text       AS tenant_id,
  b.jenis_usaha           AS jenis_usaha,
  b.tanggal_mulai::text   AS tanggal_mulai,
  b.tanggal_selesai::text AS tanggal_selesai,
  b.jumlah_durasi         AS jumlah_durasi,
  b.total_harga           AS total_harga,
  b.komisi_platform       AS komisi_platform,
  b.pendapatan_host       AS pendapatan_host,
  b.status                AS status,
  b.created_at            AS created_at,
  p.nama_tempat           AS nama_tempat,
  p.kategori              AS kategori,
  p.alamat                AS alamat,
  p.kecamatan                  AS kecamatan,
  p.host_id::text         AS host_id,
  tenant.nama             AS nama_tenant,
  host.nama               AS nama_host,
  (SELECT COALESCE(array_agg(pi.url_foto), '{}')
   FROM place_images pi WHERE pi.place_id = p.id) AS foto
`;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

/** Mengubah baris database menjadi bentuk respons API. */
export function toBookingResponse(row: BookingRow): BookingResponse {
  const totalHarga = toNumber(row.total_harga);

  return {
    id: row.id,
    kode_booking: row.kode_booking,
    place_id: row.place_id,
    tenant_id: row.tenant_id,
    host_id: row.host_id,
    jenis_usaha: row.jenis_usaha,
    tanggal_mulai: row.tanggal_mulai,
    tanggal_selesai: row.tanggal_selesai,
    jumlah_durasi: row.jumlah_durasi,
    // Harga per satuan diturunkan dari total harga agar selalu konsisten
    // dengan rincian biaya yang tersimpan.
    harga_satuan:
      row.jumlah_durasi > 0 ? Math.round((totalHarga / row.jumlah_durasi) * 100) / 100 : 0,
    total_harga: totalHarga,
    komisi_platform: toNumber(row.komisi_platform),
    pendapatan_host: toNumber(row.pendapatan_host),
    status: row.status,
    created_at: row.created_at?.toISOString(),
    nama_tempat: row.nama_tempat,
    kategori: row.kategori,
    alamat: row.alamat,
    kecamatan: row.kecamatan,
    nama_tenant: row.nama_tenant,
    nama_host: row.nama_host,
    foto: row.foto ?? [],
  };
}

/**
 * Membuat kode booking unik untuk E-Pass.
 *
 * Format: `SPOTH-<YYYYMMDD>-<nomor urut 4 digit>`, contoh `SPOTH-20261201-0001`.
 *
 * `pg_advisory_xact_lock` dipakai agar hanya satu transaksi yang boleh
 * menghitung nomor urut untuk tanggal yang sama. Tanpa ini, dua pembayaran
 * yang terjadi bersamaan bisa mendapat kode booking yang sama.
 */
export async function generateKodeBooking(
  tanggalMulai: string,
  client: Queryable = pool,
): Promise<string> {
  const tanggal = tanggalMulai.replace(/-/g, '');
  const prefix = `${BOOKING_CODE_PREFIX}-${tanggal}`;

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`spoth_kode_${prefix}`]);

  const result = await client.query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM bookings WHERE kode_booking LIKE $1',
    [`${prefix}-%`],
  );

  const nextNumber = toNumber(result.rows[0]?.total) + 1;

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Membuat pemesanan baru (SRS Tabel 3.1 Fitur "Pemesanan").
 *
 * Alur:
 * 1. Validasi tempat ada dan masih dalam periode ketersediaan.
 * 2. Mengunci baris tempat (`SELECT ... FOR UPDATE`) supaya dua permintaan
 *    bersamaan untuk tempat yang sama tidak bisa lolos pengecekan jadwal.
 * 3. Mengecek bentrok jadwal (Fitur "Validasi Ketersediaan").
 * 4. Menghitung total harga, komisi 10%, dan pendapatan host.
 * 5. Menyimpan pemesanan dengan status MENUNGGU_PEMBAYARAN.
 */
export async function createBooking(
  tenantId: string,
  input: CreateBookingInput,
): Promise<BookingResponse> {
  const placeId = String(input.place_id);

  if (input.tanggal_mulai < today()) {
    throw new AppError('Tanggal mulai sewa tidak boleh di masa lalu', 400);
  }

  const result = await withTransaction(async (client) => {
    // Kunci baris tempat: semua pemesanan untuk tempat ini akan berurutan.
    const placeResult = await client.query<PlaceRow>(
      `SELECT id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
              alamat, kecamatan, fasilitas, aturan, harga,
              tipe_durasi, created_at, updated_at,
              tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
              tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia
       FROM places
       WHERE id = $1::integer
       FOR UPDATE`,
      [placeId],
    );

    const place = placeResult.rows[0];

    if (!place) {
      throw notFound('Tempat tidak ditemukan');
    }

    if (place.host_id === tenantId) {
      throw new AppError('Anda tidak bisa menyewa tempat milik Anda sendiri', 400);
    }

    // Batas periode tempat dapat disewa (jika diatur).
    const tanggalSelesai = calculateEndDate(
      input.tanggal_mulai,
      place.tipe_durasi,
      input.jumlah_durasi,
    );

    const periodConflicts = getAvailabilityPeriodConflicts(
      place,
      input.tanggal_mulai,
      tanggalSelesai,
    );

    if (periodConflicts.length > 0) {
      throw new AppError('Tanggal sewa berada di luar periode ketersediaan tempat', 400);
    }

    // Aturan ketersediaan (TANGGAL/HARI/BULAN). Memakai client transaksi yang
    // sama dengan pengecekan jadwal agar snapshot datanya konsisten.
    const ruleConflicts = await findAvailabilityRuleConflicts(
      placeId,
      input.tanggal_mulai,
      tanggalSelesai,
      client,
    );

    if (ruleConflicts.length > 0) {
      throw conflict('Jadwal tidak tersedia berdasarkan aturan ketersediaan tempat');
    }

    // Validasi ketersediaan jadwal.
    const konflik = await findScheduleConflicts(
      placeId,
      input.tanggal_mulai,
      tanggalSelesai,
      client,
    );

    if (konflik.length > 0) {
      throw conflict(
        `Jadwal bentrok. Tempat sudah disewa pada ${konflik
          .map((item) => `${item.tanggal_mulai} s.d. ${item.tanggal_selesai}`)
          .join(', ')}`,
      );
    }

    // Hitung rincian biaya sesuai aturan SRS Subbab 3.3.6.
    const harga = calculatePrice(
      toNumber(place.harga),
      input.jumlah_durasi,
      COMMISSION_RATE,
    );

    const insertResult = await client.query<BookingRow>(
      `INSERT INTO bookings (
         place_id, tenant_id, jenis_usaha, tanggal_mulai, tanggal_selesai,
         jumlah_durasi, total_harga, komisi_platform, pendapatan_host, status
       )
       VALUES ($1::integer, $2::integer, $3, $4::date, $5::date, $6, $7, $8, $9, $10)
       RETURNING id::text AS id, kode_booking, place_id::text AS place_id,
                 tenant_id::text AS tenant_id, jenis_usaha,
                 tanggal_mulai::text AS tanggal_mulai, tanggal_selesai::text AS tanggal_selesai,
                 jumlah_durasi, total_harga, komisi_platform, pendapatan_host,
                 status, created_at`,
      [
        placeId,
        tenantId,
        input.jenis_usaha,
        input.tanggal_mulai,
        tanggalSelesai,
        input.jumlah_durasi,
        harga.total_harga,
        harga.komisi_platform,
        harga.pendapatan_host,
        BOOKING_STATUS.MENUNGGU_PEMBAYARAN,
      ],
    );

    const booking = insertResult.rows[0];

    if (!booking) {
      throw new AppError('Gagal membuat pemesanan', 500);
    }

    // Notifikasi untuk Host (SRS Tabel 3.1 Fitur "Notifikasi").
    await createNotification(
      client,
      place.host_id,
      'Pemesanan baru masuk',
      `${place.nama_tempat} dipesan oleh tenant pada ${input.tanggal_mulai} s.d. ${tanggalSelesai}. Total ${harga.total_harga}.`,
      { booking_id: booking.id, tipe: 'PEMESANAN_BARU' },
    );

    return { booking };
  });

  const booking = await getBookingById(result.booking.id, tenantId, 'TENANT');

  return booking;
}

/**
 * Mengambil satu pemesanan.
 *
 * Hardening default-deny: hanya boleh diakses oleh:
 * - `TENANT` yang merupakan `b.tenant_id`, atau
 * - `HOST` yang merupakan `p.host_id` (pemilik tempat).
 *
 * Role apa pun selain keduanya ditolak 403 (aman untuk tambahan role).
 */
export async function getBookingById(
  bookingId: string,
  requesterId: string,
  requesterRole: 'HOST' | 'TENANT',
): Promise<BookingResponse> {
  const result = await pool.query<BookingRow>(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     JOIN users tenant ON tenant.id = b.tenant_id
     JOIN users host ON host.id = p.host_id
     WHERE b.id = $1::integer
     LIMIT 1`,
    [bookingId],
  );

  const booking = result.rows[0];

  if (!booking) {
    throw notFound('Pemesanan tidak ditemukan');
  }

  const isOwnerTenant = booking.tenant_id === requesterId;
  const isOwnerHost = booking.host_id === requesterId;

  // Pola default-deny: hanya role TENANT yang menjadi `tenant_id`, atau
  // role HOST yang menjadi `host_id`, yang boleh membaca. Semua role lain
  // (seperti role baru di masa depan) tidak dapat mengakses.
  const isAllowed =
    (requesterRole === 'TENANT' && isOwnerTenant) ||
    (requesterRole === 'HOST' && isOwnerHost);

  if (!isAllowed) {
    throw forbidden('Anda tidak diizinkan membaca pemesanan ini');
  }

  return toBookingResponse(booking);
}

/**
 * Daftar riwayat penyewaan (SRS Tabel 3.1 Fitur "Riwayat Penyewaan").
 * - Tenant: riwayat miliknya sendiri.
 * - Host: riwayat pemesanan pada tempat-tempatnya.
 */
export async function listBookings(
  requesterId: string,
  requesterRole: 'HOST' | 'TENANT',
  query: BookingQuery,
): Promise<PaginatedResult<BookingResponse>> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (requesterRole === 'TENANT') {
    values.push(requesterId);
    conditions.push(`b.tenant_id = $${values.length}::integer`);
  } else {
    values.push(requesterId);
    conditions.push(`p.host_id = $${values.length}::integer`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`b.status = $${values.length}`);
  }

  if (query.kode_booking) {
    values.push(`%${query.kode_booking}%`);
    conditions.push(`b.kode_booking ILIKE $${values.length}`);
  }

  if (query.tanggal_mulai) {
    values.push(query.tanggal_mulai);
    conditions.push(`b.tanggal_mulai = $${values.length}::date`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     ${whereClause}`,
    values,
  );

  const total = toNumber(countResult.rows[0]?.total);

  values.push(query.limit);
  const limitParam = `$${values.length}`;
  values.push(toOffset(query.page, query.limit));
  const offsetParam = `$${values.length}`;

  const dataResult = await pool.query<BookingRow>(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     JOIN users tenant ON tenant.id = b.tenant_id
     JOIN users host ON host.id = p.host_id
     ${whereClause}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const items = dataResult.rows.map(toBookingResponse);

  return buildPaginatedResult(items, total, query.page, query.limit);
}

/**
 * Membatalkan pemesanan.
 * Jadwal yang dibebaskan akan bisa dipesan kembali oleh tenant lain.
 */
export async function cancelBooking(
  bookingId: string,
  tenantId: string,
): Promise<BookingResponse> {
  const result = await pool.query<BookingRow>(
    `SELECT id::text AS id, kode_booking, place_id::text AS place_id,
            tenant_id::text AS tenant_id, jenis_usaha,
            tanggal_mulai::text AS tanggal_mulai, tanggal_selesai::text AS tanggal_selesai,
            jumlah_durasi, total_harga, komisi_platform, pendapatan_host,
            status, created_at
     FROM bookings
     WHERE id = $1::integer
     LIMIT 1`,
    [bookingId],
  );

  const booking = result.rows[0];

  if (!booking) {
    throw notFound('Pemesanan tidak ditemukan');
  }

  if (booking.tenant_id !== tenantId) {
    throw forbidden('Anda hanya bisa membatalkan pemesanan milik Anda sendiri');
  }

  if (booking.status === BOOKING_STATUS.DIBATALKAN) {
    throw new AppError('Pemesanan ini sudah dibatalkan', 400);
  }

  if (booking.status === BOOKING_STATUS.LUNAS) {
    throw new AppError('Pemesanan yang sudah lunas tidak dapat dibatalkan', 400);
  }

  if (booking.status !== BOOKING_STATUS.MENUNGGU_PEMBAYARAN) {
    throw new AppError('Pemesanan hanya dapat dibatalkan jika berstatus menunggu pembayaran', 400);
  }

  const updateResult = await pool.query(
    `UPDATE bookings
     SET status = $2
     WHERE id = $1::integer
       AND status = $3
     RETURNING id`,
    [bookingId, BOOKING_STATUS.DIBATALKAN, BOOKING_STATUS.MENUNGGU_PEMBAYARAN],
  );

  if ((updateResult.rowCount ?? 0) === 0) {
    throw new AppError('Pemesanan ini sudah tidak dapat dibatalkan', 400);
  }

  const placeResult = await pool.query<{ host_id: string; nama_tempat: string }>(
    `SELECT host_id::text AS host_id, nama_tempat FROM places WHERE id = $1::integer`,
    [booking.place_id],
  );

  const place = placeResult.rows[0];

  if (place) {
    await createNotification(
      pool,
      place.host_id,
      'Pemesanan dibatalkan',
      `Pemesanan ${place.nama_tempat} oleh tenant telah dibatalkan.`,
      { booking_id: booking.id, tipe: 'PEMESANAN_DIBATALKAN' },
    );
  }

  return getBookingById(bookingId, tenantId, 'TENANT');
}

/**
 * Membatalkan pemesanan oleh Pemilik tempat (jalur operasional untuk
 * membersihkan pemesanan yang masih menunggu pembayaran).
 *
 * Hanya pemesanan berstatus MENUNGGU_PEMBAYARAN yang boleh dibatalkan.
 * Pemilik hanya boleh membatalkan pemesanan pada tempat miliknya sendiri.
 */
export async function cancelBookingByHost(
  bookingId: string,
  hostId: string,
): Promise<BookingResponse> {
  const result = await pool.query<{
    id: string;
    tenant_id: string;
    place_id: string;
    status: string;
    host_id: string;
    nama_tempat: string;
  }>(
    `SELECT b.id::text AS id, b.tenant_id::text AS tenant_id,
            b.place_id::text AS place_id, b.status,
            p.host_id::text AS host_id, p.nama_tempat
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     WHERE b.id = $1::integer
     LIMIT 1`,
    [bookingId],
  );

  const booking = result.rows[0];

  if (!booking) {
    throw notFound('Pemesanan tidak ditemukan');
  }

  if (booking.host_id !== hostId) {
    throw forbidden('Anda hanya bisa membatalkan pemesanan pada tempat Anda sendiri');
  }

  const updateResult = await pool.query(
    `UPDATE bookings
     SET status = $2
     WHERE id = $1::integer
       AND status = $3
     RETURNING id`,
    [bookingId, BOOKING_STATUS.DIBATALKAN, BOOKING_STATUS.MENUNGGU_PEMBAYARAN],
  );

  if ((updateResult.rowCount ?? 0) === 0) {
    if (booking.status === BOOKING_STATUS.DIBATALKAN) {
      throw new AppError('Pemesanan ini sudah dibatalkan', 400);
    }

    if (booking.status === BOOKING_STATUS.LUNAS) {
      throw new AppError('Pemesanan yang sudah lunas tidak dapat dibatalkan', 400);
    }

    throw new AppError(
      'Pemesanan hanya dapat dibatalkan jika berstatus menunggu pembayaran',
      400,
    );
  }

  await createNotification(
    pool,
    booking.tenant_id,
    'Pemesanan dibatalkan oleh pemilik',
    `Pemesanan ${booking.nama_tempat} telah dibatalkan oleh pemilik tempat.`,
    { booking_id: booking.id, tipe: 'PEMESANAN_DIBATALKAN' },
  );

  return getBookingById(bookingId, hostId, 'HOST');
}

/**
 * Menghitung pratinjau biaya sebelum Tenant menekan tombol pesan.
 * Dipakai pada halaman "Form Pemesanan" untuk menampilkan rincian tagihan.
 */
export async function previewPrice(
  placeId: string,
  tanggalMulai: string,
  jumlahDurasi: number,
  tenantId?: string,
): Promise<PricePreviewResponse> {
  if (tanggalMulai < today()) {
    throw new AppError('Tanggal mulai sewa tidak boleh di masa lalu', 400);
  }

  const result = await pool.query<PlaceRow>(
    `SELECT id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
            alamat, kecamatan, fasilitas, aturan, harga,
            tipe_durasi, created_at, updated_at,
            tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
            tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia
     FROM places
     WHERE id = $1::integer
     LIMIT 1`,
    [placeId],
  );

  const place = result.rows[0];

  if (!place) {
    throw notFound('Tempat tidak ditemukan');
  }

  if (tenantId && place.host_id === tenantId) {
    throw new AppError('Anda tidak bisa menyewa tempat milik Anda sendiri', 400);
  }

  const tanggalSelesai = calculateEndDate(tanggalMulai, place.tipe_durasi, jumlahDurasi);

  const periodConflicts = getAvailabilityPeriodConflicts(place, tanggalMulai, tanggalSelesai);
  const ruleConflicts = await findAvailabilityRuleConflicts(placeId, tanggalMulai, tanggalSelesai);
  const scheduleConflicts = await findScheduleConflicts(placeId, tanggalMulai, tanggalSelesai);

  const konflik = [...periodConflicts, ...ruleConflicts, ...scheduleConflicts];

    const harga = calculatePrice(
      toNumber(place.harga),
      jumlahDurasi,
      COMMISSION_RATE,
    );

  return {
    place_id: place.id,
    nama_tempat: place.nama_tempat,
    tanggal_mulai: tanggalMulai,
    tanggal_selesai: tanggalSelesai,
    jumlah_durasi: jumlahDurasi,
    tipe_durasi: place.tipe_durasi,
    harga_satuan: harga.harga_satuan,
    total_harga: harga.total_harga,
    komisi_platform: harga.komisi_platform,
    pendapatan_host: harga.pendapatan_host,
    tersedia: konflik.length === 0,
    konflik,
  };
}

/** Status pemesanan yang masih memblokir jadwal. */
export const blockingStatuses = ACTIVE_BOOKING_STATUSES;


