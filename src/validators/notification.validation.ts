import { z } from 'zod';

import { paginationQuerySchema } from '../utils/validators.js';

/** Parameter daftar notifikasi. */
export const notificationQuerySchema = paginationQuerySchema.extend({
  unread_only: z
    .enum(['true', 'false'], { error: 'unread_only harus true atau false' })
    .optional()
    .transform((value) => value === 'true'),
});

export type NotificationQueryPayload = z.infer<typeof notificationQuerySchema>;
