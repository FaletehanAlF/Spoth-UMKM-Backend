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
 * Memakai harga promo bila tersedia, jika tidak memakai harga normal.
 * Aturan: "Harga per satuan = harga promo jika ada, jika tidak ada maka harga normal".
 */
export function getUnitPrice(hargaNormal: number, hargaPromo: number | null): number {
  return hargaPromo !== null && hargaPromo > 0 ? hargaPromo : hargaNormal;
}

export interface PriceBreakdown {
  /** Harga per satuan yang dipakai (promo bila ada). */
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
  hargaNormal: number,
  hargaPromo: number | null,
  jumlahDurasi: number,
  commissionRate = 0.1,
): PriceBreakdown {
  const harga_satuan = getUnitPrice(hargaNormal, hargaPromo);
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
