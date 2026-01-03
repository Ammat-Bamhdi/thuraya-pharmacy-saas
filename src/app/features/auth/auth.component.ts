/**
 * @fileoverview Authentication component with login/signup
 * Production-ready with accessibility and error handling
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { 
  Component, 
  signal, 
  inject, 
  ChangeDetectionStrategy,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';

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
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </a>

          <!-- Feature Card -->
          <div class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div class="feature-content">
              <h2>Multi-branch Management</h2>
              <p>Manage multiple pharmacy branches from a single dashboard with real-time sync and offline support.</p>
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
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#0f172a"/>
                <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
              </svg>
            </div>
            <span class="mobile-logo-text">Thurayya</span>
          </div>

          <!-- Form Header -->
          <header class="form-header">
            <h1 id="form-title">{{ isLogin() ? 'Welcome back' : 'Create your account' }}</h1>
            <p id="form-description">
              {{ isLogin() 
                ? 'Enter your credentials to access your pharmacy dashboard' 
                : 'Start your 14-day free trial. No credit card required.' 
              }}
            </p>
          </header>

          <!-- Error Message -->
          @if (auth.error()) {
            <div 
              class="error-banner" 
              role="alert" 
              aria-live="polite"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ auth.error() }}</span>
              <button 
                type="button" 
                (click)="auth.clearError()"
                aria-label="Dismiss error"
                class="dismiss-btn"
              >
                ×
              </button>
            </div>
          }

          <!-- Success Message -->
          @if (successMessage()) {
            <div 
              class="success-banner" 
              role="status" 
              aria-live="polite"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>{{ successMessage() }}</span>
            </div>
          }

          <!-- Auth Form -->
          <form 
            (ngSubmit)="handleSubmit()" 
            class="auth-form"
            aria-labelledby="form-title"
            aria-describedby="form-description"
            #authForm="ngForm"
          >
            <!-- Registration Fields -->
            @if (!isLogin()) {
              <div class="form-group">
                <label for="name" class="form-label">
                  Full Name <span class="required" aria-hidden="true">*</span>
                </label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  [(ngModel)]="name" 
                  #nameInput="ngModel"
                  placeholder="Enter your full name"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="name"
                  [attr.aria-invalid]="nameInput.invalid && nameInput.touched"
                  [attr.aria-describedby]="nameInput.invalid && nameInput.touched ? 'name-error' : null"
                  class="form-input"
                  [class.error]="nameInput.invalid && nameInput.touched"
                />
                @if (nameInput.invalid && nameInput.touched) {
                  <span id="name-error" class="field-error" role="alert">
                    Please enter your full name (at least 2 characters)
                  </span>
                }
              </div>

              <div class="form-group">
                <label for="pharmacy" class="form-label">
                  Pharmacy Name <span class="required" aria-hidden="true">*</span>
                </label>
                <input 
                  type="text" 
                  id="pharmacy" 
                  name="pharmacy"
                  [(ngModel)]="pharmacyName"
                  #pharmacyInput="ngModel"
                  placeholder="Enter your pharmacy or organization name"
                  required
                  minlength="2"
                  maxlength="200"
                  [attr.aria-invalid]="pharmacyInput.invalid && pharmacyInput.touched"
                  class="form-input"
                  [class.error]="pharmacyInput.invalid && pharmacyInput.touched"
                />
                @if (pharmacyInput.invalid && pharmacyInput.touched) {
                  <span class="field-error" role="alert">
                    Please enter your pharmacy name
                  </span>
                }
              </div>
            }

            <!-- Email Field -->
            <div class="form-group">
              <label for="email" class="form-label">
                Email Address <span class="required" aria-hidden="true">*</span>
              </label>
              <input 
                type="email" 
                id="email" 
                name="email"
                [(ngModel)]="email"
                #emailInput="ngModel"
                placeholder="you@example.com"
                required
                email
                autocomplete="email"
                [attr.aria-invalid]="emailInput.invalid && emailInput.touched"
                class="form-input"
                [class.error]="emailInput.invalid && emailInput.touched"
              />
              @if (emailInput.invalid && emailInput.touched) {
                <span class="field-error" role="alert">
                  Please enter a valid email address
                </span>
              }
            </div>

            <!-- Password Field -->
            <div class="form-group">
              <div class="label-row">
                <label for="password" class="form-label">
                  Password <span class="required" aria-hidden="true">*</span>
                </label>
                @if (isLogin()) {
                  <a href="#" class="forgot-link" (click)="$event.preventDefault()">
                    Forgot password?
                  </a>
                }
              </div>
              <div class="password-input">
                <input 
                  [type]="showPassword() ? 'text' : 'password'" 
                  id="password" 
                  name="password"
                  [(ngModel)]="password"
                  #passwordInput="ngModel"
                  [placeholder]="isLogin() ? 'Enter your password' : 'Create a strong password'"
                  required
                  minlength="6"
                  [autocomplete]="isLogin() ? 'current-password' : 'new-password'"
                  [attr.aria-invalid]="passwordInput.invalid && passwordInput.touched"
                  class="form-input"
                  [class.error]="passwordInput.invalid && passwordInput.touched"
                />
                <button 
                  type="button" 
                  class="toggle-password" 
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  [attr.aria-pressed]="showPassword()"
                >
                  @if (showPassword()) {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
              @if (passwordInput.invalid && passwordInput.touched) {
                <span class="field-error" role="alert">
                  Password must be at least 6 characters
                </span>
              }
              @if (!isLogin() && password.length >= 6) {
                <div class="password-strength" aria-live="polite">
                  <div class="strength-bar">
                    <div 
                      class="strength-fill" 
                      [style.width.%]="passwordStrength()"
                      [class.weak]="passwordStrength() < 40"
                      [class.medium]="passwordStrength() >= 40 && passwordStrength() < 70"
                      [class.strong]="passwordStrength() >= 70"
                    ></div>
                  </div>
                  <span class="strength-text">
                    {{ passwordStrength() < 40 ? 'Weak' : passwordStrength() < 70 ? 'Medium' : 'Strong' }}
                  </span>
                </div>
              }
            </div>

            <!-- Registration: Country & Currency -->
            @if (!isLogin()) {
              <div class="form-row">
                <div class="form-group">
                  <label for="country" class="form-label">
                    Country <span class="required" aria-hidden="true">*</span>
                  </label>
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
                    <option value="" disabled>Select country</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="AE">🇦🇪 United Arab Emirates</option>
                    <option value="KW">🇰🇼 Kuwait</option>
                    <option value="QA">🇶🇦 Qatar</option>
                    <option value="BH">🇧🇭 Bahrain</option>
                    <option value="OM">🇴🇲 Oman</option>
                    <option value="EG">🇪🇬 Egypt</option>
                    <option value="JO">🇯🇴 Jordan</option>
                    <option value="YE">🇾🇪 Yemen</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="currency" class="form-label">
                    Currency <span class="required" aria-hidden="true">*</span>
                  </label>
                  <select 
                    id="currency" 
                    name="currency"
                    [(ngModel)]="currency"
                    #currencyInput="ngModel"
                    required
                    class="form-input form-select"
                    [class.error]="currencyInput.invalid && currencyInput.touched"
                  >
                    <option value="" disabled>Select currency</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="KWD">KWD - Kuwaiti Dinar</option>
                    <option value="QAR">QAR - Qatari Riyal</option>
                    <option value="BHD">BHD - Bahraini Dinar</option>
                    <option value="OMR">OMR - Omani Rial</option>
                    <option value="EGP">EGP - Egyptian Pound</option>
                    <option value="JOD">JOD - Jordanian Dinar</option>
                    <option value="YER">YER - Yemeni Rial</option>
                    <option value="USD">USD - US Dollar</option>
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
                <span>{{ isLogin() ? 'Sign In' : 'Create Account' }}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              }
            </button>
          </form>

          <!-- Divider -->
          <div class="divider" role="separator">
            <span>or continue with</span>
          </div>

          <!-- Social Login -->
          <div class="social-buttons">
            <button 
              type="button" 
              class="social-btn" 
              (click)="loginWithGoogle()"
              aria-label="Continue with Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </button>

            <button 
              type="button" 
              class="social-btn" 
              (click)="loginWithMicrosoft()"
              aria-label="Continue with Microsoft"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
              <span>Microsoft</span>
            </button>
          </div>

          <!-- Toggle Login/Signup -->
          <p class="toggle-auth">
            {{ isLogin() ? "Don't have an account?" : "Already have an account?" }}
            <button 
              type="button" 
              (click)="toggleMode()"
              class="toggle-btn"
            >
              {{ isLogin() ? 'Sign up for free' : 'Sign in' }}
            </button>
          </p>

          <!-- Terms -->
          @if (!isLogin()) {
            <p class="terms">
              By creating an account, you agree to our 
              <a href="#" (click)="$event.preventDefault()">Terms of Service</a> 
              and 
              <a href="#" (click)="$event.preventDefault()">Privacy Policy</a>
            </p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* ========== Layout ========== */
    .auth-container {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: #ffffff;
    }

    /* ========== Brand Panel ========== */
    .brand-panel {
      flex: 1;
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      padding: 3rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .brand-content {
      position: relative;
      z-index: 10;
      max-width: 480px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 3rem;
    }

    .logo-text {
      font-size: 2.25rem;
      font-weight: 700;
      color: white;
      font-family: 'Noto Sans Arabic', system-ui, sans-serif;
      letter-spacing: -0.02em;
    }

    .taglines {
      margin-bottom: 1.5rem;
    }

    .tagline {
      font-size: 2.5rem;
      font-weight: 600;
      color: white;
      line-height: 1.2;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .description {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.125rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }

    .knowledge-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #38bdf8;
      text-decoration: none;
      font-size: 1rem;
      font-weight: 500;
      margin-bottom: 3rem;
      transition: all 0.2s ease;
    }

    .knowledge-link:hover {
      color: #7dd3fc;
      gap: 0.75rem;
    }

    .knowledge-link:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 4px;
      border-radius: 4px;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 1.75rem;
      backdrop-filter: blur(10px);
    }

    .feature-icon {
      width: 56px;
      height: 56px;
      background: rgba(56, 189, 248, 0.15);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: #38bdf8;
    }

    .feature-content h2 {
      color: white;
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
    }

    .feature-content p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
    }

    .decorative-circle {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .circle-1 {
      width: 500px;
      height: 500px;
      top: -150px;
      right: -150px;
    }

    .circle-2 {
      width: 400px;
      height: 400px;
      bottom: -100px;
      left: -100px;
    }

    /* ========== Form Panel ========== */
    .form-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 2rem 3rem;
      background: #ffffff;
      position: relative;
      overflow-y: auto;
    }

    .lang-switcher {
      position: absolute;
      top: 1.5rem;
      right: 2rem;
      display: flex;
      gap: 0.25rem;
      background: #f1f5f9;
      padding: 0.25rem;
      border-radius: 8px;
    }

    .lang-btn {
      background: transparent;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .lang-btn:hover {
      color: #0f172a;
    }

    .lang-btn.active {
      background: white;
      color: #0f172a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .lang-btn:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }

    .form-container {
      max-width: 420px;
      width: 100%;
      margin: auto;
    }

    .mobile-logo {
      display: none;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .mobile-logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }

    /* ========== Form Header ========== */
    .form-header {
      margin-bottom: 2rem;
    }

    .form-header h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }

    .form-header p {
      color: #64748b;
      font-size: 1rem;
      margin: 0;
      line-height: 1.5;
    }

    /* ========== Alerts ========== */
    .error-banner,
    .success-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
    }

    .success-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
    }

    .error-banner svg,
    .success-banner svg {
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .dismiss-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .dismiss-btn:hover {
      opacity: 1;
    }

    /* ========== Form ========== */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
    }

    .required {
      color: #dc2626;
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .forgot-link {
      font-size: 0.875rem;
      color: #0f172a;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }

    .forgot-link:hover {
      color: #3b82f6;
    }

    .forgot-link:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
      border-radius: 4px;
    }

    .form-input {
      padding: 0.875rem 1rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 1rem;
      color: #0f172a;
      background: #ffffff;
      transition: all 0.2s ease;
      width: 100%;
    }

    .form-input:hover {
      border-color: #cbd5e1;
    }

    .form-input:focus {
      outline: none;
      border-color: #0f172a;
      box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
    }

    .form-input.error {
      border-color: #dc2626;
    }

    .form-input.error:focus {
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }

    .form-input::placeholder {
      color: #94a3b8;
    }

    .form-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      padding-right: 2.5rem;
    }

    .field-error {
      font-size: 0.8125rem;
      color: #dc2626;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* ========== Password Input ========== */
    .password-input {
      position: relative;
    }

    .password-input input {
      padding-right: 3rem;
    }

    .toggle-password {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }

    .toggle-password:hover {
      color: #0f172a;
    }

    .toggle-password:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }

    /* ========== Password Strength ========== */
    .password-strength {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .strength-bar {
      flex: 1;
      height: 4px;
      background: #e2e8f0;
      border-radius: 2px;
      overflow: hidden;
    }

    .strength-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease, background-color 0.3s ease;
    }

    .strength-fill.weak { background: #dc2626; }
    .strength-fill.medium { background: #f59e0b; }
    .strength-fill.strong { background: #16a34a; }

    .strength-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      min-width: 50px;
    }

    /* ========== Submit Button ========== */
    .submit-btn {
      background: #0f172a;
      color: white;
      border: none;
      padding: 1rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .submit-btn:hover:not(:disabled) {
      background: #1e293b;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
    }

    .submit-btn:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }

    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ========== Divider ========== */
    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.75rem 0;
      color: #94a3b8;
      font-size: 0.875rem;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* ========== Social Buttons ========== */
    .social-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      font-size: 0.95rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .social-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .social-btn:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }

    /* ========== Toggle Auth ========== */
    .toggle-auth {
      text-align: center;
      color: #64748b;
      font-size: 0.95rem;
      margin-top: 2rem;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: #0f172a;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.95rem;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: color 0.2s;
    }

    .toggle-btn:hover {
      color: #3b82f6;
    }

    .toggle-btn:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
      border-radius: 4px;
    }

    /* ========== Terms ========== */
    .terms {
      text-align: center;
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 1.5rem;
      line-height: 1.6;
    }

    .terms a {
      color: #0f172a;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .terms a:hover {
      color: #3b82f6;
    }

    /* ========== Responsive ========== */
    @media (max-width: 1024px) {
      .brand-panel {
        display: none;
      }

      .form-panel {
        flex: 1;
      }

      .mobile-logo {
        display: flex;
      }
    }

    @media (max-width: 480px) {
      .form-panel {
        padding: 1.5rem;
      }

      .lang-switcher {
        top: 1rem;
        right: 1rem;
      }

      .form-header h1 {
        font-size: 1.5rem;
      }

      .social-buttons {
        grid-template-columns: 1fr;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }

    /* ========== Reduced Motion ========== */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class AuthComponent {
  protected readonly auth = inject(AuthService);

  // UI State
  readonly isLogin = signal(true);
  readonly showPassword = signal(false);
  readonly language = signal<'en' | 'ar'>('en');
  readonly successMessage = signal<string | null>(null);

  // Form fields
  name = '';
  email = '';
  password = '';
  pharmacyName = '';
  country = '';
  currency = '';

  // Country to currency mapping
  private readonly currencyMap: Record<string, string> = {
    'SA': 'SAR',
    'AE': 'AED',
    'KW': 'KWD',
    'QA': 'QAR',
    'BH': 'BHD',
    'OM': 'OMR',
    'EG': 'EGP',
    'JO': 'JOD',
    'YE': 'YER'
  };

  /**
   * Calculate password strength (0-100)
   */
  readonly passwordStrength = computed(() => {
    const pwd = this.password;
    if (!pwd) return 0;
    
    let strength = 0;
    if (pwd.length >= 6) strength += 20;
    if (pwd.length >= 8) strength += 10;
    if (pwd.length >= 12) strength += 10;
    if (/[a-z]/.test(pwd)) strength += 15;
    if (/[A-Z]/.test(pwd)) strength += 15;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 15;
    
    return Math.min(100, strength);
  });

  /**
   * Check if form is valid for submission
   */
  isFormValid(): boolean {
    if (this.isLogin()) {
      return !!(this.email && this.password && this.password.length >= 6);
    }
    return !!(
      this.name && 
      this.email && 
      this.password && 
      this.password.length >= 6 &&
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

  /**
   * Login existing user
   */
  private login(): void {
    this.auth.login({
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.auth.navigateAfterAuth();
      }
    });
  }

  /**
   * Register new tenant
   */
  private register(): void {
    this.auth.register({
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      tenantName: this.pharmacyName.trim(),
      country: this.country,
      currency: this.currency
    }).subscribe({
      next: () => {
        this.auth.navigateAfterAuth();
      }
    });
  }

  /**
   * Google OAuth (placeholder)
   */
  loginWithGoogle(): void {
    this.successMessage.set('Google authentication coming soon!');
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  /**
   * Microsoft OAuth (placeholder)
   */
  loginWithMicrosoft(): void {
    this.successMessage.set('Microsoft authentication coming soon!');
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  /**
   * Reset form fields
   */
  private resetForm(): void {
    this.name = '';
    this.email = '';
    this.password = '';
    this.pharmacyName = '';
    this.country = '';
    this.currency = '';
  }
}
