import { z } from 'zod';

import { BOOKING_STATUS } from '../types/domain.js';
import { MAX_BOOKING_DURATION } from '../config/constants.js';
import { paginationQuerySchema } from '../utils/validators.js';

/**
 * Skema pembuatan pemesanan (SRS Tabel 3.4 Halaman "Form Pemesanan").
 *
 * Tenant memilih `tanggal_mulai` dan `jumlah_durasi`. Tanggal selesai dihitung
 * otomatis oleh server mengikuti `tipe_durasi` tempat.
 */
export const createBookingSchema = z
  .object({
    place_id: z.coerce
      .number({ error: 'Tempat wajib dipilih' })
      .int('Tempat wajib dipilih')
      .positive('Tempat wajib dipilih'),
    tanggal_mulai: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
        message: 'Tanggal tidak valid',
      }),
    jumlah_durasi: z.coerce
      .number({ error: 'Lama sewa harus berupa angka' })
      .int('Lama sewa harus bilangan bulat')
      .min(1, 'Lama sewa minimal 1')
      .max(MAX_BOOKING_DURATION, `Lama sewa maksimal ${MAX_BOOKING_DURATION}`),
    jenis_usaha: z
      .string()
      .trim()
      .min(1, 'Jenis usaha wajib diisi')
      .max(100, 'Jenis usaha maksimal 100 karakter'),
    tanggal_selesai: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
      .optional(),
  })
  .strict();

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

/** Parameter daftar riwayat penyewaan. */
export const bookingQuerySchema = paginationQuerySchema.extend({
  status: z.enum(BOOKING_STATUS, { error: 'Status pemesanan tidak valid' }).optional(),
});

export type BookingQueryPayload = z.infer<typeof bookingQuerySchema>;

/** Parameter pratinjau biaya sebelum memesan. */
export const pricePreviewSchema = z.object({
  place_id: z.coerce
    .number({ error: 'Tempat wajib dipilih' })
    .int('Tempat wajib dipilih')
    .positive('Tempat wajib dipilih'),
  tanggal_mulai: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  jumlah_durasi: z.coerce
    .number({ error: 'Lama sewa harus berupa angka' })
    .int('Lama sewa harus bilangan bulat')
    .min(1, 'Lama sewa minimal 1')
    .max(MAX_BOOKING_DURATION, `Lama sewa maksimal ${MAX_BOOKING_DURATION}`),
});

export type PricePreviewPayload = z.infer<typeof pricePreviewSchema>;
