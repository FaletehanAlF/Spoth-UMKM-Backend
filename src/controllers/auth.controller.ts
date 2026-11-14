import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { loginUser, registerUser } from '../services/auth.service.js';
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
 * Token bersifat stateless, jadi frontend cukup menghapus token yang disimpan.
 * Endpoint ini tetap ada agar alur logout di frontend seragam.
 */
export const logout = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, 200, 'Logout berhasil');
  },
);
