import { pool } from '../config/database.js';
import type { Queryable } from '../types/database.js';
import { AppError, notFound } from '../utils/app-error.js';
import { evaluateAvailabilityRules } from './availability.logic.js';
import type {
  AvailabilityRuleResponse,
  AvailabilityRuleRow,
  BookedRange,
  CreateAvailabilityRuleInput,
  UpdateAvailabilityRuleInput,
} from '../types/place.types.js';
import { collectAvailabilityRuleIssues } from '../validators/place.validation.js';

/** Query yang dipakai untuk membaca satu aturan ketersediaan. */
const SELECT_RULE = `
  SELECT id::text               AS id,
         place_id::text         AS place_id,
         tipe_aturan            AS tipe_aturan,
         tanggal_mulai::text    AS tanggal_mulai,
         tanggal_selesai::text  AS tanggal_selesai,
         hari                   AS hari,
         bulan                  AS bulan,
         tersedia               AS tersedia,
         created_at             AS created_at,
         updated_at             AS updated_at
  FROM place_availability_rules
  WHERE id = $1::integer AND place_id = $2::integer
  LIMIT 1
`;

const RULE_COLUMNS = `
  id::text               AS id,
  place_id::text         AS place_id,
  tipe_aturan            AS tipe_aturan,
  tanggal_mulai::text    AS tanggal_mulai,
  tanggal_selesai::text  AS tanggal_selesai,
  hari                   AS hari,
  bulan                  AS bulan,
  tersedia               AS tersedia,
  created_at             AS created_at,
  updated_at             AS updated_at
`;

/**
 * Aturan baru selalu default TIDAK tersedia (keputusan produk).
 * Host harus secara eksplisit mengubahnya menjadi tersedia bila diinginkan.
 */
const DEFAULT_TERSEDIA = false;

function toRuleResponse(row: AvailabilityRuleRow): AvailabilityRuleResponse {
  return {
    id: row.id,
    place_id: row.place_id,
    tipe_aturan: row.tipe_aturan,
    tanggal_mulai: row.tanggal_mulai,
    tanggal_selesai: row.tanggal_selesai,
    hari: row.hari,
    bulan: row.bulan,
    tersedia: row.tersedia,
    created_at: row.created_at?.toISOString(),
    updated_at: row.updated_at?.toISOString(),
  };
}

async function assertPlaceOwnedBy(
  placeId: string,
  hostId: string,
  client: Queryable = pool,
): Promise<void> {
  const result = await client.query<{ id: string }>(
    'SELECT id::text AS id FROM places WHERE id = $1::integer AND host_id = $2::integer LIMIT 1',
    [placeId, hostId],
  );

  if (result.rows.length === 0) {
    throw notFound('Tempat tidak ditemukan atau bukan milik Anda');
  }
}

/** Melempar error validasi bila hasil gabungan nilai lama + baru tidak konsisten. */
function assertRuleConsistency(value: {
  tipe_aturan: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  hari: number | null;
  bulan: number | null;
  tersedia: boolean;
}): void {
  const issues = collectAvailabilityRuleIssues(value);

  if (issues.length > 0) {
    throw new AppError('Validasi data gagal', 400, issues);
  }
}

export async function listRules(
  placeId: string,
  hostId?: string,
): Promise<AvailabilityRuleResponse[]> {
  if (hostId) {
    await assertPlaceOwnedBy(placeId, hostId);
  }

  const result = await pool.query<AvailabilityRuleRow>(
    `SELECT ${RULE_COLUMNS}
     FROM place_availability_rules
     WHERE place_id = $1::integer
     ORDER BY tanggal_mulai ASC, id ASC`,
    [placeId],
  );

  return result.rows.map(toRuleResponse);
}

export async function createRule(
  placeId: string,
  hostId: string,
  input: CreateAvailabilityRuleInput,
): Promise<AvailabilityRuleResponse> {
  await assertPlaceOwnedBy(placeId, hostId);

  const tersedia = input.tersedia ?? DEFAULT_TERSEDIA;

  assertRuleConsistency({
    tipe_aturan: input.tipe_aturan,
    tanggal_mulai: input.tanggal_mulai,
    tanggal_selesai: input.tanggal_selesai,
    hari: input.hari ?? null,
    bulan: input.bulan ?? null,
    tersedia,
  });

  const result = await pool.query<AvailabilityRuleRow>(
    `INSERT INTO place_availability_rules
       (place_id, tipe_aturan, tanggal_mulai, tanggal_selesai, hari, bulan, tersedia)
     VALUES ($1::integer, $2, $3::date, $4::date, $5, $6, $7)
     RETURNING ${RULE_COLUMNS}`,
    [
      placeId,
      input.tipe_aturan,
      input.tanggal_mulai,
      input.tanggal_selesai,
      input.hari ?? null,
      input.bulan ?? null,
      tersedia,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError('Gagal menyimpan aturan ketersediaan', 500);
  }

  return toRuleResponse(row);
}

/**
 * Memperbarui aturan ketersediaan.
 *
 * Validasi dilakukan terhadap GABUNGAN nilai lama (dari database) dan nilai
 * baru (dari request). Dengan begitu perubahan seperti mengubah `tipe_aturan`
 * dari HARI ke BULAN tanpa mengirim `bulan` tetap ditolak, begitu pula
 * perubahan tanggal selesai menjadi lebih awal dari tanggal mulai.
 */
export async function updateRule(
  placeId: string,
  ruleId: string,
  hostId: string,
  input: UpdateAvailabilityRuleInput,
): Promise<AvailabilityRuleResponse> {
  await assertPlaceOwnedBy(placeId, hostId);

  const existingResult = await pool.query<AvailabilityRuleRow>(SELECT_RULE, [ruleId, placeId]);
  const existing = existingResult.rows[0];

  if (!existing) {
    throw notFound('Aturan ketersediaan tidak ditemukan');
  }

  const merged = {
    tipe_aturan: input.tipe_aturan ?? existing.tipe_aturan,
    tanggal_mulai: input.tanggal_mulai ?? existing.tanggal_mulai,
    tanggal_selesai: input.tanggal_selesai ?? existing.tanggal_selesai,
    hari: input.hari !== undefined ? input.hari : existing.hari,
    bulan: input.bulan !== undefined ? input.bulan : existing.bulan,
    tersedia: input.tersedia ?? existing.tersedia,
  };

  assertRuleConsistency(merged);

  const result = await pool.query<AvailabilityRuleRow>(
    `UPDATE place_availability_rules
     SET tipe_aturan     = $3,
         tanggal_mulai   = $4::date,
         tanggal_selesai = $5::date,
         hari            = $6,
         bulan           = $7,
         tersedia        = $8,
         updated_at      = NOW()
     WHERE id = $1::integer AND place_id = $2::integer
     RETURNING ${RULE_COLUMNS}`,
    [
      ruleId,
      placeId,
      merged.tipe_aturan,
      merged.tanggal_mulai,
      merged.tanggal_selesai,
      merged.hari,
      merged.bulan,
      merged.tersedia,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw notFound('Aturan ketersediaan tidak ditemukan');
  }

  return toRuleResponse(row);
}

export async function deleteRule(
  placeId: string,
  ruleId: string,
  hostId: string,
): Promise<void> {
  await assertPlaceOwnedBy(placeId, hostId);

  const result = await pool.query(
    'DELETE FROM place_availability_rules WHERE id = $1::integer AND place_id = $2::integer',
    [ruleId, placeId],
  );

  if (result.rowCount === 0) {
    throw notFound('Aturan ketersediaan tidak ditemukan');
  }
}

/**
 * Mengecek apakah rentang tanggal bertabrakan dengan aturan ketersediaan
 * (TANGGAL/HARI/BULAN).
 *
 * `client` dapat diisi dengan client transaksi (mis. dari `withTransaction`
 * pada pembuatan pemesanan) agar pembacaan aturan memakai koneksi dan
 * snapshot yang sama dengan pengecekan jadwal. Bila tidak diisi, fungsi
 * tetap kompatibel dengan pemanggilan di luar transaksi (memakai `pool`).
 */
export async function findAvailabilityRuleConflicts(
  placeId: string,
  tanggalMulai: string,
  tanggalSelesai: string,
  client: Queryable = pool,
): Promise<BookedRange[]> {
  const result = await client.query<AvailabilityRuleRow>(
    `SELECT ${RULE_COLUMNS}
     FROM place_availability_rules
     WHERE place_id = $1::integer`,
    [placeId],
  );

  return evaluateAvailabilityRules(result.rows, tanggalMulai, tanggalSelesai);
}
