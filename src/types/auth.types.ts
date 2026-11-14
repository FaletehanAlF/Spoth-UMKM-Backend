import type { UserResponse, UserRole } from './domain.js';

export interface RegisterInput {
  nama: string;
  email: string;
  password: string;
  no_hp?: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: UserResponse;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

