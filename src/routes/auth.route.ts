import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';
import { login, logout, register } from '../controllers/auth.controller.js';
import { loginSchema, registerSchema } from '../validators/auth.validation.js';

const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', authenticate, logout);

export default authRouter;
