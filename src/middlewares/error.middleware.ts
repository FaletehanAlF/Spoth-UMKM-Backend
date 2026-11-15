import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';

import { AppError } from '../utils/app-error.js';

interface PostgresErrorLike {
  code?: string;
  constraint?: string;
}

function isPostgresError(error: unknown): error is PostgresErrorLike {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
};

/**
 * Middleware penanganan error terakhir.
 * Semua error yang tidak tertangani sebelumnya dikembalikan dalam format
 * `{ success: false, message: "..." }` supaya frontend selalu bisa
 * menampilkan pesan dari field `message`.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
    return;
  }

  // Error dari Multer (ukuran file terlalu besar, dll).
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'Ukuran gambar maksimal 5 MB',
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: 'File upload tidak valid',
    });
    return;
  }

  if (isPostgresError(error)) {
    // Email sudah dipakai.
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      res.status(409).json({
        success: false,
        message: 'Email sudah dipakai',
      });
      return;
    }

    // Kode booking E-Pass bentrok (sangat jarang, tapi tetap ditangani).
    if (error.code === '23505' && error.constraint === 'bookings_kode_booking_key') {
      res.status(409).json({
        success: false,
        message: 'Kode booking sudah ada, silakan coba lagi',
      });
      return;
    }

    if (error.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Terjadi konflik data',
      });
      return;
    }

    // Nilai tidak memenuhi CHECK constraint (mis. role atau enum).
    if (error.code === '23514') {
      res.status(400).json({
        success: false,
        message: 'Data tidak valid',
      });
      return;
    }

    // Relasi antar tabel tidak terpenuhi.
    if (error.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Data yang dirujuk tidak ditemukan',
      });
      return;
    }
  }

  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({
      success: false,
      message: 'Format JSON tidak valid',
    });
    return;
  }

  console.error('[error]', error);

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
  });
};
