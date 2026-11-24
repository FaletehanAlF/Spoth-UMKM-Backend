import { pool, withTransaction } from '../config/database.js';
import { ACTIVE_BOOKING_STATUSES } from '../types/domain.js';
import type { Queryable } from '../types/database.js';
import { AppError, conflict, notFound } from '../utils/app-error.js';
import { calculateEndDate, today } from '../utils/date.js';
import { buildPaginatedResult, toOffset, type PaginatedResult } from '../utils/pagination.js';
import { getUnitPrice } from '../utils/pricing.js';
import { getAvailabilityPeriodConflicts } from './availability.logic.js';
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
  p.harga               AS harga,
  p.tipe_durasi         AS tipe_durasi,
  p.created_at          AS created_at,
  p.updated_at          AS updated_at,
  p.tanggal_mulai_tersedia::text    AS tanggal_mulai_tersedia,
  p.tanggal_selesai_tersedia::text  AS tanggal_selesai_tersedia,
  u.nama                AS nama_host,
  (SELECT COUNT(*) FROM place_images pi WHERE pi.place_id = p.id)::int AS jumlah_foto
`;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

/** Mengubah baris database menjadi bentuk respons API. */
export function toPlaceResponse(
  row: PlaceRow,
  foto: string[] = [],
  sudahDiSewa = false,
): PlaceResponse {
  const harga = toNumber(row.harga);

  return {
    id: row.id,
    host_id: row.host_id,
    nama_tempat: row.nama_tempat,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    alamat: row.alamat,
    kecamatan: row.kecamatan,
    harga,
    tipe_durasi: row.tipe_durasi,
    created_at: row.created_at?.toISOString(),
    updated_at: row.updated_at?.toISOString(),
    tanggal_mulai_tersedia: row.tanggal_mulai_tersedia ?? null,
    tanggal_selesai_tersedia: row.tanggal_selesai_tersedia ?? null,
    foto,
    nama_host: row.nama_host,
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
         harga, tipe_durasi,
         tanggal_mulai_tersedia, tanggal_selesai_tersedia
       )
       VALUES ($1::integer, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date)
       RETURNING id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
                 alamat, kecamatan, harga,
                 tipe_durasi, created_at, updated_at,
                 tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
                 tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia`,
      [
        hostId,
        input.nama_tempat,
        input.kategori,
        input.deskripsi,
        input.alamat,
        input.kecamatan,
        input.harga,
        input.tipe_durasi,
        input.tanggal_mulai_tersedia ?? null,
        input.tanggal_selesai_tersedia ?? null,
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

  if (query.tipe_durasi) {
    conditions.push(`p.tipe_durasi = ${addValue(query.tipe_durasi)}`);
  }

  if (query.kecamatan) {
    conditions.push(`p.kecamatan ILIKE ${addValue(`%${query.kecamatan}%`)}`);
  }

  // Filter harga memakai harga sewa.
  const harga = 'p.harga';

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
         harga        = COALESCE($8, harga),
         tipe_durasi  = COALESCE($9, tipe_durasi),
         tanggal_mulai_tersedia   = CASE WHEN $10::boolean THEN $11::date ELSE tanggal_mulai_tersedia END,
         tanggal_selesai_tersedia = CASE WHEN $12::boolean THEN $13::date ELSE tanggal_selesai_tersedia END,
         updated_at   = NOW()
         WHERE id = $1::integer AND host_id = $2::integer
         RETURNING id::text AS id, host_id::text AS host_id, nama_tempat, kategori, deskripsi,
               alamat, kecamatan, harga, tipe_durasi,
               created_at, updated_at,
               tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
               tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia`,
    [
      placeId,
      hostId,
      input.nama_tempat ?? null,
      input.kategori ?? null,
      input.deskripsi ?? null,
      input.alamat ?? null,
      input.kecamatan ?? null,
      input.harga ?? null,
      input.tipe_durasi ?? null,
      input.tanggal_mulai_tersedia !== undefined,
      input.tanggal_mulai_tersedia ?? null,
      input.tanggal_selesai_tersedia !== undefined,
      input.tanggal_selesai_tersedia ?? null,
    ],
  );

  const place = result.rows[0];

  if (!place) {
    throw notFound('Tempat tidak ditemukan');
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
            alamat, kecamatan, harga,
            tipe_durasi, created_at, updated_at,
             tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
             tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia
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
  jumlahDurasi: number,
): Promise<AvailabilityResult> {
  // Sama seperti createBooking: tanggal lampau selalu ditolak.
  if (tanggalMulai < today()) {
    throw new AppError('Tanggal mulai sewa tidak boleh di masa lalu', 400);
  }

  const place = await pool.query<PlaceRow>(
    `SELECT id::text AS id, tipe_durasi,
            tanggal_mulai_tersedia::text AS tanggal_mulai_tersedia,
            tanggal_selesai_tersedia::text AS tanggal_selesai_tersedia
     FROM places WHERE id = $1::integer LIMIT 1`,
    [placeId],
  );

  const row = place.rows[0];

  if (!row) {
    throw notFound('Tempat tidak ditemukan');
  }

  const tanggalSelesai = calculateEndDate(tanggalMulai, row.tipe_durasi, jumlahDurasi);

  const periodConflicts = getAvailabilityPeriodConflicts(row, tanggalMulai, tanggalSelesai);
  const konflik = await findScheduleConflicts(placeId, tanggalMulai, tanggalSelesai);

  const allConflicts = [...periodConflicts, ...konflik];

  return {
    tersedia: allConflicts.length === 0,
    tanggal_mulai: tanggalMulai,
    tanggal_selesai: tanggalSelesai,
    jumlah_durasi: jumlahDurasi,
    konflik: allConflicts,
  };
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





