import type { UserRole } from './domain.js';
import type { UserResponse } from './domain.js';

export type { UserResponse };

export interface UpdateProfileInput {
  nama?: string;
  no_hp?: string;
}

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
