import { z } from 'zod';

/**
 * Skema validasi yang dipakai bersama oleh banyak modul.
 * Dengan begini aturan dasar (id numerik, pagination, tanggal) konsisten
 * di seluruh API.
 */

/** Id numerik pada parameter URL, contoh: `/api/places/12`. */
export const idParamSchema = z.object({
  id: z.coerce
    .number({ error: 'Id harus berupa angka' })
    .int('Id harus berupa bilangan bulat')
    .positive('Id harus lebih besar dari 0'),
});

export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Mengambil nilai parameter URL sebagai string.
 *
 * Pada Express 5, `req.params.id` bertipe `string | string[]`, sehingga
 * helper ini dipakai agar controller tidak perlu melakukan casting manual.
 */
export function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

/** Parameter pagination untuk seluruh endpoint daftar. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page minimal 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit minimal 1').max(100, 'Limit maksimal 100').default(12),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Tanggal `YYYY-MM-DD` dengan validasi kalender yang benar. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, { message: 'Tanggal tidak valid' });

/** Nomor telepon Indonesia: awalan 62 / 08 dan hanya berisi angka. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+62|62|0)8[1-9][0-9]{6,11}$/, 'Format nomor HP tidak valid');

/** Email unik dengan panjang maksimal 150 karakter (SRS Tabel 4.2). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Format email tidak valid')
  .max(150, 'Email maksimal 150 karakter');

/** Password minimal 8 karakter (SRS Tabel 3.3). */
export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password maksimal 72 byte',
  });

/** Nominal uang: positif, maksimal 2 desimal, batas aman untuk NUMERIC(14,2). */
export const moneySchema = z
  .number({ error: 'Harga harus berupa angka' })
  .positive('Harga harus lebih besar dari 0')
  .max(9_999_999_999.99, 'Harga terlalu besar')
  .refine((value) => Number.isInteger(Math.round(value * 100)), 'Format harga tidak valid');
