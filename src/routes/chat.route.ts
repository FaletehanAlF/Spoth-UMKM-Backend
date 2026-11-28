import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams } from '../middlewares/validate.middleware.js';
import {
  block,
  blockStatus,
  editMessage,
  getConversations,
  getMessages,
  markRead,
  postMessage,
  removeMessage,
  unblock,
} from '../controllers/chat.controller.js';
import { bookingIdParamSchema, chatMessageParamSchema, sendMessageSchema } from '../validators/chat.validation.js';

const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get('/conversations', getConversations);
chatRouter.get('/:bookingId/messages', validateParams(bookingIdParamSchema), getMessages);
chatRouter.post('/:bookingId/read', validateParams(bookingIdParamSchema), markRead);
chatRouter.get(
  '/:bookingId/block-status',
  validateParams(bookingIdParamSchema),
  blockStatus,
);
chatRouter.post('/:bookingId/block', validateParams(bookingIdParamSchema), block);
chatRouter.delete('/:bookingId/block', validateParams(bookingIdParamSchema), unblock);
chatRouter.patch(
  '/:bookingId/messages/:messageId',
  validateParams(chatMessageParamSchema),
  validateBody(sendMessageSchema),
  editMessage,
);
chatRouter.delete(
  '/:bookingId/messages/:messageId',
  validateParams(chatMessageParamSchema),
  removeMessage,
);
chatRouter.post(
  '/:bookingId/messages',
  validateParams(bookingIdParamSchema),
  validateBody(sendMessageSchema),
  postMessage,
);

export default chatRouter;
