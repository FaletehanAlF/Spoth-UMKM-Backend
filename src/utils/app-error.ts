export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Error yang memang diharapkan terjadi (validasi, akses ditolak, data tidak
 * ditemukan, dan sejenisnya). Error ini akan diterjemahkan menjadi status
 * HTTP yang tepat oleh `errorHandler`.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: ErrorDetail[];

  constructor(message: string, statusCode = 500, errors?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/** Data yang diminta tidak ditemukan. */
export function notFound(message = 'Data tidak ditemukan'): AppError {
  return new AppError(message, 404);
}

/** Pengguna belum login atau token tidak valid. */
export function unauthorized(message = 'Anda harus login terlebih dahulu'): AppError {
  return new AppError(message, 401);
}

/** Pengguna sudah login tetapi role-nya tidak berhak mengakses sumber daya. */
export function forbidden(message = 'Anda tidak memiliki akses ke sumber daya ini'): AppError {
  return new AppError(message, 403);
}

/** Validasi gagal (payload, query, atau param). */
export function badRequest(message: string, errors?: ErrorDetail[]): AppError {
  return new AppError(message, 400, errors);
}

/** Data bentrok dengan data yang sudah ada (mis. jadwal sudah terisi). */
export function conflict(message: string): AppError {
  return new AppError(message, 409);
}
