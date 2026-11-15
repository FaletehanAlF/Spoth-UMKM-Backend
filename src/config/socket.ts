import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

import { env, getJwtSecret } from './env.js';
import type { AuthUser } from '../types/express.js';
import { USER_ROLE, type UserRole } from '../types/domain.js';

let ioInstance: Server | null = null;

function isUserRole(value: unknown): value is UserRole {
  return value === USER_ROLE.HOST || value === USER_ROLE.TENANT;
}

/**
 * Menginisialisasi Socket.IO dan menempelkannya ke HTTP server Express.
 *
 * Autentikasi dilakukan saat handshake menggunakan token JWT yang sama
 * dengan REST API. Identitas pengguna diambil dari token, bukan dari data
 * yang dikirim client. Setiap socket masuk ke room `user:<id>` sehingga
 * notifikasi hanya dikirim ke penerima yang tepat.
 */
export function initSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: env.cors.origins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const authToken =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      (typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '').trim()
        : undefined) ??
      (typeof socket.handshake.query.token === 'string'
        ? socket.handshake.query.token
        : undefined);

    if (!authToken) {
      next(new Error('Token autentikasi tidak ditemukan'));
      return;
    }

    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(authToken, secret);

      if (
        typeof decoded === 'string' ||
        typeof decoded.sub !== 'string' ||
        typeof decoded.email !== 'string' ||
        !isUserRole(decoded.role)
      ) {
        next(new Error('Token tidak valid'));
        return;
      }

      const user: AuthUser = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      };

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Token tidak valid'));
    }
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