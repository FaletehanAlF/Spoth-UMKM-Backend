import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import { cekKunciMidtrans, petunjukKunci } from '../config/midtrans.js';
import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  createPayment,
  getPaymentByBookingId,
  sinkronkanStatusPembayaran,
  tanganiNotifikasiMidtrans,
} from '../services/payment.service.js';
import type {
  CreatePaymentPayload,
  MidtransNotificationPayload,
} from '../validators/payment.validation.js';

/**
 * GET /api/payments/midtrans/health
 * Menguji server key ke Midtrans tanpa membuat transaksi.
 *
 * Hanya tersedia di development agar status konfigurasi pembayaran tidak
 * terbuka untuk umum di production.
 */
export const getMidtransHealth = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    if (env.isProduction) {
      sendSuccess(res, 404, 'Endpoint tidak ditemukan', {});
      return;
    }

    const hasil = await cekKunciMidtrans();

    sendSuccess(
      res,
      200,
      hasil.ok
        ? 'Server key Midtrans valid'
        : 'Server key Midtrans bermasalah',
      {
        mode: hasil.mode,
        dashboard_url: env.midtrans.isProduction
          ? 'https://dashboard.midtrans.com/settings/access_keys'
          : 'https://dashboard.sandbox.midtrans.com/settings/access_keys',
        server_key_configured: Boolean(env.midtrans.serverKey),
        signature_secret_configured: Boolean(
          env.midtrans.signatureSecretKey,
        ),
        server_key_hint: petunjukKunci(env.midtrans.serverKey),
        key_accepted: hasil.ok,
        http_status: hasil.httpStatus,
        detail: hasil.message,
        signature_warning: env.midtrans.signatureSecretKey
          ? null
          : 'MIDTRANS_SIGNATURE_SECRET_KEY belum diisi. Webhook memakai ' +
            'Server Key; untuk akun baru, isi Signature Secret Key dari ' +
            'dashboard agar verifikasi webhook tetap valid.',
      },
    );
  },
);

/**
 * POST /api/payments/:bookingId
 * Membuat transaksi Snap Midtrans dan mengembalikan token + link pembayaran.
 */
export const payBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { force } = req.body as CreatePaymentPayload;
    const result = await createPayment(
      paramString(req.params.id),
      req.user!.id,
      force === true,
    );

    sendSuccess(
      res,
      201,
      'Transaksi pembayaran dibuat. Selesaikan pembayaran lewat Midtrans.',
      result,
    );
  },
);

/**
 * GET /api/payments/:bookingId
 * Mengambil detail pembayaran sebuah pemesanan.
 */
export const getPayment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payment = await getPaymentByBookingId(
      paramString(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    if (!payment) {
      sendSuccess(res, 404, 'Belum ada pembayaran untuk pemesanan ini', { payment: null });
      return;
    }

    sendSuccess(res, 200, 'Berhasil memuat detail pembayaran', { payment });
  },
);

/**
 * POST /api/payments/:bookingId/sync
 * Menanyakan status terbaru ke Midtrans lalu memperbarui database.
 */
export const syncPayment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payment = await sinkronkanStatusPembayaran(
      paramString(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    if (!payment) {
      sendSuccess(res, 404, 'Belum ada pembayaran untuk pemesanan ini', { payment: null });
      return;
    }

    sendSuccess(res, 200, 'Status pembayaran diperbarui', { payment });
  },
);

/**
 * POST /api/payments/webhook
 * Dipanggil server Midtrans setiap kali status transaksi berubah.
 *
 * Tidak memakai JWT: keasliannya dijaga oleh signature_key.
 */
export const midtransWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const notifikasi = req.body as MidtransNotificationPayload;
    const hasil = await tanganiNotifikasiMidtrans(notifikasi);

    sendSuccess(res, 200, 'Notifikasi Midtrans diproses', hasil);
  },
);
