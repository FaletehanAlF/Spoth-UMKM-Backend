import { Router } from 'express';

import { getCategories } from '../controllers/category.controller.js';

const categoryRouter = Router();

// Publik: dibutuhkan oleh form tambah/edit tempat (dropdown kategori).
categoryRouter.get('/', getCategories);

export default categoryRouter;
