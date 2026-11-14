import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { validateParams } from '../middlewares/validate.middleware.js';
import { idParamSchema } from '../utils/validators.js';
import { showEPass } from '../controllers/epass.controller.js';

const epassRouter = Router();

epassRouter.use(authenticate);
epassRouter.get('/:id', validateParams(idParamSchema), showEPass);

export default epassRouter;
