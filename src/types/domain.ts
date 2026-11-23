/**
 * Domain constants & types shared by every module.
 *
 * Values here follow the SRS (Bab III dan Bab IV) so the database, the API
 * contract and the Flutter Web frontend always speak the same language.
 */

/** Peran pengguna. SRS Tabel 3.2 & Tabel 4.2 (kolom `role`). */
export const USER_ROLE = {
  HOST: 'HOST',
  TENANT: 'TENANT',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const USER_ROLES: UserRole[] = [USER_ROLE.HOST, USER_ROLE.TENANT];

/** Kategori tempat. SRS Tabel 3.3 & Tabel 4.3 (kolom `kategori`). */
export const PLACE_CATEGORY = {
  LAPAK_USAHA: 'LAPAK_USAHA',
  TERAS_KOMERSIAL: 'TERAS_KOMERSIAL',
  BOOTH_EVENT: 'BOOTH_EVENT',
} as const;

/** Tipe kategori tempat (teks bebas, maks. 50 karakter). */
export type PlaceCategory = string;

export const PLACE_CATEGORIES: PlaceCategory[] = Object.values(PLACE_CATEGORY);

/** Satuan waktu sewa. SRS Tabel 3.3 & Tabel 4.3 (kolom `tipe_durasi`). */
export const DURATION_TYPE = {
  HARIAN: 'HARIAN',
  MINGGUAN: 'MINGGUAN',
  BULANAN: 'BULANAN',
} as const;

export type DurationType = (typeof DURATION_TYPE)[keyof typeof DURATION_TYPE];

export const DURATION_TYPES: DurationType[] = Object.values(DURATION_TYPE);

/** Status pemesanan. SRS Tabel 3.3 & Tabel 4.5 (kolom `status`). */
export const BOOKING_STATUS = {
  MENUNGGU_PEMBAYARAN: 'MENUNGGU_PEMBAYARAN',
  LUNAS: 'LUNAS',
  DIBATALKAN: 'DIBATALKAN',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const BOOKING_STATUSES: BookingStatus[] = Object.values(BOOKING_STATUS);

/**
 * Status pemesanan yang masih "mengikat" jadwal tempat.
 * Jadwal bentrok dihitung hanya untuk status ini (SRS Subbab 3.3.6).
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BOOKING_STATUS.MENUNGGU_PEMBAYARAN,
  BOOKING_STATUS.LUNAS,
];

/** Status pembayaran simulasi. SRS Tabel 4.6 (kolom `status`). */
export const PAYMENT_STATUS = {
  BERHASIL: 'BERHASIL',
  GAGAL: 'GAGAL',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Metode pembayaran yang tersedia (semua simulasi). SRS KNF-13. */
export const PAYMENT_METHOD = {
  DANA: 'DANA',
  OVO: 'OVO',
  GOPAY: 'GOPAY',
  SHOPEEPAY: 'SHOPEEPAY',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_METHODS: PaymentMethod[] = Object.values(PAYMENT_METHOD);

/** Prefix kode booking pada E-Pass. SRS Tabel 3.3 (`kode_booking`). */
export const BOOKING_CODE_PREFIX = 'SPOTH';

/**
 * Bentuk data pengguna yang dikirim ke frontend (SRS Tabel 4.2).
 *
 * Diletakkan di sini (bukan di modul auth/user) agar kedua modul dapat
 * memakainya tanpa import silang (auth -> user).
 */
export interface UserResponse {
  id: string;
  nama: string;
  email: string;
  no_hp: string | null;
  foto: string | null;
  role: UserRole;
  created_at?: string;
}
