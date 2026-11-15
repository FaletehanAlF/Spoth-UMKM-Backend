import type { Request } from 'express';

import type { UserRole } from '../types/domain.js';

/**
 * Data pengguna yang tersimpan di token JWT.
 * Dipasang ke `req.user` oleh middleware `authenticate`.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Perluasan Express agar `req.user` selalu punya tipe yang jelas.
 * File ini otomatis dimuat karena `include: ["src"]` pada tsconfig.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Body request yang sudah divalidasi oleh `validateBody`.
 * Controller cukup memakai `req.body` tanpa casting manual.
 */
export interface TypedRequest<
  Params = Record<string, never>,
  ResBody = unknown,
  ReqBody = unknown,
  Query = Record<string, never>,
> extends Request<Params, ResBody, ReqBody, Query> {
  user: AuthUser;
}

export {};
