/**
 * @fileoverview Authentication service - Production-ready state management
 * Single source of truth: Backend validates all auth state
 * 
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Injectable, inject, signal, computed, Injector, runInInjectionContext } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom, of } from 'rxjs';
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
        // Load initial data first
        await firstValueFrom(this.dataService.loadInitialData());
        
        this._initialized.set(true);
        this.navigateAfterAuth();
        
        // Enforce access rules after navigation (handles page refresh)
        this.enforceAccessRules();
      } else {
        // User doesn't exist in database (401), clear everything
        this.clearAllStorage();
        this._initialized.set(true);
        this.store.setView('auth');
      }
    } catch (_error) {
      // Network error or server down - check stored user as fallback
      const storedUser = this.getStoredUser();
      if (storedUser) {
        this._user.set(storedUser);
        this.syncUserToStore(storedUser);
        
        // Try to load initial data even in offline mode
        try {
          await firstValueFrom(this.dataService.loadInitialData());
        } catch (_e) {
          // Silent fail - app can work with cached data
        }
        
        this._initialized.set(true);
        this.navigateAfterAuth();
        
        // Enforce access rules
        this.enforceAccessRules();
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
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MeResponse>>(`${this.apiUrl}/auth/me`)
      );
      
      if (response.success && response.data) {
        // Update local state with fresh data from backend
        const { user, tenant } = response.data;
        
        this._user.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.syncUserToStore(user);
        
        // Also sync tenant to store
        if (tenant) {
          this.syncTenantToStore(tenant);
        }
        return true;
      }
      return false;
    } catch (error: any) {
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
          if (authResponse.accessToken) {
            this.saveAuthData(authResponse, authResponse.isNewUser);
          } else if (authResponse.isNewUser) {
            // New user without tokens yet (needs onboarding)
            // Save basic user info if needed or just mark as first login
            localStorage.setItem(FIRST_LOGIN_KEY, 'true');
            if (authResponse.user) {
              localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
              this._user.set(authResponse.user);
              this.syncUserToStore(authResponse.user);
            }
          }
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

    return this.http.post<ApiResponse<GoogleAuthResponse>>(`${this.apiUrl}/auth/google-code`, { code })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Google authentication failed');
          }
          return response.data;
        }),
        tap(authResponse => {
          if (authResponse.accessToken) {
            this.saveAuthData(authResponse, authResponse.isNewUser);
          } else if (authResponse.isNewUser) {
            // New user without tokens yet (needs onboarding)
            localStorage.setItem(FIRST_LOGIN_KEY, 'true');
            if (authResponse.user) {
              localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
              this._user.set(authResponse.user);
              this.syncUserToStore(authResponse.user);
            }
          }
          
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
   * Refresh access token using refresh token
   * Should be called when access token is about to expire
   * Includes retry logic for network failures
   */
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      console.warn('[Auth] No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/auth/refresh`, {
      refreshToken
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Token refresh failed');
        }
        return response.data;
      }),
      tap(authResponse => {
        // Update tokens without marking as first login
        localStorage.setItem(TOKEN_KEY, authResponse.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
        this._user.set(authResponse.user);
      }),
      catchError(error => {
        // If refresh fails, logout
        console.warn('[Auth] Token refresh failed, logging out');
        this.logout();
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if current token needs refresh (expires within 5 minutes)
   */
  shouldRefreshToken(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = this.decodeToken(token);
      if (!payload?.exp) return false;
      
      // Refresh if token expires within 5 minutes
      const expiresAt = payload.exp * 1000;
      const fiveMinutes = 5 * 60 * 1000;
      return expiresAt - Date.now() < fiveMinutes;
    } catch {
      return false;
    }
  }

  // Prevent multiple logout calls
  private _isLoggingOut = false;

  /**
   * Logout and clear all auth data
   * 
   * Production-grade logout flow:
   * 1. Guard against double-logout
   * 2. Set loading state
   * 3. Call backend to invalidate refresh token (security best practice)
   * 4. Clear all local storage
   * 5. Clear all service caches
   * 6. Reset all signals/state
   * 7. Navigate to auth view
   * 
   * Always completes logout even if backend call fails (fail-safe)
   */
  logout(): void {
    // Guard: prevent multiple simultaneous logout calls
    if (this._isLoggingOut) return;

    this._isLoggingOut = true;
    this._isLoading.set(true);

    const token = this.getToken();
    
    // If we have a token, try to invalidate it on the backend
    if (token) {
      this.http.post<{ success: boolean }>(`${this.apiUrl}/auth/logout`, {})
        .pipe(
          catchError(() => of({ success: true })), // Continue anyway on error
          finalize(() => this.executeLogoutCleanup())
        )
        .subscribe();
    } else {
      // No token, just do client-side cleanup
      this.executeLogoutCleanup();
    }
  }

  /**
   * Execute the actual logout cleanup
   * Separated to ensure it always runs, regardless of backend response
   */
  private executeLogoutCleanup(): void {
    // 1. Clear all auth data from localStorage
    this.clearAllStorage();

    // 2. Clear the data service cache
    try {
      this.dataService.clearCache();
    } catch (e) {
      // Silent fail - not critical
    }

    // 3. Clear the store (clears all reactive state)
    this.store.clearAll();

    // 4. Clear any pending errors
    this._error.set(null);

    // 5. Reset loading state
    this._isLoading.set(false);

    // 6. Reset logout guard
    this._isLoggingOut = false;

    // 7. Keep initialized as true (auth service is ready, just logged out)
    // Note: Do NOT set initialized to false or app will show loading screen forever

    // 8. Navigate to auth view
    this.store.setView('auth');
  }

  /**
   * Force logout without backend call
   * Use for scenarios like token expiration or invalid token
   */
  forceLogout(): void {
    this._isLoggingOut = false; // Reset guard in case it's stuck
    this.executeLogoutCleanup();
  }

  /**
   * Check if user can access dashboard (production-grade guard)
   * 
   * Requirements:
   * 1. Organization (tenant) must exist
   * 2. At least one branch must be created
   * 3. User must be assigned to at least one branch
   * 
   * @returns true if all requirements met, false otherwise
   */
  canAccessDashboard(): boolean {
    const tenant = this.store.tenant();
    const branches = this.store.branches();
    const user = this.store.currentUser();

    // Rule 1: Must have organization setup
    if (!tenant) return false;

    // Rule 2: Must have at least one branch
    if (branches.length === 0) return false;

    // Rule 3: SuperAdmin can access without branch assignment
    // Other roles must be assigned to a branch
    if (user?.role === 'super_admin') return true;
    
    // Non-SuperAdmin users must be assigned to a branch
    if (!user?.branchId) return false;

    return true;
  }

  /**
   * Complete onboarding for first-time users.
   * After successful onboarding provisioning, always navigate to dashboard
   * and load fresh data from the backend.
   */
  completeOnboarding(): void {
    localStorage.removeItem(FIRST_LOGIN_KEY);
    
    // After successful onboarding, always navigate to dashboard
    // The loadDataAndNavigate will fetch fresh data from backend
    // This ensures branches created during onboarding are properly loaded
    this.loadDataAndNavigate('dashboard');
  }

  /**
   * Navigate user based on auth state and dashboard access requirements
   */
  navigateAfterAuth(): void {
    // First-time users always go to onboarding
    if (this.isFirstLogin()) {
      this.store.setView('onboarding');
      return;
    }

    // For returning users, load data first then check access requirements
    // This ensures branches are loaded before canAccessDashboard() check
    this.dataService.loadInitialData().subscribe({
      next: () => {
        // Now we have loaded branches - check access requirements
        if (this.canAccessDashboard()) {
          this.store.setView('dashboard');
        } else {
          // User completed registration but never created branches
          this.store.setView('onboarding');
        }
      },
      error: () => {
        console.warn('[Auth] Failed to load data, checking local state');
        // Fallback to local state check
        if (this.canAccessDashboard()) {
          this.store.setView('dashboard');
        } else {
          this.store.setView('onboarding');
        }
      }
    });
  }

  /**
   * Navigate directly to onboarding
   */
  goToOnboarding(): void {
    localStorage.setItem(FIRST_LOGIN_KEY, 'true');
    this.store.setView('onboarding');
  }

  /**
   * Navigate directly to dashboard (with access guard)
   */
  goToDashboard(): void {
    localStorage.removeItem(FIRST_LOGIN_KEY);
    
    // Load data first, then check access requirements
    this.dataService.loadInitialData().subscribe({
      next: () => {
        if (this.canAccessDashboard()) {
          this.store.setView('dashboard');
        } else {
          console.warn('[Auth] Cannot access dashboard - requirements not met');
          this.store.setView('onboarding');
        }
      },
      error: () => {
        // Fallback to local state check
        if (this.canAccessDashboard()) {
          this.store.setView('dashboard');
        } else {
          this.store.setView('onboarding');
        }
      }
    });
  }

  /**
   * Enforce dashboard access rules (called after data load or page refresh)
   * Redirects to onboarding if requirements not met
   */
  enforceAccessRules(): void {
    const currentView = this.store.currentView();
    
    // Only enforce if user is trying to access dashboard or main app
    if (currentView === 'auth' || currentView === 'onboarding') {
      return; // Already on allowed screens
    }

    // Check if user still meets dashboard requirements
    if (!this.canAccessDashboard()) {
      console.warn('[Auth] Access rules violated - redirecting to onboarding');
      this.store.setView('onboarding');
    }
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
   * Get current access token with validation
   * Validates token format to prevent XSS attacks
   */
  getToken(): string | null {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return null;
      
      // Validate JWT format (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[Auth] Invalid token format detected, clearing');
        this.clearAllStorage();
        return null;
      }
      
      // Basic XSS check - JWT should only contain base64 chars and dots
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
        console.warn('[Auth] Token contains invalid characters, clearing');
        this.clearAllStorage();
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('[Auth] Error reading token:', error);
      this.clearAllStorage();
      return null;
    }
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
   * Includes token validation for security
   */
  private saveAuthData(authResponse: AuthResponse, isFirstLogin: boolean): void {
    // Validate tokens before saving
    if (!authResponse.accessToken || !authResponse.refreshToken) {
      throw new Error('Invalid auth response: missing tokens');
    }
    
    // Validate token format to prevent XSS
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authResponse.accessToken)) {
      throw new Error('Invalid access token format');
    }
    
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
   * Handle HTTP errors with detailed user-friendly messages
   * Includes special handling for rate limiting and security events
   */
  private handleError(error: any): Observable<never> {
    // Check if this is a NormalizedError from the interceptor
    if (error.message && error.description && !error.error) {
      // Log security-relevant errors
      if (error.status === 401 || error.status === 403) {
        console.warn('[Auth Security]', error.message, error.description);
      }
      
      // Special handling for rate limiting
      if (error.status === 429 || error.isRateLimited) {
        console.warn('[Auth] Rate limit exceeded');
        this._error.set('Too many attempts. Please wait a moment.');
        return throwError(() => error);
      }
      
      this._error.set(error.message);
      return throwError(() => error);
    }
    
    // Otherwise treat as HttpErrorResponse
    const { message, description } = this.getAuthErrorDetails(error);
    
    // Log auth failures for security monitoring
    if (error.status === 401 || error.status === 403) {
      console.warn('[Auth Security]', message, error.url);
    }
    
    this._error.set(message);
    return throwError(() => ({ message, description, status: error.status }));
  }

  /**
   * Get detailed authentication error information
   */
  private getAuthErrorDetails(error: HttpErrorResponse): { message: string; description: string } {
    if (error.error instanceof ErrorEvent) {
      return {
        message: 'Network Connection Error',
        description: 'Unable to reach the authentication server. Please check your internet connection and try again.'
      };
    }
    
    switch (error.status) {
      case 0:
        return {
          message: 'Server Unavailable',
          description: 'Unable to connect to the server. Please check your internet connection or try again later.'
        };
      
      case 400:
        // Handle validation errors
        if (error.error?.errors) {
          const errorFields = Object.keys(error.error.errors);
          const firstError = error.error.errors[errorFields[0]]?.[0];
          return {
            message: 'Invalid Information',
            description: firstError || 'Please check the information you entered and try again.'
          };
        }
        return {
          message: 'Invalid Request',
          description: error.error?.message || 'The information provided is invalid. Please review and try again.'
        };
      
      case 401:
        // For 401 errors, prefer backend message if available
        const backendMessage = error.error?.message;
        
        // Distinguish between login, register, and session expiry
        const requestUrl = error.url || '';
        if (requestUrl.includes('/auth/login') || requestUrl.includes('login')) {
          return {
            message: 'Invalid Credentials',
            description: backendMessage || 'The email or password you entered is incorrect. Please check your credentials and try again.'
          };
        }
        if (requestUrl.includes('/auth/register') || requestUrl.includes('register')) {
          return {
            message: 'Registration Failed',
            description: backendMessage || 'Unable to create your account. Please try again or contact support.'
          };
        }
        return {
          message: 'Session Expired',
          description: 'Your session has expired. Please sign in again to continue.'
        };
      
      case 403:
        return {
          message: 'Access Denied',
          description: 'Your account does not have permission to access this resource. Contact your administrator for help.'
        };
      
      case 404:
        return {
          message: 'Account Not Found',
          description: 'No account exists with this email address. Would you like to create a new account?'
        };
      
      case 409:
        return {
          message: 'Email Already Registered',
          description: 'An account with this email already exists. Please sign in or use a different email address.'
        };
      
      case 422:
        return {
          message: 'Validation Failed',
          description: error.error?.message || 'Please ensure all required fields are filled correctly.'
        };
      
      case 429:
        return {
          message: 'Too Many Attempts',
          description: 'You have made too many login attempts. Please wait a few minutes before trying again.'
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: 'Server Error',
          description: 'We are experiencing technical difficulties. Please try again in a few minutes.'
        };
      
      default:
        return {
          message: 'Authentication Failed',
          description: error.error?.message || 'An unexpected error occurred. Please try again.'
        };
    }
  }
}
