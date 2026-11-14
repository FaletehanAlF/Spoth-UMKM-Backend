import { Router } from 'express';

import { checkDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const serverTime = await checkDatabaseConnection();

    res.json({
      status: 'ok',
      database: 'connected',
      serverTime: serverTime.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[database] Health check failed:', message);

    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      ...(env.nodeEnv === 'production' ? {} : { message }),
    });
  }
});

export default router;
