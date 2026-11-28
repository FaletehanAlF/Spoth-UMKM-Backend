import crypto from 'node:crypto';

import { pool, withTransaction } from '../config/database.js';
import { env } from '../config/env.js';
import {
  ambilStatusTransaksi,
  ambilStatusTransaksiSnap,
  buatTransaksiSnap,
  MASA_BERLAKU_SNAP_JAM,
  type MidtransStatus,
} from '../config/midtrans.js';
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  type PaymentStatus,
  type UserRole,
} from '../types/domain.js';
import { AppError, forbidden, notFound } from '../utils/app-error.js';
import { canAccessPayment } from '../utils/access-control.js';
import type { Queryable } from '../types/database.js';
import { createNotification } from './notification.service.js';
import { generateKodeBooking } from './booking.service.js';
import type {
  MidtransNotification,
  PaymentResponse,
  PaymentResult,
  PaymentRow,
} from '../types/payment.types.js';

interface BookingForPayment {
  id: string;
  kode_booking: string | null;
  tenant_id: string;
  nama_tempat: string;
  nama_tenant: string;
  nama_host: string;
  total_harga: string;
  admin_fee: string;
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
 * Membuat order id unik untuk Midtrans. Booking id tetap terlihat agar
 * pembayaran mudah dilacak dari dashboard Midtrans.
 */
function buatOrderId(bookingId: string): string {
  const waktu = Date.now().toString(36).toUpperCase();

  return `SPOTH-${bookingId}-${waktu}`;
}

/**
 * Menerjemahkan status transaksi Midtrans menjadi status pembayaran kita.
 */
function statusPembayaranDariMidtrans(
  transactionStatus: string,
  fraudStatus?: string | null,
): PaymentStatus {
  if (transactionStatus === 'settlement') {
    return PAYMENT_STATUS.BERHASIL;
  }

  if (transactionStatus === 'capture') {
    // Kartu kredit bisa "capture" tapi masih menunggu pemeriksaan fraud.
    return fraudStatus === 'challenge' ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.BERHASIL;
  }

  if (transactionStatus === 'pending') {
    return PAYMENT_STATUS.PENDING;
  }

  if (transactionStatus === 'expire') {
    return PAYMENT_STATUS.EXPIRED;
  }

  if (transactionStatus === 'cancel') {
    return PAYMENT_STATUS.DIBATALKAN;
  }

  return PAYMENT_STATUS.GAGAL;
}

/**
 * Menerapkan status pembayaran ke dua tabel: payments dan bookings.
 *
 * Dipakai oleh webhook maupun tombol "Cek status", sehingga aturan
 * perubahan statusnya hanya ditulis satu kali.
 */
async function terapkanStatusPembayaran(
  client: Queryable,
  payment: { id: string; booking_id: string },
  status: PaymentStatus,
  data: {
    paymentType: string | null;
    transactionStatus: string;
    orderId: string;
    expiredAt: Date | null;
    raw: Record<string, unknown>;
  },
): Promise<void> {
  const lunas = status === PAYMENT_STATUS.BERHASIL;

  await client.query(
    `UPDATE payments SET
       status = $2::text,
       metode = COALESCE($3, metode),
       payment_type = COALESCE($3, payment_type),
       transaction_status = $4,
       order_id = $5,
       expired_at = COALESCE($6, expired_at),
       midtrans_response = $7::jsonb,
       paid_at = CASE WHEN $2::text = 'BERHASIL' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
     WHERE id = $1::integer`,
    [
      payment.id,
      status,
      data.paymentType,
      data.transactionStatus,
      data.orderId,
      data.expiredAt,
      JSON.stringify(data.raw),
    ],
  );

  if (!lunas) {
    // Pembayaran gagal/kedaluwarsa tidak mengubah status booking, karena
    // tenant masih boleh mencoba membayar lagi.
    return;
  }

  const bookingResult = await client.query<{
    status: string;
    kode_booking: string | null;
    tanggal_mulai: string;
    tenant_id: string;
    host_id: string;
    nama_tempat: string;
    admin_fee: string;
    komisi_platform: string;
    pendapatan_host: string;
  }>(
    `SELECT b.status,
            b.kode_booking,
            b.tanggal_mulai::text AS tanggal_mulai,
            b.tenant_id::text      AS tenant_id,
            p.host_id::text        AS host_id,
            p.nama_tempat          AS nama_tempat,
            b.admin_fee            AS admin_fee,
            b.komisi_platform      AS komisi_platform,
            b.pendapatan_host      AS pendapatan_host
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     WHERE b.id = $1::integer
     FOR UPDATE OF b`,
    [payment.booking_id],
  );

  const booking = bookingResult.rows[0];

  if (!booking || booking.status === BOOKING_STATUS.LUNAS) {
    return;
  }

  const kodeBooking =
    booking.kode_booking ?? (await generateKodeBooking(booking.tanggal_mulai, client));

  await client.query(
    `UPDATE bookings SET status = $2, kode_booking = $3 WHERE id = $1::integer`,
    [payment.booking_id, BOOKING_STATUS.LUNAS, kodeBooking],
  );

  const biayaAdmin = toNumber(booking.admin_fee);
  const komisiPlatform = toNumber(booking.komisi_platform);
  const pendapatanHost = toNumber(booking.pendapatan_host);

  await createNotification(
    client,
    booking.tenant_id,
    'Pembayaran berhasil',
    `Pembayaran untuk ${booking.nama_tempat} berhasil. Termasuk biaya admin ` +
      `Rp${biayaAdmin}. Kode booking Anda: ${kodeBooking}.`,
    { booking_id: payment.booking_id, tipe: 'PEMBAYARAN_BERHASIL' },
  );

  await createNotification(
    client,
    booking.host_id,
    'Pembayaran diterima',
    `Penyewa membayar ${booking.nama_tempat}. Biaya admin platform ` +
      `Rp${komisiPlatform} dipotong dari total pembayaran. ` +
      `Pendapatan Anda: Rp${pendapatanHost}.`,
    { booking_id: payment.booking_id, tipe: 'PEMBAYARAN_BERHASIL' },
  );
}

/**
 * Mencari transaksi yang masih menunggu dan tokennya belum kedaluwarsa.
 *
 * Dipakai supaya menekan tombol "Bayar" berkali-kali tidak membuat banyak
 * tagihan. Selama token Snap lama masih berlaku, token itu yang dipakai lagi.
 */
async function ambilPembayaranMenunggu(
  client: Queryable,
  bookingId: string,
): Promise<PaymentRow | null> {
  const hasil = await client.query<PaymentRow>(
    `SELECT id::text AS id, booking_id::text AS booking_id, metode, jumlah,
            status, paid_at, created_at, order_id, snap_token, redirect_url,
            payment_type, transaction_status, expired_at
     FROM payments
     WHERE booking_id = $1::integer
       AND status = $2
       AND snap_token IS NOT NULL
       AND redirect_url IS NOT NULL
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [bookingId, PAYMENT_STATUS.PENDING],
  );

  return hasil.rows[0] ?? null;
}

/**
 * Menyusun respons pembayaran dari data booking dan baris tabel payments.
 *
 * Dipakai baik saat membuat transaksi baru maupun saat memakai ulang
 * transaksi lama, sehingga bentuk responsnya selalu sama.
 */
function susunHasilPembayaran(
  booking: BookingForPayment,
  payment: PaymentRow,
): PaymentResult {
  const paymentResponse = toPaymentResponse({
    ...payment,
    kode_booking: booking.kode_booking,
    total_harga: booking.total_harga,
    admin_fee: booking.admin_fee,
    komisi_platform: booking.komisi_platform,
    pendapatan_host: booking.pendapatan_host,
    nama_tempat: booking.nama_tempat,
  });

  return {
    payment: paymentResponse,
    booking: {
      id: booking.id,
      kode_booking: booking.kode_booking,
      status: booking.status,
      total_harga: paymentResponse.total_harga,
    },
  };
}

/**
 * Langkah 1 pembayaran: membuat transaksi Snap di Midtrans.
 *
 * Hasilnya berupa token dan link pembayaran. Booking baru berubah menjadi
 * LUNAS setelah Midtrans mengabarkan pembayaran berhasil.
 *
 * [paksaBaru] dipakai saat pengguna memilih "Buat Ulang Pembayaran" karena
 * halaman pembayaran sebelumnya sudah kedaluwarsa.
 */
export async function createPayment(
  bookingId: string,
  tenantId: string,
  paksaBaru = false,
): Promise<PaymentResult> {
  const { booking, orderId, pembayaranLama } = await withTransaction(async (client) => {
    const bookingResult = await client.query<BookingForPayment>(
      `SELECT
         b.id::text              AS id,
         b.kode_booking          AS kode_booking,
         b.tenant_id::text       AS tenant_id,
         p.nama_tempat           AS nama_tempat,
         tenant.nama             AS nama_tenant,
         host.nama               AS nama_host,
         b.total_harga           AS total_harga,
         b.admin_fee             AS admin_fee,
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

    const data = bookingResult.rows[0];

    if (!data) {
      throw notFound('Pemesanan tidak ditemukan');
    }

    if (data.tenant_id !== tenantId) {
      throw forbidden('Anda hanya bisa membayar pemesanan milik Anda sendiri');
    }

    if (data.status === BOOKING_STATUS.LUNAS) {
      throw new AppError('Pemesanan ini sudah lunas', 400);
    }

    if (data.status === BOOKING_STATUS.DIBATALKAN) {
      throw new AppError('Pemesanan ini sudah dibatalkan', 400);
    }

    // Transaksi lama ditutup agar tidak dipakai lagi saat pengguna meminta
    // transaksi baru. Jika ternyata sudah dibayar, webhook tetap bisa
    // mengubahnya menjadi BERHASIL.
    if (paksaBaru) {
      await client.query(
        `UPDATE payments
         SET status = $2, transaction_status = 'expire'
         WHERE booking_id = $1::integer AND status = $3`,
        [data.id, PAYMENT_STATUS.EXPIRED, PAYMENT_STATUS.PENDING],
      );
    }

    return {
      booking: data,
      orderId: buatOrderId(data.id),
      pembayaranLama: paksaBaru
        ? null
        : await ambilPembayaranMenunggu(client, data.id),
    };
  });

  // Token lama masih berlaku: pakai lagi, jangan buat tagihan baru.
  if (pembayaranLama) {
    return susunHasilPembayaran(booking, pembayaranLama);
  }

  const totalHarga = toNumber(booking.total_harga);
  const adminFee = toNumber(booking.admin_fee);
  const totalSewa = totalHarga - adminFee;

  const snap = await buatTransaksiSnap({
    orderId,
    grossAmount: totalHarga,
    namaTenant: booking.nama_tenant,
    namaTempat: booking.nama_tempat,
    namaHost: booking.nama_host,
    adminFee,
    totalSewa,
  });

  const kedaluwarsa = new Date(
    Date.now() + MASA_BERLAKU_SNAP_JAM * 60 * 60 * 1000,
  );

  const payment = await withTransaction(async (client) => {
    const simpan = await client.query<PaymentRow>(
      `INSERT INTO payments
         (booking_id, metode, jumlah, status, order_id, snap_token, redirect_url,
          transaction_status, gross_amount, expired_at)
       VALUES ($1::integer, 'MIDTRANS', $2, $3, $4, $5, $6, 'pending', $2, $7)
       RETURNING id::text AS id, booking_id::text AS booking_id, metode, jumlah,
                 status, paid_at, created_at, order_id,
                 snap_token, redirect_url, payment_type, transaction_status, expired_at`,
      [
        bookingId,
        totalHarga,
        PAYMENT_STATUS.PENDING,
        orderId,
        snap.token,
        snap.redirectUrl,
        kedaluwarsa,
      ],
    );

    const baris = simpan.rows[0];

    if (!baris) {
      throw new AppError('Gagal menyimpan transaksi pembayaran', 500);
    }

    return baris;
  });

  return susunHasilPembayaran(booking, payment);
}

/**
 * Memastikan notifikasi benar-benar berasal dari Midtrans.
 *
 * Rumus resmi: SHA512(order_id + status_code + gross_amount + serverKey).
 */
function tandaTanganSah(notifikasi: MidtransNotification): boolean {
  // Sejak 28 Oktober 2026 Midtrans memakai Signature Secret Key tersendiri.
  // Integrasi lama yang belum punya key tersebut tetap memakai Server Key.
  const kunci = env.midtrans.signatureSecretKey || env.midtrans.serverKey;

  if (!kunci) {
    return false;
  }

  const bahan = `${notifikasi.order_id}${notifikasi.status_code}${notifikasi.gross_amount}${kunci}`;
  const diharapkan = crypto.createHash('sha512').update(bahan).digest('hex');

  const diterima = Buffer.from(notifikasi.signature_key.trim().toLowerCase());
  const seharusnya = Buffer.from(diharapkan);

  return (
    diterima.length === seharusnya.length &&
    crypto.timingSafeEqual(diterima, seharusnya)
  );
}

function keTanggal(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const tanggal = new Date(value.replace(' ', 'T'));

  return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

/**
 * Menangani notifikasi (webhook) dari Midtrans.
 *
 * Mengembalikan "ok" bila diproses, atau dilempar sebagai AppError bila
 * tanda tangan tidak cocok. Midtrans akan mengirim ulang bila respons gagal.
 */
export async function tanganiNotifikasiMidtrans(
  notifikasi: MidtransNotification,
): Promise<{ status: string }> {
  if (!tandaTanganSah(notifikasi)) {
    throw forbidden('Tanda tangan notifikasi Midtrans tidak valid');
  }

  const hasil = await withTransaction(async (client) => {
    const cari = await client.query<PaymentRow>(
      `SELECT id::text AS id, booking_id::text AS booking_id, status,
              jumlah, created_at, paid_at
       FROM payments
       WHERE order_id = $1
       FOR UPDATE`,
      [notifikasi.order_id],
    );

    const payment = cari.rows[0];

    if (!payment) {
      throw notFound('Transaksi Midtrans tidak dikenal');
    }

    // Notifikasi duplikat cukup diabaikan agar notifikasi tidak terkirim dua kali.
    if (payment.status === PAYMENT_STATUS.BERHASIL) {
      return 'sudah-diproses';
    }

    const status = statusPembayaranDariMidtrans(
      notifikasi.transaction_status,
      notifikasi.fraud_status,
    );

    await terapkanStatusPembayaran(client, payment, status, {
      paymentType: notifikasi.payment_type ?? null,
      transactionStatus: notifikasi.transaction_status,
      orderId: notifikasi.order_id,
      expiredAt: keTanggal(notifikasi.expiry_time),
      raw: notifikasi,
    });

    return status;
  });

  return { status: hasil };
}

type PaymentDetailRow = PaymentRow & { tenant_id: string; host_id: string };

const PAYMENT_DETAIL_SELECT = `
  SELECT pay.id::text AS id,
         pay.booking_id::text AS booking_id,
         pay.metode, pay.jumlah, pay.status, pay.paid_at, pay.created_at,
         pay.order_id, pay.snap_token, pay.redirect_url, pay.payment_type,
         pay.transaction_status, pay.expired_at,
         b.kode_booking, b.total_harga, b.admin_fee, b.komisi_platform,
         b.pendapatan_host, p.nama_tempat,
         b.tenant_id::text AS tenant_id, p.host_id::text AS host_id
  FROM payments pay
  JOIN bookings b ON b.id = pay.booking_id
  JOIN places p ON p.id = b.place_id`;

/** Mengambil pembayaran terbaru beserta data booking dan tempatnya. */
async function ambilPembayaranTerbaru(
  bookingId: string,
): Promise<PaymentDetailRow | null> {
  const hasil = await pool.query<PaymentDetailRow>(
    `${PAYMENT_DETAIL_SELECT}
     WHERE pay.booking_id = $1::integer
     ORDER BY pay.created_at DESC
     LIMIT 1`,
    [bookingId],
  );

  return hasil.rows[0] ?? null;
}

/**
 * Menanyakan status pembayaran langsung ke Midtrans lalu menyimpannya.
 *
 * Berguna saat webhook tidak bisa menjangkau server (misalnya saat
 * development di laptop), sehingga pengguna tetap bisa melanjutkan.
 */
export async function sinkronkanStatusPembayaran(
  bookingId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<PaymentResponse | null> {
  const payment = await ambilPembayaranTerbaru(bookingId);

  if (!payment) {
    return null;
  }

  if (!canAccessPayment({ id: requesterId, role: requesterRole }, payment.tenant_id, payment.host_id)) {
    throw forbidden('Anda tidak diizinkan membaca data pembayaran ini');
  }

  // Sudah berhasil: tidak perlu bertanya lagi ke Midtrans.
  if (payment.status === PAYMENT_STATUS.BERHASIL) {
    return toPaymentResponse(payment);
  }

  if (!payment.order_id) {
    return toPaymentResponse(payment);
  }

  // Status dibaca lewat Snap karena memakai izin yang sama dengan pembuatan
  // pembayaran. API Core hanya dipakai untuk pembayaran lama tanpa token Snap.
  let statusMidtrans: MidtransStatus;

  if (payment.snap_token) {
    const dariSnap = await ambilStatusTransaksiSnap(
      payment.snap_token,
      payment.order_id,
    );

    if (!dariSnap) {
      throw new AppError(
        'Transaksi tidak ditemukan di Midtrans. Buat ulang pembayaran dari aplikasi.',
        502,
      );
    }

    statusMidtrans = dariSnap;
  } else {
    statusMidtrans = await ambilStatusTransaksi(payment.order_id);
  }

  const status = statusPembayaranDariMidtrans(
    statusMidtrans.transactionStatus,
    statusMidtrans.fraudStatus,
  );

  await withTransaction(async (client) => {
    await terapkanStatusPembayaran(client, payment, status, {
      paymentType: statusMidtrans.paymentType,
      transactionStatus: statusMidtrans.transactionStatus,
      orderId: statusMidtrans.orderId,
      expiredAt: keTanggal(statusMidtrans.raw.expiry_time as string | undefined),
      raw: statusMidtrans.raw,
    });
  });

  return getPaymentByBookingId(bookingId, requesterId, requesterRole);
}

/**
 * Transformasi baris tabel `payments` menjadi bentuk respons API.
 */
function toPaymentResponse(row: PaymentRow): PaymentResponse {
  return {
    id: row.id,
    booking_id: row.booking_id,
    metode: row.metode,
    jumlah: toNumber(row.jumlah),
    status: row.status,
    paid_at: row.paid_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    kode_booking: row.kode_booking ?? null,
    total_harga: toNumber(row.total_harga),
    admin_fee: toNumber(row.admin_fee),
    komisi_platform: toNumber(row.komisi_platform),
    pendapatan_host: toNumber(row.pendapatan_host),
    nama_tempat: row.nama_tempat,
    snap_token: row.snap_token ?? null,
    redirect_url: row.redirect_url ?? null,
    payment_type: row.payment_type ?? null,
    transaction_status: row.transaction_status ?? null,
    expired_at: row.expired_at?.toISOString() ?? null,
  };
}

/**
 * Ambil detail pembayaran sebuah pemesanan.
 *
 * Hanya TENANT pemilik booking atau HOST pemilik tempat yang boleh membaca.
 */
export async function getPaymentByBookingId(
  bookingId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<PaymentResponse | null> {
  const row = await ambilPembayaranTerbaru(bookingId);

  if (!row) {
    return null;
  }

  const isAllowed = canAccessPayment(
    { id: requesterId, role: requesterRole },
    row.tenant_id,
    row.host_id,
  );

  if (!isAllowed) {
    throw forbidden('Anda tidak diizinkan membaca data pembayaran ini');
  }

  return toPaymentResponse(row);
}
