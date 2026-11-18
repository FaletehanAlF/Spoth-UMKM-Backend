import type { Request, Response } from 'express';

import { sendPaginated, sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  cancelBooking,
  cancelBookingByHost,
  createBooking,
  getBookingById,
  listBookings,
  previewPrice,
} from '../services/booking.service.js';
import type {
  BookingQueryPayload,
  CreateBookingPayload,
  PricePreviewPayload,
} from '../validators/booking.validation.js';

/**
 * POST /api/bookings
 * Tenant membuat pemesanan (dengan validasi ketersediaan jadwal).
 */
export const createNewBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as CreateBookingPayload;
    const booking = await createBooking(req.user!.id, payload);

    sendSuccess(res, 201, 'Pemesanan berhasil dibuat, silakan lakukan pembayaran', {
      booking,
    });
  },
);

/**
 * GET /api/bookings
 * Riwayat penyewaan milik pengguna yang sedang login.
 */
export const getBookings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as BookingQueryPayload;
    const result = await listBookings(req.user!.id, req.user!.role, query);

    sendPaginated(res, 'Berhasil memuat riwayat penyewaan', result);
  },
);

/**
 * GET /api/bookings/:id
 * Detail satu pemesanan.
 */
export const getBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const booking = await getBookingById(
      paramString(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    sendSuccess(res, 200, 'Berhasil memuat detail pemesanan', { booking });
  },
);

/**
 * POST /api/bookings/:id/cancel
 * Membatalkan pemesanan yang masih berjalan.
 */
export const cancelExistingBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const booking = await cancelBooking(paramString(req.params.id), req.user!.id);

    sendSuccess(res, 200, 'Pemesanan berhasil dibatalkan', { booking });
  },
);

/**
 * POST /api/bookings/:id/cancel-by-host
 * Host membatalkan pemesanan pada tempatnya.
 */
export const cancelBookingAsHost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const booking = await cancelBookingByHost(paramString(req.params.id), req.user!.id);

    sendSuccess(res, 200, 'Pemesanan berhasil dibatalkan oleh pemilik', { booking });
  },
);

/**
 * GET /api/bookings/preview-price
 * Pratinjau rincian biaya sebelum Tenant melakukan pemesanan.
 */
export const getPricePreview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as PricePreviewPayload;
    const preview = await previewPrice(
      String(query.place_id),
      query.tanggal_mulai,
      query.jumlah_durasi,
      req.user!.id,
    );

    sendSuccess(res, 200, 'Berhasil menghitung pratinjau biaya', { pratinjau: preview });
  },
);
