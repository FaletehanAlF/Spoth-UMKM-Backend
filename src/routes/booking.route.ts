import { Router } from 'express';

import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { USER_ROLE } from '../types/domain.js';
import { idParamSchema } from '../utils/validators.js';
import {
  cancelBookingAsHost,
  cancelExistingBooking,
  createNewBooking,
  getBooking,
  getBookings,
  getPricePreview,
} from '../controllers/booking.controller.js';
import {
  bookingQuerySchema,
  createBookingSchema,
  pricePreviewSchema,
} from '../validators/booking.validation.js';

const bookingRouter = Router();

bookingRouter.use(authenticate);

// Pratinjau biaya (Tenant). Didaftarkan sebelum `/:id` agar tidak tertangkap
// sebagai parameter id.
bookingRouter.get(
  '/preview-price',
  authorize(USER_ROLE.TENANT),
  validateQuery(pricePreviewSchema),
  getPricePreview,
);

// Riwayat penyewaan: Tenant melihat miliknya, Host melihat pesanannya.
bookingRouter.get('/', validateQuery(bookingQuerySchema), getBookings);

// Pemesanan baru hanya boleh dibuat oleh Tenant.
bookingRouter.post(
  '/',
  authorize(USER_ROLE.TENANT),
  validateBody(createBookingSchema),
  createNewBooking,
);

bookingRouter.get('/:id', validateParams(idParamSchema), getBooking);

bookingRouter.post(
  '/:id/cancel',
  authorize(USER_ROLE.TENANT),
  validateParams(idParamSchema),
  cancelExistingBooking,
);

bookingRouter.post(
  '/:id/cancel-by-host',
  authorize(USER_ROLE.HOST),
  validateParams(idParamSchema),
  cancelBookingAsHost,
);

export default bookingRouter;
