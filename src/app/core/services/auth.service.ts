/**
 * @fileoverview Authentication service - Production-ready state management
 * Single source of truth: Backend validates all auth state
 * 
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Injectable, inject, signal, computed, Injector, runInInjectionContext } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  LoginRequest, 
  RegisterRequest, 
  GoogleAuthRequest,
  AuthResponse, 
  GoogleAuthResponse,
  AuthUser, 
  AuthTenant,
  ApiResponse,
  TokenPayload,
  MeResponse
} from '../models/auth.model';
import { StoreService } from './store.service';
import { DataService } from './data.service';

// Storage keys - all auth data in localStorage
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
  private readonly injector = inject(Injector);
  
  private readonly apiUrl = environment.apiUrl;
  
  // Lazy inject DataService to avoid circular dependency
  private _dataService: DataService | null = null;
  private get dataService(): DataService {
    if (!this._dataService) {
      this._dataService = runInInjectionContext(this.injector, () => inject(DataService));
    }
    return this._dataService;
  }
  
  // Reactive state - single source of truth for auth
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _initialized = signal(false);
  
  // Public readonly signals
  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly initialized = this._initialized.asReadonly();
  
  // Computed state
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isFirstLogin = computed(() => localStorage.getItem(FIRST_LOGIN_KEY) === 'true');

  /**
   * Initialize auth state - MUST be called on app startup
   * Validates token against backend and sets up proper state
   */
  async initialize(): Promise<void> {
    if (this._initialized()) return;

    const token = this.getToken();
    
    // No token = not authenticated
    if (!token) {
      this.clearAllStorage();
      this._initialized.set(true);
      this.store.setView('auth');
      return;
    }

    // Check if token is expired locally first
    if (this.isTokenExpired(token)) {
      console.log('[Auth] Token expired locally, clearing auth');
      this.clearAllStorage();
      this._initialized.set(true);
      this.store.setView('auth');
      return;
    }

    // Validate token against backend - this is the source of truth
    try {
      const isValid = await this.validateWithBackend();
      
      if (isValid) {
        // User exists in database, proceed
        this._initialized.set(true);
        this.navigateAfterAuth();
      } else {
        // User doesn't exist in database (401), clear everything
        console.log('[Auth] Backend validation failed, clearing auth');
        this.clearAllStorage();
        this._initialized.set(true);
        this.store.setView('auth');
      }
    } catch (error) {
      // Network error or server down - check stored user as fallback
      console.warn('[Auth] Backend unreachable, using cached auth state');
      const storedUser = this.getStoredUser();
      if (storedUser) {
        this._user.set(storedUser);
        this.syncUserToStore(storedUser);
        this._initialized.set(true);
        this.navigateAfterAuth();
      } else {
        this.clearAllStorage();
        this._initialized.set(true);
        this.store.setView('auth');
      }
    }
  }

  /**
   * Validate token with backend - returns true if user exists
   */
  private async validateWithBackend(): Promise<boolean> {
    try {
      console.log('[Auth] Validating with backend...');
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MeResponse>>(`${this.apiUrl}/auth/me`)
      );
      
      console.log('[Auth] Backend response:', response);
      
      if (response.success && response.data) {
        // Update local state with fresh data from backend
        const { user, tenant } = response.data;
        console.log('[Auth] User:', user?.name, 'Tenant:', tenant?.name);
        
        this._user.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.syncUserToStore(user);
        
        // Also sync tenant to store
        if (tenant) {
          this.syncTenantToStore(tenant);
        } else {
          console.warn('[Auth] No tenant data in response');
        }
        return true;
      }
      console.warn('[Auth] Backend validation failed - no data');
      return false;
    } catch (error: any) {
      console.error('[Auth] Backend validation error:', error);
      if (error.status === 401) {
        // Token invalid or user doesn't exist
        return false;
      }
      // Network error - throw to use fallback
      throw error;
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
          this.saveAuthData(authResponse, true);
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
          this.saveAuthData(authResponse, false);
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Authenticate with Google OAuth (ID token)
   */
  googleAuth(request: GoogleAuthRequest): Observable<GoogleAuthResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.post<ApiResponse<GoogleAuthResponse>>(`${this.apiUrl}/auth/google`, request)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Google authentication failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          this.saveAuthData(authResponse, authResponse.isNewUser);
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Authenticate with Google authorization code (popup flow)
   */
  googleAuthWithCode(code: string): Observable<GoogleAuthResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.post<ApiResponse<GoogleAuthResponse>>(`${this.apiUrl}/auth/google/code`, { code })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Google authentication failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          this.saveAuthData(authResponse, authResponse.isNewUser);
          
          // Immediately sync tenant to store for UI update
          if (authResponse.tenant) {
            this.syncTenantToStore(authResponse.tenant);
          }
        }),
        catchError(error => this.handleError(error)),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Logout and clear all auth data
   */
  logout(): void {
    this.clearAllStorage();
    this.store.clearAll();
    this.store.setView('auth');
  }

  /**
   * Complete onboarding for first-time users
   */
  completeOnboarding(): void {
    localStorage.removeItem(FIRST_LOGIN_KEY);
    this.loadDataAndNavigate('dashboard');
  }

  /**
   * Navigate user based on auth state
   */
  navigateAfterAuth(): void {
    if (this.isFirstLogin()) {
      this.store.setView('onboarding');
    } else {
      this.loadDataAndNavigate('dashboard');
    }
  }

  /**
   * Navigate directly to onboarding
   */
  goToOnboarding(): void {
    localStorage.setItem(FIRST_LOGIN_KEY, 'true');
    this.store.setView('onboarding');
  }

  /**
   * Navigate directly to dashboard
   */
  goToDashboard(): void {
    localStorage.removeItem(FIRST_LOGIN_KEY);
    this.loadDataAndNavigate('dashboard');
  }

  /**
   * Load initial data from backend and then navigate
   */
  private loadDataAndNavigate(view: 'dashboard' | 'onboarding'): void {
    // Load branches and other initial data before navigating
    this.dataService.loadInitialData().subscribe({
      next: () => {
        this.store.setView(view);
      },
      error: () => {
        // Still navigate even if data load fails
        console.warn('Failed to load initial data, continuing anyway');
        this.store.setView(view);
      }
    });
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }

  setError(message: string): void {
    this._error.set(message);
  }

  // ==================== Private Methods ====================

  /**
   * Save auth data to localStorage and update state
   */
  private saveAuthData(authResponse: AuthResponse, isFirstLogin: boolean): void {
    // Save to localStorage
    localStorage.setItem(TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    
    if (isFirstLogin) {
      localStorage.setItem(FIRST_LOGIN_KEY, 'true');
    } else {
      localStorage.removeItem(FIRST_LOGIN_KEY);
    }
    
    // Update signals
    this._user.set(authResponse.user);
    
    // Sync with store
    this.syncUserToStore(authResponse.user);
  }

  /**
   * Sync user data to store service
   */
  private syncUserToStore(user: AuthUser): void {
    this.store.updateCurrentUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: this.mapRole(user.role),
      branchId: user.branchId || undefined,
      status: user.status.toLowerCase() as 'active' | 'invited' | 'suspended',
      avatar: user.avatar || undefined
    });
  }

  /**
   * Sync tenant data to store service
   */
  private syncTenantToStore(tenant: AuthTenant): void {
    // Normalize language to lowercase (backend returns "En"/"Ar", store expects "en"/"ar")
    const normalizedLanguage = (tenant.language?.toLowerCase() || 'en') as 'en' | 'ar';
    
    this.store.setTenant({
      id: tenant.id,
      name: tenant.name,
      country: tenant.country,
      currency: tenant.currency,
      language: normalizedLanguage
    });
    
    console.log('[Auth] Tenant synced to store:', tenant.name);
  }

  /**
   * Get stored user from localStorage
   */
  private getStoredUser(): AuthUser | null {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      if (!storedUser) return null;
      
      const user = JSON.parse(storedUser);
      if (user && user.id && user.email) {
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all auth data from localStorage
   */
  private clearAllStorage(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(FIRST_LOGIN_KEY);
    this._user.set(null);
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return true;
      // Add 60 second buffer
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
      if (!base64Url) return null;
      
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
   * Handle HTTP errors with user-friendly messages
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred. Please try again.';
    
    if (error.error instanceof ErrorEvent) {
      message = 'Network error. Please check your connection.';
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check if the server is running.';
    } else if (error.status === 400) {
      message = error.error?.message || 'Invalid request. Please check your input.';
    } else if (error.status === 401) {
      message = 'Invalid email or password.';
    } else if (error.status === 409) {
      message = 'This email is already registered.';
    } else if (error.error?.message) {
      message = error.error.message;
    }
    
    this._error.set(message);
    return throwError(() => new Error(message));
  }
}
