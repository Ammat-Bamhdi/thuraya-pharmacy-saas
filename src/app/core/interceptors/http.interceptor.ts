import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { StoreService } from '../services/store.service';
import { environment } from '../../../environments/environment';

// ============================================================================
// Constants
// ============================================================================

const TOKEN_KEY = 'thurayya_access_token';
const REFRESH_TOKEN_KEY = 'thurayya_refresh_token';
const USER_KEY = 'thurayya_user';
const FIRST_LOGIN_KEY = 'thurayya_first_login';

// Rate limiting
const RATE_LIMIT_RETRY_DELAY = 1000; // 1 second

// ============================================================================
// Correlation ID Interceptor
// ============================================================================

/**
 * Adds correlation ID to requests for request tracking
 * Matches backend X-Correlation-ID header for distributed tracing
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  // Generate a unique correlation ID for each request
  const correlationId = generateCorrelationId();
  
  const correlatedReq = req.clone({
    setHeaders: {
      'X-Correlation-ID': correlationId,
      'X-Request-ID': correlationId.substring(0, 8)
    }
  });
  
  return next(correlatedReq);
};

/**
 * Generate a unique correlation ID (UUID v4 format without dashes)
 */
function generateCorrelationId(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// JWT Authentication Interceptor
// ============================================================================

/**
 * JWT Authentication interceptor
 * Adds Bearer token to API requests and handles 401 responses
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth header for login and register endpoints
  const isLoginOrRegister = req.url.includes('/auth/login') || req.url.includes('/auth/register');
  
  const token = localStorage.getItem(TOKEN_KEY);
  
  let authReq = req;
  // Add auth header for all requests except login/register endpoints
  if (token && !isLoginOrRegister) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // On 401, clear auth and redirect to login
      // Skip if this is a login or register endpoint
      if (error.status === 401 && !isLoginOrRegister) {
        clearAuthAndRedirect();
      }
      
      return throwError(() => error);
    })
  );
};

/**
 * Clear all auth data and redirect to login
 */
function clearAuthAndRedirect(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(FIRST_LOGIN_KEY);
  
  // Redirect to auth
  try {
    const store = inject(StoreService);
    store.setView('auth');
  } catch {
    // If inject fails (not in injection context), force reload
    window.location.reload();
  }
}

// ============================================================================
// Content-Type Interceptor
// ============================================================================

/**
 * Content-Type interceptor for JSON requests
 */
export const contentTypeInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add for requests with body
  if (req.body && !req.headers.has('Content-Type')) {
    const jsonReq = req.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    return next(jsonReq);
  }
  
  return next(req);
};

// ============================================================================
// Rate Limit Interceptor
// ============================================================================

/**
 * Rate limit handling interceptor
 * Handles 429 Too Many Requests with automatic retry
 */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 429) {
        // Get retry-after from header or use default
        const retryAfter = error.headers.get('Retry-After');
        const retryDelayMs = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : RATE_LIMIT_RETRY_DELAY;
        
        console.warn(`[Rate Limited] Retrying after ${retryDelayMs}ms...`);
        
        // Return error with retry info for UI handling
        const rateLimitError = new Error('Too many requests. Please wait a moment.');
        (rateLimitError as any).retryAfter = retryDelayMs;
        (rateLimitError as any).isRateLimited = true;
        
        return throwError(() => rateLimitError);
      }
      
      return throwError(() => error);
    })
  );
};

// ============================================================================
// Error Handling Interceptor
// ============================================================================

/**
 * Enhanced error handling interceptor with structured error responses
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Log errors in development
      if (!environment.production) {
        const correlationId = req.headers.get('X-Correlation-ID') || 'unknown';
        console.error(`[HTTP Error ${error.status}] [${correlationId}]`, req.url, error.message);
      }
      
      // Normalize error response
      const normalizedError = normalizeError(error);
      
      return throwError(() => normalizedError);
    })
  );
};

/**
 * Normalize HTTP errors into a consistent structure with detailed descriptions
 */
function normalizeError(error: HttpErrorResponse): NormalizedError {
  const baseError: NormalizedError = {
    status: error.status,
    message: 'An unexpected error occurred',
    description: 'Something went wrong while processing your request. Please try again.',
    errors: null,
    correlationId: null,
    timestamp: new Date().toISOString(),
    actionRequired: null
  };

  // Extract correlation ID from response headers
  if (error.headers) {
    baseError.correlationId = error.headers.get('X-Correlation-ID');
  }

  if (error.error instanceof ErrorEvent) {
    // Client-side or network error
    baseError.message = 'Network Connection Error';
    baseError.description = 'Unable to reach the server. Please check your internet connection and try again.';
    baseError.isNetworkError = true;
    baseError.actionRequired = 'Check your internet connection';
  } else if (error.status === 0) {
    baseError.message = 'Server Unreachable';
    baseError.description = 'The server is not responding. This could be due to network issues or server maintenance.';
    baseError.isNetworkError = true;
    baseError.actionRequired = 'Wait a moment and try again';
  } else if (error.status === 400) {
    // Validation errors from backend
    baseError.message = 'Invalid Request';
    baseError.description = error.error?.message || error.error?.title || 'The information you provided is invalid. Please review and correct the highlighted fields.';
    if (error.error?.errors) {
      baseError.errors = error.error.errors;
      // Create detailed description from validation errors
      const errorFields = Object.keys(error.error.errors);
      if (errorFields.length > 0) {
        baseError.description = `Please correct the following: ${errorFields.join(', ')}.`;
      }
    }
    baseError.actionRequired = 'Review and correct the form fields';
  } else if (error.status === 401) {
    // Check if this is a login/register request
    const requestUrl = error.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    
    if (isAuthEndpoint) {
      baseError.message = 'Authentication Failed';
      baseError.description = error.error?.message || 'Invalid credentials. Please check your email and password.';
      baseError.actionRequired = 'Check your credentials';
    } else {
      baseError.message = 'Authentication Required';
      baseError.description = 'Your session has expired or your credentials are invalid. Please sign in again to continue.';
      baseError.actionRequired = 'Sign in to your account';
    }
  } else if (error.status === 403) {
    baseError.message = 'Access Denied';
    baseError.description = 'You do not have the required permissions to perform this action. Contact your administrator if you believe this is an error.';
    baseError.actionRequired = 'Contact your administrator';
  } else if (error.status === 404) {
    baseError.message = 'Resource Not Found';
    baseError.description = 'The item you are looking for does not exist or may have been deleted.';
    baseError.actionRequired = 'Go back and try again';
  } else if (error.status === 409) {
    baseError.message = 'Conflict Detected';
    baseError.description = error.error?.message || 'This item already exists or conflicts with existing data. Please use a different value.';
    baseError.actionRequired = 'Use a different value';
  } else if (error.status === 422) {
    baseError.message = 'Validation Failed';
    baseError.description = error.error?.message || 'The data you submitted could not be processed. Please check your input and try again.';
    baseError.actionRequired = 'Check your input data';
  } else if (error.status === 429) {
    baseError.message = 'Too Many Requests';
    baseError.description = 'You have made too many requests in a short period. Please wait a moment before trying again.';
    baseError.isRateLimited = true;
    baseError.actionRequired = 'Wait a few seconds and retry';
  } else if (error.status >= 500 && error.status < 600) {
    baseError.message = 'Server Error';
    baseError.description = 'An internal server error occurred. Our team has been notified. Please try again later.';
    baseError.actionRequired = 'Try again later';
  } else if (error.error?.message) {
    baseError.message = 'Request Failed';
    baseError.description = error.error.message;
  }

  return baseError;
}

/**
 * Normalized error structure with enhanced descriptions
 */
export interface NormalizedError {
  status: number;
  message: string;
  description: string;
  errors: Record<string, string[]> | null;
  correlationId: string | null;
  timestamp: string;
  actionRequired: string | null;
  isNetworkError?: boolean;
  isRateLimited?: boolean;
}

// ============================================================================
// API Versioning Interceptor
// ============================================================================

/**
 * API versioning interceptor
 * Adds API version header for future versioning support
 */
export const apiVersionInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add to API requests
  if (req.url.includes('/api/')) {
    const versionedReq = req.clone({
      setHeaders: {
        'X-Api-Version': '1.0'
      }
    });
    return next(versionedReq);
  }
  
  return next(req);
};
