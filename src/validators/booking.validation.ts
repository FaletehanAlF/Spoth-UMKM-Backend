import { z } from 'zod';

import { BOOKING_STATUS, DURATION_TYPE } from '../types/domain.js';
import { batasPaket } from '../config/constants.js';
import { dateOnlySchema, optionalQuery, paginationQuerySchema } from '../utils/validators.js';

/**
 * Skema pembuatan pemesanan (SRS Tabel 3.4 Halaman "Form Pemesanan").
 *
 * Tenant memilih `tanggal_mulai`, `tipe_durasi` (paket mingguan/bulanan), dan
 * `jumlah_durasi` (jumlah paket). Tanggal selesai dihitung otomatis oleh
 * server: 1 minggu = 7 hari, 1 bulan = 30 hari.
 */
export const createBookingSchema = z
  .object({
    place_id: z.coerce
      .number({ error: 'Tempat wajib dipilih' })
      .int('Tempat wajib dipilih')
      .positive('Tempat wajib dipilih'),
    tanggal_mulai: dateOnlySchema,
    tipe_durasi: z.enum(DURATION_TYPE, {
      error: 'Paket sewa harus MINGGUAN atau BULANAN',
    }),
    jumlah_durasi: z.coerce
      .number({ error: 'Jumlah paket harus berupa angka' })
      .int('Jumlah paket harus bilangan bulat')
      .min(1, 'Jumlah paket minimal 1'),
    jenis_usaha: z
      .string()
      .trim()
      .min(3, 'Jenis usaha minimal 3 karakter')
      .max(100, 'Jenis usaha maksimal 100 karakter'),
  })
  .strict()
  .superRefine((value, ctx) => {
    const batas = batasPaket(value.tipe_durasi);

    if (value.jumlah_durasi > batas) {
      ctx.addIssue({
        code: 'custom',
        path: ['jumlah_durasi'],
        message: `Maksimal sewa ${batas} ${value.tipe_durasi === DURATION_TYPE.BULANAN ? 'bulan' : 'minggu'}`,
      });
    }
  });

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

/** Parameter daftar riwayat penyewaan. */
export const bookingQuerySchema = paginationQuerySchema.extend({
  status: optionalQuery(z.enum(BOOKING_STATUS, { error: 'Status pemesanan tidak valid' })),
  kode_booking: optionalQuery(z.string().trim().max(30, 'Kode booking terlalu panjang')),
  tanggal_mulai: optionalQuery(dateOnlySchema),
});

export type BookingQueryPayload = z.infer<typeof bookingQuerySchema>;

/** Parameter pratinjau biaya sebelum memesan. */
export const pricePreviewSchema = z
  .object({
    place_id: z.coerce
      .number({ error: 'Tempat wajib dipilih' })
      .int('Tempat wajib dipilih')
      .positive('Tempat wajib dipilih'),
    tanggal_mulai: dateOnlySchema,
    tipe_durasi: z.enum(DURATION_TYPE, {
      error: 'Paket sewa harus MINGGUAN atau BULANAN',
    }),
    jumlah_durasi: z.coerce
      .number({ error: 'Jumlah paket harus berupa angka' })
      .int('Jumlah paket harus bilangan bulat')
      .min(1, 'Jumlah paket minimal 1'),
  })
  .superRefine((value, ctx) => {
    const batas = batasPaket(value.tipe_durasi);

    if (value.jumlah_durasi > batas) {
      ctx.addIssue({
        code: 'custom',
        path: ['jumlah_durasi'],
        message: `Maksimal sewa ${batas} ${value.tipe_durasi === DURATION_TYPE.BULANAN ? 'bulan' : 'minggu'}`,
      });
    }
  });

export type PricePreviewPayload = z.infer<typeof pricePreviewSchema>;
