import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { getJwtSecret } from '../config/env.js';
import type { AuthUser } from '../types/express.js';
import { USER_ROLE, type UserRole } from '../types/domain.js';
import { getUserByTokenSubject } from '../services/auth.service.js';
import { AppError, unauthorized } from '../utils/app-error.js';

function isUserRole(value: unknown): value is UserRole {
  return value === USER_ROLE.HOST || value === USER_ROLE.TENANT;
}

interface TokenPayload {
  sub?: unknown;
  ver?: unknown;
}

/**
 * Middleware autentikasi.
 *
 * Proses:
 * 1. Parsing header `Authorization: Bearer <token>`
 * 2. `jwt.verify(token, secret, { algorithms: ['HS256'] })` — melarang
 *    `alg: none` dan algoritma lain (hardening).
 * 3. Cek komponen JWT (`sub` string & `ver` angka).
 * 4. Ambil user dari DB berdasarkan `sub`.
 * 5. Cek `token_version` user vs `ver` JWT — mismatch → 401.
 * 6. Role dipakai dari DB (sumber otorisasi yang benar).
 *
 * Catatan: user yang sudah dihapus dari DB otomatis ditolak karena
 * `getUserByTokenSubject` mengembalikan null.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    next(unauthorized());
    return;
  }

  const secret = getJwtSecret();

  let payload: TokenPayload | null = null;

  try {
    const verified = jwt.verify(token, secret, { algorithms: ['HS256'] });

    if (typeof verified !== 'string') {
      payload = verified as TokenPayload;
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token sudah kedaluwarsa', 401));
      return;
    }

    payload = null;
  }

  if (!payload || typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
    next(new AppError('Token tidak valid', 401));
    return;
  }

  try {
    const user = await getUserByTokenSubject(payload.sub);

    // User tidak ditemukan => ditolak 401 (pesan seragam agar tidak ada
    // oracle 'user exists' bagi attacker).
    if (!user) {
      next(new AppError('Token tidak valid', 401));
      return;
    }

    if (user.token_version !== payload.ver) {
      next(new AppError('Token tidak valid', 401));
      return;
    }

    if (!isUserRole(user.role)) {
      next(new AppError('Token tidak valid', 401));
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    req.user = authUser;
    next();
  } catch {
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
