import { Router } from 'express';

import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { USER_ROLE } from '../types/domain.js';
import { idParamSchema } from '../utils/validators.js';
import {
  availabilityRuleParamsSchema,
  availabilitySchema,
  createAvailabilityRuleSchema,
  createPlaceSchema,
  myPlaceSchema,
  searchPlaceSchema,
  updateAvailabilityRuleSchema,
  updatePlaceSchema,
} from '../validators/place.validation.js';
import {
  createNewPlace,
  getAvailability,
  getMyPlaces,
  getPlace,
  getSummary,
  removePlace,
  searchPlaces,
  updateExistingPlace,
} from '../controllers/place.controller.js';
import {
  createAvailabilityRule,
  getAvailabilityRules,
  removeAvailabilityRule,
  updateAvailabilityRule,
} from '../controllers/placeAvailability.controller.js';

const placeRouter = Router();

// --- Endpoint khusus Host ---------------------------------------------------
// Catatan penting: `/mine` dan `/mine/summary` harus didaftarkan SEBELUM
// `/:id`, karena Express mencocokkan route sesuai urutan pendaftaran. Jika
// `/:id` didaftarkan lebih dulu, permintaan `/mine` akan dianggap id "mine".
placeRouter.get(
  '/mine/summary',
  authenticate,
  authorize(USER_ROLE.HOST),
  getSummary,
);
placeRouter.get(
  '/mine',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateQuery(myPlaceSchema),
  getMyPlaces,
);

// --- Endpoint untuk Tenant (publik) -----------------------------------------
placeRouter.get('/', validateQuery(searchPlaceSchema), searchPlaces);
placeRouter.get('/:id/availability', validateParams(idParamSchema), validateQuery(availabilitySchema), getAvailability);
placeRouter.get('/:id', optionalAuthenticate, validateParams(idParamSchema), getPlace);

// --- Endpoint tulis khusus Host ---------------------------------------------
placeRouter.post(
  '/',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateBody(createPlaceSchema),
  createNewPlace,
);

placeRouter.patch(
  '/:id',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(idParamSchema),
  validateBody(updatePlaceSchema),
  updateExistingPlace,
);

placeRouter.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(idParamSchema),
  removePlace,
);

// --- Aturan ketersediaan tempat (Host) --------------------------------------
// Endpoint management: wajib login sebagai HOST dan hanya untuk tempat miliknya.
placeRouter.get(
  '/:id/availability-rules',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(idParamSchema),
  getAvailabilityRules,
);

placeRouter.post(
  '/:id/availability-rules',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(idParamSchema),
  validateBody(createAvailabilityRuleSchema),
  createAvailabilityRule,
);

placeRouter.patch(
  '/:id/availability-rules/:ruleId',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(availabilityRuleParamsSchema),
  validateBody(updateAvailabilityRuleSchema),
  updateAvailabilityRule,
);

placeRouter.delete(
  '/:id/availability-rules/:ruleId',
  authenticate,
  authorize(USER_ROLE.HOST),
  validateParams(availabilityRuleParamsSchema),
  removeAvailabilityRule,
);

export default placeRouter;
