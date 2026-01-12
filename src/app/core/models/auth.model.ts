/**
 * @fileoverview Authentication models and DTOs
 */

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;       // For tenant-first auth flow
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  country: string;
  currency: string;
}

export interface GoogleAuthRequest {
  credential: string;        // Google ID token (JWT)
  tenantSlug?: string;       // For existing org login (tenant-first flow)
  isNewOrg?: boolean;        // True if creating new org (signup flow)
  tenantName?: string;       // Required for new user registration
  country?: string;          // Required for new user registration
  currency?: string;         // Required for new user registration
}

export interface GoogleCodeRequest {
  code: string;
  tenantSlug?: string;       // For existing org login (tenant-first flow)
  isNewOrg?: boolean;        // True if creating new org (signup flow)
}

/**
 * Login request - includes tenantSlug for tenant-first auth
 */
export interface TenantLoginRequest {
  email: string;
  password: string;
  tenantSlug: string;        // Required: which org to log into
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

export interface GoogleAuthResponse extends AuthResponse {
  isNewUser: boolean;        // True if this is first login (needs onboarding)
  tenant: AuthTenant | null; // Tenant info for immediate UI update
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

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  language: string;
}

export interface TenantPublicInfo {
  id: string;
  name: string;
  slug: string;
}

export interface MeResponse {
  user: AuthUser;
  tenant: AuthTenant | null;
}

