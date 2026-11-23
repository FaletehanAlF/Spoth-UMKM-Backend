import { pool } from '../config/database.js';
import { BOOKING_STATUS, type BookingStatus } from '../types/domain.js';
import { forbidden, notFound } from '../utils/app-error.js';
import { formatDateIndo, formatRupiah } from '../utils/date.js';
import type { EPassResponse } from '../types/epass.types.js';

interface EPassRow {
  id: string;
  kode_booking: string | null;
  place_id: string;
  tenant_id: string;
  host_id: string;
  nama_tempat: string;
  kategori: string;
  alamat: string;
  kecamatan: string;
  jenis_usaha: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_durasi: number;
  tipe_durasi: string;
  total_harga: string;
  komisi_platform: string;
  pendapatan_host: string;
  status: BookingStatus;
  nama_tenant: string;
  nama_host: string;
  metode: string | null;
  paid_at: Date | null;
  created_at: Date;
  foto: string[];
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

/**
 * Mengambil E-Pass sebuah pemesanan (SRS Tabel 3.1 Fitur "E-Pass Pemesanan").
 *
 * E-Pass hanya tersedia untuk pemesanan yang statusnya sudah LUNAS, karena
 * kode booking dibuat saat pembayaran berhasil.
 */
export async function getEPass(
  bookingId: string,
  requesterId: string,
  requesterRole: 'HOST' | 'TENANT',
): Promise<EPassResponse> {
  const result = await pool.query<EPassRow>(
    `SELECT
       b.id::text              AS id,
       b.kode_booking          AS kode_booking,
       b.place_id::text        AS place_id,
       b.tenant_id::text       AS tenant_id,
       p.host_id::text         AS host_id,
       p.nama_tempat           AS nama_tempat,
       p.kategori              AS kategori,
       p.alamat                AS alamat,
       p.kecamatan            AS kecamatan,
       b.jenis_usaha           AS jenis_usaha,
       b.tanggal_mulai::text  AS tanggal_mulai,
       b.tanggal_selesai::text AS tanggal_selesai,
       b.jumlah_durasi         AS jumlah_durasi,
       p.tipe_durasi           AS tipe_durasi,
       b.total_harga           AS total_harga,
       b.komisi_platform       AS komisi_platform,
       b.pendapatan_host       AS pendapatan_host,
       b.status                AS status,
       b.created_at            AS created_at,
       tenant.nama             AS nama_tenant,
       host.nama               AS nama_host,
       (SELECT pay.metode FROM payments pay
        WHERE pay.booking_id = b.id ORDER BY pay.created_at DESC LIMIT 1) AS metode,
       (SELECT pay.paid_at FROM payments pay
        WHERE pay.booking_id = b.id ORDER BY pay.created_at DESC LIMIT 1) AS paid_at,
       (SELECT COALESCE(array_agg(pi.url_foto), '{}')
        FROM place_images pi WHERE pi.place_id = p.id) AS foto
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     JOIN users tenant ON tenant.id = b.tenant_id
     JOIN users host ON host.id = p.host_id
     WHERE b.id = $1::integer
     LIMIT 1`,
    [bookingId],
  );

  const row = result.rows[0];

  if (!row) {
    throw notFound('Pemesanan tidak ditemukan');
  }

  const isOwnerTenant = row.tenant_id === requesterId;
  const isOwnerHost = row.host_id === requesterId;

  // Pola default-deny pada E-Pass: hanya TENANT milik pemesanan atau HOST
  // pemilik tempat yang boleh melihat.
  const isAllowed =
    (requesterRole === 'TENANT' && isOwnerTenant) ||
    (requesterRole === 'HOST' && isOwnerHost);

  if (!isAllowed) {
    throw forbidden('Anda tidak diizinkan membaca E-Pass ini');
  }

  if (row.status !== BOOKING_STATUS.LUNAS || !row.kode_booking) {
    throw notFound('E-Pass belum tersedia karena pemesanan belum lunas');
  }

  const totalHarga = toNumber(row.total_harga);

  return {
    kode_booking: row.kode_booking,
    nama_tempat: row.nama_tempat,
    kategori: row.kategori,
    alamat: row.alamat,
    kecamatan: row.kecamatan,
    foto: row.foto ?? [],
    jenis_usaha: row.jenis_usaha,
    tanggal_mulai: row.tanggal_mulai,
    tanggal_selesai: row.tanggal_selesai,
    jumlah_durasi: row.jumlah_durasi,
    tipe_durasi: row.tipe_durasi,
    harga_satuan: row.jumlah_durasi > 0 ? Math.round((totalHarga / row.jumlah_durasi) * 100) / 100 : 0,
    total_harga: totalHarga,
    komisi_platform: toNumber(row.komisi_platform),
    pendapatan_host: toNumber(row.pendapatan_host),
    status: row.status,
    nama_tenant: row.nama_tenant,
    nama_host: row.nama_host,
    metode_pembayaran: row.metode,
    tanggal_pembayaran: row.paid_at?.toISOString() ?? null,
    dibuat_pada: row.created_at?.toISOString(),
  };
}

/**
 * Membuat teks E-Pass siap cetak (dipakai saat frontend ingin menampilkannya
 * dalam bentuk kartu sederhana).
 */
export function formatEPassText(epass: EPassResponse): string {
  return [
    'E-PASS SPOTH UMKM',
    `Kode Booking : ${epass.kode_booking}`,
    `Tempat       : ${epass.nama_tempat}`,
    `Alamat       : ${epass.alamat}, ${epass.kecamatan}`,
    `Jenis Usaha  : ${epass.jenis_usaha}`,
    `Periode      : ${formatDateIndo(epass.tanggal_mulai)} s.d. ${formatDateIndo(epass.tanggal_selesai)}`,
    `Total Bayar  : ${formatRupiah(epass.total_harga)}`,
    `Komisi       : ${formatRupiah(epass.komisi_platform)}`,
    `Status       : ${epass.status}`,
  ].join('\n');
}


