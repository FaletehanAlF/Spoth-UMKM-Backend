import { z } from 'zod';

import { DURATION_TYPE, PLACE_KECAMATANS } from '../types/domain.js';
import { MAX_PLACE_IMAGES, batasPaket } from '../config/constants.js';
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
  deskripsi: z
    .string()
    .trim()
    .min(30, 'Deskripsi minimal 30 karakter'),
  alamat: z
    .string()
    .trim()
    .min(10, 'Alamat minimal 10 karakter')
    .max(255, 'Alamat maksimal 255 karakter'),
  kecamatan: z.enum(PLACE_KECAMATANS, {
    error: 'Kecamatan tempat tidak valid',
  }),
  harga_mingguan: z
    .number({ error: 'Harga paket mingguan harus berupa angka' })
    .positive('Harga paket mingguan harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga paket mingguan terlalu besar')
    .nullable()
    .optional(),
  harga_bulanan: z
    .number({ error: 'Harga paket bulanan harus berupa angka' })
    .positive('Harga paket bulanan harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga paket bulanan terlalu besar')
    .nullable()
    .optional(),
  foto: z
    .array(photoUrlSchema)
    .max(MAX_PLACE_IMAGES, `Maksimal ${MAX_PLACE_IMAGES} foto`)
    .optional(),
});

/** Skema tambah tempat (Host). */
export const createPlaceSchema = placeBaseSchema
  .superRefine((value, ctx) => {
    if (!value.foto || value.foto.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['foto'],
        message: 'Silakan masukkan minimal 1 foto.',
      });
    }
  })
  .superRefine((value, ctx) => {
    const adaMingguan = typeof value.harga_mingguan === 'number';
    const adaBulanan = typeof value.harga_bulanan === 'number';

    if (!adaMingguan && !adaBulanan) {
      ctx.addIssue({
        code: 'custom',
        path: ['harga_mingguan'],
        message: 'Aktifkan minimal satu paket: mingguan atau bulanan.',
      });
    }
  });

export type CreatePlacePayload = z.infer<typeof createPlaceSchema>;

/**
 * Skema ubah tempat (Host). Semua field opsional.
 */
export const updatePlaceSchema = placeBaseSchema
  .partial()
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
  durasi: z.enum(DURATION_TYPE, { error: 'Paket durasi tidak valid' }).optional(),
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
export const availabilitySchema = z
  .object({
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

export type AvailabilityPayload = z.infer<typeof availabilitySchema>;
