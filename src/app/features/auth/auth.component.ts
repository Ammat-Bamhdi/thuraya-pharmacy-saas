/**
 * @fileoverview Authentication component with login/signup
 * Production-ready with accessibility, Google OAuth, smart routing, and proper validation
 * 
 * @author Thuraya Systems
 * @version 2.0.0
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
              aria-label="{{ isLogin() ? 'Sign in with Google' : 'Sign up with Google' }}"
            >
              @if (googleLoading()) {
                <span class="spinner-small" aria-hidden="true"></span>
                <span>Connecting...</span>
              } @else {
                <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>{{ isLogin() ? 'Sign in with Google' : 'Sign up with Google' }}</span>
              }
            </button>
          </div>

          <!-- Divider -->
          <div class="divider" role="separator">
            <span>or continue with email</span>
          </div>

          <!-- Auth Form -->
          <form 
            (ngSubmit)="handleSubmit()" 
            class="auth-form"
            aria-labelledby="form-title"
            autocomplete="on"
          >
            <!-- Registration Fields -->
            @if (!isLogin()) {
              <div class="form-group" [class.has-value]="name()">
                <label for="name" class="form-label">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  [ngModel]="name()" 
                  (ngModelChange)="name.set($event); auth.clearError()"
                  placeholder="John Doe"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="name"
                  class="form-input"
                  [class.error]="name() && name().length < 2"
                />
                @if (name() && name().length < 2) {
                  <span class="field-hint error">Name must be at least 2 characters</span>
                }
              </div>

              <div class="form-group" [class.has-value]="pharmacyName()">
                <label for="pharmacy" class="form-label">Organization Name</label>
                <input 
                  type="text" 
                  id="pharmacy" 
                  name="pharmacy"
                  [ngModel]="pharmacyName()"
                  (ngModelChange)="pharmacyName.set($event); auth.clearError()"
                  placeholder="Acme Pharmacy"
                  required
                  minlength="2"
                  maxlength="200"
                  autocomplete="organization"
                  class="form-input"
                />
              </div>
            }

            <!-- Email Field -->
            <div class="form-group" [class.has-value]="email()">
              <label for="email" class="form-label">Email</label>
              <div class="input-wrapper">
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  [ngModel]="email()"
                  (ngModelChange)="onEmailChange($event)"
                  (blur)="checkEmailExists()"
                  placeholder="you&#64;company.com"
                  required
                  autocomplete="email"
                  class="form-input"
                  [class.error]="email() && !isValidEmail()"
                  [class.checking]="checkingEmail()"
                />
                @if (checkingEmail()) {
                  <span class="input-indicator" aria-hidden="true">
                    <span class="spinner-tiny"></span>
                  </span>
                }
              </div>
              @if (email() && !isValidEmail()) {
                <span class="field-hint error">Please enter a valid email address</span>
              }
              @if (emailExistsMessage()) {
                <span class="field-hint info">{{ emailExistsMessage() }}</span>
              }
            </div>

            <!-- Password Field -->
            <div class="form-group" [class.has-value]="password()">
              <div class="label-row">
                <label for="password" class="form-label">Password</label>
                @if (isLogin()) {
                  <button type="button" class="forgot-link" (click)="showForgotPassword()">
                    Forgot password?
                  </button>
                }
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
                  [minlength]="isLogin() ? 1 : 8"
                  [autocomplete]="isLogin() ? 'current-password' : 'new-password'"
                  [attr.aria-describedby]="!isLogin() ? 'password-requirements' : null"
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
              
              <!-- Password Requirements (Signup only) -->
              @if (!isLogin() && password()) {
                <div id="password-requirements" class="password-requirements" [class.all-valid]="isPasswordValid()">
                  <div class="requirements-grid">
                    <div class="requirement" [class.valid]="passwordChecks().minLength">
                      <span class="check-icon">
                        @if (passwordChecks().minLength) {
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        } @else {
                          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
                        }
                      </span>
                      <span>8+ characters</span>
                    </div>
                    <div class="requirement" [class.valid]="passwordChecks().hasUppercase">
                      <span class="check-icon">
                        @if (passwordChecks().hasUppercase) {
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        } @else {
                          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
                        }
                      </span>
                      <span>Uppercase</span>
                    </div>
                    <div class="requirement" [class.valid]="passwordChecks().hasLowercase">
                      <span class="check-icon">
                        @if (passwordChecks().hasLowercase) {
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        } @else {
                          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
                        }
                      </span>
                      <span>Lowercase</span>
                    </div>
                    <div class="requirement" [class.valid]="passwordChecks().hasNumber">
                      <span class="check-icon">
                        @if (passwordChecks().hasNumber) {
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        } @else {
                          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
                        }
                      </span>
                      <span>Number</span>
                    </div>
                  </div>
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
                    [ngModel]="country()"
                    (ngModelChange)="onCountryChange($event)"
                    required
                    class="form-input form-select"
                  >
                    <option value="" disabled>Select country</option>
                    @for (c of countries; track c.code) {
                      <option [value]="c.code">{{ c.name }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label for="currency" class="form-label">Currency</label>
                  <select 
                    id="currency" 
                    name="currency"
                    [ngModel]="currency()"
                    (ngModelChange)="currency.set($event)"
                    required
                    class="form-input form-select"
                  >
                    <option value="" disabled>Select currency</option>
                    @for (curr of currencies; track curr.code) {
                      <option [value]="curr.code">{{ curr.code }} - {{ curr.name }}</option>
                    }
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
                <span class="spinner" aria-hidden="true"></span>
                <span>{{ isLogin() ? 'Signing in...' : 'Creating account...' }}</span>
              } @else {
                <span>{{ isLogin() ? 'Sign in' : 'Create account' }}</span>
                <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              }
            </button>
          </form>

          <!-- Toggle Login/Signup -->
          <p class="toggle-auth">
            {{ isLogin() ? "Don't have an account?" : "Already have an account?" }}
            <button type="button" (click)="toggleMode()" class="toggle-btn">
              {{ isLogin() ? 'Create one now' : 'Sign in instead' }}
            </button>
          </p>

          <!-- Terms -->
          @if (!isLogin()) {
            <p class="terms">
              By signing up, you agree to our 
              <a href="/terms" target="_blank">Terms of Service</a> and 
              <a href="/privacy" target="_blank">Privacy Policy</a>
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
    /* ========== Variables ========== */
    :host {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-size-xs: 0.75rem;
      --font-size-sm: 0.8125rem;
      --font-size-base: 0.875rem;
      --font-size-lg: 1rem;
      --font-size-xl: 1.25rem;
      --font-size-2xl: 1.5rem;
      --color-primary: #0f172a;
      --color-primary-hover: #1e293b;
      --color-accent: #3b82f6;
      --color-text: #374151;
      --color-text-muted: #6b7280;
      --color-border: #e5e7eb;
      --color-error: #dc2626;
      --color-error-bg: #fef2f2;
      --color-success: #16a34a;
      --color-success-bg: #f0fdf4;
      --color-info: #2563eb;
      --color-info-bg: #eff6ff;
      --radius: 10px;
      --radius-sm: 6px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      --transition: 150ms ease;
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
      transition: all var(--transition);
    }

    .knowledge-link:hover { color: #7dd3fc; gap: 0.5rem; }
    .knowledge-link:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }

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
      border-radius: var(--radius-sm);
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
      transition: all var(--transition);
    }

    .lang-btn:hover { color: var(--color-primary); }
    .lang-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
    .lang-btn.active { background: white; color: var(--color-primary); box-shadow: var(--shadow-sm); }

    .form-container {
      max-width: 380px;
      width: 100%;
      margin: auto;
      padding: 2rem 0;
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

    /* ========== Alerts ========== */
    .error-banner, .success-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1.25rem;
      font-size: var(--font-size-sm);
      line-height: 1.5;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .error-banner {
      background: var(--color-error-bg);
      border: 1px solid #fecaca;
      color: var(--color-error);
    }

    .success-banner {
      background: var(--color-success-bg);
      border: 1px solid #bbf7d0;
      color: var(--color-success);
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

    /* ========== Google Button ========== */
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

    .spinner-tiny {
      width: 14px;
      height: 14px;
      border: 2px solid #e5e7eb;
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* ========== Divider ========== */
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

    /* ========== Form ========== */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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
      color: var(--color-accent);
      text-decoration: none;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    .forgot-link:hover { text-decoration: underline; }

    .input-wrapper {
      position: relative;
    }

    .input-indicator {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
    }

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
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
    }
    .form-input.error { border-color: var(--color-error); }
    .form-input.checking { padding-right: 2.5rem; }
    .form-input::placeholder { color: #9ca3af; }

    .field-hint {
      font-size: var(--font-size-xs);
      margin-top: 0.25rem;
    }
    .field-hint.error { color: var(--color-error); }
    .field-hint.info { color: var(--color-info); }

    .form-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.625rem center;
      padding-right: 2.5rem;
      cursor: pointer;
    }

    /* ========== Password Input ========== */
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

    /* ========== Password Requirements ========== */
    .password-requirements {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: var(--radius);
      border: 1px solid #f3f4f6;
      transition: all 0.2s ease;
    }

    .password-requirements.all-valid {
      background: var(--color-success-bg);
      border-color: #bbf7d0;
    }

    .requirements-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.375rem 1rem;
    }

    .requirement {
      font-size: var(--font-size-xs);
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      transition: color var(--transition);
    }

    .requirement.valid { color: var(--color-success); }

    .check-icon {
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .check-icon svg { width: 12px; height: 12px; }

    /* ========== Submit Button ========== */
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

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ========== Toggle Auth ========== */
    .toggle-auth {
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin-top: 1.5rem;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--color-accent);
      font-weight: 600;
      cursor: pointer;
      font-size: var(--font-size-sm);
      padding: 0;
      margin-left: 0.25rem;
    }

    .toggle-btn:hover { text-decoration: underline; }
    .toggle-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

    /* ========== Terms ========== */
    .terms {
      text-align: center;
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      margin-top: 1rem;
      line-height: 1.5;
    }

    .terms a { 
      color: var(--color-text); 
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .terms a:hover { color: var(--color-accent); }

    /* ========== Footer ========== */
    .auth-footer {
      text-align: center;
      font-size: var(--font-size-xs);
      color: #9ca3af;
      padding: 1rem 0;
      margin-top: auto;
    }

    /* ========== Responsive ========== */
    @media (max-width: 1024px) {
      .brand-panel { display: none; }
      .mobile-logo { display: flex; }
    }

    @media (max-width: 480px) {
      .form-panel { padding: 1rem; }
      .form-container { padding: 1rem 0; }
      .form-row { grid-template-columns: 1fr; }
      .requirements-grid { grid-template-columns: 1fr; }
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
export class AuthComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  // UI State
  readonly isLogin = signal(true);
  readonly showPassword = signal(false);
  readonly language = signal<'en' | 'ar'>('en');
  readonly successMessage = signal<string | null>(null);
  readonly googleLoading = signal(false);
  readonly checkingEmail = signal(false);
  readonly emailExistsMessage = signal<string | null>(null);

  // Form fields
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly pharmacyName = signal('');
  readonly country = signal('');
  readonly currency = signal('');

  // Constants
  readonly currentYear = new Date().getFullYear();
  
  readonly countries = [
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'QA', name: 'Qatar' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'OM', name: 'Oman' },
    { code: 'EG', name: 'Egypt' },
    { code: 'JO', name: 'Jordan' },
    { code: 'YE', name: 'Yemen' }
  ];

  readonly currencies = [
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'KWD', name: 'Kuwaiti Dinar' },
    { code: 'QAR', name: 'Qatari Riyal' },
    { code: 'BHD', name: 'Bahraini Dinar' },
    { code: 'OMR', name: 'Omani Rial' },
    { code: 'EGP', name: 'Egyptian Pound' },
    { code: 'JOD', name: 'Jordanian Dinar' },
    { code: 'YER', name: 'Yemeni Rial' },
    { code: 'USD', name: 'US Dollar' }
  ];

  private readonly currencyMap: Record<string, string> = {
    'SA': 'SAR', 'AE': 'AED', 'KW': 'KWD', 'QA': 'QAR',
    'BH': 'BHD', 'OM': 'OMR', 'EG': 'EGP', 'JO': 'JOD', 'YE': 'YER'
  };

  private readonly googleClientId = environment.googleClientId || '';
  private emailCheckTimeout: any;

  /**
   * Password validation checks
   */
  readonly passwordChecks = computed(() => {
    const pwd = this.password();
    return {
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd)
    };
  });

  readonly isPasswordValid = computed(() => {
    if (this.isLogin()) return this.password().length > 0;
    const checks = this.passwordChecks();
    return checks.minLength && checks.hasUppercase && checks.hasLowercase && checks.hasNumber;
  });

  readonly isFormValid = computed(() => {
    if (this.isLogin()) {
      return !!(this.email() && this.isValidEmail() && this.password());
    }
    
    return !!(
      this.name() && 
      this.name().length >= 2 &&
      this.email() && 
      this.isValidEmail() &&
      this.isPasswordValid() &&
      this.pharmacyName() && 
      this.country() && 
      this.currency()
    );
  });

  ngOnInit(): void {
    this.loadGoogleScript();
  }

  ngOnDestroy(): void {
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }
  }

  isValidEmail(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email());
  }

  onEmailChange(value: string): void {
    this.email.set(value);
    this.auth.clearError();
    this.emailExistsMessage.set(null);
    
    // Debounce email check
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }
  }

  checkEmailExists(): void {
    const email = this.email().trim();
    if (!email || !this.isValidEmail()) return;

    // Clear any pending checks
    if (this.emailCheckTimeout) {
      clearTimeout(this.emailCheckTimeout);
    }

    this.emailCheckTimeout = setTimeout(async () => {
      this.checkingEmail.set(true);
      try {
        const response = await fetch(`${environment.apiUrl}/auth/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        
        if (data.success && data.data) {
          if (data.data.exists && !this.isLogin()) {
            this.emailExistsMessage.set('This email is already registered. Sign in instead?');
          } else if (!data.data.exists && this.isLogin()) {
            this.emailExistsMessage.set('No account found. Create one?');
          } else {
            this.emailExistsMessage.set(null);
          }
        }
      } catch (e) {
        // Silently fail - not critical
      } finally {
        this.checkingEmail.set(false);
      }
    }, 500);
  }

  onCountryChange(value: string): void {
    this.country.set(value);
    const suggestedCurrency = this.currencyMap[value];
    if (suggestedCurrency) {
      this.currency.set(suggestedCurrency);
    }
  }

  toggleMode(): void {
    this.isLogin.set(!this.isLogin());
    this.auth.clearError();
    this.successMessage.set(null);
    this.emailExistsMessage.set(null);
    this.resetForm();
  }

  showForgotPassword(): void {
    this.successMessage.set('Password reset feature coming soon. Contact support for assistance.');
    setTimeout(() => this.successMessage.set(null), 5000);
  }

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
      email: this.email().trim().toLowerCase(),
      password: this.password()
    }).subscribe({
      next: () => this.auth.navigateAfterAuth()
    });
  }

  private register(): void {
    this.auth.register({
      name: this.name().trim(),
      email: this.email().trim().toLowerCase(),
      password: this.password(),
      tenantName: this.pharmacyName().trim(),
      country: this.country(),
      currency: this.currency()
    }).subscribe({
      next: () => this.auth.navigateAfterAuth()
    });
  }

  private resetForm(): void {
    this.name.set('');
    this.password.set('');
    this.pharmacyName.set('');
    this.country.set('');
    this.currency.set('');
    // Keep email to allow quick toggle
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

    // Set a timeout to reset loading state if popup is closed/cancelled
    const timeoutId = setTimeout(() => {
      if (this.googleLoading()) {
        this.ngZone.run(() => {
          this.googleLoading.set(false);
        });
      }
    }, 120000); // 2 minute timeout

    try {
      google.accounts.id.prompt((notification: any) => {
        // Handle all prompt dismissal cases
        if (notification.isNotDisplayed()) {
          // One Tap not displayed, try popup
          this.ngZone.run(() => this.showGooglePopup(timeoutId));
        } else if (notification.isSkippedMoment()) {
          // User skipped (closed/dismissed) One Tap
          const reason = notification.getSkippedReason();
          this.ngZone.run(() => {
            clearTimeout(timeoutId);
            this.googleLoading.set(false);
            if (reason === 'user_cancel') {
              // User explicitly cancelled - no error message needed
            } else {
              // Try popup as fallback
              this.showGooglePopup(timeoutId);
            }
          });
        } else if (notification.isDismissedMoment()) {
          // User dismissed the prompt
          const reason = notification.getDismissedReason();
          this.ngZone.run(() => {
            clearTimeout(timeoutId);
            this.googleLoading.set(false);
            if (reason !== 'credential_returned') {
              // User cancelled or clicked outside - no error needed
            }
          });
        }
      });
    } catch (e) {
      clearTimeout(timeoutId);
      this.googleLoading.set(false);
      this.auth.setError('Google Sign-In is temporarily unavailable. Please use email.');
    }
  }

  private showGooglePopup(parentTimeoutId?: ReturnType<typeof setTimeout>): void {
    // Clear parent timeout since we're starting a new flow
    if (parentTimeoutId) {
      clearTimeout(parentTimeoutId);
    }

    // Set popup-specific timeout
    const popupTimeoutId = setTimeout(() => {
      if (this.googleLoading()) {
        this.ngZone.run(() => {
          this.googleLoading.set(false);
        });
      }
    }, 180000); // 3 minute timeout for popup flow

    try {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: this.googleClientId,
        scope: 'email profile openid',
        ux_mode: 'popup',
        callback: (response: any) => {
          clearTimeout(popupTimeoutId);
          if (response.code) {
            this.authenticateWithGoogleCode(response.code);
          } else if (response.error) {
            // Handle specific errors
            this.ngZone.run(() => {
              this.googleLoading.set(false);
              if (response.error === 'access_denied') {
                // User denied permission - no error message
              } else if (response.error === 'popup_closed_by_user') {
                // User closed popup - no error message
              } else {
                this.auth.setError('Google Sign-In failed. Please try again.');
              }
            });
          } else {
            // No code and no error - likely cancelled
            this.ngZone.run(() => this.googleLoading.set(false));
          }
        },
        error_callback: (error: any) => {
          // Handle popup blocked or other errors
          clearTimeout(popupTimeoutId);
          this.ngZone.run(() => {
            this.googleLoading.set(false);
            if (error?.type === 'popup_closed') {
              // User closed the popup - no error message needed
            } else if (error?.type === 'popup_failed_to_open') {
              this.auth.setError('Popup was blocked. Please allow popups for this site.');
            } else {
              // Silent fail for other cancellation cases
            }
          });
        }
      });
      client.requestCode();
    } catch (e) {
      clearTimeout(popupTimeoutId);
      this.ngZone.run(() => {
        this.googleLoading.set(false);
        this.auth.setError('Could not open Google Sign-In. Please try again.');
      });
    }
  }

  private authenticateWithGoogleCode(code: string): void {
    this.auth.googleAuthWithCode(code).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.googleLoading.set(false);
          if (response.isNewUser) {
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
    this.auth.googleAuth({ credential }).subscribe({
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

