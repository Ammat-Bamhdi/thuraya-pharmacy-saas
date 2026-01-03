/**
 * @fileoverview Authentication models and DTOs
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  country: string;
  currency: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'BranchAdmin' | 'SectionAdmin';
  branchId: string | null;
  branchName: string | null;
  status: 'Active' | 'Invited' | 'Suspended';
  avatar: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors: string[] | null;
}

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  branchId: string;
  exp: number;
  iat: number;
}

