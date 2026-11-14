import fs from 'node:fs';
import path from 'node:path';

import multer from 'multer';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Folder penyimpanan foto. Dibuat otomatis saat modul ini dimuat supaya
 * tidak perlu langkah manual sebelum menjalankan server.
 */
fs.mkdirSync(env.upload.dir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, env.upload.dir);
  },
  filename(_req, file, callback) {
    // Nama file diacak agar tidak menebak dan tidak menimpa file lain.
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    callback(null, uniqueName);
  },
});

/**
 * Middleware upload satu foto (`field` bernama `foto`).
 * File disimpan di folder `uploads/` dan dapat diakses lewat URL statis.
 */
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as never)) {
      callback(new AppError('Format foto harus JPG, PNG, atau WEBP', 400));
      return;
    }

    callback(null, true);
  },
}).single('foto');
