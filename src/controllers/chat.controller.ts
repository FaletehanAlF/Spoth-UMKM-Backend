import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  deleteMessage,
  blockContact,
  getBlockStatus,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  unblockContact,
  updateMessage,
} from '../services/chat.service.js';
import type { SendMessagePayload } from '../validators/chat.validation.js';

/** GET /api/chat/conversations */
export const getConversations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversations = await listConversations(req.user!.id);
  sendSuccess(res, 200, 'Daftar percakapan', { conversations });
});

/** GET /api/chat/:bookingId/messages */
export const getMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const messages = await listMessages(paramString(req.params.bookingId), req.user!.id);
  sendSuccess(res, 200, 'Daftar pesan', { messages });
});

/** POST /api/chat/:bookingId/messages */
export const postMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as SendMessagePayload;
  const message = await sendMessage(paramString(req.params.bookingId), req.user!.id, payload.body);
  sendSuccess(res, 201, 'Pesan terkirim', { message });
});

/** PATCH /api/chat/:bookingId/messages/:messageId */
export const editMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as SendMessagePayload;
  const message = await updateMessage(
    paramString(req.params.bookingId),
    paramString(req.params.messageId),
    req.user!.id,
    payload.body,
  );
  sendSuccess(res, 200, 'Pesan berhasil diedit', { message });
});

/** DELETE /api/chat/:bookingId/messages/:messageId */
export const removeMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await deleteMessage(
    paramString(req.params.bookingId),
    paramString(req.params.messageId),
    req.user!.id,
  );
  sendSuccess(res, 200, 'Pesan berhasil dihapus');
});

/** POST /api/chat/:bookingId/block */
export const block = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await blockContact(paramString(req.params.bookingId), req.user!.id);
  sendSuccess(res, 200, 'Kontak diblokir');
});

/** DELETE /api/chat/:bookingId/block */
export const unblock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await unblockContact(paramString(req.params.bookingId), req.user!.id);
  sendSuccess(res, 200, 'Blokir dibuka');
});

/** GET /api/chat/:bookingId/block-status */
export const blockStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const status = await getBlockStatus(paramString(req.params.bookingId), req.user!.id);
  sendSuccess(res, 200, 'Status blokir', status);
});

export const markRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const total = await markConversationRead(paramString(req.params.bookingId), req.user!.id);
  sendSuccess(res, 200, 'Chat ditandai dibaca', { total });
});
