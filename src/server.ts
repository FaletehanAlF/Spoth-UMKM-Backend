import http from 'node:http';

import app from './app.js';
import { checkDatabaseConnection, closeDatabasePool } from './config/database.js';
import { env, validateMidtransConfig, validateProductionConfig } from './config/env.js';
import { cekKunciMidtrans } from './config/midtrans.js';
import { initSocket } from './config/socket.js';

const port = env.port;

async function start(): Promise<void> {
  // Fail-fast di production: jika konfigurasi kritis (TLS DB, CORS allowlist,
  // JWT_SECRET) tidak lengkap, aplikasi ditolak sebelum listen.
  validateProductionConfig();

  // Peringatan (bukan penghentian) bila key Midtrans tidak cocok dengan mode.
  validateMidtransConfig();

  // Cek langsung ke Midtrans di background. Log ini membedakan key yang
  // formatnya benar dari key yang benar-benar diterima Midtrans.
  if (env.midtrans.serverKey) {
    void cekKunciMidtrans().then((hasil) => {
      console.log(`[midtrans] ${hasil.message}`);
    });
  }

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

  // Menangani error saat server dijalankan, misalnya port sudah dipakai
  // oleh proses lain, agar pesan error lebih jelas dan tidak crash.
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${port} sudah digunakan oleh proses lain. ` +
          'Hentikan proses tersebut atau ubah PORT di .env.',
      );
    } else {
      console.error(`[server] Gagal menjalankan server: ${error.message}`);
    }

    process.exit(1);
  });

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

start().catch((error: unknown) => {
  console.error('[server] Startup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
