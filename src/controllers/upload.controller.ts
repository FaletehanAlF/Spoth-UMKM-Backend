import type { Request, Response } from 'express';

import { uploadImageBuffer } from '../config/cloudinary.js';
import { sendSuccess } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { getUploadedFile } from '../middlewares/upload.middleware.js';

/**
 * POST /api/uploads/photo
 * Host mengunggah gambar tempat. File dikirim ke Cloudinary, backend
 * tidak menyimpan file di disk.
 *
 * Form-data (multipart/form-data):
 *   field `foto` / `image` / `file` / `photo` -> file gambar
 *     (JPG, JPEG, PNG, WEBP, maksimal 5 MB)
 *
 * Respons berisi `secure_url` dan `public_id` dari Cloudinary.
 */
export const uploadPhoto = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const file = getUploadedFile(req);

    if (!file) {
      throw new AppError('File gambar wajib diunggah', 400);
    }

    try {
      const result = await uploadImageBuffer(file.buffer, file.mimetype);

      sendSuccess(res, 201, 'Gambar berhasil diunggah', {
        secure_url: result.secure_url,
        public_id: result.public_id,
        // Alias untuk kompatibilitas dengan kode yang masih memakai url_foto.
        url_foto: result.secure_url,
        url: result.secure_url,
        ukuran: file.size,
        nama_file: file.originalname,
      });
    } catch (error) {
      console.error('[cloudinary] upload failed:', error);

      const message =
        error instanceof Error ? error.message : 'Gagal mengunggah gambar ke Cloudinary';

      throw new AppError(message, 502);
    }
  },
);