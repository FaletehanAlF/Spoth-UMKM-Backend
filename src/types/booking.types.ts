import type { BookingStatus } from './domain.js';

export interface BookingRow {
  id: string;
  kode_booking: string | null;
  place_id: string;
  tenant_id: string;
  host_id?: string;
  jenis_usaha: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  total_harga: string;
  komisi_platform: string;
  pendapatan_host: string;
  status: BookingStatus;
  created_at: Date;
  /** Nama tempat (dari tabel `places`). */
  nama_tempat?: string;
  kategori?: string;
  alamat?: string;
  kecamatan?: string;
  /** Nama penyewa (dari tabel `users`). */
  nama_tenant?: string;
  nama_host?: string;
  foto?: string[];
}

/**
 * Bentuk pemesanan yang dikirim ke frontend.
 * `harga_satuan` disertakan agar rincian biaya bisa langsung ditampilkan.
 */
export interface BookingResponse {
  id: string;
  kode_booking: string | null;
  place_id: string;
  tenant_id: string;
  host_id?: string;
  jenis_usaha: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  harga_satuan: number;
  total_harga: number;
  komisi_platform: number;
  pendapatan_host: number;
  status: BookingStatus;
  created_at: string;
  nama_tempat?: string;
  kategori?: string;
  alamat?: string;
  kecamatan?: string;
  nama_tenant?: string;
  nama_host?: string;
  foto?: string[];
}

export interface CreateBookingInput {
  place_id: number;
  tanggal_mulai: string;
  jumlah_durasi: number;
  jenis_usaha: string;
}

export interface BookingQuery {
  status?: BookingStatus;
  kode_booking?: string;
  tanggal_mulai?: string;
  page: number;
  limit: number;
}

export interface PricePreviewResponse {
  place_id: string;
  nama_tempat: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  tipe_durasi: string;
  harga_satuan: number;
  total_harga: number;
  komisi_platform: number;
  pendapatan_host: number;
  tersedia: boolean;
  konflik: { tanggal_mulai: string; tanggal_selesai: string; status: string }[];
}


