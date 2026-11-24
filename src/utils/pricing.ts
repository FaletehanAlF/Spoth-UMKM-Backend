/**
 * Pembulatan uang ke 2 desimal (satuan rupiah penuh).
 *
 * Semua perhitungan harga memakai helper ini supaya tidak ada selisih
 * pembulatan antara total harga, komisi platform, dan pendapatan host.
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
  /** Harga sewa + biaya admin (yang dibayar Tenant). */
  total_harga: number;
  /** Biaya admin platform yang disertakan pada total. */
  admin_fee: number;
  /** Pendapatan platform: hanya sebesar biaya admin. */
  komisi_platform: number;
  /** Pendapatan Host: harga sewa tanpa biaya admin. */
  pendapatan_host: number;
}

/**
 * Menghitung rincian biaya sewa:
 *   Harga Sewa      = Harga per satuan x Jumlah Durasi
 *   Biaya Admin     = Rp2.000 (konstanta ADMIN_FEE)
 *   Total Harga     = Harga Sewa + Biaya Admin
 *   Komisi Platform = Biaya Admin
 *   Pendapatan Host = Total Harga - Komisi Platform = Harga Sewa
 *
 * Dengan begitu Host menerima harga sewanya secara utuh, sedangkan platform
 * mendapat Rp2.000 dari setiap pembayaran.
 */
export function calculatePrice(
  harga: number,
  jumlahDurasi: number,
  adminFee = 0,
): PriceBreakdown {
  const harga_satuan = harga;
  const harga_sewa = roundMoney(harga_satuan * jumlahDurasi);
  const total_harga = roundMoney(harga_sewa + adminFee);
  const komisi_platform = roundMoney(adminFee);
  const pendapatan_host = roundMoney(total_harga - komisi_platform);

  return {
    harga_satuan,
    jumlah_durasi: jumlahDurasi,
    total_harga,
    admin_fee: adminFee,
    komisi_platform,
    pendapatan_host,
  };
}
