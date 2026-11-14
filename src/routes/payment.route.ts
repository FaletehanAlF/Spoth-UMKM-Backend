import { Router } from 'express';

import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams } from '../middlewares/validate.middleware.js';
import { USER_ROLE } from '../types/domain.js';
import { idParamSchema } from '../utils/validators.js';
import { getPayment, payBooking } from '../controllers/payment.controller.js';
import { createPaymentSchema } from '../validators/payment.validation.js';

const paymentRouter = Router();

paymentRouter.use(authenticate);

paymentRouter.get('/:id', validateParams(idParamSchema), getPayment);

paymentRouter.post(
  '/:id',
  authorize(USER_ROLE.TENANT),
  validateParams(idParamSchema),
  validateBody(createPaymentSchema),
  payBooking,
);

export default paymentRouter;
