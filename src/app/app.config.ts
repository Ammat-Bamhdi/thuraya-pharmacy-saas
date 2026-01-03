import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { authInterceptor, loggingInterceptor, cacheInterceptor } from '@core/interceptors/http.interceptor';
import { environment } from '../environments/environment';

/**
 * Modern Angular 21 Application Configuration
 * Uses standalone components and functional providers
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // HTTP Client with modern interceptors
    provideHttpClient(
      withFetch(), // Use native Fetch API
      withInterceptors([
        authInterceptor,
        ...(environment.production ? [] : [loggingInterceptor]),
        cacheInterceptor
      ])
    ),
    
    // Animations
    provideAnimations()
  ]
};

