import { Router } from 'express';

import { checkDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';
import authRouter from './auth.route.js';

const router = Router();

/**
 * Health check API.
 * Mengcek koneksi database sehingga tidak normale bila server sedang hidup.
 */
router.get('/health', async (_req, res) => {
  try {
    const serverTime = await checkDatabaseConnection();

    res.json({
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        database: 'connected',
        serverTime: serverTime.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[database] Health check failed:', message);

    res.status(503).json({
      success: false,
      message: 'Database tidak terhubung',
      data: {
        status: 'error',
        database: 'disconnected',
        ...(env.isProduction ? {} : { detail: message }),
      },
    });
  }
});

// Modul utama aplikasi.
router.use('/auth', authRouter);

export default router;
