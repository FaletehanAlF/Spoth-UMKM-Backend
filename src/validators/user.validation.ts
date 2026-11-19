import { z } from 'zod';

import { phoneSchema } from '../utils/validators.js';

/**
 * Skema ubah profil (SRS Tabel 3.4 Halaman "Profil").
 */
export const updateProfileSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(1, 'Nama wajib diisi')
      .max(100, 'Nama maksimal 100 karakter')
      .optional(),
    no_hp: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
    foto: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  })
  .strict();

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
