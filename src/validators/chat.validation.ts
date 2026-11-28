import { z } from 'zod';

/** Kirim pesan chat sederhana. */
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
}).strict();

/** Parameter URL `/:bookingId`. */
export const bookingIdParamSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
});

/** Parameter URL `/:bookingId/messages/:messageId`. */
export const chatMessageParamSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive(),
});

export type SendMessagePayload = z.infer<typeof sendMessageSchema>;
