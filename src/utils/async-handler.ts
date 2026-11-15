import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Membungkus controller asynchronous agar error yang dilempar otomatis
 * diteruskan ke `errorHandler` tanpa perlu `try/catch` di setiap controller.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
