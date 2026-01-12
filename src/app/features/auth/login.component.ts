/**
 * @fileoverview Login Component for tenant-first authentication
 * Handles login within a specific organization context (tenant slug in URL)
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { 
  Component, 
  signal, 
  inject, 
  ChangeDetectionStrategy,
  computed,
  OnInit,
  OnDestroy,
  NgZone,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { environment } from '../../../environments/environment';
import { ApiResponse, TenantPublicInfo } from '@core/models/auth.model';
import { catchError, of, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Google Sign-In types
declare const google: any;

// LocalStorage key for remembering last used org
const LAST_ORG_KEY = 'thurayya_last_org';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-container" role="main">
      <!-- Left Panel - Branding -->
      <aside class="brand-panel" aria-hidden="true">
        <div class="brand-content">
          <!-- Logo -->
          <div class="logo">
            <div class="logo-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.1"/>
                <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
              </svg>
            </div>
            <span class="logo-text">ثريّا</span>
          </div>

          <!-- Org Name Badge -->
          @if (orgInfo()) {
            <div class="org-badge">
              <span class="org-badge-text">{{ orgInfo()?.name }}</span>
            </div>
          }

          <!-- Taglines -->
          <div class="taglines">
            <h1 class="tagline">Streamline.</h1>
            <h1 class="tagline">Optimize.</h1>
            <h1 class="tagline">Grow.</h1>
          </div>

          <p class="description">
            Sign in to manage your pharmacy operations, inventory, and sales
          </p>

          <!-- Feature Card -->
          <div class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="feature-content">
              <h2>Secure Access</h2>
              <p>Enterprise-grade security with role-based permissions and audit logging.</p>
            </div>
          </div>
        </div>

        <!-- Decorative Elements -->
        <div class="decorative-circle circle-1" aria-hidden="true"></div>
        <div class="decorative-circle circle-2" aria-hidden="true"></div>
      </aside>

      <!-- Right Panel - Login Form -->
      <section class="form-panel">
        <!-- Back Link -->
        <a routerLink="/" class="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Change organization</span>
        </a>

        <div class="form-container">
          <!-- Loading State -->
          @if (isLoadingOrg()) {
            <div class="loading-state">
              <div class="spinner-large"></div>
              <p>Loading organization...</p>
            </div>
          } @else if (orgError()) {
            <!-- Org Error State -->
            <div class="error-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h2>Organization not found</h2>
              <p>The organization "{{ slug() }}" doesn't exist or may have been deleted.</p>
              <button type="button" class="primary-btn" (click)="goBack()">
                Go back
              </button>
            </div>
          } @else {
            <!-- Form Header -->
            <header class="form-header">
              <h1 id="form-title">Welcome back</h1>
              <p id="form-description">
                Sign in to <strong>{{ orgInfo()?.name }}</strong>
              </p>
            </header>

            <!-- Error Message -->
            @if (auth.error()) {
              <div class="error-banner" role="alert" aria-live="assertive">
                <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{{ auth.error() }}</span>
                <button type="button" (click)="auth.clearError()" aria-label="Dismiss" class="dismiss-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            }

            <!-- Success Message -->
            @if (successMessage()) {
              <div class="success-banner" role="status" aria-live="polite">
                <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <span>{{ successMessage() }}</span>
              </div>
            }

            <!-- Google Sign-In Button -->
            <div class="google-signin-wrapper">
              <button 
                type="button" 
                class="google-btn"
                (click)="signInWithGoogle()"
                [disabled]="auth.isLoading() || googleLoading()"
                aria-label="Sign in with Google"
              >
                @if (googleLoading()) {
                  <span class="spinner-small" aria-hidden="true"></span>
                  <span>Signing in...</span>
                } @else {
                  <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
                }
              </button>
            </div>

            <!-- Divider -->
            <div class="divider" role="separator">
              <span>or continue with email</span>
            </div>

            <!-- Login Form -->
            <form 
              (ngSubmit)="handleSubmit()" 
              class="auth-form"
              aria-labelledby="form-title"
              autocomplete="on"
            >
              <!-- Email Field -->
              <div class="form-group" [class.has-value]="email()">
                <label for="email" class="form-label">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  [ngModel]="email()"
                  (ngModelChange)="email.set($event); auth.clearError()"
                  placeholder="you&#64;company.com"
                  required
                  autocomplete="email"
                  class="form-input"
                  [class.error]="email() && !isValidEmail()"
                />
                @if (email() && !isValidEmail()) {
                  <span class="field-hint error">Please enter a valid email address</span>
                }
              </div>

              <!-- Password Field -->
              <div class="form-group" [class.has-value]="password()">
                <div class="label-row">
                  <label for="password" class="form-label">Password</label>
                  <button type="button" class="forgot-link" (click)="showForgotPassword()">
                    Forgot password?
                  </button>
                </div>
                <div class="password-input">
                  <input 
                    [type]="showPassword() ? 'text' : 'password'" 
                    id="password" 
                    name="password"
                    [ngModel]="password()"
                    (ngModelChange)="password.set($event); auth.clearError()"
                    placeholder="••••••••"
                    required
                    autocomplete="current-password"
                    class="form-input"
                  />
                  <button 
                    type="button" 
                    class="toggle-password" 
                    (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                    [attr.aria-pressed]="showPassword()"
                  >
                    @if (showPassword()) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    }
                  </button>
                </div>
              </div>

              <!-- Submit Button -->
              <button 
                type="submit" 
                class="submit-btn" 
                [disabled]="auth.isLoading() || !isFormValid()"
                [attr.aria-busy]="auth.isLoading()"
              >
                @if (auth.isLoading()) {
                  <span class="spinner" aria-hidden="true"></span>
                  <span>Signing in...</span>
                } @else {
                  <span>Sign in</span>
                  <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                }
              </button>
            </form>

            <!-- Not a member -->
            <p class="not-member">
              Not a member of this organization?
              <br />
              <span class="contact-hint">Contact your administrator to get an invitation.</span>
            </p>
          }
        </div>

        <!-- Footer -->
        <footer class="auth-footer">
          <span>© {{ currentYear }} Thurayya Systems. All rights reserved.</span>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    /* Variables */
    :host {
      --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-size-xs: 0.75rem;
      --font-size-sm: 0.8125rem;
      --font-size-base: 0.875rem;
      --font-size-lg: 1rem;
      --font-size-xl: 1.25rem;
      --font-size-2xl: 1.5rem;
      --color-primary: #0f172a;
      --color-primary-hover: #1e293b;
      --color-accent: #6366f1;
      --color-accent-hover: #4f46e5;
      --color-text: #374151;
      --color-text-muted: #6b7280;
      --color-border: #e5e7eb;
      --color-error: #dc2626;
      --color-error-bg: #fef2f2;
      --color-success: #10b981;
      --radius: 10px;
      --radius-sm: 6px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      --transition: 150ms ease;
    }

    /* Layout */
    .login-container {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: #fff;
      font-family: var(--font-sans);
    }

    /* Brand Panel */
    .brand-panel {
      flex: 1;
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      padding: 2.5rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .brand-content {
      position: relative;
      z-index: 10;
      max-width: 420px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .logo-text {
      font-size: 1.75rem;
      font-weight: 700;
      color: white;
      font-family: 'Noto Sans Arabic', var(--font-sans);
    }

    .org-badge {
      display: inline-flex;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 20px;
      padding: 0.5rem 1rem;
      margin-bottom: 2rem;
    }

    .org-badge-text {
      color: #a5b4fc;
      font-size: var(--font-size-sm);
      font-weight: 600;
    }

    .taglines { margin-bottom: 1.25rem; }

    .tagline {
      font-size: 2rem;
      font-weight: 600;
      color: white;
      line-height: 1.2;
      margin: 0;
    }

    .description {
      color: rgba(255, 255, 255, 0.65);
      font-size: var(--font-size-base);
      line-height: 1.5;
      margin-bottom: 2rem;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .feature-icon {
      width: 44px;
      height: 44px;
      background: rgba(99, 102, 241, 0.12);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.875rem;
      color: #a5b4fc;
    }

    .feature-content h2 {
      color: white;
      font-size: var(--font-size-base);
      font-weight: 600;
      margin: 0 0 0.375rem 0;
    }

    .feature-content p {
      color: rgba(255, 255, 255, 0.55);
      font-size: var(--font-size-sm);
      line-height: 1.5;
      margin: 0;
    }

    .decorative-circle {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .circle-1 { width: 400px; height: 400px; top: -120px; right: -120px; }
    .circle-2 { width: 300px; height: 300px; bottom: -80px; left: -80px; }

    /* Form Panel */
    .form-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1.5rem 2.5rem;
      background: #fff;
      position: relative;
      overflow-y: auto;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-weight: 500;
      text-decoration: none;
      margin-bottom: 1rem;
      transition: color var(--transition);
    }

    .back-link:hover {
      color: var(--color-primary);
    }

    .back-link svg {
      width: 16px;
      height: 16px;
    }

    .form-container {
      max-width: 380px;
      width: 100%;
      margin: auto;
      padding: 2rem 0;
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .spinner-large {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    .loading-state p {
      color: var(--color-text-muted);
      font-size: var(--font-size-base);
    }

    /* Error State */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
    }

    .error-state svg {
      width: 48px;
      height: 48px;
      color: var(--color-error);
      margin-bottom: 1rem;
    }

    .error-state h2 {
      color: var(--color-primary);
      font-size: var(--font-size-xl);
      margin: 0 0 0.5rem 0;
    }

    .error-state p {
      color: var(--color-text-muted);
      font-size: var(--font-size-base);
      margin: 0 0 1.5rem 0;
    }

    .primary-btn {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-size: var(--font-size-base);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
    }

    .primary-btn:hover {
      background: var(--color-primary-hover);
    }

    /* Form Header */
    .form-header { margin-bottom: 1.5rem; }

    .form-header h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-primary);
      margin: 0 0 0.375rem 0;
      letter-spacing: -0.025em;
    }

    .form-header p {
      color: var(--color-text-muted);
      font-size: var(--font-size-base);
      margin: 0;
    }

    .form-header strong {
      color: var(--color-primary);
    }

    /* Error Banner */
    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1.25rem;
      font-size: var(--font-size-sm);
      line-height: 1.5;
      background: var(--color-error-bg);
      border: 1px solid #fecaca;
      color: var(--color-error);
      animation: slideIn 0.2s ease-out;
    }

    /* Success Banner */
    .success-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1.25rem;
      font-size: var(--font-size-sm);
      line-height: 1.5;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: var(--color-success);
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .alert-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .dismiss-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 0.25rem;
      opacity: 0.7;
      flex-shrink: 0;
    }

    .dismiss-btn svg { width: 14px; height: 14px; }
    .dismiss-btn:hover { opacity: 1; }

    /* Google Button */
    .google-signin-wrapper { margin-bottom: 0; }

    .google-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: white;
      font-size: var(--font-size-base);
      font-weight: 500;
      color: var(--color-text);
      cursor: pointer;
      transition: all var(--transition);
    }

    .google-btn:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
      box-shadow: var(--shadow-sm);
    }

    .google-btn:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .google-icon { width: 18px; height: 18px; }

    .spinner-small {
      width: 18px;
      height: 18px;
      border: 2px solid #e5e7eb;
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* Divider */
    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.25rem 0;
      color: #9ca3af;
      font-size: var(--font-size-xs);
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }

    /* Form */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-label {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text);
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .forgot-link {
      font-size: var(--font-size-xs);
      color: var(--color-accent);
      text-decoration: none;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    .forgot-link:hover { text-decoration: underline; }

    .form-input {
      width: 100%;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: var(--font-size-base);
      color: var(--color-primary);
      background: #fff;
      transition: all var(--transition);
      height: 44px;
    }

    .form-input:hover { border-color: #d1d5db; }
    .form-input:focus { 
      outline: none; 
      border-color: var(--color-accent); 
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); 
    }
    .form-input.error { border-color: var(--color-error); }
    .form-input::placeholder { color: #9ca3af; }

    .field-hint {
      font-size: var(--font-size-xs);
      margin-top: 0.25rem;
      display: block;
    }
    .field-hint.error { color: var(--color-error); }

    /* Password Input */
    .password-input { position: relative; }
    .password-input input { padding-right: 2.75rem; width: 100%; }

    .toggle-password {
      position: absolute;
      right: 0.625rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      display: flex;
    }

    .toggle-password svg { width: 18px; height: 18px; }
    .toggle-password:hover { color: var(--color-text); }
    .toggle-password:focus-visible { outline: 2px solid var(--color-accent); }

    /* Submit Button */
    .submit-btn {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      font-size: var(--font-size-base);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 48px;
      margin-top: 0.5rem;
    }

    .submit-btn:hover:not(:disabled) { 
      background: var(--color-primary-hover); 
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }
    
    .submit-btn:active:not(:disabled) { transform: translateY(0); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .submit-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

    .btn-arrow { width: 18px; height: 18px; transition: transform var(--transition); }
    .submit-btn:hover:not(:disabled) .btn-arrow { transform: translateX(2px); }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* Not Member */
    .not-member {
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin-top: 1.5rem;
      line-height: 1.6;
    }

    .contact-hint {
      color: #9ca3af;
      font-size: var(--font-size-xs);
    }

    /* Footer */
    .auth-footer {
      text-align: center;
      font-size: var(--font-size-xs);
      color: #9ca3af;
      padding: 1rem 0;
      margin-top: auto;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .brand-panel { display: none; }
    }

    @media (max-width: 480px) {
      .form-panel { padding: 1rem; }
      .form-container { padding: 1rem 0; }
      .form-header h1 { font-size: var(--font-size-xl); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  // Org context
  readonly slug = signal('');
  readonly orgInfo = signal<TenantPublicInfo | null>(null);
  readonly isLoadingOrg = signal(true);
  readonly orgError = signal(false);

  // UI State
  readonly showPassword = signal(false);
  readonly googleLoading = signal(false);
  readonly successMessage = signal<string | null>(null);

  // Form fields
  readonly email = signal('');
  readonly password = signal('');

  // Constants
  readonly currentYear = new Date().getFullYear();
  private readonly googleClientId = environment.googleClientId || '';

  readonly isFormValid = computed(() => {
    return !!(this.email() && this.isValidEmail() && this.password());
  });

  ngOnInit(): void {
    // Get slug from route with proper cleanup
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.slug.set(slug);
        this.loadOrgInfo(slug);
        // Remember this org for next time
        this.saveLastOrg(slug);
      } else {
        this.orgError.set(true);
        this.isLoadingOrg.set(false);
      }
    });

    this.loadGoogleScript();
  }

  ngOnDestroy(): void {
    // DestroyRef handles cleanup automatically
  }

  private loadOrgInfo(slug: string): void {
    this.isLoadingOrg.set(true);
    this.orgError.set(false);

    this.http.get<ApiResponse<TenantPublicInfo>>(`${this.apiUrl}/tenants/by-slug/${slug}`).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap(response => {
        this.isLoadingOrg.set(false);
        if (response.success && response.data) {
          this.orgInfo.set(response.data);
        } else {
          this.orgError.set(true);
        }
      }),
      catchError(() => {
        this.isLoadingOrg.set(false);
        this.orgError.set(true);
        return of(null);
      })
    ).subscribe();
  }

  private saveLastOrg(slug: string): void {
    try {
      localStorage.setItem(LAST_ORG_KEY, slug);
    } catch {
      // localStorage not available - ignore
    }
  }

  isValidEmail(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email());
  }

  handleSubmit(): void {
    if (!this.isFormValid()) return;
    
    // Pass tenantSlug for tenant-first validation
    this.auth.login({
      email: this.email().trim().toLowerCase(),
      password: this.password(),
      tenantSlug: this.slug()
    }).subscribe({
      next: () => this.auth.navigateAfterAuth()
    });
  }

  showForgotPassword(): void {
    // Show inline message instead of browser alert
    this.successMessage.set('Password reset feature coming soon. Please contact your administrator for assistance.');
    setTimeout(() => this.successMessage.set(null), 6000);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // ==================== Google OAuth ====================

  private loadGoogleScript(): void {
    if (!this.googleClientId) {
      console.warn('Google Client ID not configured');
      return;
    }

    if (typeof google !== 'undefined' && google.accounts) {
      this.initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initializeGoogle();
    document.head.appendChild(script);
  }

  private initializeGoogle(): void {
    if (!this.googleClientId) return;

    try {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response: any) => this.handleGoogleCallback(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
    } catch (e) {
      console.error('Failed to initialize Google Sign-In', e);
    }
  }

  signInWithGoogle(): void {
    if (!this.googleClientId) {
      this.auth.setError('Google Sign-In is not configured. Please use email instead.');
      return;
    }

    this.googleLoading.set(true);
    this.auth.clearError();

    const timeoutId = setTimeout(() => {
      if (this.googleLoading()) {
        this.ngZone.run(() => this.googleLoading.set(false));
      }
    }, 120000);

    try {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          this.ngZone.run(() => this.showGooglePopup(timeoutId));
        } else if (notification.isSkippedMoment()) {
          const reason = notification.getSkippedReason();
          this.ngZone.run(() => {
            clearTimeout(timeoutId);
            this.googleLoading.set(false);
            if (reason !== 'user_cancel') {
              this.showGooglePopup(timeoutId);
            }
          });
        } else if (notification.isDismissedMoment()) {
          this.ngZone.run(() => {
            clearTimeout(timeoutId);
            this.googleLoading.set(false);
          });
        }
      });
    } catch (_e) {
      clearTimeout(timeoutId);
      this.googleLoading.set(false);
      this.auth.setError('Google Sign-In is temporarily unavailable. Please use email.');
    }
  }

  private showGooglePopup(parentTimeoutId?: ReturnType<typeof setTimeout>): void {
    if (parentTimeoutId) clearTimeout(parentTimeoutId);

    const popupTimeoutId = setTimeout(() => {
      if (this.googleLoading()) {
        this.ngZone.run(() => this.googleLoading.set(false));
      }
    }, 180000);

    try {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: this.googleClientId,
        scope: 'email profile openid',
        ux_mode: 'popup',
        callback: (response: any) => {
          clearTimeout(popupTimeoutId);
          if (response.code) {
            this.authenticateWithGoogleCode(response.code);
          } else {
            this.ngZone.run(() => {
              this.googleLoading.set(false);
              if (response.error && response.error !== 'access_denied' && response.error !== 'popup_closed_by_user') {
                this.auth.setError('Google Sign-In failed. Please try again.');
              }
            });
          }
        },
        error_callback: (error: any) => {
          clearTimeout(popupTimeoutId);
          this.ngZone.run(() => {
            this.googleLoading.set(false);
            if (error?.type === 'popup_failed_to_open') {
              this.auth.setError('Popup was blocked. Please allow popups for this site.');
            }
          });
        }
      });
      client.requestCode();
    } catch (_e) {
      clearTimeout(popupTimeoutId);
      this.ngZone.run(() => {
        this.googleLoading.set(false);
        this.auth.setError('Could not open Google Sign-In. Please try again.');
      });
    }
  }

  private authenticateWithGoogleCode(code: string): void {
    // Pass the tenant slug to the backend for validation
    this.auth.googleAuthWithCode(code, this.slug()).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.googleLoading.set(false);
          if (response.isNewUser) {
            // User needs onboarding (but shouldn't happen in login flow - user must be invited)
            this.auth.goToOnboarding();
          } else {
            this.auth.goToDashboard();
          }
        });
      },
      error: () => {
        this.ngZone.run(() => this.googleLoading.set(false));
      }
    });
  }

  private handleGoogleCallback(response: any): void {
    if (response.credential) {
      this.ngZone.run(() => this.authenticateWithGoogle(response.credential));
    } else {
      this.ngZone.run(() => this.googleLoading.set(false));
    }
  }

  private authenticateWithGoogle(credential: string): void {
    // Pass the tenant slug to the backend for validation
    this.auth.googleAuth({ 
      credential, 
      tenantSlug: this.slug() 
    }).subscribe({
      next: (response) => {
        this.googleLoading.set(false);
        if (response.isNewUser) {
          this.auth.goToOnboarding();
        } else {
          this.auth.goToDashboard();
        }
      },
      error: () => {
        this.googleLoading.set(false);
      }
    });
  }
}
