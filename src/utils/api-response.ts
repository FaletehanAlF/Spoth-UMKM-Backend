import type { Response } from 'express';

import type { PaginatedResult } from './pagination.js';

export interface ApiResponseBody<T> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Format respons sukses yang seragam untuk seluruh endpoint.
 * Bentuk: `{ success: true, message: "...", data: { ... } }`
 */
export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
): void {
  const body: ApiResponseBody<T> = {
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  };

  res.status(statusCode).json(body);
}

/**
 * Format respons untuk daftar berpaginasi.
 * Data berisi `items` dan `pagination` (page, limit, total, totalPages).
 */
export function sendPaginated<T>(
  res: Response,
  message: string,
  result: PaginatedResult<T>,
): void {
  sendSuccess(res, 200, message, result);
}
