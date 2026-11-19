import { z } from 'zod';

import {
  DURATION_TYPE,
  PLACE_STATUS,
} from '../types/domain.js';
import { MAX_PLACE_IMAGES } from '../config/constants.js';
import { dateOnlySchema, paginationQuerySchema } from '../utils/validators.js';

/**
 * Fasilitas diterima sebagai teks bebas maupun array teks.
 * Hasilnya selalu disimpan sebagai teks dengan pemisah koma.
 * Batas total 500 karakter mencegah payload teks yang berlebihan.
 */
const facilitiesSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join(', '),
  )
  .refine((value) => value.length <= 500, {
    message: 'Fasilitas maksimal 500 karakter',
  });

/**
 * URL yang diizinkan untuk `url_foto`.
 *
 * Hanya dibolehkan URL yang dapat dikembalikan oleh endpoint
 * `/api/uploads/photo` atau URL tamu dari Cloudinary (`https://`).
 * Semua skema `javascript:`, `data:`, `file:` dan lainnya ditolak —
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
    .min(1, 'Nama tempat wajib diisi')
    .max(150, 'Nama tempat maksimal 150 karakter'),
  kategori: z
    .string()
    .trim()
    .min(1, 'Kategori wajib dipilih')
    .max(50, 'Kategori maksimal 50 karakter'),
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
  tanggal_mulai_tersedia: dateOnlySchema.optional().nullable(),
  tanggal_selesai_tersedia: dateOnlySchema.optional().nullable(),
  foto: z
    .array(photoUrlSchema)
    .max(MAX_PLACE_IMAGES, `Maksimal ${MAX_PLACE_IMAGES} foto`)
    .optional(),
});

/**
 * Aturan validasi harga (SRS Tabel 4.8 No. 10):
 * "Harga promo lebih besar dari harga normal -> Ditolak dengan pesan validasi".
 */
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
  .superRefine(hargaRefinement)
  .superRefine(availabilityPeriodRefinement);

export type CreatePlacePayload = z.infer<typeof createPlaceSchema>;

/**
 * Skema ubah tempat (Host). Semua field opsional.
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
  .superRefine(hargaRefinement)
  .superRefine(availabilityPeriodRefinement);

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
  tanggal_mulai: dateOnlySchema,
  jumlah_durasi: z.coerce
    .number({ error: 'Jumlah durasi harus berupa angka' })
    .int('Jumlah durasi harus bilangan bulat')
    .min(1, 'Jumlah durasi minimal 1')
    .max(365, 'Jumlah durasi maksimal 365'),
});

export type AvailabilityPayload = z.infer<typeof availabilitySchema>;

const availabilityRuleTypeSchema = z.enum(['TANGGAL', 'HARI', 'BULAN'], {
  error: 'Tipe aturan harus TANGGAL, HARI, atau BULAN',
});

const availabilityRuleBaseSchema = z.object({
  tipe_aturan: availabilityRuleTypeSchema,
  tanggal_mulai: dateOnlySchema,
  tanggal_selesai: dateOnlySchema,
  hari: z.coerce.number().int().min(0, 'Hari minimal 0 (Minggu)').max(6, 'Hari maksimal 6 (Sabtu)').nullable().optional(),
  bulan: z.coerce.number().int().min(1, 'Bulan minimal 1').max(12, 'Bulan maksimal 12').nullable().optional(),
  tersedia: z.boolean().optional(),
});

/**
 * Aturan konsistensi untuk SATU set nilai aturan yang sudah lengkap.
 * Dipakai oleh create (nilai request) dan update (gabungan nilai lama+baru).
 */
function ruleConsistencyRefinement(
  value: {
    tipe_aturan?: 'TANGGAL' | 'HARI' | 'BULAN';
    tanggal_mulai?: string;
    tanggal_selesai?: string;
    hari?: number | null;
    bulan?: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.tanggal_mulai && value.tanggal_selesai && value.tanggal_selesai < value.tanggal_mulai) {
    ctx.addIssue({
      code: 'custom',
      path: ['tanggal_selesai'],
      message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
    });
  }

  if (!value.tipe_aturan) {
    return;
  }

  const hari = value.hari ?? null;
  const bulan = value.bulan ?? null;

  if (value.tipe_aturan === 'HARI') {
    if (hari === null) {
      ctx.addIssue({ code: 'custom', path: ['hari'], message: 'Hari wajib diisi untuk tipe HARI' });
    }
    if (bulan !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['bulan'],
        message: 'Tipe HARI tidak boleh memiliki bulan',
      });
    }
  }

  if (value.tipe_aturan === 'BULAN') {
    if (bulan === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['bulan'],
        message: 'Bulan wajib diisi untuk tipe BULAN',
      });
    }
    if (hari !== null) {
      ctx.addIssue({ code: 'custom', path: ['hari'], message: 'Tipe BULAN tidak boleh memiliki hari' });
    }
  }

  if (value.tipe_aturan === 'TANGGAL' && (hari !== null || bulan !== null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['tipe_aturan'],
      message: 'Tipe TANGGAL tidak boleh memiliki hari/bulan',
    });
  }
}

/**
 * Skema untuk memvalidasi hasil GABUNGAN nilai aturan (lama + baru).
 * Diekspor agar service dapat memvalidasi sebelum menyimpan perubahan.
 */
export const availabilityRuleConsistencySchema = z
  .object({
    tipe_aturan: availabilityRuleTypeSchema,
    tanggal_mulai: dateOnlySchema,
    tanggal_selesai: dateOnlySchema,
    hari: z.number().int().min(0).max(6).nullable(),
    bulan: z.number().int().min(1).max(12).nullable(),
    tersedia: z.boolean(),
  })
  .superRefine(ruleConsistencyRefinement);

/** Mengumpulkan daftar error konsistensi aturan ketersediaan. */
export function collectAvailabilityRuleIssues(value: unknown): {
  field: string;
  message: string;
}[] {
  const result = availabilityRuleConsistencySchema.safeParse(value);

  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

/**
 * Skema tambah aturan ketersediaan.
 * Default `tersedia` adalah false (keputusan produk: aturan baru berarti
 * "Tidak tersedia" sampai Host mengubahnya).
 */
export const createAvailabilityRuleSchema = availabilityRuleBaseSchema
  .extend({
    tersedia: z.boolean().default(false),
  })
  .superRefine(ruleConsistencyRefinement);

export type CreateAvailabilityRulePayload = z.infer<typeof createAvailabilityRuleSchema>;

/**
 * Skema ubah aturan ketersediaan (semua field opsional).
 * Pengecekan konsistensi penuh dilakukan pada hasil gabungan nilai lama dan
 * baru di `placeAvailability.service.ts`; di sini hanya dicek bila kedua
 * tanggal dikirim bersamaan.
 */
export const updateAvailabilityRuleSchema = availabilityRuleBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.tanggal_mulai && value.tanggal_selesai && value.tanggal_selesai < value.tanggal_mulai) {
      ctx.addIssue({
        code: 'custom',
        path: ['tanggal_selesai'],
        message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
      });
    }
  });

export type UpdateAvailabilityRulePayload = z.infer<typeof updateAvailabilityRuleSchema>;

export const availabilityRuleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  ruleId: z.coerce.number().int().positive(),
});