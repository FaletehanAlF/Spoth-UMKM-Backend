import type { DurationType } from '../types/domain.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Format tanggal `YYYY-MM-DD` menjadi objek Date tengah malam UTC. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Format objek Date menjadi `YYYY-MM-DD` (menotrosi zona waktu lokal). */
export function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Tambah sejumlah hari pada tanggal (hasil tetap `YYYY-MM-DD`). */
export function addDays(dateString: string, days: number): string {
  const date = parseDateOnly(dateString);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** Tambah sejumlah bulan pada tanggal (hasil tetap `YYYY-MM-DD`). */
export function addMonths(dateString: string, months: number): string {
  const date = parseDateOnly(dateString);
  const day = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  // Kembalikan ke tanggal asli bila bulan tujuan lebih pendek.
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();

  date.setUTCDate(Math.min(day, daysInTargetMonth));

  return date.toISOString().slice(0, 10);
}

/** Jumlah hari antara dua tanggal (tanggal akhir ikut dihitung). */
export function countDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate).getTime();
  const end = parseDateOnly(endDate).getTime();

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Menghitung tanggal akhir sewa dari tanggal mulai, satuan durasi, dan
 * jumlah durasi.
 *
 * Contoh (HARIAN, mulai 2026-12-01, jumlah 3): 2026-12-03.
 * Tanggal awal dan tanggal akhir sama-sama ikut dihitung sebagai hari sewa.
 */
export function calculateEndDate(
  startDate: string,
  durationType: DurationType,
  jumlahDurasi: number,
): string {
  switch (durationType) {
    case 'HARIAN':
      return addDays(startDate, jumlahDurasi - 1);
    case 'MINGGUAN':
      return addDays(startDate, jumlahDurasi * 7 - 1);
    case 'BULANAN':
      return addMonths(startDate, jumlahDurasi) === startDate
        ? startDate
        : addDays(addMonths(startDate, jumlahDurasi), -1);
    default:
      return startDate;
  }
}

/**
 * Format tanggal Indonesia (contoh: "1 Desember 2026").
 * Dipakai pada E-Pass dan ringkasan pemesanan.
 */
export function formatDateIndo(value: string | Date): string {
  const date = typeof value === 'string' ? parseDateOnly(value) : value;
  const bulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
}

/** Format angka menjadi mata uang rupiah (contoh: "Rp 360.000"). */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/** Tanggal hari ini dalam format `YYYY-MM-DD`. */
export function today(): string {
  return formatDateOnly(new Date());
}
