import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { StoreService } from '../services/store.service';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'thurayya_access_token';
const REFRESH_TOKEN_KEY = 'thurayya_refresh_token';
const USER_KEY = 'thurayya_user';
const FIRST_LOGIN_KEY = 'thurayya_first_login';

/**
 * JWT Authentication interceptor
 * Adds Bearer token to API requests and handles 401 responses
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth header for auth endpoints EXCEPT /auth/me which needs authentication
  const isAuthEndpoint = req.url.includes('/auth/');
  const isAuthMe = req.url.includes('/auth/me');
  
  const token = localStorage.getItem(TOKEN_KEY);
  
  let authReq = req;
  // Add auth header for all requests except login/register endpoints (but include /auth/me)
  if (token && (!isAuthEndpoint || isAuthMe)) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // On 401, clear auth and redirect to login
      // Skip if this is already an auth endpoint (login/register can fail with 401)
      if (error.status === 401 && !isAuthEndpoint) {
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

/**
 * Content-Type interceptor for JSON requests
 */
export const contentTypeInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add for requests with body
  if (req.body && !req.headers.has('Content-Type')) {
    const jsonReq = req.clone({
      setHeaders: {
        'Content-Type': 'application/json'
      }
    });
    return next(jsonReq);
  }
  
  return next(req);
};

/**
 * Error handling interceptor with logging
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Log errors in development
      if (!environment.production) {
        console.error(`[HTTP Error ${error.status}]`, req.url, error.message);
      }
      
      return throwError(() => error);
    })
  );
};
