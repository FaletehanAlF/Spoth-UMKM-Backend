import { z } from 'zod';

/**
 * Sejak memakai Midtrans, pengguna tidak lagi memilih metode.
 * `force` dipakai saat pengguna ingin membuat transaksi baru karena
 * halaman pembayaran sebelumnya sudah kedaluwarsa.
 */
export const createPaymentSchema = z
  .object({
    force: z.boolean().optional(),
  })
  .strict();

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;

/**
 * Notifikasi webhook Midtrans. Field wajib dipakai untuk memverifikasi
 * tanda tangan, sisanya opsional.
 */
export const midtransNotificationSchema = z
  .object({
    order_id: z.string().min(1),
    status_code: z.string().min(1),
    gross_amount: z.string().min(1),
    signature_key: z.string().min(1),
    transaction_status: z.string().min(1),
    fraud_status: z.string().optional(),
    payment_type: z.string().optional(),
    transaction_id: z.string().optional(),
    expiry_time: z.string().optional(),
  })
  .passthrough();

export type MidtransNotificationPayload = z.infer<typeof midtransNotificationSchema>;
