import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

import { getJwtSecret, isCorsOriginAllowed } from './env.js';
import { getUserByTokenSubject } from '../services/auth.service.js';
import type { AuthUser } from '../types/express.js';
import { USER_ROLE, type UserRole } from '../types/domain.js';

let ioInstance: Server | null = null;

function isUserRole(value: unknown): value is UserRole {
  return value === USER_ROLE.HOST || value === USER_ROLE.TENANT;
}

interface TokenPayload {
  sub?: unknown;
  ver?: unknown;
}

/**
 * Mengambil token kandidat dari handshake socket (kompatibilitas sama
 * seperti REST API: Authorization header / auth.token / query.token).
 */
function getTokenFromHandshake(handshake: unknown): string | undefined {
  const h = handshake as {
    auth?: { token?: string };
    headers?: { authorization?: string };
    query?: { token?: string };
  };

  if (!h) {
    return undefined;
  }

  if (typeof h.auth?.token === 'string' && h.auth.token) {
    return h.auth.token;
  }

  if (typeof h.headers?.authorization === 'string') {
    const token = h.headers.authorization.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      return token;
    }
  }

  if (typeof h.query?.token === 'string' && h.query.token) {
    return h.query.token;
  }

  return undefined;
}

/**
 * Inisialisasi Socket.IO dan menempelkannya ke HTTP server Express.
 *
 * Autentikasi dilakukan saat handshake menggunakan token JWT yang sama
 * dengan REST API. Identitas pengguna diambil dari DB, termasuk
 * `token_version` (pencabaran sesi berfungsi seragam dengan REST API).
 * Setiap socket masuk ke room `user:<id>` sehingga notifikasi hanya
 * dikirim ke penerima yang tepat.
 */
export function initSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin)),
      credentials: false,
    },
  });

  io.use((socket, next) => {
    const token = getTokenFromHandshake(socket.handshake);

    if (!token) {
      next(new Error('Token autentikasi tidak ditemukan'));
      return;
    }

    let payload: TokenPayload | null = null;

    try {
      const verified = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

      if (typeof verified !== 'string') {
        payload = verified as TokenPayload;
      }
    } catch {
      payload = null;
    }

    if (!payload || typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
      next(new Error('Token tidak valid'));
      return;
    }

    // Simpan nilai yang sudah lolos validasi ke const agar TypeScript tetap
    // mempersempit tipenya di dalam async IIFE di bawah.
    const subject: string = payload.sub;
    const tokenVersion: number = payload.ver;

    void (async () => {
      try {
        const user = await getUserByTokenSubject(subject);

        if (!user) {
          next(new Error('Token tidak valid'));
          return;
        }

        if (user.token_version !== tokenVersion) {
          next(new Error('Token tidak valid'));
          return;
        }

        if (!isUserRole(user.role)) {
          next(new Error('Token tidak valid'));
          return;
        }

        const authUser: AuthUser = {
          id: user.id,
          email: user.email,
          role: user.role,
        };

        socket.data.user = authUser;
        next();
      } catch {
        next(new Error('Token tidak valid'));
      }
    })();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser | undefined;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${user.id}`);
  });

  ioInstance = io;
  return io;
}

/** Mengambil instance Socket.IO (null jika belum diinisialisasi). */
export function getIO(): Server | null {
  return ioInstance;
}
