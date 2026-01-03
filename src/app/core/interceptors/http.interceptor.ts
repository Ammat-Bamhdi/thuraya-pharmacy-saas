import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';

const TOKEN_KEY = 'thurayya_access_token';

/**
 * JWT Authentication interceptor
 * Adds Bearer token to API requests and handles 401 responses
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth header for auth endpoints
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const token = localStorage.getItem(TOKEN_KEY);
  
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expired - try refresh
        const refreshToken = localStorage.getItem('thurayya_refresh_token');
        
        if (refreshToken) {
          // Attempt token refresh
          return handleTokenRefresh(authReq, next);
        } else {
          // No refresh token - logout
          handleLogout();
        }
      }
      
      return throwError(() => error);
    })
  );
};

/**
 * Handle token refresh and retry request
 */
function handleTokenRefresh(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const authService = inject(AuthService);
  
  return authService.refreshToken().pipe(
    take(1),
    switchMap(() => {
      const newToken = localStorage.getItem(TOKEN_KEY);
      const retryReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${newToken}`
        }
      });
      return next(retryReq);
    }),
    catchError((error) => {
      handleLogout();
      return throwError(() => error);
    })
  );
}

/**
 * Handle logout and redirect
 */
function handleLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('thurayya_refresh_token');
  localStorage.removeItem('thurayya_user');
  localStorage.removeItem('thurayya_first_login');
  
  // Redirect to auth
  const store = inject(StoreService);
  store.setView('auth');
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
        console.error(`HTTP Error ${error.status}:`, error.message, req.url);
      }
      
      return throwError(() => error);
    })
  );
};

// Import environment for production check
import { environment } from '../../../environments/environment';
