import multer from 'multer';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '../config/constants.js';
import { AppError } from '../utils/app-error.js';

/**
 * Middleware upload gambar menggunakan Multer Memory Storage.
 *
 * File TIDAK disimpan di folder `uploads/` backend. Buffer file akan
 * diteruskan langsung ke Cloudinary oleh controller.
 */
const storage = multer.memoryStorage();

/**
 * Middleware upload satu gambar. Mendukung beberapa nama field umum
 * (`foto`, `image`, `file`, `photo`) agar mudah dipakai oleh frontend
 * maupun pengujian manual.
 */
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 4,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as never)) {
      callback(new AppError('Format gambar harus JPG, JPEG, PNG, atau WEBP', 400));
      return;
    }

    callback(null, true);
  },
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]);

/**
 * Mengambil file pertama yang berhasil diunggah dari request.
 * Berguna karena middleware memakai `.fields(...)` (bukan `.single(...)`).
 */
export function getUploadedFile(req: Express.Request): Express.Multer.File | undefined {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | Express.Multer.File[]
    | undefined;

  if (!files) {
    return undefined;
  }

  if (Array.isArray(files)) {
    return files[0];
  }

  const priority = ['foto', 'image', 'file', 'photo'];

  for (const name of priority) {
    const list = files[name];

    if (list && list.length > 0) {
      return list[0];
    }
  }

  const firstKey = Object.keys(files)[0];

  return firstKey ? files[firstKey]?.[0] : undefined;
}