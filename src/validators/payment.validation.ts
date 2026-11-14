import { z } from 'zod';

import { PAYMENT_METHOD } from '../types/domain.js';

/**
 * Skema pembayaran simulasi (SRS Tabel 3.1 Fitur "Pembayaran Simulasi").
 * Pembayaran tidak memindahkan uang sungguhan (KNF-13).
 */
export const createPaymentSchema = z
  .object({
    metode: z.enum(PAYMENT_METHOD, { error: 'Metode pembayaran tidak valid' }),
  })
  .strict();

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
