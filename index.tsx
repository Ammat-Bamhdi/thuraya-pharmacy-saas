
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './src/app/app.component';
import { appConfig } from './src/app/app.config';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    ...appConfig.providers
  ]
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
