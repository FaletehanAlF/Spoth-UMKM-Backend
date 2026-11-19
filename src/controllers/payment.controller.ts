import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import { createPayment, getPaymentByBookingId } from '../services/payment.service.js';
import type { CreatePaymentPayload } from '../validators/payment.validation.js';

/**
 * POST /api/payments/:bookingId
 * Memproses pembayaran simulasi dan menerbitkan E-Pass.
 */
export const payBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as CreatePaymentPayload;
    const result = await createPayment(
      paramString(req.params.id),
      req.user!.id,
      payload.metode,
    );

    sendSuccess(res, 201, 'Pembayaran simulasi berhasil, E-Pass telah dibuat', result);
  },
);

/**
 * GET /api/payments/:bookingId
 * Mengambil detail pembayaran sebuah pemesanan.
 *
 * Layanan ini juga mengembalikan `403` bila user bukan TENANT yang membayar
 * atau HOST pemilik tempat (IDOR fix).
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
