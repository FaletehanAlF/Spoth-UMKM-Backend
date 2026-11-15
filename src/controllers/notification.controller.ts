import type { Request, Response } from 'express';

import { sendPaginated, sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  deleteNotification,
  getNotificationSummary,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../services/notification.service.js';
import type { NotificationQueryPayload } from '../validators/notification.validation.js';

/**
 * GET /api/notifications
 * Daftar notifikasi milik pengguna yang sedang login.
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as NotificationQueryPayload;
    const result = await listNotifications(req.user!.id, query);

    sendPaginated(res, 'Berhasil memuat daftar notifikasi', result);
  },
);

/**
 * GET /api/notifications/summary
 * Jumlah notifikasi total dan belum dibaca (untuk badge di frontend).
 */
export const getSummary = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const summary = await getNotificationSummary(req.user!.id);

    sendSuccess(res, 200, 'Berhasil memuat ringkasan notifikasi', { ringkasan: summary });
  },
);

/**
 * PATCH /api/notifications/:id/read
 * Menandai satu notifikasi sebagai sudah dibaca.
 */
export const readNotification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await markAsRead(req.user!.id, paramString(req.params.id));

    sendSuccess(res, 200, 'Notifikasi ditandai sudah dibaca');
  },
);

/**
 * POST /api/notifications/read-all
 * Menandai semua notifikasi sebagai sudah dibaca.
 */
export const readAllNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const updated = await markAllAsRead(req.user!.id);

    sendSuccess(res, 200, 'Semua notifikasi ditandai sudah dibaca', { jumlah: updated });
  },
);

/**
 * DELETE /api/notifications/:id
 * Menghapus satu notifikasi milik pengguna yang sedang login.
 */
export const removeNotification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await deleteNotification(req.user!.id, paramString(req.params.id));

    sendSuccess(res, 200, 'Notifikasi berhasil dihapus');
  },
);
