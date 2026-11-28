import { pool } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { UserResponse } from '../types/domain.js';
import type { UpdateProfileInput, UserRow } from '../types/user.types.js';

const USER_COLUMNS = `
  id::text AS id,
  nama,
  email,
  no_hp,
  foto,
  role,
  created_at
`;

function toUserResponse(row: UserRow): UserResponse {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    no_hp: row.no_hp,
    foto: row.foto ?? null,
    role: row.role,
    created_at: row.created_at?.toISOString(),
  };
}

/** Mengambil data profil pengguna yang sedang login. */
export async function getUserById(userId: string): Promise<UserResponse> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError('Pengguna tidak ditemukan', 404);
  }

  return toUserResponse(user);
}

/**
 * Memperbarui profil pengguna (SRS Tabel 3.1 Fitur "Kelola Profil").
 * Hanya `nama` dan `no_hp` yang boleh diubah; email dan role tidak dapat
 * diubah dari endpoint ini.
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserResponse> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET nama = COALESCE($2, nama),
         no_hp = COALESCE($3, no_hp),
         foto = COALESCE($4, foto)
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, input.nama ?? null, input.no_hp ?? null, input.foto ?? null],
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError('Pengguna tidak ditemukan', 404);
  }

  return toUserResponse(user);
}
