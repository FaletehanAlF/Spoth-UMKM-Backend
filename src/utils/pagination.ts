export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Membentuk hasil daftar berpaginasi.
 * Semua endpoint yang mengembalikan daftar memakai format ini supaya
 * frontend Flutter Web selalu membaca struktur yang sama.
 */
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/** Menghitung offset baris SQL dari nomor halaman. */
export function toOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
