import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParamSchema } from '../utils/validators.js';
import {
  getNotifications,
  getSummary,
  readAllNotifications,
  readNotification,
  removeNotification,
} from '../controllers/notification.controller.js';
import { notificationQuerySchema } from '../validators/notification.validation.js';

const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/', validateQuery(notificationQuerySchema), getNotifications);
notificationRouter.get('/summary', getSummary);
notificationRouter.post('/read-all', readAllNotifications);
notificationRouter.patch('/:id/read', validateParams(idParamSchema), readNotification);
notificationRouter.delete('/:id', validateParams(idParamSchema), removeNotification);

export default notificationRouter;
