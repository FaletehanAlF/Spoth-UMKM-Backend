import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { getJwtSecret } from '../config/env.js';
import type { AuthUser } from '../types/express.js';
import { USER_ROLE, type UserRole } from '../types/domain.js';
import { AppError } from '../utils/app-error.js';

function isUserRole(value: unknown): value is UserRole {
  return value === USER_ROLE.HOST || value === USER_ROLE.TENANT;
}

/**
 * Middleware autentikasi.
 * Membaca token dari header `Authorization: Bearer <token>`, memverifikasi
 * tanda tangannya, lalu memasang data pengguna ke `req.user`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError('Token autentikasi tidak ditemukan', 401));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    next(new AppError('Token autentikasi tidak ditemukan', 401));
    return;
  }

  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.email !== 'string' ||
      !isUserRole(decoded.role)
    ) {
      next(new AppError('Token tidak valid', 401));
      return;
    }

    const user: AuthUser = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token sudah kedaluwarsa', 401));
      return;
    }

    next(new AppError('Token tidak valid', 401));
  }
};

/**
 * Middleware pembatasan akses berdasarkan peran.
 *
 * Contoh pemakaian pada modul places (khusus Host):
 * ```ts
 * placeRouter.post('/', authenticate, authorize(USER_ROLE.HOST), createPlace);
 * ```
 *
 * Menguji "Hak akses" (Tabel 4.8 No. 22): Tenant yang membuka endpoint
 * khusus Host akan menerima status 403.
 */
export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError('Anda harus login terlebih dahulu', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Akses ditolak. Fitur ini hanya untuk peran ${allowedRoles.join(' atau ')}`,
          403,
        ),
      );
      return;
    }

    next();
  };
}
