import { Router } from 'express';

import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams } from '../middlewares/validate.middleware.js';
import { USER_ROLE } from '../types/domain.js';
import { idParamSchema } from '../utils/validators.js';
import {
  getMidtransHealth,
  getPayment,
  midtransWebhook,
  payBooking,
  syncPayment,
} from '../controllers/payment.controller.js';
import {
  createPaymentSchema,
  midtransNotificationSchema,
} from '../validators/payment.validation.js';

const paymentRouter = Router();

// Dipasang sebelum authenticate: Midtrans tidak membawa token JWT kita.
// Keaslian data diverifikasi lewat signature_key di dalam service.
paymentRouter.post(
  '/webhook',
  validateBody(midtransNotificationSchema),
  midtransWebhook,
);

// Diagnostik key Midtrans (hanya development). Membantu memastikan key benar-
// benar diterima Midtrans tanpa harus membuat transaksi.
paymentRouter.get('/midtrans/health', getMidtransHealth);

paymentRouter.use(authenticate);

paymentRouter.get('/:id', validateParams(idParamSchema), getPayment);

paymentRouter.post(
  '/:id',
  authorize(USER_ROLE.TENANT),
  validateParams(idParamSchema),
  validateBody(createPaymentSchema),
  payBooking,
);

paymentRouter.post(
  '/:id/sync',
  validateParams(idParamSchema),
  syncPayment,
);

export default paymentRouter;
