import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * POST /api/uploads/photo
 * Host mengunggah foto tempat.
 *
 * Form-data:
 *   field `foto` -> file gambar (JPG/PNG/WEBP, maksimal 5 MB)
 *
 * Respons berisi `url_foto` yang langsung bisa dikirim sebagai bagian dari
 * body `POST /api/places`.
 */
export const uploadPhoto = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      sendSuccess(res, 400, 'File foto wajib diunggah pada field "foto"', {
        url_foto: null,
      });
      return;
    }

    const url_foto = `${env.upload.publicPath}/${file.filename}`;

    sendSuccess(res, 201, 'Foto berhasil diunggah', {
      url_foto,
      nama_file: file.filename,
      ukuran: file.size,
    });
  },
);
