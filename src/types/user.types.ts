import type { UserRole } from './domain.js';
import type { UserResponse } from './domain.js';

export type { UserResponse };

export interface UpdateProfileInput {
  nama?: string;
  no_hp?: string;
  foto?: string;
}

/** Baris tabel `users` sesuai skema SRS Tabel 4.2 + tambahan hardening. */
export interface UserRow {
  id: string;
  nama: string;
  email: string;
  password_hash: string;
  no_hp: string | null;
  foto: string | null;
  role: UserRole;
  created_at: Date;
  /** Versi token pengguna untuk pencabutan sesi (tambahan hardening). */
  token_version: number;
}
