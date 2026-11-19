import { pool, withTransaction } from '../config/database.js';
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  type PaymentMethod,
  type UserRole,
} from '../types/domain.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { canAccessPayment } from '../utils/access-control.js';
import { createNotification } from './notification.service.js';
import { generateKodeBooking } from './booking.service.js';
import type { PaymentResponse, PaymentResult, PaymentRow } from '../types/payment.types.js';

interface BookingForPayment {
  id: string;
  kode_booking: string | null;
  place_id: string;
  tenant_id: string;
  host_id: string;
  nama_tempat: string;
  nama_tenant: string;
  nama_host: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  total_harga: string;
  komisi_platform: string;
  pendapatan_host: string;
  status: string;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

/**
 * Memproses pembayaran simulasi (SRS Tabel 3.1 Fitur "Pembayaran Simulasi").
 *
 * Alur:
 * 1. Memastikan pemesanan milik Tenant tersebut dan masih berstatus
 *    MENUNGGU_PEMBAYARAN.
 * 2. Menyimpan data pembayaran dengan status BERHASIL.
 * 3. Mengubah status pemesanan menjadi LUNAS.
 * 4. Membuat kode booking untuk E-Pass.
 * 5. Mengirim notifikasi ke Tenant dan Host.
 *
 * Semua langkah di atas berjalan di dalam satu transaksi supaya tidak ada
 * pembayaran tanpa E-Pass atau sebaliknya.
 */
export async function createPayment(
  bookingId: string,
  tenantId: string,
  metode: PaymentMethod,
): Promise<PaymentResult> {
  const result = await withTransaction(async (client) => {
    // Kunci baris pemesanan supaya tidak ada dua pembayaran bersamaan.
    const bookingResult = await client.query<BookingForPayment>(
      `SELECT
         b.id::text              AS id,
         b.kode_booking          AS kode_booking,
         b.place_id::text        AS place_id,
         b.tenant_id::text       AS tenant_id,
         p.host_id::text         AS host_id,
         p.nama_tempat           AS nama_tempat,
         tenant.nama             AS nama_tenant,
         host.nama               AS nama_host,
         b.tanggal_mulai::text  AS tanggal_mulai,
         b.tanggal_selesai::text AS tanggal_selesai,
         b.total_harga           AS total_harga,
         b.komisi_platform       AS komisi_platform,
         b.pendapatan_host       AS pendapatan_host,
         b.status                AS status
       FROM bookings b
       JOIN places p ON p.id = b.place_id
       JOIN users tenant ON tenant.id = b.tenant_id
       JOIN users host ON host.id = p.host_id
       WHERE b.id = $1::integer
       FOR UPDATE OF b`,
      [bookingId],
    );

    const booking = bookingResult.rows[0];

    if (!booking) {
      throw notFound('Pemesanan tidak ditemukan');
    }

    if (booking.tenant_id !== tenantId) {
      throw forbidden('Anda hanya bisa membayar pemesanan milik Anda sendiri');
    }

    if (booking.status === BOOKING_STATUS.LUNAS) {
      throw new AppError('Pemesanan ini sudah lunas', 400);
    }

    if (booking.status === BOOKING_STATUS.DIBATALKAN) {
      throw new AppError('Pemesanan ini sudah dibatalkan', 400);
    }

    const totalHarga = toNumber(booking.total_harga);

    // 1. Simpan transaksi pembayaran simulasi.
    const paymentResult = await client.query<PaymentRow>(
      `INSERT INTO payments (booking_id, metode, jumlah, status, paid_at)
       VALUES ($1::integer, $2, $3, $4, NOW())
       RETURNING id::text AS id, booking_id::text AS booking_id, metode, jumlah,
                 status, paid_at, created_at`,
      [bookingId, metode, totalHarga, PAYMENT_STATUS.BERHASIL],
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
      throw new AppError('Gagal memproses pembayaran', 500);
    }

    // 2. Buat kode booking (E-Pass) lalu ubah status menjadi LUNAS.
    const kodeBooking = await generateKodeBooking(booking.tanggal_mulai, client);

    await client.query(
      `UPDATE bookings
       SET status = $2, kode_booking = $3
       WHERE id = $1::integer`,
      [bookingId, BOOKING_STATUS.LUNAS, kodeBooking],
    );

    // 3. Notifikasi untuk Tenant dan Host (SRS Tabel 3.5).
    await createNotification(
      client,
      booking.tenant_id,
      'Pembayaran berhasil',
      `Pembayaran untuk ${booking.nama_tempat} berhasil. Kode booking Anda: ${kodeBooking}.`,
      { booking_id: booking.id, tipe: 'PEMBAYARAN_BERHASIL' },
    );

    await createNotification(
      client,
      booking.host_id,
      'Pembayaran diterima',
      `Tenant telah membayar ${booking.nama_tempat}. Pendapatan Anda: ${toNumber(booking.pendapatan_host)}.`,
      { booking_id: booking.id, tipe: 'PEMBAYARAN_BERHASIL' },
    );

    return {
      payment: {
        id: payment.id,
        booking_id: payment.booking_id,
        metode: payment.metode,
        jumlah: toNumber(payment.jumlah),
        status: payment.status,
        paid_at: payment.paid_at?.toISOString() ?? null,
        created_at: payment.created_at?.toISOString(),
        kode_booking: kodeBooking,
        total_harga: totalHarga,
        komisi_platform: toNumber(booking.komisi_platform),
        pendapatan_host: toNumber(booking.pendapatan_host),
        nama_tempat: booking.nama_tempat,
      },
      booking: {
        id: booking.id,
        kode_booking: kodeBooking,
        status: BOOKING_STATUS.LUNAS,
        total_harga: totalHarga,
      },
    };
  });

  return result;
}

/**
 * Transformasi baris tabel `payments` menjadi bentuk respons API.
 */
function toPaymentResponse(row: PaymentRow & { tenant_id: string; host_id: string }): PaymentResponse {
  return {
    id: row.id,
    booking_id: row.booking_id,
    metode: row.metode,
    jumlah: toNumber(row.jumlah),
    status: row.status,
    paid_at: row.paid_at?.toISOString() ?? null,
    created_at: row.created_at?.toISOString(),
    kode_booking: row.kode_booking ?? null,
    total_harga: toNumber(row.total_harga),
    komisi_platform: toNumber(row.komisi_platform),
    pendapatan_host: toNumber(row.pendapatan_host),
    nama_tempat: row.nama_tempat,
  };
}

/**
 * Ambil detail pembayaran sebuah pemesanan.
 *
 * Hardening IDOR: fungsi ini dipanggil oleh user yang telah otentikasi
 * melalui `authenticate`. Kode `403` dikembalikan bila:
 * - pembayaran ada, tetapi user bukan:
 *   - TENANT yang menjadi `b.tenant_id`, atau
 *   - HOST yang menjadi `p.host_id` (pemilik tempat).
 *
 * Jika pembayaran tidak ada, kembalikan `null` → controller kembalikan
 * 404 (kompatibel dengan frontend lama).
 *
 * Posisi pemilik dideteksi dari database (tidak percaya role dari token).
 */
export async function getPaymentByBookingId(
  bookingId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<PaymentResponse | null> {
  const result = await pool.query<PaymentRow & { tenant_id: string; host_id: string }>(
    `SELECT
       pay.id::text       AS id,
       pay.booking_id::text AS booking_id,
       pay.metode         AS metode,
       pay.jumlah         AS jumlah,
       pay.status         AS status,
       pay.paid_at        AS paid_at,
       pay.created_at     AS created_at,
       b.kode_booking     AS kode_booking,
       b.total_harga      AS total_harga,
       b.komisi_platform  AS komisi_platform,
       b.pendapatan_host  AS pendapatan_host,
       p.nama_tempat      AS nama_tempat,
       b.tenant_id::text  AS tenant_id,
       p.host_id::text    AS host_id
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     JOIN places p ON p.id = b.place_id
     WHERE pay.booking_id = $1::integer
     ORDER BY pay.created_at DESC
     LIMIT 1`,
    [bookingId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const isAllowed = canAccessPayment(
    { id: requesterId, role: requesterRole },
    row.tenant_id,
    row.host_id,
  );

  if (!isAllowed) {
    // Default-deny: jangan bocorkan detail apa pun ke pihak yang tidak berhak.
    throw forbidden('Anda tidak diizinkan membaca data pembayaran ini');
  }

  return toPaymentResponse(row);
}
