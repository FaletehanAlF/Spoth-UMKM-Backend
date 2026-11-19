import { parseDateOnly } from '../utils/date.js';
import type { AvailabilityRuleRow, BookedRange } from '../types/place.types.js';

/**
 * Logika ketersediaan murni (tanpa akses database).
 *
 * Fungsi-fungsi di sini dipakai bersama oleh:
 * - `placeAvailability.service.ts` (aturan ketersediaan tempat)
 * - `place.service.ts` (checkAvailability)
 * - `booking.service.ts` (createBooking & previewPrice)
 *
 * Dengan begitu pemeriksaan ketersediaan pada preview dan pembuatan
 * pemesanan SELALU memakai aturan yang sama.
 */

/** Status konflik untuk tempat yang sedang NONAKTIF. */
export const CONFLICT_STATUS_TIDAK_AKTIF = 'STATUS_TIDAK_AKTIF';

/** Status konflik untuk tanggal di luar periode ketersediaan tempat. */
export const CONFLICT_STATUS_PERIODE = 'PERIODE_TIDAK_TERSEDIA';

/** Status konflik untuk tanggal yang diblokir aturan ketersediaan. */
export const CONFLICT_STATUS_ATURAN = 'ATURAN_KETERSEDIAAN';

/**
 * Mengecek apakah sebuah aturan berlaku pada tanggal tertentu.
 *
 * - TANGGAL: berlaku pada seluruh rentang tanggal_mulai..tanggal_selesai.
 * - HARI   : berlaku bila hari (0=Minggu..6=Sabtu) cocok.
 * - BULAN  : berlaku bila bulan (1..12) cocok.
 *
 * Rentang tanggal aturan tetap menjadi batas berlakunya aturan.
 */
export function isRuleApplicable(rule: AvailabilityRuleRow, dateString: string, date: Date): boolean {
  if (dateString < rule.tanggal_mulai || dateString > rule.tanggal_selesai) {
    return false;
  }

  switch (rule.tipe_aturan) {
    case 'TANGGAL':
      return true;
    case 'HARI':
      return date.getUTCDay() === rule.hari;
    case 'BULAN':
      return date.getUTCMonth() + 1 === rule.bulan;
    default:
      return false;
  }
}

/**
 * Mengevaluasi seluruh aturan ketersediaan untuk rentang tanggal yang diminta.
 *
 * Aturan bersifat "blokir menang": bila ada satu saja aturan dengan
 * `tersedia = false` yang berlaku, tanggal tersebut dianggap tidak tersedia,
 * walaupun ada aturan lain dengan `tersedia = true` pada tanggal yang sama.
 */
export function evaluateAvailabilityRules(
  rules: AvailabilityRuleRow[],
  tanggalMulai: string,
  tanggalSelesai: string,
): BookedRange[] {
  if (rules.length === 0) {
    return [];
  }

  const start = parseDateOnly(tanggalMulai);
  const end = parseDateOnly(tanggalSelesai);

  for (
    let cursor = new Date(start.getTime());
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dateString = cursor.toISOString().slice(0, 10);
    const applicable = rules.filter((rule) => isRuleApplicable(rule, dateString, cursor));

    if (applicable.some((rule) => !rule.tersedia)) {
      return [
        {
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          status: CONFLICT_STATUS_ATURAN,
        },
      ];
    }
  }

  return [];
}

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

/**
 * Konflik karena tempat tidak berstatus AKTIF.
 * Tempat NONAKTIF tidak boleh dinyatakan tersedia oleh endpoint mana pun.
 */
export function getPlaceStatusConflict(
  status: string,
  tanggalMulai: string,
  tanggalSelesai: string,
): BookedRange | null {
  if (status === 'AKTIF') {
    return null;
  }

  return {
    tanggal_mulai: tanggalMulai,
    tanggal_selesai: tanggalSelesai,
    status: CONFLICT_STATUS_TIDAK_AKTIF,
  };
}
