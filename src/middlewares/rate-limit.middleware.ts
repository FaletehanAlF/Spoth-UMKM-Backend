import rateLimit from 'express-rate-limit';

/**
 * Pembatas jumlah request untuk endpoint sensitif (login & registrasi).
 * Tujuannya menjaga keamanan (KNF-04) tanpa mengganggu pengguna normal.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.',
  },
});

/**
 * Pembatas khusus upload gambar.
 * Mencegah penyalahgunaan penyimpanan Cloudinary / kuota.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak unggahan. Silakan coba lagi beberapa menit lagi.',
  },
});

/**
 * Pembatas umum untuk seluruh API.
 * Nilainya dibuat tinggi supaya tidak mengganggu penggunaan normal.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  },
});
