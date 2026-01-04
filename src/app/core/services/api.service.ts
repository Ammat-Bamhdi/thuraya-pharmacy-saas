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
  errors?: Record<string, string[]>;
  timestamp: Date;
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
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Loading state management
  private readonly _activeRequests = signal(0);
  readonly isLoading = computed(() => this._activeRequests() > 0);
  
  // Error state
  private readonly _lastError = signal<ApiError | null>(null);
  readonly lastError = this._lastError.asReadonly();

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
          throw this.createApiError(0, response.message || 'Request failed', response.errors || undefined);
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
      apiError = this.createApiError(
        error.status,
        this.getErrorMessage(error),
        error.error?.errors
      );
    } else {
      apiError = error;
    }
    
    this._lastError.set(apiError);
    console.error('API Error:', apiError);
    
    return throwError(() => apiError);
  }

  private createApiError(status: number, message: string, errors?: Record<string, string[]>): ApiError {
    return {
      status,
      message,
      errors,
      timestamp: new Date()
    };
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Unable to connect to server. Please check your internet connection.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please log in again.';
    }
    if (error.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.status === 422) {
      return error.error?.message || 'Validation failed. Please check your input.';
    }
    if (error.status >= 500) {
      return 'A server error occurred. Please try again later.';
    }
    return error.error?.message || error.message || 'An unexpected error occurred.';
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

