import type {
  DurationType,
  PlaceCategory,
  PlaceStatus,
} from './domain.js';

export interface PlaceRow {
  id: string;
  host_id: string;
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kota: string;
  fasilitas: string | null;
  aturan: string | null;
  harga_normal: string;
  harga_promo: string | null;
  tipe_durasi: DurationType;
  status: PlaceStatus;
  created_at: Date;
  updated_at: Date;
  /** Batas periode tempat dapat disewa (opsional). */
  tanggal_mulai_tersedia: string | null;
  tanggal_selesai_tersedia: string | null;
  /** Nama host, diambil dari tabel `users`. */
  nama_host?: string;
  /** Harga yang benar-benar dipakai (promo bila ada). */
  harga_efektif?: string;
  /** Jumlah foto tempat. */
  jumlah_foto?: string;
}

/**
 * Bentuk data tempat yang dikirim ke frontend.
 * `fasilitas` disimpan sebagai teks di database, lalu dikirim juga dalam
 * bentuk array supaya lebih mudah ditampilkan di Flutter Web.
 */
export interface PlaceResponse {
  id: string;
  host_id: string;
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kota: string;
  fasilitas: string | null;
  fasilitas_list: string[];
  aturan: string | null;
  harga_normal: number;
  harga_promo: number | null;
  harga_efektif: number;
  tipe_durasi: DurationType;
  status: PlaceStatus;
  created_at: string;
  updated_at: string;
  tanggal_mulai_tersedia: string | null;
  tanggal_selesai_tersedia: string | null;
  foto: string[];
  nama_host?: string;
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

export interface PlaceSummaryResponse {
  total_tempat: number;
  tempat_aktif: number;
  total_pemesanan: number;
  pemesanan_menunggu: number;
  pemesanan_lunas: number;
  total_pendapatan: number;
  total_komisi: number;
}

export interface CreatePlaceInput {
  nama_tempat: string;
  kategori: PlaceCategory;
  deskripsi: string;
  alamat: string;
  kota: string;
  fasilitas?: string;
  aturan?: string;
  harga_normal: number;
  harga_promo?: number;
  tipe_durasi: DurationType;
  status?: PlaceStatus;
  tanggal_mulai_tersedia?: string | null;
  tanggal_selesai_tersedia?: string | null;
  foto?: string[];
}

export interface UpdatePlaceInput {
  nama_tempat?: string;
  kategori?: PlaceCategory;
  deskripsi?: string;
  alamat?: string;
  kota?: string;
  fasilitas?: string;
  aturan?: string;
  harga_normal?: number;
  harga_promo?: number | null;
  tipe_durasi?: DurationType;
  status?: PlaceStatus;
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
  kota?: string;
  sort?: 'terbaru' | 'terlama' | 'harga_asc' | 'harga_desc' | 'nama';
  page: number;
  limit: number;
}

export interface MyPlaceQuery {
  keyword?: string;
  status?: PlaceStatus;
  page: number;
  limit: number;
}

export interface AvailabilityQuery {
  tanggal_mulai: string;
  jumlah_durasi: number;
}

/** Aturan ketersediaan tempat (berbasis tanggal/hari/bulan). */
export type AvailabilityRuleType = 'TANGGAL' | 'HARI' | 'BULAN';

export interface AvailabilityRuleRow {
  id: string;
  place_id: string;
  tipe_aturan: AvailabilityRuleType;
  tanggal_mulai: string;
  tanggal_selesai: string;
  hari: number | null;
  bulan: number | null;
  tersedia: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AvailabilityRuleResponse {
  id: string;
  place_id: string;
  tipe_aturan: AvailabilityRuleType;
  tanggal_mulai: string;
  tanggal_selesai: string;
  hari: number | null;
  bulan: number | null;
  tersedia: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAvailabilityRuleInput {
  tipe_aturan: AvailabilityRuleType;
  tanggal_mulai: string;
  tanggal_selesai: string;
  hari?: number | null;
  bulan?: number | null;
  tersedia?: boolean;
}

export interface UpdateAvailabilityRuleInput {
  tipe_aturan?: AvailabilityRuleType;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  hari?: number | null;
  bulan?: number | null;
  tersedia?: boolean;
}

export interface AvailabilityResult {
  tersedia: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  konflik: BookedRange[];
}
