import type {
  DurationType,
  PlaceCategory,
  PlaceKecamatan,
} from './domain.js';

export interface PlaceRow {
  id: string;
  host_id: string;
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kecamatan: PlaceKecamatan;
  harga: string;
  tipe_durasi: DurationType;
  created_at: Date;
  updated_at: Date;
  /** Batas periode tempat dapat disewa (opsional). */
  tanggal_mulai_tersedia: string | null;
  tanggal_selesai_tersedia: string | null;
  /** Nama host, diambil dari tabel `users`. */
  nama_host?: string;
  /** Jumlah foto tempat. */
  jumlah_foto?: string;
}

/** Bentuk data tempat yang dikirim ke frontend. */
export interface PlaceResponse {
  id: string;
  host_id: string;
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kecamatan: PlaceKecamatan;
  harga: number;
  tipe_durasi: DurationType;
  created_at: string;
  updated_at: string;
  tanggal_mulai_tersedia: string | null;
  tanggal_selesai_tersedia: string | null;
  foto: string[];
  nama_host?: string;
  /** True bila tempat sedang memiliki pemesanan aktif. */
  sudah_di_sewa: boolean;
  jumlah_foto?: number;
}

/** Tanggal yang sudah dipakai oleh pemesanan lain (untuk info ketersediaan). */
export interface BookedRange {
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
}

export interface PlaceDetailResponse extends PlaceResponse {
  jadwal_terpakai: BookedRange[];
  /** Ringkasan untuk dashboard Host. */
  total_pemesanan?: number;
  total_pendapatan?: number;
}

/** Pendapatan bersih host pada satu bulan (untuk grafik dashboard). */
export interface MonthlyRevenue {
  /** Format YYYY-MM, contoh "2026-06". */
  bulan: string;
  pendapatan: number;
}

export interface PlaceSummaryResponse {
  total_tempat: number;
  total_pemesanan: number;
  pemesanan_menunggu: number;
  pemesanan_lunas: number;
  total_pendapatan: number;
  total_komisi: number;
  /** Pendapatan bersih per bulan dari semua aktivitas pemesanan lunas. */
  pendapatan_bulanan: MonthlyRevenue[];
}

export interface CreatePlaceInput {
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kecamatan: PlaceKecamatan;
  harga: number;
  tipe_durasi: DurationType;
  tanggal_mulai_tersedia?: string | null;
  tanggal_selesai_tersedia?: string | null;
  foto?: string[];
}

export interface UpdatePlaceInput {
  nama_tempat?: string;
  kategori?: PlaceCategory;
  deskripsi?: string;
  alamat?: string;
  kecamatan?: PlaceKecamatan;
  harga?: number;
  tipe_durasi?: DurationType;
  tanggal_mulai_tersedia?: string | null;
  tanggal_selesai_tersedia?: string | null;
  foto?: string[];
}

export interface SearchPlaceQuery {
  keyword?: string;
  kategori?: PlaceCategory;
  min_harga?: number;
  max_harga?: number;
  tipe_durasi?: DurationType;
  kecamatan?: PlaceKecamatan;
  sort?: 'terbaru' | 'terlama' | 'harga_asc' | 'harga_desc' | 'nama';
  page: number;
  limit: number;
}

export interface MyPlaceQuery {
  keyword?: string;
  page: number;
  limit: number;
}

export interface AvailabilityQuery {
  tanggal_mulai: string;
  jumlah_durasi: number;
}

export interface AvailabilityResult {
  tersedia: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  konflik: BookedRange[];
}



