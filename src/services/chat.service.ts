import { pool } from '../config/database.js';
import { getIO } from '../config/socket.js';
import type { Queryable } from '../types/database.js';
import { forbidden, notFound } from '../utils/app-error.js';

export interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ChatConversation {
  contact_id: string;
  booking_id: string;
  kode_booking: string | null;
  nama_tempat: string;
  nama_lain: string;
  foto: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface BookingPeople {
  id: string;
  tenant_id: string;
  host_id: string;
}

/** Pastikan user adalah penyewa pada booking ini atau pemilik tempatnya. */
async function pastikanBisaChat(
  client: Queryable,
  bookingId: string,
  userId: string,
): Promise<BookingPeople> {
  const hasil = await client.query<BookingPeople>(
    `SELECT b.id::text AS id, b.tenant_id::text AS tenant_id, p.host_id::text AS host_id
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     WHERE b.id = $1::integer
     LIMIT 1`,
    [bookingId],
  );

  const booking = hasil.rows[0];
  if (!booking) throw notFound('Pemesanan tidak ditemukan');
  if (booking.tenant_id !== userId && booking.host_id !== userId) {
    throw forbidden('Hanya penyewa dan pemilik tempat yang bisa chat');
  }

  return booking;
}

function toChatMessage(row: {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}): ChatMessage {
  return {
    id: row.id,
    booking_id: row.booking_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at.toISOString(),
  };
}

export async function listMessages(
  bookingId: string,
  userId: string,
): Promise<ChatMessage[]> {
  await pastikanBisaChat(pool, bookingId, userId);

  const hasil = await pool.query<{
    id: string; booking_id: string; sender_id: string; body: string; created_at: Date;
  }>(
    `SELECT id::text AS id, booking_id::text AS booking_id, sender_id::text AS sender_id,
            body, created_at
     FROM chat_messages
     WHERE booking_id = $1::integer AND deleted_at IS NULL
     ORDER BY id ASC`,
    [bookingId],
  );

  return hasil.rows.map(toChatMessage);
}

export async function sendMessage(
  bookingId: string,
  userId: string,
  body: string,
): Promise<ChatMessage> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);
  const lawanBicara = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;

  const blokir = await pool.query<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM chat_blocks
       WHERE user_id = $1::integer AND contact_id = $2::integer
     ) AS blocked`,
    [lawanBicara, userId],
  );

  if (blokir.rows[0]?.blocked) {
    throw forbidden('anda di blokir');
  }

  const hasil = await pool.query<{
    id: string; booking_id: string; sender_id: string; body: string; created_at: Date;
  }>(
    `INSERT INTO chat_messages (booking_id, sender_id, body)
     VALUES ($1::integer, $2::integer, $3)
     RETURNING id::text AS id, booking_id::text AS booking_id, sender_id::text AS sender_id,
               body, created_at`,
    [bookingId, userId, body],
  );

  const message = toChatMessage(hasil.rows[0]!);

  // Kirim realtime sederhana ke lawan bicara. REST tetap sumber data utama.
  getIO()?.to(`user:${lawanBicara}`).emit('chat:message', message);

  return message;
}

/** Edit hanya pesan sendiri yang belum dihapus. */
export async function updateMessage(
  bookingId: string,
  messageId: string,
  userId: string,
  body: string,
): Promise<ChatMessage> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);

  const hasil = await pool.query<{
    id: string; booking_id: string; sender_id: string; body: string; created_at: Date;
  }>(
    `UPDATE chat_messages
     SET body = $4, edited_at = NOW()
     WHERE booking_id = $1::integer
       AND id = $2::bigint
       AND sender_id = $3::integer
       AND deleted_at IS NULL
     RETURNING id::text AS id, booking_id::text AS booking_id, sender_id::text AS sender_id,
               body, created_at`,
    [bookingId, messageId, userId, body],
  );

  const row = hasil.rows[0];
  if (!row) throw notFound('Pesan tidak ditemukan atau bukan pesan Anda');

  const message = toChatMessage(row);
  const lawanBicara = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;
  getIO()?.to(`user:${lawanBicara}`).emit('chat:message-updated', message);
  return message;
}

/** Soft delete hanya pesan sendiri; kontak tidak melihatnya lagi. */
export async function deleteMessage(
  bookingId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);

  const hasil = await pool.query(
    `UPDATE chat_messages
     SET deleted_at = NOW()
     WHERE booking_id = $1::integer
       AND id = $2::bigint
       AND sender_id = $3::integer
       AND deleted_at IS NULL`,
    [bookingId, messageId, userId],
  );

  if (!hasil.rowCount) throw notFound('Pesan tidak ditemukan atau bukan pesan Anda');

  const lawanBicara = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;
  getIO()?.to(`user:${lawanBicara}`).emit('chat:message-deleted', {
    id: messageId,
    booking_id: bookingId,
  });
}

/** Blokir kontak; sisi mana pun bisa membuka blokir. */
export async function blockContact(bookingId: string, userId: string): Promise<void> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);
  const contactId = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;
  if (contactId === userId) return;

  await pool.query(
    `INSERT INTO chat_blocks (user_id, contact_id)
     VALUES ($1::integer, $2::integer)
     ON CONFLICT (user_id, contact_id) DO NOTHING`,
    [userId, contactId],
  );
}

export async function unblockContact(bookingId: string, userId: string): Promise<void> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);
  const contactId = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;

  await pool.query(
    `DELETE FROM chat_blocks
     WHERE (user_id = $1::integer AND contact_id = $2::integer)
        OR (user_id = $2::integer AND contact_id = $1::integer)`,
    [userId, contactId],
  );
}

export interface ChatBlockStatus {
  blocked: boolean;
  blocked_by_me: boolean;
  blocked_by_other: boolean;
}

export async function getBlockStatus(bookingId: string, userId: string): Promise<ChatBlockStatus> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);
  const contactId = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;

  const hasil = await pool.query<ChatBlockStatus>(
    `SELECT
       EXISTS (
         SELECT 1 FROM chat_blocks
         WHERE (user_id = $1::integer AND contact_id = $2::integer)
            OR (user_id = $2::integer AND contact_id = $1::integer)
       ) AS blocked,
       EXISTS (
         SELECT 1 FROM chat_blocks
         WHERE user_id = $1::integer AND contact_id = $2::integer
       ) AS blocked_by_me,
       EXISTS (
         SELECT 1 FROM chat_blocks
         WHERE user_id = $2::integer AND contact_id = $1::integer
       ) AS blocked_by_other`,
    [userId, contactId],
  );

  return hasil.rows[0]!;
}

export async function listConversations(userId: string): Promise<ChatConversation[]> {
  const hasil = await pool.query<{
    contact_id: string;
    booking_id: string;
    kode_booking: string | null;
    nama_tempat: string;
    nama_lain: string;
    foto: string | null;
    last_message: string | null;
    last_message_at: Date | null;
  }>(
    `SELECT CASE WHEN b.tenant_id = $1::integer THEN owner.id ELSE tenant.id END::text AS contact_id,
            b.id::text AS booking_id, b.kode_booking, p.nama_tempat,
            CASE WHEN b.tenant_id = $1::integer THEN owner.nama ELSE tenant.nama END AS nama_lain,
            CASE WHEN b.tenant_id = $1::integer THEN owner.foto ELSE tenant.foto END AS foto,
            lm.body AS last_message, lm.created_at AS last_message_at
     FROM bookings b
     JOIN places p ON p.id = b.place_id
     JOIN users tenant ON tenant.id = b.tenant_id
     JOIN users owner ON owner.id = p.host_id
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM chat_messages
       WHERE booking_id = b.id AND deleted_at IS NULL ORDER BY id DESC LIMIT 1
     ) lm ON true
     WHERE b.tenant_id = $1::integer OR p.host_id = $1::integer
     ORDER BY b.id DESC`,
    [userId],
  );

  const belumDibaca = await pool.query<{
    contact_id: string;
    unread_count: number;
  }>(
    `SELECT cm.sender_id::text AS contact_id, COUNT(*)::int AS unread_count
     FROM chat_messages cm
     JOIN bookings b ON b.id = cm.booking_id
     JOIN places p ON p.id = b.place_id
     LEFT JOIN chat_read_markers m
       ON m.user_id = $1::integer AND m.contact_id = cm.sender_id
     WHERE (b.tenant_id = $1::integer OR p.host_id = $1::integer)
       AND cm.sender_id <> $1::integer
        AND cm.deleted_at IS NULL
       AND cm.created_at > COALESCE(m.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)
     GROUP BY cm.sender_id`,
    [userId],
  );

  const jumlahBelumDibaca = new Map(
    belumDibaca.rows.map((row) => [row.contact_id, row.unread_count]),
  );

  const contacts = new Map<string, ChatConversation>();

  for (const row of hasil.rows) {
    const lastMessageAt = row.last_message_at?.toISOString() ?? null;
    const existing = contacts.get(row.contact_id);

    if (!existing) {
      contacts.set(row.contact_id, {
        contact_id: row.contact_id,
        booking_id: row.booking_id,
        kode_booking: row.kode_booking,
        nama_tempat: row.nama_tempat,
        nama_lain: row.nama_lain,
        foto: row.foto,
        last_message: row.last_message,
        last_message_at: lastMessageAt,
        unread_count: jumlahBelumDibaca.get(row.contact_id) ?? 0,
      });
      continue;
    }

    const existingTime = existing.last_message_at ? Date.parse(existing.last_message_at) : 0;
    const newTime = lastMessageAt ? Date.parse(lastMessageAt) : 0;
    if (newTime > existingTime) {
      existing.last_message = row.last_message;
      existing.last_message_at = lastMessageAt;
    }
  }

  return [...contacts.values()].sort((a, b) => {
    const aTime = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const bTime = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return bTime - aTime;
  });
}

export async function totalBelumDibaca(userId: string): Promise<number> {
  const hasil = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM chat_messages cm
     JOIN bookings b ON b.id = cm.booking_id
     JOIN places p ON p.id = b.place_id
     LEFT JOIN chat_read_markers m
       ON m.user_id = $1::integer AND m.contact_id = cm.sender_id
     WHERE (b.tenant_id = $1::integer OR p.host_id = $1::integer)
       AND cm.sender_id <> $1::integer
        AND cm.deleted_at IS NULL
       AND cm.created_at > COALESCE(m.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)`,
    [userId],
  );

  return hasil.rows[0]?.total ?? 0;
}

export async function markConversationRead(
  bookingId: string,
  userId: string,
): Promise<number> {
  const booking = await pastikanBisaChat(pool, bookingId, userId);
  const contactId = booking.tenant_id === userId ? booking.host_id : booking.tenant_id;

  await pool.query(
    `INSERT INTO chat_read_markers (user_id, contact_id, last_read_at)
     VALUES ($1::integer, $2::integer, NOW())
     ON CONFLICT (user_id, contact_id)
     DO UPDATE SET last_read_at = NOW()`,
    [userId, contactId],
  );

  return totalBelumDibaca(userId);
}
