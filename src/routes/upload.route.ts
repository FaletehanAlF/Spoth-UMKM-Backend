import { Router } from 'express';

import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';
import { USER_ROLE } from '../types/domain.js';
import { uploadPhoto } from '../controllers/upload.controller.js';

const uploadRouter = Router();

uploadRouter.post(
  '/photo',
  authenticate,
  authorize(USER_ROLE.HOST),
  uploadImage,
  uploadPhoto,
);

// Alias agar endpoint upload gambar lebih mudah ditemukan / diuji.
uploadRouter.post(
  '/image',
  authenticate,
  authorize(USER_ROLE.HOST),
  uploadImage,
  uploadPhoto,
);

export default uploadRouter;
