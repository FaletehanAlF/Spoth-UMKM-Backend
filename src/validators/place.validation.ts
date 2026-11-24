import { z } from 'zod';

import { DURATION_TYPE, PLACE_KECAMATANS } from '../types/domain.js';
import { MAX_PLACE_IMAGES } from '../config/constants.js';
import { dateOnlySchema, paginationQuerySchema } from '../utils/validators.js';

/**
 * URL yang diizinkan untuk `url_foto`.
 *
 * Hanya dibolehkan URL yang dapat dikembalikan oleh endpoint
 * `/api/uploads/photo` atau URL tamu dari Cloudinary (`https://`).
 * Semua skema `javascript:`, `data:`, `file:` dan lainnya ditolak â€”
 * jika dikirim, `javascript:` akan eksekusi kode saat dibuka di browser.
 */
const photoUrlSchema = z
  .string()
  .trim()
  .min(1, 'URL foto tidak boleh kosong')
  .max(255)
  .refine(
    (value) =>
      value.startsWith('/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    {
      message:
        'URL foto hanya boleh berupa URL relatif, http:// atau https:// (javascript: dan data: dilarang)',
    },
  );

export const placeBaseSchema = z.object({
  nama_tempat: z
    .string()
    .trim()
    .min(5, 'Nama tempat minimal 5 karakter')
    .max(150, 'Nama tempat maksimal 150 karakter'),
  kategori: z
    .string()
    .trim()
    .min(5, 'Kategori minimal 5 karakter')
    .max(50, 'Kategori maksimal 50 karakter'),
  deskripsi: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(250, 'Deskripsi maksimal 250 karakter'),
  alamat: z
    .string()
    .trim()
    .min(10, 'Alamat minimal 10 karakter')
    .max(255, 'Alamat maksimal 255 karakter'),
  kecamatan: z.enum(PLACE_KECAMATANS, {
    error: 'Kecamatan tempat tidak valid',
  }),
  harga: z
    .number({ error: 'Harga harus berupa angka' })
    .positive('Harga harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga terlalu besar'),
  tipe_durasi: z.enum(DURATION_TYPE, {
    error: 'Tipe durasi harus HARIAN, MINGGUAN, atau BULANAN',
  }),
  tanggal_mulai_tersedia: dateOnlySchema.optional().nullable(),
  tanggal_selesai_tersedia: dateOnlySchema.optional().nullable(),
  foto: z
    .array(photoUrlSchema)
    .max(MAX_PLACE_IMAGES, `Maksimal ${MAX_PLACE_IMAGES} foto`)
    .optional(),
});

const availabilityPeriodRefinement = (
  value: { tanggal_mulai_tersedia?: string | null; tanggal_selesai_tersedia?: string | null },
  ctx: z.RefinementCtx,
): void => {
  const mulai = value.tanggal_mulai_tersedia ?? null;
  const selesai = value.tanggal_selesai_tersedia ?? null;

  if ((mulai === null) !== (selesai === null)) {
    ctx.addIssue({
      code: 'custom',
      path: [mulai === null ? 'tanggal_mulai_tersedia' : 'tanggal_selesai_tersedia'],
      message: 'Tanggal mulai dan selesai ketersediaan harus diisi bersama',
    });
  }

  if (mulai && selesai && selesai < mulai) {
    ctx.addIssue({
      code: 'custom',
      path: ['tanggal_selesai_tersedia'],
      message: 'Tanggal selesai ketersediaan tidak boleh sebelum tanggal mulai',
    });
  }
};

/** Skema tambah tempat (Host). */
export const createPlaceSchema = placeBaseSchema
  .superRefine(availabilityPeriodRefinement)
  .superRefine((value, ctx) => {
    if (!value.foto || value.foto.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['foto'],
        message: 'Silakan masukkan minimal 1 foto.',
      });
    }
  });

export type CreatePlacePayload = z.infer<typeof createPlaceSchema>;

/**
 * Skema ubah tempat (Host). Semua field opsional.
 */
export const updatePlaceSchema = placeBaseSchema
  .partial()
  .superRefine(availabilityPeriodRefinement)
  .superRefine((value, ctx) => {
    if (value.foto !== undefined && value.foto !== null && value.foto.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['foto'],
        message: 'Silakan masukkan minimal 1 foto.',
      });
    }
  });

export type UpdatePlacePayload = z.infer<typeof updatePlaceSchema>;

/** Parameter pencarian & filter tempat (Tenant). */
export const searchPlaceSchema = paginationQuerySchema.extend({
  keyword: z.string().trim().max(100, 'Kata kunci terlalu panjang').optional(),
  kategori: z.string().trim().min(1, 'Kategori tidak valid').max(50, 'Kategori maksimal 50 karakter').optional(),
  min_harga: z.coerce
    .number({ error: 'Harga minimum harus berupa angka' })
    .finite('Harga minimum harus berupa angka yang valid')
    .positive('Harga minimum harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga minimum terlalu besar')
    .optional(),
  max_harga: z.coerce
    .number({ error: 'Harga maksimum harus berupa angka' })
    .finite('Harga maksimum harus berupa angka yang valid')
    .positive('Harga maksimum harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga maksimum terlalu besar')
    .optional(),
  tipe_durasi: z.enum(DURATION_TYPE, { error: 'Tipe durasi tidak valid' }).optional(),
  kecamatan: z.enum(PLACE_KECAMATANS, { error: 'Kecamatan tempat tidak valid' }).optional(),
  sort: z
    .enum(['terbaru', 'terlama', 'harga_asc', 'harga_desc', 'nama'], {
      error: 'Urutan tidak valid',
    })
    .default('terbaru'),
});

export type SearchPlacePayload = z.infer<typeof searchPlaceSchema>;

/** Parameter daftar tempat milik Host. */
export const myPlaceSchema = paginationQuerySchema.extend({
  keyword: z.string().trim().max(100, 'Kata kunci terlalu panjang').optional(),
});

export type MyPlacePayload = z.infer<typeof myPlaceSchema>;

/** Parameter pengecekan ketersediaan jadwal. */
export const availabilitySchema = z.object({
  tanggal_mulai: dateOnlySchema,
  jumlah_durasi: z.coerce
    .number({ error: 'Jumlah durasi harus berupa angka' })
    .int('Jumlah durasi harus bilangan bulat')
    .min(1, 'Jumlah durasi minimal 1')
    .max(365, 'Jumlah durasi maksimal 365'),
});

export type AvailabilityPayload = z.infer<typeof availabilitySchema>;
