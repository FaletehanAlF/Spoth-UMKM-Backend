import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { pool } from '../config/database.js';
import { env, getJwtSecret } from '../config/env.js';
import type { UserRole } from '../types/domain.js';
import { AppError } from '../utils/app-error.js';
import type { UserResponse } from '../types/domain.js';
import type {
  JwtPayload,
  LoginInput,
  LoginResult,
  RegisterInput,
} from '../types/auth.types.js';

const SALT_ROUNDS = 12;

/**
 * Hash dummy untuk menyamakan waktu respons ketika email tidak ditemukan.
 * Nilainya bukan rahasia dan tidak terhubung ke akun mana pun.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$wHXqJbLc8C0.1D4n994m3.1Ttt7EVN.4AdtmH4uOvJtVxtgLQdTE.';

export interface UserRow {
  id: string;
  nama: string;
  email: string;
  password_hash: string;
  no_hp: string | null;
  role: UserRole;
  created_at: Date;
  token_version: number;
}

const USER_COLUMNS = `
  id::text AS id,
  nama,
  email,
  no_hp,
  role,
  created_at,
  token_version
`;

function toUserResponse(row: UserRow): UserResponse {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    no_hp: row.no_hp,
    role: row.role,
    created_at: row.created_at?.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<UserResponse> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id::text AS id FROM users WHERE email = $1 LIMIT 1',
    [input.email],
  );

  if (existing.rows.length > 0) {
    throw new AppError('Email sudah dipakai', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const result = await pool.query<UserRow>(
    `INSERT INTO users (nama, email, password_hash, no_hp, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${USER_COLUMNS}`,
    [input.nama, input.email, passwordHash, input.no_hp ?? null, input.role],
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError('Registrasi gagal', 500);
  }

  return toUserResponse(user);
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [input.email],
  );

  const user = result.rows[0];

  if (!user) {
    // Tetap jalankan bcrypt.compare terhadap hash dummy agar waktu respons
    // untuk email yang tidak ada mirip dengan email yang ada (anti user
    // enumeration berbasis timing).
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);

    throw new AppError('Email Belum Terdaftar', 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError('Email atau password salah', 401);
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    ver: user.token_version,
  };

  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  };

  const token = jwt.sign(payload, getJwtSecret(), options);

  return {
    token,
    user: toUserResponse(user),
  };
}

/**
 * Ambil data pengguna lengkap dari kolom identitas/versi saat verifikasi
 * token (digunakan oleh `authenticate` dan Socket.IO handshake).
 *
 * Return null jika user tidak ada (lebih ringan dari throws).
 */
export async function getUserByTokenSubject(userId: string): Promise<
  Pick<UserRow, 'id' | 'email' | 'role' | 'token_version'> | null
> {
  const result = await pool.query<Pick<UserRow, 'id' | 'email' | 'role' | 'token_version'>>(
    `SELECT id::text AS id, email, role, token_version
     FROM users
     WHERE id = $1::integer
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

/**
 * Menaikkan token_version pemegang ID `userId`.
 *
 * Dipakai saat logout agar semua sesi user tersebut otomatis kedaluwarsa,
 * kecuali session di device lain yang sudah di-logout juga.
 */
export async function bumpUserTokenVersion(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = $1::integer',
    [userId],
  );
}
