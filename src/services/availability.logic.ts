import type { BookedRange } from '../types/place.types.js';

/**
 * Logika periode ketersediaan murni (tanpa akses database).
 *
 * Dipakai bersama oleh `place.service.ts` (checkAvailability) dan
 * `booking.service.ts` (createBooking & previewPrice) supaya batas tanggal
 * yang dikirim ke tenant selalu diperiksa dengan aturan yang sama.
 */

/** Status konflik untuk tanggal di luar periode ketersediaan tempat. */
export const CONFLICT_STATUS_PERIODE = 'PERIODE_TIDAK_TERSEDIA';

/**
 * Konflik karena tanggal diminta berada di luar periode ketersediaan tempat.
 * Periode hanya diperiksa bila salah satu batasnya diatur oleh Host.
 */
export function getAvailabilityPeriodConflicts(
  place: { tanggal_mulai_tersedia: string | null; tanggal_selesai_tersedia: string | null },
  tanggalMulai: string,
  tanggalSelesai: string,
): BookedRange[] {
  const conflicts: BookedRange[] = [];

  if (place.tanggal_mulai_tersedia && tanggalMulai < place.tanggal_mulai_tersedia) {
    conflicts.push({
      tanggal_mulai: place.tanggal_mulai_tersedia,
      tanggal_selesai: place.tanggal_mulai_tersedia,
      status: CONFLICT_STATUS_PERIODE,
    });
  }

  if (place.tanggal_selesai_tersedia && tanggalSelesai > place.tanggal_selesai_tersedia) {
    conflicts.push({
      tanggal_mulai: place.tanggal_selesai_tersedia,
      tanggal_selesai: place.tanggal_selesai_tersedia,
      status: CONFLICT_STATUS_PERIODE,
    });
  }

  return conflicts;
}
