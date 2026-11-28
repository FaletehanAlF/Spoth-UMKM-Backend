import type { PaymentStatus } from './domain.js';

export interface PaymentRow {
  id: string;
  booking_id: string;
  /** Jenis pembayaran dari Midtrans, mis. "qris" atau "bank_transfer". */
  metode: string;
  jumlah: string;
  status: PaymentStatus;
  paid_at: Date | null;
  created_at: Date;
  order_id: string | null;
  snap_token: string | null;
  redirect_url: string | null;
  payment_type: string | null;
  transaction_status: string | null;
  expired_at: Date | null;
  /** Data pemesanan yang dibayar (diisi pada query ringkasan pembayaran). */
  kode_booking?: string | null;
  total_harga?: string;
  admin_fee?: string;
  komisi_platform?: string;
  pendapatan_host?: string;
  nama_tempat?: string;
}

export interface PaymentResponse {
  id: string;
  booking_id: string;
  metode: string;
  jumlah: number;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  /** Ringkasan pemesanan yang dibayar. */
  kode_booking: string | null;
  total_harga: number;
  admin_fee: number;
  komisi_platform: number;
  pendapatan_host: number;
  nama_tempat?: string;
  /** Data Snap untuk membuka halaman pembayaran Midtrans. */
  snap_token: string | null;
  redirect_url: string | null;
  payment_type: string | null;
  transaction_status: string | null;
  expired_at: string | null;
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

/** Bentuk data notifikasi webhook Midtrans yang kita pakai. */
export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  expiry_time?: string;
  [key: string]: unknown;
}
