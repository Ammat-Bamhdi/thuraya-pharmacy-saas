/**
 * @fileoverview Base API Service - Production-grade HTTP client wrapper
 * @description Provides centralized API communication with:
 * - Automatic retry with exponential backoff
 * - Request caching with TTL
 * - Error normalization
 * - Loading state management
 * - Request cancellation
 * - Optimistic updates support
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, timer, of, Subject } from 'rxjs';
import { catchError, retry, map, tap, takeUntil, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  description: string;
  errors?: Record<string, string[]>;
  timestamp: Date;
  actionRequired?: string;
  correlationId?: string;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RequestConfig {
  skipCache?: boolean;
  cacheTtl?: number; // milliseconds
  retries?: number;
  showLoading?: boolean;
  skipRateLimitRetry?: boolean; // Skip automatic retry on rate limit
}

// ============================================================================
// API Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  
  // Request cancellation
  private readonly cancelPending$ = new Subject<void>();
  
  // Cache storage
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_CACHE_TTL = 30 * 1000; // Reduced to 30 seconds for dynamic pharmacy data
  
  // Loading state management
  private readonly _activeRequests = signal(0);
  readonly isLoading = computed(() => this._activeRequests() > 0);
  
  // Error state
  private readonly _lastError = signal<ApiError | null>(null);
  readonly lastError = this._lastError.asReadonly();

  // Rate limit state
  private readonly _isRateLimited = signal(false);
  readonly isRateLimited = this._isRateLimited.asReadonly();

  // ============================================================================
  // Core HTTP Methods
  // ============================================================================

  /**
   * GET request with caching support
   */
  get<T>(endpoint: string, params?: QueryParams, config?: RequestConfig): Observable<T> {
    const url = this.buildUrl(endpoint);
    const httpParams = this.buildParams(params);
    const cacheKey = this.getCacheKey('GET', url, params);
    
    // Check cache first
    if (!config?.skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return of(cached);
      }
    }
    
    return this.executeRequest<T>(
      this.http.get<ApiResponse<T>>(url, { params: httpParams }),
      config
    ).pipe(
      tap(data => {
        if (data) {
          this.setCache(cacheKey, data, config?.cacheTtl);
        }
      })
    );
  }

  /**
   * POST request - creates new resource
   */
  post<T>(endpoint: string, body: unknown, config?: RequestConfig): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T>(
      this.http.post<ApiResponse<T>>(url, body),
      config
    );
  }

  /**
   * PUT request - full update
   */
  put<T>(endpoint: string, body: unknown, config?: RequestConfig): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T>(
      this.http.put<ApiResponse<T>>(url, body),
      config
    );
  }

  /**
   * PATCH request - partial update
   */
  patch<T>(endpoint: string, body: unknown, config?: RequestConfig): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T>(
      this.http.patch<ApiResponse<T>>(url, body),
      config
    );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, config?: RequestConfig): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T>(
      this.http.delete<ApiResponse<T>>(url),
      config
    );
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Batch create multiple resources
   */
  bulkCreate<T>(endpoint: string, items: unknown[]): Observable<T[]> {
    const url = this.buildUrl(`${endpoint}/bulk`);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T[]>(
      this.http.post<ApiResponse<T[]>>(url, { items })
    );
  }

  /**
   * Batch update multiple resources
   */
  bulkUpdate<T>(endpoint: string, items: { id: string; data: unknown }[]): Observable<T[]> {
    const url = this.buildUrl(`${endpoint}/bulk`);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<T[]>(
      this.http.put<ApiResponse<T[]>>(url, { items })
    );
  }

  /**
   * Batch delete multiple resources
   */
  bulkDelete(endpoint: string, ids: string[]): Observable<boolean> {
    const url = this.buildUrl(`${endpoint}/bulk`);
    this.invalidateCacheForEndpoint(endpoint);
    
    return this.executeRequest<boolean>(
      this.http.request<ApiResponse<boolean>>('DELETE', url, { body: { ids } })
    );
  }

  // ============================================================================
  // Request Execution
  // ============================================================================

  private executeRequest<T>(
    request: Observable<ApiResponse<T>>,
    config?: RequestConfig
  ): Observable<T> {
    const retries = config?.retries ?? 3;
    
    if (config?.showLoading !== false) {
      this._activeRequests.update(n => n + 1);
    }
    
    return request.pipe(
      takeUntil(this.cancelPending$),
      retry({
        count: retries,
        delay: (error, retryCount) => {
          // Handle rate limiting (429)
          if (error.status === 429) {
            this._isRateLimited.set(true);
            
            if (config?.skipRateLimitRetry) {
              return throwError(() => error);
            }
            
            // Get retry-after from error or use default 1 second
            const retryAfter = (error as any).retryAfter || 1000;
            console.warn(`Rate limited. Retrying in ${retryAfter}ms...`);
            
            // Reset rate limit flag after delay
            setTimeout(() => this._isRateLimited.set(false), retryAfter);
            
            return timer(retryAfter);
          }
          
          // Only retry on network errors or 5xx
          if (error.status && error.status < 500 && error.status !== 0) {
            return throwError(() => error);
          }
          // Exponential backoff: 1s, 2s, 4s...
          const delay = Math.pow(2, retryCount - 1) * 1000;
          console.log(`Retrying request in ${delay}ms (attempt ${retryCount}/${retries})`);
          return timer(delay);
        }
      }),
      map(response => {
        if (!response.success) {
          throw this.createApiError(
            0, 
            'Request failed', 
            response.message || 'The request could not be completed',
            response.errors || undefined
          );
        }
        return response.data as T;
      }),
      catchError(error => this.handleError(error)),
      finalize(() => {
        if (config?.showLoading !== false) {
          this._activeRequests.update(n => Math.max(0, n - 1));
        }
      })
    );
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: HttpErrorResponse | ApiError): Observable<never> {
    let apiError: ApiError;
    
    if (error instanceof HttpErrorResponse) {
      const { message, description, actionRequired } = this.getErrorDetails(error);
      apiError = this.createApiError(
        error.status,
        message,
        description,
        error.error?.errors,
        actionRequired
      );
    } else {
      apiError = error;
    }
    
    this._lastError.set(apiError);
    
    // Only log in development
    if (!environment.production) {
      console.error('API Error:', apiError);
    }
    
    return throwError(() => apiError);
  }

  private createApiError(
    status: number, 
    message: string, 
    description: string,
    errors?: Record<string, string[]>,
    actionRequired?: string
  ): ApiError {
    return {
      status,
      message,
      description,
      errors,
      timestamp: new Date(),
      actionRequired
    };
  }

  /**
   * Get detailed error information based on HTTP status
   */
  private getErrorDetails(error: HttpErrorResponse): { 
    message: string; 
    description: string; 
    actionRequired?: string;
  } {
    // Check if this is an auth endpoint error
    const requestUrl = error.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    
    const errorMessages: Record<number, { message: string; description: string; actionRequired?: string }> = {
      0: {
        message: 'Connection Failed',
        description: 'Unable to connect to the server. Please check your internet connection and ensure the server is running.',
        actionRequired: 'Check your internet connection'
      },
      400: {
        message: 'Invalid Request',
        description: error.error?.message || 'The request contains invalid data. Please review your input and try again.',
        actionRequired: 'Review and correct your input'
      },
      401: {
        message: isAuthEndpoint ? 'Authentication Failed' : 'Session Expired',
        description: error.error?.message || (isAuthEndpoint ? 'Invalid credentials. Please check your email and password.' : 'Your login session has expired. Please sign in again to continue working.'),
        actionRequired: 'Sign in again'
      },
      403: {
        message: 'Access Denied',
        description: 'You do not have permission to access this resource. Contact your administrator if you need access.',
        actionRequired: 'Contact your administrator'
      },
      404: {
        message: 'Not Found',
        description: 'The requested item could not be found. It may have been moved or deleted.',
        actionRequired: 'Go back and try again'
      },
      409: {
        message: 'Conflict',
        description: error.error?.message || 'This operation conflicts with existing data. The item may already exist.',
        actionRequired: 'Use a different value'
      },
      422: {
        message: 'Validation Error',
        description: error.error?.message || 'The submitted data failed validation. Please check the required fields.',
        actionRequired: 'Check required fields'
      },
      429: {
        message: 'Rate Limited',
        description: 'You are making requests too quickly. Please wait a moment before trying again.',
        actionRequired: 'Wait and retry'
      },
      500: {
        message: 'Server Error',
        description: 'An unexpected server error occurred. Our team has been notified. Please try again later.',
        actionRequired: 'Try again later'
      },
      502: {
        message: 'Bad Gateway',
        description: 'The server received an invalid response. This is usually temporary. Please try again.',
        actionRequired: 'Try again in a few seconds'
      },
      503: {
        message: 'Service Unavailable',
        description: 'The server is temporarily unavailable due to maintenance or high load. Please try again shortly.',
        actionRequired: 'Try again in a few minutes'
      },
      504: {
        message: 'Gateway Timeout',
        description: 'The server took too long to respond. This may be due to high load. Please try again.',
        actionRequired: 'Try again'
      }
    };

    // Get matching error or use generic 5xx handler
    if (errorMessages[error.status]) {
      return errorMessages[error.status];
    }
    
    if (error.status >= 500) {
      return {
        message: 'Server Error',
        description: 'An unexpected server error occurred. Please try again later.',
        actionRequired: 'Try again later'
      };
    }

    return {
      message: 'Request Failed',
      description: error.error?.message || error.message || 'An unexpected error occurred while processing your request.',
      actionRequired: 'Try again'
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private getCacheKey(method: string, url: string, params?: QueryParams): string {
    return `${method}:${url}:${JSON.stringify(params || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_CACHE_TTL
    });
  }

  private invalidateCacheForEndpoint(endpoint: string): void {
    const prefix = endpoint.split('/')[0];
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific endpoint
   */
  invalidateCache(endpoint: string): void {
    this.invalidateCacheForEndpoint(endpoint);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  private buildParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    
    return httpParams;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    this.cancelPending$.next();
  }

  /**
   * Clear the last error
   */
  clearError(): void {
    this._lastError.set(null);
  }
}

