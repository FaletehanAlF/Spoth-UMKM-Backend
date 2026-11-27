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

/** Satuan waktu sewa. Hanya ada paket mingguan dan bulanan. */
export const DURATION_TYPE = {
  MINGGUAN: 'MINGGUAN',
  BULANAN: 'BULANAN',
} as const;

export type DurationType = (typeof DURATION_TYPE)[keyof typeof DURATION_TYPE];

export const DURATION_TYPES: DurationType[] = Object.values(DURATION_TYPE);

export const PLACE_KECAMATAN_LABELS = [
  'Pancoran Mas',
  'Cimanggis',
  'Sawangan',
  'Limo',
  'Sukmajaya',
  'Beji',
  'Cipayung',
  'Cilodong',
  'Cinere',
  'Tapos',
  'Bojongsari',
] as const;

export type PlaceKecamatan = (typeof PLACE_KECAMATAN_LABELS)[number];

export const PLACE_KECAMATANS: PlaceKecamatan[] = [
  ...PLACE_KECAMATAN_LABELS,
];

/** Status pemesanan. SRS Tabel 3.3 & Tabel 4.5 (kolom `status`). */
export const BOOKING_STATUS = {
  MENUNGGU_PEMBAYARAN: 'MENUNGGU_PEMBAYARAN',
  LUNAS: 'LUNAS',
  DIBATALKAN: 'DIBATALKAN',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const BOOKING_STATUSES: BookingStatus[] = Object.values(BOOKING_STATUS);

/**
 * Label status pemesanan yang ditampilkan ke pengguna.
 *
 * Frontend (Flutter Web) tidak perlu menebak bahasa tampilannya: server
 * mengirim label siap pakai pada setiap item riwayat penyewaan.
 * `LUNAS` ditampilkan sebagai "Berhasil Disewa" karena pembayaran sudah lunas
 * sehingga sewa dianggap berhasil.
 */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu Pembayaran',
  LUNAS: 'Berhasil Disewa',
  DIBATALKAN: 'Dibatalkan',
};

/** Mengambil label tampilan sebuah status pemesanan. */
export function getBookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

/**
 * Status pemesanan yang masih "mengikat" jadwal tempat.
 * Jadwal bentrok dihitung hanya untuk status ini (SRS Subbab 3.3.6).
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BOOKING_STATUS.MENUNGGU_PEMBAYARAN,
  BOOKING_STATUS.LUNAS,
];

/** Status pembayaran. Sejak memakai Midtrans nilainya mengikuti transaksi. */
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  BERHASIL: 'BERHASIL',
  GAGAL: 'GAGAL',
  EXPIRED: 'EXPIRED',
  DIBATALKAN: 'DIBATALKAN',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

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

