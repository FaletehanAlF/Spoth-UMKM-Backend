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
  /** Harga paket mingguan (NULL bila paket ini tidak ditawarkan). */
  harga_mingguan: string | null;
  /** Harga paket bulanan (NULL bila paket ini tidak ditawarkan). */
  harga_bulanan: string | null;
  created_at: Date;
  updated_at: Date;
  /** Nama host, diambil dari tabel `users`. */
  nama_host?: string;
  /** URL foto profil host (bisa kosong bila belum diunggah). */
  foto_host?: string | null;
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
  /** Harga paket mingguan (null bila tidak ditawarkan). */
  harga_mingguan: number | null;
  /** Harga paket bulanan (null bila tidak ditawarkan). */
  harga_bulanan: number | null;
  /**
   * Harga paket termurah, untuk ditampilkan di kartu dan untuk pengurutan.
   * Tempat selalu punya minimal satu paket, jadi nilainya tidak pernah null.
   */
  harga_terendah: number;
  /** Satuan dari paket termurah ("MINGGUAN" atau "BULANAN"). */
  satuan_terendah: DurationType;
  created_at: string;
  updated_at: string;
  foto: string[];
  nama_host?: string;
  /** Foto profil pemilik tempat. */
  foto_host?: string | null;
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
  harga_mingguan?: number | null;
  harga_bulanan?: number | null;
  foto?: string[];
}

export interface UpdatePlaceInput {
  nama_tempat?: string;
  kategori?: string;
  deskripsi?: string;
  alamat?: string;
  kecamatan?: PlaceKecamatan;
  /** Kirim `null` untuk menonaktifkan paket mingguan. */
  harga_mingguan?: number | null;
  /** Kirim `null` untuk menonaktifkan paket bulanan. */
  harga_bulanan?: number | null;
  foto?: string[];
}

export interface SearchPlaceQuery {
  keyword?: string;
  kategori?: PlaceCategory;
  min_harga?: number;
  max_harga?: number;
  /** Hanya tampilkan tempat yang menawarkan paket ini. */
  durasi?: DurationType;
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

export interface AvailabilityResult {
  tersedia: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  konflik: BookedRange[];
}



