/**
 * @fileoverview Authentication component with login/signup
 * Production-ready with accessibility, Google OAuth, and proper validation
 * 
 * @author Thuraya Systems
 * @version 1.1.0
 */

import { 
  Component, 
  signal, 
  inject, 
  ChangeDetectionStrategy,
  computed,
  OnInit,
  OnDestroy,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { environment } from '../../../environments/environment';

// Google Sign-In types
declare const google: any;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-container" role="main">
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

          <!-- Taglines -->
          <div class="taglines">
            <h1 class="tagline">Inventory.</h1>
            <h1 class="tagline">Procurement.</h1>
            <h1 class="tagline">Sales & CRM.</h1>
            <h1 class="tagline">Reports and more.</h1>
          </div>

          <p class="description">
            Streamline your pharmacy operations and focus on patient care
          </p>

          <a href="https://docs.thurayya.io" class="knowledge-link" target="_blank" rel="noopener">
            <span>Visit our documentation</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </a>

          <!-- Feature Card -->
          <div class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div class="feature-content">
              <h2>Multi-branch Management</h2>
              <p>Manage multiple pharmacy branches from a single dashboard with real-time sync.</p>
            </div>
          </div>
        </div>

        <!-- Decorative Elements -->
        <div class="decorative-circle circle-1" aria-hidden="true"></div>
        <div class="decorative-circle circle-2" aria-hidden="true"></div>
      </aside>

      <!-- Right Panel - Auth Form -->
      <section class="form-panel">
        <!-- Language Switcher -->
        <div class="lang-switcher" role="group" aria-label="Language selection">
          <button 
            type="button"
            class="lang-btn" 
            [class.active]="language() === 'ar'" 
            (click)="language.set('ar')"
            [attr.aria-pressed]="language() === 'ar'"
          >
            عربي
          </button>
          <button 
            type="button"
            class="lang-btn" 
            [class.active]="language() === 'en'" 
            (click)="language.set('en')"
            [attr.aria-pressed]="language() === 'en'"
          >
            EN
          </button>
        </div>

        <div class="form-container">
          <!-- Logo for mobile -->
          <div class="mobile-logo">
            <div class="logo-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#0f172a"/>
                <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
              </svg>
            </div>
            <span class="mobile-logo-text">Thurayya</span>
          </div>

          <!-- Form Header -->
          <header class="form-header">
            <h1 id="form-title">{{ isLogin() ? 'Welcome back' : 'Create account' }}</h1>
            <p id="form-description">
              {{ isLogin() 
                ? 'Enter your credentials to access your dashboard' 
                : 'Start your 14-day free trial' 
              }}
            </p>
          </header>

          <!-- Error Message -->
          @if (auth.error()) {
            <div class="error-banner" role="alert" aria-live="polite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ auth.error() }}</span>
              <button type="button" (click)="auth.clearError()" aria-label="Dismiss" class="dismiss-btn">×</button>
            </div>
          }

          <!-- Success Message -->
          @if (successMessage()) {
            <div class="success-banner" role="status" aria-live="polite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
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
            >
              @if (googleLoading()) {
                <span class="spinner-small"></span>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
              <span>{{ isLogin() ? 'Sign in with Google' : 'Sign up with Google' }}</span>
            </button>
          </div>

          <!-- Divider -->
          <div class="divider" role="separator">
            <span>or</span>
          </div>

          <!-- Auth Form -->
          <form 
            (ngSubmit)="handleSubmit()" 
            class="auth-form"
            aria-labelledby="form-title"
            #authForm="ngForm"
          >
            <!-- Registration Fields -->
            @if (!isLogin()) {
              <div class="form-group">
                <label for="name" class="form-label">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  [(ngModel)]="name" 
                  #nameInput="ngModel"
                  placeholder="John Doe"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="name"
                  [attr.aria-invalid]="nameInput.invalid && nameInput.touched"
                  class="form-input"
                  [class.error]="nameInput.invalid && nameInput.touched"
                />
                @if (nameInput.invalid && nameInput.touched) {
                  <span class="field-error" role="alert">Enter your full name (min 2 characters)</span>
                }
              </div>

              <div class="form-group">
                <label for="pharmacy" class="form-label">Organization Name</label>
                <input 
                  type="text" 
                  id="pharmacy" 
                  name="pharmacy"
                  [(ngModel)]="pharmacyName"
                  #pharmacyInput="ngModel"
                  placeholder="Acme Pharmacy"
                  required
                  minlength="2"
                  maxlength="200"
                  [attr.aria-invalid]="pharmacyInput.invalid && pharmacyInput.touched"
                  class="form-input"
                  [class.error]="pharmacyInput.invalid && pharmacyInput.touched"
                />
                @if (pharmacyInput.invalid && pharmacyInput.touched) {
                  <span class="field-error" role="alert">Enter your organization name</span>
                }
              </div>
            }

            <!-- Email Field -->
            <div class="form-group">
              <label for="email" class="form-label">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email"
                [(ngModel)]="email"
                #emailInput="ngModel"
                placeholder="you&#64;company.com"
                required
                email
                autocomplete="email"
                [attr.aria-invalid]="emailInput.invalid && emailInput.touched"
                class="form-input"
                [class.error]="emailInput.invalid && emailInput.touched"
              />
              @if (emailInput.invalid && emailInput.touched) {
                <span class="field-error" role="alert">Enter a valid email address</span>
              }
            </div>

            <!-- Password Field -->
            <div class="form-group">
              <div class="label-row">
                <label for="password" class="form-label">Password</label>
                @if (isLogin()) {
                  <a href="#" class="forgot-link" (click)="$event.preventDefault()">Forgot?</a>
                }
              </div>
              <div class="password-input">
                <input 
                  [type]="showPassword() ? 'text' : 'password'" 
                  id="password" 
                  name="password"
                  [(ngModel)]="password"
                  #passwordInput="ngModel"
                  placeholder="••••••••"
                  required
                  [minlength]="isLogin() ? 1 : 8"
                  [autocomplete]="isLogin() ? 'current-password' : 'new-password'"
                  [attr.aria-invalid]="passwordInput.invalid && passwordInput.touched"
                  [attr.aria-describedby]="!isLogin() ? 'password-requirements' : null"
                  class="form-input"
                  [class.error]="passwordInput.invalid && passwordInput.touched"
                />
                <button 
                  type="button" 
                  class="toggle-password" 
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  @if (showPassword()) {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
              
              <!-- Password Requirements (Signup only) -->
              @if (!isLogin()) {
                <div id="password-requirements" class="password-requirements">
                  <p class="requirements-title">Password must contain:</p>
                  <ul class="requirements-list">
                    <li [class.valid]="passwordChecks().minLength">
                      <span class="check-icon">{{ passwordChecks().minLength ? '✓' : '○' }}</span>
                      At least 8 characters
                    </li>
                    <li [class.valid]="passwordChecks().hasUppercase">
                      <span class="check-icon">{{ passwordChecks().hasUppercase ? '✓' : '○' }}</span>
                      One uppercase letter
                    </li>
                    <li [class.valid]="passwordChecks().hasLowercase">
                      <span class="check-icon">{{ passwordChecks().hasLowercase ? '✓' : '○' }}</span>
                      One lowercase letter
                    </li>
                    <li [class.valid]="passwordChecks().hasNumber">
                      <span class="check-icon">{{ passwordChecks().hasNumber ? '✓' : '○' }}</span>
                      One number
                    </li>
                  </ul>
                </div>
              }
            </div>

            <!-- Registration: Country & Currency -->
            @if (!isLogin()) {
              <div class="form-row">
                <div class="form-group">
                  <label for="country" class="form-label">Country</label>
                  <select 
                    id="country" 
                    name="country"
                    [(ngModel)]="country"
                    #countryInput="ngModel"
                    required
                    class="form-input form-select"
                    [class.error]="countryInput.invalid && countryInput.touched"
                    (change)="onCountryChange()"
                  >
                    <option value="" disabled>Select</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="AE">UAE</option>
                    <option value="KW">Kuwait</option>
                    <option value="QA">Qatar</option>
                    <option value="BH">Bahrain</option>
                    <option value="OM">Oman</option>
                    <option value="EG">Egypt</option>
                    <option value="JO">Jordan</option>
                    <option value="YE">Yemen</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="currency" class="form-label">Currency</label>
                  <select 
                    id="currency" 
                    name="currency"
                    [(ngModel)]="currency"
                    #currencyInput="ngModel"
                    required
                    class="form-input form-select"
                    [class.error]="currencyInput.invalid && currencyInput.touched"
                  >
                    <option value="" disabled>Select</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                    <option value="KWD">KWD</option>
                    <option value="QAR">QAR</option>
                    <option value="BHD">BHD</option>
                    <option value="OMR">OMR</option>
                    <option value="EGP">EGP</option>
                    <option value="JOD">JOD</option>
                    <option value="YER">YER</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            }

            <!-- Submit Button -->
            <button 
              type="submit" 
              class="submit-btn" 
              [disabled]="auth.isLoading() || !isFormValid()"
              [attr.aria-busy]="auth.isLoading()"
            >
              @if (auth.isLoading()) {
                <span class="spinner"></span>
                <span>{{ isLogin() ? 'Signing in...' : 'Creating account...' }}</span>
              } @else {
                <span>{{ isLogin() ? 'Sign in' : 'Create account' }}</span>
              }
            </button>
          </form>

          <!-- Toggle Login/Signup -->
          <p class="toggle-auth">
            {{ isLogin() ? "Don't have an account?" : "Already have an account?" }}
            <button type="button" (click)="toggleMode()" class="toggle-btn">
              {{ isLogin() ? 'Sign up' : 'Sign in' }}
            </button>
          </p>

          <!-- Terms -->
          @if (!isLogin()) {
            <p class="terms">
              By signing up, you agree to our 
              <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
            </p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* ========== Variables ========== */
    :host {
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-size-xs: 0.75rem;
      --font-size-sm: 0.8125rem;
      --font-size-base: 0.875rem;
      --font-size-lg: 1rem;
      --font-size-xl: 1.25rem;
      --font-size-2xl: 1.5rem;
      --color-primary: #0f172a;
      --color-primary-hover: #1e293b;
      --color-text: #374151;
      --color-text-muted: #6b7280;
      --color-border: #e5e7eb;
      --color-error: #dc2626;
      --color-success: #16a34a;
      --radius: 8px;
    }

    /* ========== Layout ========== */
    .auth-container {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: #fff;
      font-family: var(--font-sans);
    }

    /* ========== Brand Panel ========== */
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
      margin-bottom: 2.5rem;
    }

    .logo-text {
      font-size: 1.75rem;
      font-weight: 700;
      color: white;
      font-family: 'Noto Sans Arabic', var(--font-sans);
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
      margin-bottom: 1.5rem;
    }

    .knowledge-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      color: #38bdf8;
      text-decoration: none;
      font-size: var(--font-size-sm);
      font-weight: 500;
      margin-bottom: 2rem;
      transition: all 0.15s;
    }

    .knowledge-link:hover { color: #7dd3fc; gap: 0.5rem; }

    .feature-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .feature-icon {
      width: 44px;
      height: 44px;
      background: rgba(56, 189, 248, 0.12);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.875rem;
      color: #38bdf8;
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
      background: radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .circle-1 { width: 400px; height: 400px; top: -120px; right: -120px; }
    .circle-2 { width: 300px; height: 300px; bottom: -80px; left: -80px; }

    /* ========== Form Panel ========== */
    .form-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1.5rem 2.5rem;
      background: #fff;
      position: relative;
      overflow-y: auto;
    }

    .lang-switcher {
      position: absolute;
      top: 1rem;
      right: 1.5rem;
      display: flex;
      gap: 0.125rem;
      background: #f3f4f6;
      padding: 0.125rem;
      border-radius: 6px;
    }

    .lang-btn {
      background: transparent;
      border: none;
      padding: 0.375rem 0.75rem;
      border-radius: 5px;
      font-size: var(--font-size-xs);
      font-weight: 500;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }

    .lang-btn:hover { color: var(--color-primary); }
    .lang-btn.active { background: white; color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

    .form-container {
      max-width: 360px;
      width: 100%;
      margin: auto;
    }

    .mobile-logo {
      display: none;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .mobile-logo-text {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-primary);
    }

    /* ========== Form Header ========== */
    .form-header { margin-bottom: 1.25rem; }

    .form-header h1 {
      font-size: var(--font-size-xl);
      font-weight: 600;
      color: var(--color-primary);
      margin: 0 0 0.25rem 0;
    }

    .form-header p {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: 0;
    }

    /* ========== Alerts ========== */
    .error-banner, .success-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      border-radius: var(--radius);
      margin-bottom: 1rem;
      font-size: var(--font-size-sm);
    }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: var(--color-error);
    }

    .success-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: var(--color-success);
    }

    .dismiss-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0.7;
    }

    .dismiss-btn:hover { opacity: 1; }

    /* ========== Google Button ========== */
    .google-signin-wrapper { margin-bottom: 0; }

    .google-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: white;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text);
      cursor: pointer;
      transition: all 0.15s;
    }

    .google-btn:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
    }

    .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid #e5e7eb;
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* ========== Divider ========== */
    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1rem 0;
      color: #9ca3af;
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }

    /* ========== Form ========== */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
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
      color: var(--color-text-muted);
      text-decoration: none;
      font-weight: 500;
    }

    .forgot-link:hover { color: var(--color-primary); text-decoration: underline; }

    .form-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: var(--font-size-sm);
      color: var(--color-primary);
      background: #fff;
      transition: all 0.15s;
      height: 38px;
    }

    .form-input:hover { border-color: #d1d5db; }
    .form-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08); }
    .form-input.error { border-color: var(--color-error); }
    .form-input::placeholder { color: #9ca3af; }

    .form-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
      padding-right: 2rem;
    }

    .field-error {
      font-size: var(--font-size-xs);
      color: var(--color-error);
    }

    /* ========== Password Input ========== */
    .password-input { position: relative; }
    .password-input input { padding-right: 2.5rem; width: 100%; }

    .toggle-password {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
      display: flex;
    }

    .toggle-password:hover { color: var(--color-text); }

    /* ========== Password Requirements ========== */
    .password-requirements {
      margin-top: 0.5rem;
      padding: 0.625rem 0.75rem;
      background: #f9fafb;
      border-radius: var(--radius);
      border: 1px solid #f3f4f6;
    }

    .requirements-title {
      font-size: var(--font-size-xs);
      font-weight: 500;
      color: var(--color-text-muted);
      margin: 0 0 0.375rem 0;
    }

    .requirements-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem 0.75rem;
    }

    .requirements-list li {
      font-size: var(--font-size-xs);
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      transition: color 0.15s;
    }

    .requirements-list li.valid { color: var(--color-success); }

    .check-icon {
      font-size: 0.625rem;
      width: 14px;
      text-align: center;
    }

    /* ========== Submit Button ========== */
    .submit-btn {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.625rem 1rem;
      border-radius: var(--radius);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 40px;
      margin-top: 0.25rem;
    }

    .submit-btn:hover:not(:disabled) { background: var(--color-primary-hover); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ========== Toggle Auth ========== */
    .toggle-auth {
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin-top: 1.25rem;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--color-primary);
      font-weight: 600;
      cursor: pointer;
      font-size: var(--font-size-sm);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .toggle-btn:hover { color: #3b82f6; }

    /* ========== Terms ========== */
    .terms {
      text-align: center;
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      margin-top: 1rem;
    }

    .terms a { color: var(--color-text); text-decoration: underline; }
    .terms a:hover { color: var(--color-primary); }

    /* ========== Responsive ========== */
    @media (max-width: 1024px) {
      .brand-panel { display: none; }
      .mobile-logo { display: flex; }
    }

    @media (max-width: 480px) {
      .form-panel { padding: 1rem; }
      .form-row { grid-template-columns: 1fr; }
      .requirements-list { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class AuthComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  // UI State
  readonly isLogin = signal(true);
  readonly showPassword = signal(false);
  readonly language = signal<'en' | 'ar'>('en');
  readonly successMessage = signal<string | null>(null);
  readonly googleLoading = signal(false);

  // Form fields
  name = '';
  email = '';
  password = '';
  pharmacyName = '';
  country = '';
  currency = '';

  // Country to currency mapping
  private readonly currencyMap: Record<string, string> = {
    'SA': 'SAR', 'AE': 'AED', 'KW': 'KWD', 'QA': 'QAR',
    'BH': 'BHD', 'OM': 'OMR', 'EG': 'EGP', 'JO': 'JOD', 'YE': 'YER'
  };

  // Google Client ID from environment
  private readonly googleClientId = environment.googleClientId || '';

  /**
   * Password validation checks
   */
  readonly passwordChecks = computed(() => ({
    minLength: this.password.length >= 8,
    hasUppercase: /[A-Z]/.test(this.password),
    hasLowercase: /[a-z]/.test(this.password),
    hasNumber: /[0-9]/.test(this.password)
  }));

  /**
   * Check if password meets all requirements
   */
  readonly isPasswordValid = computed(() => {
    if (this.isLogin()) return this.password.length > 0;
    const checks = this.passwordChecks();
    return checks.minLength && checks.hasUppercase && checks.hasLowercase && checks.hasNumber;
  });

  ngOnInit(): void {
    this.loadGoogleScript();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Load Google Sign-In script
   */
  private loadGoogleScript(): void {
    if (!this.googleClientId) {
      console.warn('Google Client ID not configured');
      return;
    }

    // Check if already loaded
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

  /**
   * Initialize Google Sign-In
   */
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

  /**
   * Trigger Google Sign-In popup
   */
  signInWithGoogle(): void {
    if (!this.googleClientId) {
      this.successMessage.set('Google Sign-In not configured. Contact support.');
      setTimeout(() => this.successMessage.set(null), 3000);
      return;
    }

    this.googleLoading.set(true);

    try {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup
          google.accounts.oauth2.initTokenClient({
            client_id: this.googleClientId,
            scope: 'email profile',
            callback: (response: any) => {
              if (response.access_token) {
                this.handleGoogleToken(response.access_token);
              } else {
                this.ngZone.run(() => {
                  this.googleLoading.set(false);
                });
              }
            }
          }).requestAccessToken();
        }
      });
    } catch (e) {
      this.googleLoading.set(false);
      this.successMessage.set('Google Sign-In unavailable. Try email instead.');
      setTimeout(() => this.successMessage.set(null), 3000);
    }
  }

  /**
   * Handle Google credential callback
   */
  private handleGoogleCallback(response: any): void {
    if (response.credential) {
      this.ngZone.run(() => {
        // Send credential to backend for verification
        this.sendGoogleCredentialToBackend(response.credential);
      });
    } else {
      this.ngZone.run(() => {
        this.googleLoading.set(false);
      });
    }
  }

  /**
   * Handle Google access token
   */
  private handleGoogleToken(accessToken: string): void {
    // Get user info from Google
    fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`)
      .then(res => res.json())
      .then(user => {
        this.ngZone.run(() => {
          // Auto-fill form with Google data
          this.email = user.email || '';
          this.name = user.name || '';
          this.googleLoading.set(false);
          this.successMessage.set(`Welcome ${user.given_name || 'User'}! Complete the form below.`);
          setTimeout(() => this.successMessage.set(null), 4000);
        });
      })
      .catch(() => {
        this.ngZone.run(() => {
          this.googleLoading.set(false);
        });
      });
  }

  /**
   * Send Google credential to backend
   */
  private sendGoogleCredentialToBackend(credential: string): void {
    // TODO: Implement backend endpoint for Google OAuth
    // For now, decode the JWT and fill the form
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      this.email = payload.email || '';
      this.name = payload.name || '';
      this.googleLoading.set(false);
      this.successMessage.set(`Welcome ${payload.given_name || 'User'}! Complete the form below.`);
      setTimeout(() => this.successMessage.set(null), 4000);
    } catch {
      this.googleLoading.set(false);
    }
  }

  /**
   * Check if form is valid for submission
   */
  isFormValid(): boolean {
    if (this.isLogin()) {
      return !!(this.email && this.password);
    }
    return !!(
      this.name && 
      this.email && 
      this.isPasswordValid() &&
      this.pharmacyName && 
      this.country && 
      this.currency
    );
  }

  /**
   * Auto-select currency when country changes
   */
  onCountryChange(): void {
    const suggestedCurrency = this.currencyMap[this.country];
    if (suggestedCurrency && !this.currency) {
      this.currency = suggestedCurrency;
    }
  }

  /**
   * Toggle between login and signup modes
   */
  toggleMode(): void {
    this.isLogin.set(!this.isLogin());
    this.auth.clearError();
    this.successMessage.set(null);
    this.resetForm();
  }

  /**
   * Handle form submission
   */
  handleSubmit(): void {
    if (!this.isFormValid()) return;
    
    if (this.isLogin()) {
      this.login();
    } else {
      this.register();
    }
  }

  private login(): void {
    this.auth.login({
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: () => this.auth.navigateAfterAuth()
    });
  }

  private register(): void {
    this.auth.register({
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      tenantName: this.pharmacyName.trim(),
      country: this.country,
      currency: this.currency
    }).subscribe({
      next: () => this.auth.navigateAfterAuth()
    });
  }

  private resetForm(): void {
    this.name = '';
    this.email = '';
    this.password = '';
    this.pharmacyName = '';
    this.country = '';
    this.currency = '';
  }
}
