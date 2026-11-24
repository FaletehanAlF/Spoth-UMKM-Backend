/**
 * Konstanta bisnis SPOTH UMKM.
 * Semua angka ajaib (magic number) yang dipakai di banyak modul dikumpulkan
 * di sini agar mudah ditelusuri dan diubah.
 */

/**
 * Biaya admin platform untuk setiap pembayaran.
 *
 * Biaya ini ditambahkan ke total tagihan Tenant dan seluruhnya menjadi
 * pendapatan platform. Tidak ada potongan komisi lain dari harga sewa Host.
 */
export const ADMIN_FEE = 2000;

/** Durasi sewa maksimum (dalam satuan durasi tempat). */
export const MAX_BOOKING_DURATION = 365;

/** Batas jumlah foto per tempat. */
export const MAX_PLACE_IMAGES = 6;

/** Ukuran maksimal file foto (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Format gambar yang diizinkan. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/** Halaman bawaan saat daftar tempat dibuka tanpa parameter. */
export const DEFAULT_PAGE_SIZE = 12;

/** Jumlah baris maksimum untuk query daftar. */
export const MAX_PAGE_SIZE = 100;
