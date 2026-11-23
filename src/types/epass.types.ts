import type { BookingStatus } from './domain.js';

export interface EPassResponse {
  kode_booking: string;
  nama_tempat: string;
  kategori: string;
  alamat: string;
  kecamatan: string;
  foto: string[];
  jenis_usaha: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  tipe_durasi: string;
  harga_satuan: number;
  total_harga: number;
  komisi_platform: number;
  pendapatan_host: number;
  status: BookingStatus;
  nama_tenant: string;
  nama_host: string;
  metode_pembayaran: string | null;
  tanggal_pembayaran: string | null;
  dibuat_pada: string;
}


