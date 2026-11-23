/**
 * Pembulatan uang ke 2 desimal (satuan rupiah penuh).
 *
 * Semua perhitungan harga memakai helper ini supaya tidak ada selisih
 * pembulatan antara total harga, komisi platform, dan pendapatan host
 * (SRS Subbab 3.3.6).
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Harga per satuan sewa.
 * Kini hanya ada satu harga (tidak ada promo), jadi langsung dipakai.
 */
export function getUnitPrice(harga: number): number {
  return harga;
}

export interface PriceBreakdown {
  /** Harga per satuan yang dipakai. */
  harga_satuan: number;
  /** Jumlah durasi sewa. */
  jumlah_durasi: number;
  /** Harga sewa dikali jumlah durasi. */
  total_harga: number;
  /** 10% dari total harga untuk platform. */
  komisi_platform: number;
  /** Total harga dikurangi komisi platform. */
  pendapatan_host: number;
}

/**
 * Menghitung rincian biaya sewa sesuai aturan SRS Subbab 3.3.6:
 *   Total Harga     = Harga per satuan x Jumlah Durasi
 *   Komisi Platform = 10% x Total Harga
 *   Pendapatan Host = Total Harga - Komisi Platform
 */
export function calculatePrice(
  harga: number,
  jumlahDurasi: number,
  commissionRate = 0.1,
): PriceBreakdown {
  const harga_satuan = harga;
  const total_harga = roundMoney(harga_satuan * jumlahDurasi);
  const komisi_platform = roundMoney(total_harga * commissionRate);
  const pendapatan_host = roundMoney(total_harga - komisi_platform);

  return {
    harga_satuan,
    jumlah_durasi: jumlahDurasi,
    total_harga,
    komisi_platform,
    pendapatan_host,
  };
}
