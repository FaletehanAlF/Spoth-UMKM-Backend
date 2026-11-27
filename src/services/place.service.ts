import { pool, withTransaction } from '../config/database.js';
import { ACTIVE_BOOKING_STATUSES, DURATION_TYPE, type DurationType } from '../types/domain.js';
import type { Queryable } from '../types/database.js';
import { AppError, conflict, notFound } from '../utils/app-error.js';
import { calculateEndDate, today } from '../utils/date.js';
import { buildPaginatedResult, toOffset, type PaginatedResult } from '../utils/pagination.js';
import { ensureCategory } from './category.service.js';
import type {
  AvailabilityResult,
  BookedRange,
  CreatePlaceInput,
  MyPlaceQuery,
  PlaceDetailResponse,
  PlaceResponse,
  PlaceRow,
  PlaceSummaryResponse,
  SearchPlaceQuery,
  UpdatePlaceInput,
} from '../types/place.types.js';

/** Kolom yang selalu diambil saat membaca data tempat. */
const PLACE_COLUMNS = `
  p.id::text            AS id,
  p.host_id::text       AS host_id,
  p.nama_tempat         AS nama_tempat,
  p.kategori            AS kategori,
  p.deskripsi           AS deskripsi,
  p.alamat              AS alamat,
  p.kecamatan           AS kecamatan,
  p.harga_mingguan    AS harga_mingguan,
  p.harga_bulanan     AS harga_bulanan,
  p.created_at          AS created_at,
  p.updated_at          AS updated_at,
  u.nama                AS nama_host,
  u.foto                AS foto_host,
  (SELECT COUNT(*) FROM place_images pi WHERE pi.place_id = p.id)::int AS jumlah_foto
`;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

/**
 * Menentukan paket termurah dari sebuah tempat.
 *
 * Minimal satu paket selalu terisi (dijaga oleh constraint database), jadi
 * fungsi ini tidak pernah mengembalikan nilai kosong.
 */
function pilihPaketTermurah(
  hargaMingguan: number | null,
  hargaBulanan: number | null,
): { harga: number; satuan: DurationType } {
  if (hargaMingguan !== null && (hargaBulanan === null || hargaMingguan <= hargaBulanan)) {
    return { harga: hargaMingguan, satuan: DURATION_TYPE.MINGGUAN };
  }

  return { harga: hargaBulanan ?? 0, satuan: DURATION_TYPE.BULANAN };
}

/** Mengubah baris database menjadi bentuk respons API. */
export function toPlaceResponse(
  row: PlaceRow,
  foto: string[] = [],
  sudahDiSewa = false,
): PlaceResponse {
  const hargaMingguan = row.harga_mingguan === null ? null : toNumber(row.harga_mingguan);
  const hargaBulanan = row.harga_bulanan === null ? null : toNumber(row.harga_bulanan);
  const termurah = pilihPaketTermurah(hargaMingguan, hargaBulanan);

  return {
    id: row.id,
    host_id: row.host_id,
    nama_tempat: row.nama_tempat,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    alamat: row.alamat,
    kecamatan: row.kecamatan,
    harga_mingguan: hargaMingguan,
    harga_bulanan: hargaBulanan,
    harga_terendah: termurah.harga,
    satuan_terendah: termurah.satuan,
    created_at: row.created_at?.toISOString(),
    updated_at: row.updated_at?.toISOString(),
    foto,
    nama_host: row.nama_host,
    foto_host: row.foto_host ?? null,
    sudah_di_sewa: sudahDiSewa,
    jumlah_foto: row.jumlah_foto === undefined ? foto.length : toNumber(row.jumlah_foto),
  };
}

/**
 * Mengambil ID tempat yang sedang memiliki pemesanan aktif.
 * Dipakai untuk menandai "sudah di sewa" pada daftar tempat milik Host.
 */
async function getBookedPlaceIds(placeIds: string[]): Promise<Set<string>> {
  if (placeIds.length === 0) {
    return new Set();
  }

  const result = await pool.query<{ place_id: string }>(
    `SELECT DISTINCT place_id::text AS place_id
     FROM bookings
     WHERE place_id = ANY($1::integer[])
       AND status = ANY($2::varchar[])`,
    [placeIds, ACTIVE_BOOKING_STATUSES],
  );

  return new Set(result.rows.map((row) => row.place_id));
}

/** Mengambil daftar URL foto sebuah tempat. */
async function getPlacePhotos(placeId: string, client: Queryable = pool): Promise<string[]> {
  const result = await client.query<{ url_foto: string }>(
    'SELECT url_foto FROM place_images WHERE place_id = $1::integer ORDER BY id ASC',
    [placeId],
  );

  return result.rows.map((row) => row.url_foto);
}

/** Mengganti seluruh daftar foto sebuah tempat. */
async function replacePlacePhotos(
  client: Queryable,
  placeId: string,
  photos: string[],
): Promise<void> {
  await client.query('DELETE FROM place_images WHERE place_id = $1::integer', [placeId]);

  for (const url of photos) {
    await client.query(
      'INSERT INTO place_images (place_id, url_foto) VALUES ($1::integer, $2)',
      [placeId, url],
    );
  }
}

/**
 * Membuat tempat baru (SRS Tabel 3.1 Fitur "Kelola Tempat").
 * Harga sewa ikut tersimpan di sini (Fitur "Kelola Harga").
 */
export async function createPlace(
  hostId: string,
  input: CreatePlaceInput,
): Promise<PlaceResponse> {
  // Pembuatan tempat dan fotonya dilakukan dalam satu transaksi supaya tidak
  // ada tempat tersimpan tanpa foto bila penyimpanan foto gagal.
  return withTransaction(async (client) => {
    const result = await client.query<PlaceRow>(
      `INSERT INTO places (
         host_id, nama_tempat, kategori, deskripsi, alamat, kecamatan,
         harga_mingguan, harga_bulanan
       )
       VALUES ($1::integer, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
                alamat, kecamatan, harga_mingguan, harga_bulanan,
                created_at, updated_at`,
      [
        hostId,
        input.nama_tempat,
        input.kategori,
        input.deskripsi,
        input.alamat,
        input.kecamatan,
        input.harga_mingguan ?? null,
        input.harga_bulanan ?? null,
      ],
    );

    const place = result.rows[0];

    if (!place) {
      throw new AppError('Gagal menyimpan tempat', 500);
    }

    // Daftarkan kategori (preset/custom) ke master categories agar muncul di dropdown.
    await ensureCategory(input.kategori, hostId, client);

    const foto = input.foto ?? [];

    if (foto.length > 0) {
      await replacePlacePhotos(client, place.id, foto);
    }

    return toPlaceResponse(place, foto);
  });
}

/**
 * Mencari dan memfilter tempat (SRS Tabel 3.1 Fitur "Pencarian Tempat" dan
 * "Filter Tempat").
 */
export async function listPlaces(query: SearchPlaceQuery): Promise<PaginatedResult<PlaceResponse>> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addValue = (value: unknown): string => {
    values.push(value);

    return `$${values.length}`;
  };

  if (query.keyword) {
    const param = addValue(`%${query.keyword}%`);
    conditions.push(
      `(p.nama_tempat ILIKE ${param}
        OR COALESCE(p.deskripsi, '') ILIKE ${param}
        OR p.kecamatan ILIKE ${param})`,
    );
  }

  if (query.kategori) {
    conditions.push(`p.kategori = ${addValue(query.kategori)}`);
  }

  if (query.durasi === DURATION_TYPE.MINGGUAN) {
    conditions.push('p.harga_mingguan IS NOT NULL');
  }

  if (query.durasi === DURATION_TYPE.BULANAN) {
    conditions.push('p.harga_bulanan IS NOT NULL');
  }

  if (query.kecamatan) {
    conditions.push(`p.kecamatan ILIKE ${addValue(`%${query.kecamatan}%`)}`);
  }

  // Harga yang dibandingkan adalah paket termurah dari setiap tempat.
  const harga = 'LEAST(COALESCE(p.harga_mingguan, 999999999), COALESCE(p.harga_bulanan, 999999999))';

  if (query.min_harga !== undefined) {
    conditions.push(`${harga} >= ${addValue(query.min_harga)}`);
  }

  if (query.max_harga !== undefined) {
    conditions.push(`${harga} <= ${addValue(query.max_harga)}`);
  }

  // Tanpa filter, kondisi kosong diganti TRUE agar query tetap valid.
  const whereClause = conditions.length === 0 ? 'TRUE' : conditions.join(' AND ');

  const orderByMap: Record<NonNullable<SearchPlaceQuery['sort']>, string> = {
    terbaru: 'p.created_at DESC, p.id DESC',
    terlama: 'p.created_at ASC, p.id ASC',
    harga_asc: `${harga} ASC, p.id DESC`,
    harga_desc: `${harga} DESC, p.id DESC`,
    nama: 'p.nama_tempat ASC',
  };

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM places p WHERE ${whereClause}`,
    values,
  );

  const total = toNumber(countResult.rows[0]?.total);

  const limitParam = addValue(query.limit);
  const offsetParam = addValue(toOffset(query.page, query.limit));

  const dataResult = await pool.query<PlaceRow>(
    `SELECT ${PLACE_COLUMNS}
     FROM places p
     JOIN users u ON u.id = p.host_id
     WHERE ${whereClause}
     ORDER BY ${orderByMap[query.sort ?? 'terbaru']}
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const items = await Promise.all(
    dataResult.rows.map(async (row) => toPlaceResponse(row, await getPlacePhotos(row.id))),
  );

  return buildPaginatedResult(items, total, query.page, query.limit);
}

/** Daftar tempat milik Host yang sedang login (Dashboard Host). */
export async function listMyPlaces(
  hostId: string,
  query: MyPlaceQuery,
): Promise<PaginatedResult<PlaceResponse>> {
  const conditions: string[] = ['p.host_id = $1::integer'];
  const values: unknown[] = [hostId];

  if (query.keyword) {
    values.push(`%${query.keyword}%`);
    conditions.push(
      `(p.nama_tempat ILIKE $${values.length} OR COALESCE(p.deskripsi, '') ILIKE $${values.length})`,
    );
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM places p WHERE ${whereClause}`,
    values,
  );

  const total = toNumber(countResult.rows[0]?.total);

  values.push(query.limit);
  const limitParam = `$${values.length}`;
  values.push(toOffset(query.page, query.limit));
  const offsetParam = `$${values.length}`;

  const dataResult = await pool.query<PlaceRow>(
    `SELECT ${PLACE_COLUMNS}
     FROM places p
     JOIN users u ON u.id = p.host_id
     WHERE ${whereClause}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const bookedPlaceIds = await getBookedPlaceIds(dataResult.rows.map((row) => row.id));

  const items = await Promise.all(
    dataResult.rows.map(async (row) =>
      toPlaceResponse(row, await getPlacePhotos(row.id), bookedPlaceIds.has(row.id)),
    ),
  );

  return buildPaginatedResult(items, total, query.page, query.limit);
}

/** Mengambil detail satu tempat. */
export async function getPlaceDetail(placeId: string): Promise<PlaceDetailResponse> {
  const result = await pool.query<PlaceRow>(
    `SELECT ${PLACE_COLUMNS}
     FROM places p
     JOIN users u ON u.id = p.host_id
     WHERE p.id = $1::integer
     LIMIT 1`,
    [placeId],
  );

  const place = result.rows[0];

  if (!place) {
    throw notFound('Tempat tidak ditemukan');
  }

  const [foto, jadwal] = await Promise.all([
    getPlacePhotos(place.id),
    getBookedRanges(place.id),
  ]);

  return {
    ...toPlaceResponse(place, foto, jadwal.length > 0),
    jadwal_terpakai: jadwal,
  };
}

/** Daftar rentang tanggal yang sudah dipesan oleh tenant lain. */
export async function getBookedRanges(placeId: string): Promise<BookedRange[]> {
  const result = await pool.query<BookedRange>(
    `SELECT
       tanggal_mulai::text AS tanggal_mulai,
       tanggal_selesai::text AS tanggal_selesai,
       status
     FROM bookings
     WHERE place_id = $1::integer
       AND status = ANY($2::varchar[])
     ORDER BY tanggal_mulai ASC`,
    [placeId, ACTIVE_BOOKING_STATUSES],
  );

  return result.rows;
}

/**
 * Memperbarui tempat milik Host (Fitur "Kelola Tempat" dan "Kelola Harga").
 * Host lain tidak boleh mengubah tempat yang bukan miliknya.
 */
export async function updatePlace(
  placeId: string,
  hostId: string,
  input: UpdatePlaceInput,
): Promise<PlaceResponse> {
  await assertPlaceOwnedBy(placeId, hostId);

  const result = await pool.query<PlaceRow>(
    `UPDATE places
     SET nama_tempat  = COALESCE($3, nama_tempat),
         kategori     = COALESCE($4, kategori),
         deskripsi    = COALESCE($5, deskripsi),
         alamat       = COALESCE($6, alamat),
         kecamatan    = COALESCE($7, kecamatan),
         harga_mingguan = CASE WHEN $8::boolean THEN $9::numeric ELSE harga_mingguan END,
         harga_bulanan  = CASE WHEN $10::boolean THEN $11::numeric ELSE harga_bulanan END,
         updated_at   = NOW()
         WHERE id = $1::integer AND host_id = $2::integer
         RETURNING id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
               alamat, kecamatan, harga_mingguan, harga_bulanan,
               created_at, updated_at`,
    [
      placeId,
      hostId,
      input.nama_tempat ?? null,
      input.kategori ?? null,
      input.deskripsi ?? null,
      input.alamat ?? null,
      input.kecamatan ?? null,
      input.harga_mingguan !== undefined,
      input.harga_mingguan ?? null,
      input.harga_bulanan !== undefined,
      input.harga_bulanan ?? null,
    ],
  );

  const place = result.rows[0];

  if (!place) {
    throw notFound('Tempat tidak ditemukan');
  }

  // Constraint database menolak tempat tanpa paket; pesan errornya dibuat
  // lebih jelas untuk Host.
  if (place.harga_mingguan === null && place.harga_bulanan === null) {
    throw new AppError('Aktifkan minimal satu paket: mingguan atau bulanan.', 400);
  }

  // Auto-daftar kategori custom ke master categories (bila diubah).
  if (input.kategori) {
    await ensureCategory(input.kategori, hostId);
  }

  let foto = await getPlacePhotos(placeId);

  if (input.foto !== undefined) {
    await replacePlacePhotos(pool, placeId, input.foto);
    foto = input.foto;
  }

  return toPlaceResponse(place, foto);
}

/**
 * Menghapus tempat milik Host.
 * Tempat yang masih punya pemesanan aktif tidak boleh dihapus supaya riwayat
 * transaksi tetap utuh.
 */
export async function deletePlace(placeId: string, hostId: string): Promise<void> {
  await assertPlaceOwnedBy(placeId, hostId);

  const active = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM bookings
     WHERE place_id = $1::integer
       AND status = ANY($2::varchar[])`,
    [placeId, ACTIVE_BOOKING_STATUSES],
  );

  if (toNumber(active.rows[0]?.total) > 0) {
    throw conflict(
      'Tempat tidak bisa dihapus karena masih memiliki pemesanan yang aktif',
    );
  }

  await pool.query('DELETE FROM places WHERE id = $1::integer AND host_id = $2::integer', [
    placeId,
    hostId,
  ]);
}

/** Memastikan tempat ada dan dimiliki oleh Host tersebut. */
export async function assertPlaceOwnedBy(placeId: string, hostId: string): Promise<PlaceRow> {
  const result = await pool.query<PlaceRow>(
    `SELECT id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
            alamat, kecamatan, harga_mingguan, harga_bulanan,
            created_at, updated_at
     FROM places
     WHERE id = $1::integer AND host_id = $2::integer
     LIMIT 1`,
    [placeId, hostId],
  );

  const place = result.rows[0];

  if (!place) {
    throw notFound('Tempat tidak ditemukan atau bukan milik Anda');
  }

  return place;
}

/**
 * Memeriksa apakah rentang tanggal yang diminta bentrok dengan pemesanan lain.
 *
 * Aturan SRS Subbab 3.3.6:
 * "Jadwal bentrok jika Tanggal Mulai baru <= Tanggal Selesai lama dan
 *  Tanggal Selesai baru >= Tanggal Mulai lama, pada tempat yang sama dengan
 *  status menunggu pembayaran atau lunas."
 */
export async function findScheduleConflicts(
  placeId: string,
  tanggalMulai: string,
  tanggalSelesai: string,
  client: Queryable = pool,
  excludeBookingId?: string,
): Promise<BookedRange[]> {
  const result = await client.query<BookedRange>(
    `SELECT
       tanggal_mulai::text AS tanggal_mulai,
       tanggal_selesai::text AS tanggal_selesai,
       status
     FROM bookings
     WHERE place_id = $1::integer
       AND status = ANY($2::varchar[])
       AND $3::date <= tanggal_selesai
       AND $4::date >= tanggal_mulai
       ${excludeBookingId ? 'AND id <> $5::integer' : ''}
     ORDER BY tanggal_mulai ASC`,
    excludeBookingId
      ? [placeId, ACTIVE_BOOKING_STATUSES, tanggalMulai, tanggalSelesai, excludeBookingId]
      : [placeId, ACTIVE_BOOKING_STATUSES, tanggalMulai, tanggalSelesai],
  );

  return result.rows;
}

/**
 * Mengecek ketersediaan jadwal sebuah tempat.
 * Dipakai pada halaman Detail Tempat sebelum Tenant menekan tombol pesan.
 */
export async function checkAvailability(
  placeId: string,
  tanggalMulai: string,
  tipeDurasi: DurationType,
  jumlahDurasi: number,
): Promise<AvailabilityResult> {
  // Sama seperti createBooking: tanggal lampau selalu ditolak.
  if (tanggalMulai < today()) {
    throw new AppError('Tanggal mulai sewa tidak boleh di masa lalu', 400);
  }

  const place = await pool.query<PlaceRow>(
    `SELECT id::text AS id, harga_mingguan, harga_bulanan
     FROM places WHERE id = $1::integer LIMIT 1`,
    [placeId],
  );

  const row = place.rows[0];

  if (!row) {
    throw notFound('Tempat tidak ditemukan');
  }

  // Pastikan tempat memang menawarkan paket yang diminta.
  hargaPaket(row, tipeDurasi);

  const tanggalSelesai = calculateEndDate(tanggalMulai, tipeDurasi, jumlahDurasi);

  const konflik = await findScheduleConflicts(placeId, tanggalMulai, tanggalSelesai);

  return {
    tersedia: konflik.length === 0,
    tanggal_mulai: tanggalMulai,
    tanggal_selesai: tanggalSelesai,
    jumlah_durasi: jumlahDurasi,
    konflik,
  };
}

/** Mengambil harga paket yang dipilih, atau menolak bila paket tidak aktif. */
export function hargaPaket(
  place: Pick<PlaceRow, 'harga_mingguan' | 'harga_bulanan'>,
  tipeDurasi: DurationType,
): number {
  const harga =
    tipeDurasi === DURATION_TYPE.BULANAN ? place.harga_bulanan : place.harga_mingguan;

  if (harga === null || harga === undefined) {
    const label = tipeDurasi === DURATION_TYPE.BULANAN ? 'bulanan' : 'mingguan';
    throw new AppError(`Tempat ini tidak menyediakan paket ${label}`, 400);
  }

  return toNumber(harga);
}

/**
 * Ringkasan dashboard Host: jumlah tempat, jumlah pesanan, dan total
 * pendapatan host setelah biaya admin platform dipisahkan.
 */
export async function getHostSummary(hostId: string): Promise<PlaceSummaryResponse> {
  const [placeCount, bookingSummary, monthlyRevenue] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM places WHERE host_id = $1::integer`,
      [hostId],
    ),
    pool.query<{
      total: string;
      menunggu: string;
      lunas: string;
      pendapatan: string;
      komisi: string;
    }>(
      `SELECT
         COUNT(b.id)::text AS total,
         COUNT(b.id) FILTER (WHERE b.status = 'MENUNGGU_PEMBAYARAN')::text AS menunggu,
         COUNT(b.id) FILTER (WHERE b.status = 'LUNAS')::text AS lunas,
         COALESCE(SUM(b.pendapatan_host) FILTER (WHERE b.status = 'LUNAS'), 0)::text AS pendapatan,
         COALESCE(SUM(b.komisi_platform) FILTER (WHERE b.status = 'LUNAS'), 0)::text AS komisi
       FROM bookings b
       JOIN places p ON p.id = b.place_id
       WHERE p.host_id = $1::integer`,
      [hostId],
    ),
    // Pendapatan bersih per bulan. Enam bulan terakhir selalu dikirim
    // berurutan, termasuk bulan yang belum punya pemesanan (nilainya 0),
    // supaya grafik garis di aplikasi punya titik yang lengkap.
    pool.query<{ bulan: string; pendapatan: string }>(
      `WITH bulan AS (
         SELECT
           DATE_TRUNC('month', NOW()) - (n || ' month')::interval AS awal,
           TO_CHAR(
             DATE_TRUNC('month', NOW()) - (n || ' month')::interval,
             'YYYY-MM'
           ) AS bulan
         FROM generate_series(0, 5) AS n
       )
       SELECT
         b.bulan,
         COALESCE(SUM(bk.pendapatan_host), 0)::text AS pendapatan
       FROM bulan b
       LEFT JOIN bookings bk
         ON DATE_TRUNC('month', bk.created_at) = b.awal
        AND bk.status = 'LUNAS'
        AND bk.place_id IN (
          SELECT id FROM places WHERE host_id = $1::integer
        )
       GROUP BY b.bulan, b.awal
       ORDER BY b.awal ASC`,
      [hostId],
    ),
  ]);

  const places = placeCount.rows[0];
  const bookings = bookingSummary.rows[0];

  return {
    total_tempat: toNumber(places?.total),
    total_pemesanan: toNumber(bookings?.total),
    pemesanan_menunggu: toNumber(bookings?.menunggu),
    pemesanan_lunas: toNumber(bookings?.lunas),
    total_pendapatan: toNumber(bookings?.pendapatan),
    total_komisi: toNumber(bookings?.komisi),
    pendapatan_bulanan: monthlyRevenue.rows.map((row) => ({
      bulan: row.bulan,
      pendapatan: toNumber(row.pendapatan),
    })),
  };
}





