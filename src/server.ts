import app from './app.js';
import { checkDatabaseConnection } from './config/database.js';
import { env } from './config/env.js';

const port = env.port;

async function start(): Promise<void> {
  try {
    const serverTime = await checkDatabaseConnection();
    console.log(`[database] Connected to PostgreSQL. Server time: ${serverTime.toISOString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[database] Connection check failed: ${message}`);
    console.error('[database] The server will keep running without a verified database connection.');
  }

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

void start();
