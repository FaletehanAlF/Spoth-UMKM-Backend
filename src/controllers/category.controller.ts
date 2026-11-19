import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { listCategories } from '../services/category.service.js';

/**
 * GET /api/categories
 * Daftar kategori tempat untuk dropdown (bawaan + custom).
 */
export const getCategories = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const categories = await listCategories();

    sendSuccess(res, 200, 'Berhasil memuat daftar kategori', { categories });
  },
);
