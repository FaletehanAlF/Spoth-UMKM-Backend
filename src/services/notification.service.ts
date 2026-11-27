import { pool } from '../config/database.js';
import { getIO } from '../config/socket.js';
import type { Queryable } from '../types/database.js';
import { notFound } from '../utils/app-error.js';
import { buildPaginatedResult, toOffset, type PaginatedResult } from '../utils/pagination.js';
import type {
  NotificationQuery,
  NotificationResponse,
  NotificationRow,
  NotificationSummary,
} from '../types/notification.types.js';

const NOTIFICATION_COLUMNS = `
  id::text    AS id,
  user_id::text AS user_id,
  judul        AS judul,
  pesan        AS pesan,
  jenis        AS jenis,
  dibaca       AS dibaca,
  created_at   AS created_at,
  metadata     AS metadata
`;

function toNotificationResponse(row: NotificationRow): NotificationResponse {
  return {
    id: row.id,
    judul: row.judul,
    pesan: row.pesan,
    jenis: row.jenis ?? null,
    dibaca: row.dibaca,
    created_at: row.created_at?.toISOString(),
    metadata: row.metadata ?? null,
  };
}

/**
 * Membuat notifikasi baru (SRS Tabel 3.1 Fitur "Notifikasi").
 *
 * Fungsi ini menerima `client` agar bisa dipanggil di dalam transaksi yang
 * sama dengan pembuatan pemesanan atau pembayaran.
 */
export async function createNotification(
  client: Queryable,
  userId: string,
  judul: string,
  pesan: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const jenis = (metadata?.tipe as string | undefined) ?? null;

  const result = await client.query<{ id: string; created_at: Date; jenis: string | null }>(
    `INSERT INTO notifications (user_id, judul, pesan, jenis, metadata)
     VALUES ($1::integer, $2, $3, $4, $5::jsonb)
     RETURNING id::text AS id, created_at, jenis`,
    [userId, judul, pesan, jenis, metadata ? JSON.stringify(metadata) : null],
  );

  const row = result.rows[0];

  // Kirim notifikasi real-time bila penerima sedang terhubung. Notifikasi
  // tetap tersimpan di database (insert di atas) meskipun penerima offline.
  const io = getIO();

  if (io && row) {
    io.to(`user:${userId}`).emit('notification:new', {
      id: row.id,
      judul,
      pesan,
      jenis: row.jenis ?? jenis,
      dibaca: false,
      created_at: row.created_at?.toISOString(),
      metadata: metadata ?? null,
    });
  }
}

/**
 * Daftar notifikasi milik pengguna (SRS Tabel 3.4 Halaman "Notifikasi").
 */
export async function listNotifications(
  userId: string,
  query: NotificationQuery,
): Promise<PaginatedResult<NotificationResponse>> {
  const values: unknown[] = [userId];
  const conditions = ['user_id = $1::integer'];

  if (query.unread_only) {
    conditions.push('dibaca = FALSE');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM notifications ${whereClause}`,
    values,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(query.limit);
  const limitParam = `$${values.length}`;
  values.push(toOffset(query.page, query.limit));
  const offsetParam = `$${values.length}`;

  const dataResult = await pool.query<NotificationRow>(
    `SELECT ${NOTIFICATION_COLUMNS}
     FROM notifications
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const items = dataResult.rows.map(toNotificationResponse);

  return buildPaginatedResult(items, total, query.page, query.limit);
}

/** Ringkasan jumlah notifikasi (total dan belum dibaca). */
export async function getNotificationSummary(
  userId: string,
): Promise<NotificationSummary> {
  const result = await pool.query<{ total: string; belum_dibaca: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE dibaca = FALSE)::text AS belum_dibaca
     FROM notifications
     WHERE user_id = $1::integer`,
    [userId],
  );

  const row = result.rows[0];

  return {
    total: Number(row?.total ?? 0),
    belum_dibaca: Number(row?.belum_dibaca ?? 0),
  };
}

/** Menandai satu notifikasi sebagai sudah dibaca. */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE notifications SET dibaca = TRUE
     WHERE id = $1::integer AND user_id = $2::integer`,
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    throw notFound('Notifikasi tidak ditemukan');
  }
}

/** Menandai semua notifikasi milik pengguna sebagai sudah dibaca. */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await pool.query(
    'UPDATE notifications SET dibaca = TRUE WHERE user_id = $1::integer AND dibaca = FALSE',
    [userId],
  );

  return result.rowCount ?? 0;
}

/** Menghapus satu notifikasi milik pengguna. */
export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const result = await pool.query(
    'DELETE FROM notifications WHERE id = $1::integer AND user_id = $2::integer',
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    throw notFound('Notifikasi tidak ditemukan');
  }
}

/** Menghapus semua notifikasi milik pengguna. */
export async function deleteAllNotifications(userId: string): Promise<number> {
  const result = await pool.query(
    'DELETE FROM notifications WHERE user_id = $1::integer',
    [userId],
  );

  return result.rowCount ?? 0;
}
