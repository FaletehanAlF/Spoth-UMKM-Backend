import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { bumpUserTokenVersion, loginUser, registerUser } from '../services/auth.service.js';
import type { LoginPayload, RegisterPayload } from '../validators/auth.validation.js';

/**
 * POST /api/auth/register
 * Mendaftarkan akun baru (Host atau Tenant).
 */
export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as RegisterPayload;
    const user = await registerUser(payload);

    sendSuccess(res, 201, 'Registrasi berhasil', { user });
  },
);

/**
 * POST /api/auth/login
 * Masuk ke sistem dan mendapatkan token JWT.
 */
export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as LoginPayload;
    const result = await loginUser(payload);

    sendSuccess(res, 200, 'Login berhasil', result);
  },
);

/**
 * POST /api/auth/logout
 * Menaikkan token_version user, sehingga semua sesi user ini tercabut secara
 * efektif. Panggil dari setiap device yang ingin kenaikan segera; sesi di
 * device lain dengan versi lama otomatis ditolak sampai user login ulang.
 */
export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (userId) {
      await bumpUserTokenVersion(userId);
    }

    sendSuccess(res, 200, 'Logout berhasil');
  },
);
