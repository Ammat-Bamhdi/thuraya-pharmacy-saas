import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Modern functional HTTP interceptor for Angular 21
 * Adds authentication tokens and handles global errors
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Add authentication token if available
  const token = localStorage.getItem('auth_token');
  
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Global error handling
      if (error.status === 401) {
        // Handle unauthorized - redirect to login
        console.error('Unauthorized request - redirect to login');
        localStorage.removeItem('auth_token');
        // You can inject Router here if needed
      }
      
      return throwError(() => error);
    })
  );
};

/**
 * Logging interceptor for development
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const startTime = Date.now();
  
  console.log(`🔄 HTTP ${req.method} Request:`, req.url);
  
  return next(req).pipe(
    catchError((error) => {
      const duration = Date.now() - startTime;
      console.error(`❌ HTTP ${req.method} Error (${duration}ms):`, req.url, error);
      return throwError(() => error);
    })
  );
};

/**
 * Cache interceptor for GET requests
 */
export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // Add cache control headers
  const cachedReq = req.clone({
    setHeaders: {
      'Cache-Control': 'max-age=300' // 5 minutes
    }
  });

  return next(cachedReq);
};
