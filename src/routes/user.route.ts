import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { me, updateMe } from '../controllers/user.controller.js';
import { updateProfileSchema } from '../validators/user.validation.js';

const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/me', me);
userRouter.patch('/me', validateBody(updateProfileSchema), updateMe);

export default userRouter;
