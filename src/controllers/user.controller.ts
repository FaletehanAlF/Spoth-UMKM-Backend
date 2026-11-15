import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { getUserById, updateUserProfile } from '../services/user.service.js';
import type { UpdateProfilePayload } from '../validators/user.validation.js';

/**
 * GET /api/users/me
 * Mengambil data pengguna yang sedang login.
 */
export const me = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await getUserById(req.user!.id);

    sendSuccess(res, 200, 'Berhasil memuat profil', { user });
  },
);

/**
 * PATCH /api/users/me
 * Memperbarui nama dan nomor HP.
 */
export const updateMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as UpdateProfilePayload;
    const user = await updateUserProfile(req.user!.id, payload);

    sendSuccess(res, 200, 'Profil berhasil diperbarui', { user });
  },
);
