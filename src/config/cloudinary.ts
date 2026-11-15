import { v2 as cloudinary } from 'cloudinary';

import { getCloudinaryConfig } from './env.js';

/**
 * Konfigurasi Cloudinary dibuat terpisah agar mudah dipahami dan diuji.
 *
 * Nilai diambil dari environment variable (.env). Secret tidak pernah
 * dicetak ke console/log.
 */
const cloudinaryConfig = getCloudinaryConfig();

cloudinary.config({
  cloud_name: cloudinaryConfig.cloudName,
  api_key: cloudinaryConfig.apiKey,
  api_secret: cloudinaryConfig.apiSecret,
  secure: true,
});

export { cloudinary };

/**
 * Tipe hasil upload yang dibutuhkan oleh controller.
 */
export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

/**
 * Mengunggah buffer gambar (dari Multer memory storage) ke Cloudinary.
 *
 * File TIDAK disimpan di disk backend; buffer langsung dikirim ke Cloudinary
 * melalui stream.
 */
export function uploadImageBuffer(
  buffer: Buffer,
  mimetype: string,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryConfig.folder,
        resource_type: 'image',
        // Biarkan Cloudinary menentukan format dari buffer yang dikirim.
        format: mimetype.split('/')[1]?.replace('jpeg', 'jpg'),
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result || !result.secure_url || !result.public_id) {
          reject(new Error('Respons Cloudinary tidak lengkap'));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    stream.on('error', (error) => reject(error));
    stream.end(buffer);
  });
}