import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { 
  authInterceptor, 
  contentTypeInterceptor, 
  errorInterceptor,
  correlationIdInterceptor,
  rateLimitInterceptor,
  apiVersionInterceptor
} from '@core/interceptors/http.interceptor';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

/**
 * Modern Angular 21 Application Configuration
 * Uses standalone components and functional providers
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Router with lazy loading and view transitions
    provideRouter(
      routes,
      withComponentInputBinding(), // Enable route params as inputs
      withViewTransitions() // Smooth page transitions
    ),
    
    // HTTP Client with modern interceptors
    // Order matters: correlation ID first, then auth, then others
    provideHttpClient(
      withFetch(), // Use native Fetch API
      withInterceptors([
        correlationIdInterceptor,   // Add tracking IDs first
        apiVersionInterceptor,      // Add API version header
        contentTypeInterceptor,     // Set content type
        authInterceptor,            // Add JWT token
        rateLimitInterceptor,       // Handle rate limiting
        ...(environment.production ? [] : [errorInterceptor])
      ])
    ),
    
    // Animations
    provideAnimations()
  ]
};

