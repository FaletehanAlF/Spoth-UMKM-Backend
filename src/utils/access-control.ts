import type { UserRole } from '../types/domain.js';

/**
 * Predikat akses murni (tanpa I/O) supaya mudah diuji dan dipakai ulang.
 * Semua pengecekan memakai pola default-deny: selain kombinasi yang
 * diizinkan secara eksplisit, akses ditolak.
 */

/** Identitas peminta yang sudah terautentikasi. */
export interface Requester {
  id: string;
  role: UserRole;
}

/**
 * Pembayaran boleh dibaca oleh:
 * - TENANT yang menjadi pemilik pemesanan (`tenant_id`), atau
 * - HOST yang menjadi pemilik tempat (`host_id`).
 */
export function canAccessPayment(
  requester: Requester,
  tenantId: string,
  hostId: string,
): boolean {
  return (
    (requester.role === 'TENANT' && requester.id === tenantId) ||
    (requester.role === 'HOST' && requester.id === hostId)
  );
}
