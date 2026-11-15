import { z } from 'zod';

import { USER_ROLE } from '../types/domain.js';
import { emailSchema, passwordSchema, phoneSchema } from '../utils/validators.js';

/**
 * Skema registrasi (SRS Tabel 3.4 Halaman "Login dan Registrasi").
 * Field `role` menentukan hak akses pengguna (HOST atau TENANT).
 */
export const registerSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(1, 'Nama wajib diisi')
      .max(100, 'Nama maksimal 100 karakter'),
    email: emailSchema,
    password: passwordSchema,
    no_hp: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
    role: z.enum([USER_ROLE.HOST, USER_ROLE.TENANT], {
      error: 'Role harus HOST atau TENANT',
    }),
  })
  .strict();

export type RegisterPayload = z.infer<typeof registerSchema>;

/** Skema login. */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password wajib diisi'),
  })
  .strict();

export type LoginPayload = z.infer<typeof loginSchema>;


