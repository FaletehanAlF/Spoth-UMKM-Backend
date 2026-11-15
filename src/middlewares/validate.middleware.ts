import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../utils/app-error.js';

interface ZodIssueLike {
  path: (string | number | symbol)[];
  message: string;
}

/**
 * Mengubah daftar error Zod menjadi format yang konsisten:
 * `{ field: "body.harga_normal", message: "Harga harus lebih besar dari 0" }`
 */
function formatIssues(issues: ZodIssueLike[], source: string): { field: string; message: string }[] {
  return issues.map((issue) => {
    const field = issue.path.join('.');

    return {
      field: field ? `${source}.${field}` : source,
      message: issue.message,
    };
  });
}

function runSchema<T>(schema: ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError('Validasi data gagal', 400, formatIssues(result.error.issues, source));
  }

  return result.data;
}

/**
 * Memvalidasi `req.body` dan mengganti isinya dengan hasil validasi.
 * Controller kemudian bisa memakai `req.body` tanpa casting manual.
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = runSchema(schema, req.body, 'body');
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Memvalidasi query string (`?page=1&limit=12`).
 *
 * Catatan Express 5: `req.query` hanya bisa dibaca, jadi hasil validasi
 * dipasang ulang memakai `Object.defineProperty`.
 */
export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      const parsed = runSchema(schema, req.query, 'query');
      Object.defineProperty(req, 'query', {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Memvalidasi parameter URL (mis. `id` pada `/api/places/:id`).
 */
export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.params = runSchema(schema, req.params, 'params') as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}
