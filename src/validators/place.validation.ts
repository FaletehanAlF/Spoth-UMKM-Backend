import { z } from 'zod';

import {
  DURATION_TYPE,
  PLACE_CATEGORY,
  PLACE_STATUS,
} from '../types/domain.js';
import { MAX_PLACE_IMAGES } from '../config/constants.js';
import { paginationQuerySchema } from '../utils/validators.js';

/**
 * Fasilitas diterima sebagai teks bebas maupun array teks.
 * Hasilnya selalu disimpan sebagai teks dengan pemisah koma.
 */
const facilitiesSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join(', '),
  );

/** Alamat foto: boleh URL absolut maupun path relatif dari endpoint upload. */
const photoSchema = z.string().trim().min(1, 'URL foto tidak boleh kosong').max(255);

export const placeBaseSchema = z.object({
  nama_tempat: z
    .string()
    .trim()
    .min(1, 'Nama tempat wajib diisi')
    .max(150, 'Nama tempat maksimal 150 karakter'),
  kategori: z.enum(PLACE_CATEGORY, {
    error: 'Kategori harus LAPAK_USAHA, TERAS_KOMERSIAL, atau BOOTH_EVENT',
  }),
  deskripsi: z.string().trim().max(2000, 'Deskripsi terlalu panjang').optional(),
  alamat: z
    .string()
    .trim()
    .min(1, 'Alamat wajib diisi')
    .max(255, 'Alamat maksimal 255 karakter'),
  kota: z.string().trim().min(1, 'Kota wajib diisi').max(80, 'Kota maksimal 80 karakter'),
  fasilitas: facilitiesSchema.optional(),
  aturan: z.string().trim().max(2000, 'Aturan terlalu panjang').optional(),
  harga_normal: z
    .number({ error: 'Harga normal harus berupa angka' })
    .positive('Harga normal harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga normal terlalu besar'),
  harga_promo: z
    .number({ error: 'Harga promo harus berupa angka' })
    .positive('Harga promo harus lebih besar dari 0')
    .max(9_999_999_999.99, 'Harga promo terlalu besar')
    .optional(),
  tipe_durasi: z.enum(DURATION_TYPE, {
    error: 'Tipe durasi harus HARIAN, MINGGUAN, atau BULANAN',
  }),
  status: z.enum(PLACE_STATUS, {
    error: 'Status harus AKTIF atau NONAKTIF',
  }).optional(),
  foto: z.array(photoSchema).max(MAX_PLACE_IMAGES, `Maksimal ${MAX_PLACE_IMAGES} foto`).optional(),
});

/**
 * Aturan validasi harga (SRS Tabel 4.8 No. 10):
 * "Harga promo lebih besar dari harga normal -> Ditolak dengan pesan validasi".
 *
 * Pada saat menambah tempat, `harga_normal` selalu ikut dikirim sehingga
 * perbandingan bisa dilakukan langsung. Pada saat mengubah tempat, bila
 * `harga_normal` tidak ikut dikirim, pengecekan dilakukan ulang di service
 * terhadap harga normal yang tersimpan di database.
 */
const hargaRefinement = (
  value: { harga_normal?: number; harga_promo?: number | null },
  ctx: z.RefinementCtx,
): void => {
  if (
    value.harga_promo !== undefined &&
    value.harga_promo !== null &&
    value.harga_normal !== undefined &&
    value.harga_promo > value.harga_normal
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['harga_promo'],
      message: 'Harga promo tidak boleh lebih besar dari harga normal',
    });
  }
};

/** Skema tambah tempat (Host). */
export const createPlaceSchema = placeBaseSchema
  .extend({
    status: placeBaseSchema.shape.status?.default('AKTIF'),
  })
  .superRefine(hargaRefinement);

export type CreatePlacePayload = z.infer<typeof createPlaceSchema>;

/**
 * Skema ubah tempat (Host). Semua field opsional.
 *
 * `harga_promo` boleh bernilai `null` untuk menghapus harga promo yang
 * sebelumnya ada. `null` berarti "hapus promo", sedangkan field yang tidak
 * dikirim berarti "biarkan apa adanya".
 */
export const updatePlaceSchema = placeBaseSchema
  .partial()
  .extend({
    harga_promo: z
      .number({ error: 'Harga promo harus berupa angka' })
      .positive('Harga promo harus lebih besar dari 0')
      .max(9_999_999_999.99, 'Harga promo terlalu besar')
      .nullable()
      .optional(),
  })
  .superRefine(hargaRefinement);

export type UpdatePlacePayload = z.infer<typeof updatePlaceSchema>;

/** Parameter pencarian & filter tempat (Tenant). */
export const searchPlaceSchema = paginationQuerySchema.extend({
  keyword: z.string().trim().max(100, 'Kata kunci terlalu panjang').optional(),
  kategori: z.enum(PLACE_CATEGORY, { error: 'Kategori tidak valid' }).optional(),
  min_harga: z.coerce
    .number({ error: 'Harga minimum harus berupa angka' })
    .positive('Harga minimum harus lebih besar dari 0')
    .optional(),
  max_harga: z.coerce
    .number({ error: 'Harga maksimum harus berupa angka' })
    .positive('Harga maksimum harus lebih besar dari 0')
    .optional(),
  tipe_durasi: z.enum(DURATION_TYPE, { error: 'Tipe durasi tidak valid' }).optional(),
  kota: z.string().trim().max(80, 'Kota terlalu panjang').optional(),
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
  status: z.enum(PLACE_STATUS, { error: 'Status tidak valid' }).optional(),
});

export type MyPlacePayload = z.infer<typeof myPlaceSchema>;

/** Parameter pengecekan ketersediaan jadwal. */
export const availabilitySchema = z.object({
  tanggal_mulai: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  jumlah_durasi: z.coerce
    .number({ error: 'Jumlah durasi harus berupa angka' })
    .int('Jumlah durasi harus bilangan bulat')
    .min(1, 'Jumlah durasi minimal 1')
    .max(365, 'Jumlah durasi maksimal 365'),
});

export type AvailabilityPayload = z.infer<typeof availabilitySchema>;
