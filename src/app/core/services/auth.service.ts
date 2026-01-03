/**
 * @fileoverview Authentication service for backend API integration
 * Handles login, registration, token management, and user state
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  AuthUser, 
  ApiResponse,
  TokenPayload 
} from '../models/auth.model';
import { StoreService } from './store.service';

const TOKEN_KEY = 'thurayya_access_token';
const REFRESH_TOKEN_KEY = 'thurayya_refresh_token';
const USER_KEY = 'thurayya_user';
const FIRST_LOGIN_KEY = 'thurayya_first_login';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(StoreService);
  
  private readonly apiUrl = environment.apiUrl;
  
  // Reactive state
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  
  // Public readonly signals
  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  
  readonly isAuthenticated = computed(() => !!this._user() && !!this.getToken());
  readonly isFirstLogin = computed(() => localStorage.getItem(FIRST_LOGIN_KEY) === 'true');
  
  constructor() {
    this.loadStoredUser();
  }

  /**
   * Load user from localStorage on app init
   */
  private loadStoredUser(): void {
    const token = this.getToken();
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (token && storedUser && !this.isTokenExpired(token)) {
      try {
        this._user.set(JSON.parse(storedUser));
      } catch {
        this.clearAuth();
      }
    } else if (token) {
      // Token expired, try refresh
      this.refreshToken().subscribe({
        error: () => this.clearAuth()
      });
    }
  }

  /**
   * Register a new tenant with super admin
   */
  register(request: RegisterRequest): Observable<AuthResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/register`, request)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Registration failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          this.setAuth(authResponse, true); // Mark as first login
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Login with email and password
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/login`, request)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Login failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          this.setAuth(authResponse, false); // Not first login
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Refresh the access token
   */
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Token refresh failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          this.setAuth(authResponse, false);
        }),
        catchError(error => {
          this.clearAuth();
          return throwError(() => error);
        })
      );
  }

  /**
   * Logout and clear all auth data
   */
  logout(): void {
    this.clearAuth();
    this.store.setView('auth');
  }

  /**
   * Complete onboarding for first-time users
   */
  completeOnboarding(): void {
    localStorage.removeItem(FIRST_LOGIN_KEY);
    this.store.setView('dashboard');
  }

  /**
   * Navigate user based on auth state
   */
  navigateAfterAuth(): void {
    if (this.isFirstLogin()) {
      this.store.setView('onboarding');
    } else {
      this.store.setView('dashboard');
    }
  }

  /**
   * Check if app should show auth screen
   */
  checkAuthState(): void {
    if (this.isAuthenticated()) {
      this.navigateAfterAuth();
    } else {
      this.store.setView('auth');
    }
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload) return true;
      
      // Check if expired (with 60 second buffer)
      return (payload.exp * 1000) < (Date.now() - 60000);
    } catch {
      return true;
    }
  }

  /**
   * Decode JWT token payload
   */
  private decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Store auth data
   */
  private setAuth(authResponse: AuthResponse, isFirstLogin: boolean): void {
    localStorage.setItem(TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    
    if (isFirstLogin) {
      localStorage.setItem(FIRST_LOGIN_KEY, 'true');
    }
    
    this._user.set(authResponse.user);
    
    // Sync user with store
    this.store.updateCurrentUser({
      id: authResponse.user.id,
      name: authResponse.user.name,
      email: authResponse.user.email,
      role: this.mapRole(authResponse.user.role),
      branchId: authResponse.user.branchId || undefined,
      status: authResponse.user.status.toLowerCase() as 'active' | 'invited' | 'suspended',
      avatar: authResponse.user.avatar || undefined
    });
  }

  /**
   * Map backend role to store role
   */
  private mapRole(role: string): 'super_admin' | 'branch_admin' | 'section_admin' {
    const roleMap: Record<string, 'super_admin' | 'branch_admin' | 'section_admin'> = {
      'SuperAdmin': 'super_admin',
      'BranchAdmin': 'branch_admin',
      'SectionAdmin': 'section_admin'
    };
    return roleMap[role] || 'section_admin';
  }

  /**
   * Clear all auth data
   */
  private clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(FIRST_LOGIN_KEY);
    this._user.set(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      message = error.error.message;
    } else if (error.error?.message) {
      // Server error with message
      message = error.error.message;
    } else if (error.status === 401) {
      message = 'Invalid email or password';
    } else if (error.status === 400) {
      message = 'Invalid request. Please check your input.';
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    }
    
    this._error.set(message);
    return throwError(() => new Error(message));
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }
}

