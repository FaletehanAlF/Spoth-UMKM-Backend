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

/** Baris tabel `users` sesuai skema SRS Tabel 4.2. */
export interface UserRow {
  id: string;
  nama: string;
  email: string;
  password_hash: string;
  no_hp: string | null;
  role: UserRole;
  created_at: Date;
}

const USER_COLUMNS = `
  id::text AS id,
  nama,
  email,
  no_hp,
  role,
  created_at
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

/**
 * Membuat akun baru (SRS Tabel 3.1 Fitur "Registrasi dan Login").
 * Kata sandi disimpan dalam bentuk hash bcrypt, bukan teks asli (KNF-04).
 */
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

/**
 * Memeriksa email dan kata sandi, lalu membuat token JWT.
 * Pesan error sengaja dibuat sama untuk email salah maupun password salah
 * agar informasi akun pengguna tidak bocor.
 */
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
    throw new AppError('Email atau password salah', 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError('Email atau password salah', 401);
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
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
