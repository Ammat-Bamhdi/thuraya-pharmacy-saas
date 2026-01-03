/**
 * @fileoverview Authentication component with login/signup
 * JISR-inspired split-screen design with social auth options
 */

import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-container">
      <!-- Left Panel - Branding -->
      <div class="brand-panel">
        <div class="brand-content">
          <!-- Logo -->
          <div class="logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.1"/>
              <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
            </svg>
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

          <a href="#" class="knowledge-link">
            <span>Visit our documentation</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </a>

          <!-- Feature Card -->
          <div class="feature-card">
            <div class="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div class="feature-content">
              <h3>Multi-branch Management</h3>
              <p>Manage multiple pharmacy branches from a single dashboard with real-time sync and offline support.</p>
            </div>
            <button class="learn-more-btn">Learn more</button>
          </div>
        </div>

        <!-- Decorative Elements -->
        <div class="decorative-circle circle-1"></div>
        <div class="decorative-circle circle-2"></div>
      </div>

      <!-- Right Panel - Auth Form -->
      <div class="form-panel">
        <!-- Language Switcher -->
        <div class="lang-switcher">
          <button class="lang-btn" [class.active]="language() === 'ar'" (click)="language.set('ar')">عربي</button>
          <button class="lang-btn" [class.active]="language() === 'en'" (click)="language.set('en')">EN</button>
        </div>

        <div class="form-container">
          <!-- Logo for mobile -->
          <div class="mobile-logo">
            <div class="logo-icon">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#0f172a"/>
                <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
              </svg>
            </div>
            <span class="mobile-logo-text">Thurayya</span>
          </div>

          <!-- Form Header -->
          <div class="form-header">
            <h2>{{ isLogin() ? 'Welcome back' : 'Create account' }}</h2>
            <p>{{ isLogin() ? 'Enter your credentials to access your account' : 'Start your 14-day free trial' }}</p>
          </div>

          <!-- Error Message -->
          @if (auth.error()) {
            <div class="error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ auth.error() }}</span>
              <button type="button" (click)="auth.clearError()">×</button>
            </div>
          }

          <!-- Auth Form -->
          <form (ngSubmit)="handleSubmit()" class="auth-form">
            @if (!isLogin()) {
              <div class="form-group">
                <label for="name">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  [(ngModel)]="name" 
                  name="name"
                  placeholder="Enter your full name"
                  required
                  autocomplete="name"
                />
              </div>

              <div class="form-group">
                <label for="pharmacy">Pharmacy Name</label>
                <input 
                  type="text" 
                  id="pharmacy" 
                  [(ngModel)]="pharmacyName" 
                  name="pharmacy"
                  placeholder="Enter your pharmacy name"
                  required
                />
              </div>
            }

            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                [(ngModel)]="email" 
                name="email"
                placeholder="Enter your email"
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="password">Password</label>
                @if (isLogin()) {
                  <a href="#" class="forgot-link">Forgot password?</a>
                }
              </div>
              <div class="password-input">
                <input 
                  [type]="showPassword() ? 'text' : 'password'" 
                  id="password" 
                  [(ngModel)]="password" 
                  name="password"
                  placeholder="Enter your password"
                  required
                  autocomplete="current-password"
                  minlength="6"
                />
                <button type="button" class="toggle-password" (click)="showPassword.set(!showPassword())">
                  @if (showPassword()) {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
            </div>

            @if (!isLogin()) {
              <div class="form-row">
                <div class="form-group">
                  <label for="country">Country</label>
                  <select id="country" [(ngModel)]="country" name="country" required>
                    <option value="">Select country</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="AE">United Arab Emirates</option>
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
                  <label for="currency">Currency</label>
                  <select id="currency" [(ngModel)]="currency" name="currency" required>
                    <option value="">Select currency</option>
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

            <button type="submit" class="submit-btn" [disabled]="auth.isLoading()">
              @if (auth.isLoading()) {
                <span class="spinner"></span>
                <span>{{ isLogin() ? 'Signing in...' : 'Creating account...' }}</span>
              } @else {
                {{ isLogin() ? 'Login' : 'Create Account' }}
              }
            </button>
          </form>

          <!-- Divider -->
          <div class="divider">
            <span>OR</span>
          </div>

          <!-- Social Login -->
          <div class="social-buttons">
            <button type="button" class="social-btn" (click)="loginWithGoogle()">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </button>

            <button type="button" class="social-btn" (click)="loginWithMicrosoft()">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
              <span>Microsoft</span>
            </button>
          </div>

          <button type="button" class="sso-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>SSO Login</span>
          </button>

          <!-- Toggle Login/Signup -->
          <p class="toggle-auth">
            {{ isLogin() ? "Don't have an account?" : "Already have an account?" }}
            <button type="button" (click)="toggleMode()">
              {{ isLogin() ? 'Sign up' : 'Login' }}
            </button>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      min-height: 100vh;
      background: #ffffff;
    }

    /* Left Panel - Branding */
    .brand-panel {
      flex: 1;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
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
      font-size: 2rem;
      font-weight: 700;
      color: white;
      font-family: 'Noto Sans Arabic', sans-serif;
    }

    .taglines {
      margin-bottom: 1.5rem;
    }

    .tagline {
      font-size: 2.25rem;
      font-weight: 600;
      color: white;
      line-height: 1.3;
      margin: 0;
    }

    .description {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .knowledge-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #38bdf8;
      text-decoration: none;
      font-size: 0.95rem;
      margin-bottom: 2.5rem;
      transition: all 0.2s;
    }

    .knowledge-link:hover {
      color: #7dd3fc;
      gap: 0.75rem;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      background: rgba(56, 189, 248, 0.1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      color: #38bdf8;
    }

    .feature-content h3 {
      color: white;
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }

    .feature-content p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      line-height: 1.5;
      margin: 0 0 1rem 0;
    }

    .learn-more-btn {
      background: white;
      color: #0f172a;
      border: none;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .learn-more-btn:hover {
      background: #f1f5f9;
      transform: translateY(-1px);
    }

    .decorative-circle {
      position: absolute;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(56, 189, 248, 0.05));
    }

    .circle-1 {
      width: 400px;
      height: 400px;
      top: -100px;
      right: -100px;
    }

    .circle-2 {
      width: 300px;
      height: 300px;
      bottom: -50px;
      left: -50px;
    }

    /* Right Panel - Form */
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
      gap: 0.5rem;
    }

    .lang-btn {
      background: transparent;
      border: 1px solid #e2e8f0;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }

    .lang-btn:hover, .lang-btn.active {
      background: #f8fafc;
      color: #0f172a;
      border-color: #cbd5e1;
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

    .form-header {
      margin-bottom: 1.5rem;
    }

    .form-header h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem 0;
    }

    .form-header p {
      color: #64748b;
      font-size: 0.95rem;
      margin: 0;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      margin-bottom: 1.25rem;
      color: #dc2626;
      font-size: 0.9rem;
    }

    .error-banner button {
      margin-left: auto;
      background: none;
      border: none;
      color: #dc2626;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .forgot-link {
      font-size: 0.875rem;
      color: #0f172a;
      text-decoration: none;
      font-weight: 500;
    }

    .forgot-link:hover {
      text-decoration: underline;
    }

    input, select {
      padding: 0.875rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 1rem;
      color: #0f172a;
      background: #ffffff;
      transition: all 0.2s;
    }

    input:focus, select:focus {
      outline: none;
      border-color: #0f172a;
      box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
    }

    input::placeholder {
      color: #94a3b8;
    }

    .password-input {
      position: relative;
    }

    .password-input input {
      width: 100%;
      padding-right: 3rem;
    }

    .toggle-password {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toggle-password:hover {
      color: #0f172a;
    }

    .submit-btn {
      background: #0f172a;
      color: white;
      border: none;
      padding: 1rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .submit-btn:hover:not(:disabled) {
      background: #1e293b;
      transform: translateY(-1px);
    }

    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
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

    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.5rem 0;
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

    .social-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      font-size: 0.95rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }

    .social-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .sso-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      font-size: 0.95rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }

    .sso-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .toggle-auth {
      text-align: center;
      color: #64748b;
      font-size: 0.95rem;
      margin-top: 1.5rem;
    }

    .toggle-auth button {
      background: none;
      border: none;
      color: #0f172a;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      font-size: 0.95rem;
    }

    .toggle-auth button:hover {
      color: #1e40af;
    }

    /* Responsive */
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

      .social-buttons {
        grid-template-columns: 1fr;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AuthComponent {
  protected readonly auth = inject(AuthService);

  // State
  readonly isLogin = signal(true);
  readonly showPassword = signal(false);
  readonly language = signal<'en' | 'ar'>('en');

  // Form fields
  name = '';
  email = '';
  password = '';
  pharmacyName = '';
  country = '';
  currency = '';

  toggleMode(): void {
    this.isLogin.set(!this.isLogin());
    this.auth.clearError();
    this.resetForm();
  }

  handleSubmit(): void {
    if (this.isLogin()) {
      this.login();
    } else {
      this.register();
    }
  }

  private login(): void {
    if (!this.email || !this.password) {
      return;
    }

    this.auth.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.auth.navigateAfterAuth();
      },
      error: () => {
        // Error is handled by service
      }
    });
  }

  private register(): void {
    if (!this.name || !this.email || !this.password || !this.pharmacyName || !this.country || !this.currency) {
      return;
    }

    this.auth.register({
      name: this.name,
      email: this.email,
      password: this.password,
      tenantName: this.pharmacyName,
      country: this.country,
      currency: this.currency
    }).subscribe({
      next: () => {
        this.auth.navigateAfterAuth();
      },
      error: () => {
        // Error is handled by service
      }
    });
  }

  loginWithGoogle(): void {
    // TODO: Implement Google OAuth
    console.log('Google OAuth not yet implemented');
  }

  loginWithMicrosoft(): void {
    // TODO: Implement Microsoft OAuth
    console.log('Microsoft OAuth not yet implemented');
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
