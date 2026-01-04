import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { authInterceptor, contentTypeInterceptor, errorInterceptor } from '@core/interceptors/http.interceptor';
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
    provideHttpClient(
      withFetch(), // Use native Fetch API
      withInterceptors([
        contentTypeInterceptor,
        authInterceptor,
        ...(environment.production ? [] : [errorInterceptor])
      ])
    ),
    
    // Animations
    provideAnimations()
  ]
};

