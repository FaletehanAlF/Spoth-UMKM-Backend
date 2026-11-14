import type { PaymentMethod, PaymentStatus } from './domain.js';

export interface PaymentRow {
  id: string;
  booking_id: string;
  metode: PaymentMethod;
  jumlah: string;
  status: PaymentStatus;
  paid_at: Date | null;
  created_at: Date;
  /** Data pemesanan yang dibayar (diisi pada query ringkasan pembayaran). */
  kode_booking?: string | null;
  total_harga?: string;
  komisi_platform?: string;
  pendapatan_host?: string;
  nama_tempat?: string;
}

export interface PaymentResponse {
  id: string;
  booking_id: string;
  metode: PaymentMethod;
  jumlah: number;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  /** Ringkasan pemesanan yang dibayar. */
  kode_booking: string | null;
  total_harga: number;
  komisi_platform: number;
  pendapatan_host: number;
  nama_tempat?: string;
}

export interface PaymentResult {
  payment: PaymentResponse;
  booking: {
    id: string;
    kode_booking: string | null;
    status: string;
    total_harga: number;
  };
}
