import http from 'node:http';

import app from './app.js';
import { checkDatabaseConnection, closeDatabasePool } from './config/database.js';
import { env } from './config/env.js';
import { initSocket } from './config/socket.js';

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

  const httpServer = http.createServer(app);

  // Integrasi Socket.IO untuk notifikasi real-time.
  initSocket(httpServer);

  const server = httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });

  // Menutup koneksi database dengan rapi saat server dihentikan (Ctrl+C).
  const shutdown = (signal: string): void => {
    console.log(`\n[server] Received ${signal}. Shutting down...`);

    server.close(() => {
      void closeDatabasePool().then(() => {
        console.log('[server] Closed database pool. Goodbye!');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start();
