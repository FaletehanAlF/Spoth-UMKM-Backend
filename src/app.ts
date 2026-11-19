import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';

import { env, isCorsOriginAllowed } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { apiLimiter } from './middlewares/rate-limit.middleware.js';
import routes from './routes/index.js';

const app: Express = express();

// Keamanan header HTTP (KNF-04).
app.use(helmet());

// Trust proxy HARUS diatur sebelum middleware rate limiter.
// Nilai angka (mis. 1) atau 'loopback' bergantung ke topologi deployment.
app.set('trust proxy', env.trustProxy ?? 0);

// Izin Flutter Web (Vercel/Netlify) memanggil API ini.
// credentials=false karena autentikasi memakai header Authorization (JWT),
// bukan cookie. Di production, validateProductionConfig() memastikan
// CORS_ORIGINS berisi allowlist.
app.use(
  cors({
    origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin)),
    credentials: false,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Pembatas jumlah request untuk seluruh endpoint.
app.use('/api', apiLimiter);

// Foto tempat disimpan di folder `uploads/` dan diakses sebagai file statis.
app.use(env.upload.publicPath, express.static(env.upload.dir));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'SPOTH UMKM API',
    data: {
      nama: 'SPOTH UMKM',
      deskripsi: 'Marketplace penyewaan lapak usaha untuk UMKM',
      versi: '1.0.0',
      dokumentasi: '/api/health',
    },
  });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
