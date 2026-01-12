/**
 * @fileoverview Organization Selection Component
 * First step in tenant-first authentication flow
 * Users enter their org slug to proceed to login
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
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse, TenantPublicInfo } from '@core/models/auth.model';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, catchError, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// LocalStorage key for remembering last used org
const LAST_ORG_KEY = 'thurayya_last_org';

@Component({
  selector: 'app-org-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="org-container" role="main">
      <!-- Background Pattern -->
      <div class="bg-pattern" aria-hidden="true"></div>
      
      <!-- Main Card -->
      <div class="org-card">
        <!-- Logo -->
        <div class="logo-section">
          <div class="logo-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="var(--color-primary)"/>
              <path d="M14 16h6v16h-6V16zm7 0h6v16h-6V16zm7 0h6v16h-6V16z" fill="white"/>
            </svg>
          </div>
          <span class="logo-text">Thurayya</span>
        </div>

        <!-- Header -->
        <header class="header">
          <h1>Sign in to your organization</h1>
          <p>Enter your organization's URL to continue</p>
        </header>

        <!-- Error Message -->
        @if (error()) {
          <div class="error-banner" role="alert" aria-live="assertive">
            <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- Org Input Form -->
        <form (ngSubmit)="handleSubmit()" class="org-form">
          <div class="url-input-group">
            <div class="url-prefix">
              <span>{{ baseUrl }}/</span>
            </div>
            <input 
              type="text" 
              id="orgSlug"
              name="orgSlug"
              [ngModel]="slug()"
              (ngModelChange)="onSlugChange($event)"
              placeholder="your-organization"
              required
              autocomplete="organization"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              class="slug-input"
              [class.error]="!isValidSlug() && slug().length > 0"
              [class.valid]="validatedOrg() !== null"
              [class.checking]="isChecking()"
              aria-label="Organization URL"
              [attr.aria-describedby]="statusHint() ? 'slug-hint' : null"
            />
            <!-- Status Indicator -->
            <div class="input-status">
              @if (isChecking()) {
                <span class="spinner-small" aria-hidden="true"></span>
              } @else if (validatedOrg()) {
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              } @else if (!isValidSlug() && slug().length > 0) {
                <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              }
            </div>
          </div>

          <!-- Status Hint -->
          @if (statusHint()) {
            <p id="slug-hint" class="hint" [class.success]="validatedOrg()" [class.error]="error()">
              {{ statusHint() }}
            </p>
          }

          <!-- Submit Button -->
          <button 
            type="submit" 
            class="submit-btn" 
            [disabled]="!canSubmit()"
            [attr.aria-busy]="isChecking()"
          >
            @if (isChecking()) {
              <span class="spinner" aria-hidden="true"></span>
              <span>Checking...</span>
            } @else {
              <span>Continue</span>
              <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            }
          </button>
        </form>

        <!-- Divider -->
        <div class="divider" role="separator">
          <span>or</span>
        </div>

        <!-- Create New Org Link -->
        <div class="create-org-section">
          <p>Don't have an organization yet?</p>
          <button type="button" class="create-btn" (click)="goToCreateOrg()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span>Create a new organization</span>
          </button>
        </div>

        <!-- Footer -->
        <footer class="footer">
          <span>© {{ currentYear }} Thurayya Systems. All rights reserved.</span>
        </footer>
      </div>
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
      --font-size-2xl: 1.75rem;
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
      --color-success-bg: #ecfdf5;
      --radius: 12px;
      --radius-sm: 8px;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);
      --transition: 200ms ease;
    }

    /* Container */
    .org-container {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      font-family: var(--font-sans);
      background: linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%);
      position: relative;
      overflow: hidden;
    }

    /* Background Pattern */
    .bg-pattern {
      position: absolute;
      inset: 0;
      background-image: 
        radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.06) 0%, transparent 50%);
      pointer-events: none;
    }

    /* Card */
    .org-card {
      width: 100%;
      max-width: 420px;
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: var(--shadow-lg);
      border: 1px solid rgba(0, 0, 0, 0.04);
      position: relative;
      z-index: 1;
    }

    /* Logo */
    .logo-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .logo-text {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: -0.025em;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 1.75rem;
    }

    .header h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-primary);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }

    .header p {
      color: var(--color-text-muted);
      font-size: var(--font-size-base);
      margin: 0;
    }

    /* Error Banner */
    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1.25rem;
      font-size: var(--font-size-sm);
      background: var(--color-error-bg);
      border: 1px solid #fecaca;
      color: var(--color-error);
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .alert-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Form */
    .org-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* URL Input Group */
    .url-input-group {
      display: flex;
      align-items: stretch;
      background: #f9fafb;
      border: 2px solid var(--color-border);
      border-radius: var(--radius);
      transition: all var(--transition);
      overflow: hidden;
    }

    .url-input-group:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      background: white;
    }

    .url-input-group:has(.valid) {
      border-color: var(--color-success);
    }

    .url-input-group:has(.error) {
      border-color: var(--color-error);
    }

    .url-prefix {
      display: flex;
      align-items: center;
      padding: 0 0.875rem;
      background: #f3f4f6;
      color: var(--color-text-muted);
      font-size: var(--font-size-base);
      font-weight: 500;
      border-right: 1px solid var(--color-border);
      white-space: nowrap;
    }

    .slug-input {
      flex: 1;
      min-width: 0;
      padding: 0.875rem 1rem;
      border: none;
      background: transparent;
      font-size: var(--font-size-base);
      font-family: var(--font-sans);
      color: var(--color-primary);
      outline: none;
    }

    .slug-input::placeholder {
      color: #9ca3af;
    }

    .input-status {
      display: flex;
      align-items: center;
      padding-right: 0.875rem;
    }

    .spinner-small {
      width: 18px;
      height: 18px;
      border: 2px solid #e5e7eb;
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .check-icon {
      width: 20px;
      height: 20px;
      color: var(--color-success);
    }

    .error-icon {
      width: 18px;
      height: 18px;
      color: var(--color-error);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Hint */
    .hint {
      font-size: var(--font-size-sm);
      margin: 0;
      padding: 0 0.25rem;
      color: var(--color-text-muted);
    }

    .hint.success {
      color: var(--color-success);
    }

    .hint.error {
      color: var(--color-error);
    }

    /* Submit Button */
    .submit-btn {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.875rem 1.25rem;
      border-radius: var(--radius);
      font-size: var(--font-size-base);
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: all var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 52px;
      margin-top: 0.5rem;
    }

    .submit-btn:hover:not(:disabled) {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
    }

    .submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .submit-btn:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    .btn-arrow {
      width: 18px;
      height: 18px;
      transition: transform var(--transition);
    }

    .submit-btn:hover:not(:disabled) .btn-arrow {
      transform: translateX(3px);
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* Divider */
    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.75rem 0;
      color: #9ca3af;
      font-size: var(--font-size-sm);
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }

    /* Create Org Section */
    .create-org-section {
      text-align: center;
    }

    .create-org-section p {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: 0 0 0.75rem 0;
    }

    .create-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius);
      background: white;
      font-size: var(--font-size-base);
      font-weight: 500;
      font-family: var(--font-sans);
      color: var(--color-text);
      cursor: pointer;
      transition: all var(--transition);
      width: 100%;
    }

    .create-btn:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: #f5f3ff;
    }

    .create-btn:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    .create-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: var(--font-size-xs);
      color: #9ca3af;
      margin-top: 2rem;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .org-container {
        padding: 1rem;
      }

      .org-card {
        padding: 1.75rem;
        border-radius: 16px;
      }

      .header h1 {
        font-size: var(--font-size-xl);
      }

      .url-prefix {
        font-size: var(--font-size-sm);
        padding: 0 0.625rem;
      }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class OrgSelectionComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  // State
  readonly slug = signal('');
  readonly isChecking = signal(false);
  readonly error = signal<string | null>(null);
  readonly validatedOrg = signal<TenantPublicInfo | null>(null);

  // Debounced slug check
  private slugCheck$ = new Subject<string>();

  // Base URL for display (extract from environment or current URL)
  get baseUrl(): string {
    const hostname = window.location.hostname;
    if (hostname === 'localhost') {
      return 'localhost:4200';
    }
    return hostname.replace(/^www\./, '');
  }

  readonly currentYear = new Date().getFullYear();

  // Computed
  readonly isValidSlug = computed(() => {
    const s = this.slug();
    // Slug must be lowercase, alphanumeric with hyphens, 3-50 chars
    return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(s) || /^[a-z0-9]{3,50}$/.test(s);
  });

  readonly canSubmit = computed(() => {
    return this.validatedOrg() !== null && !this.isChecking();
  });

  readonly statusHint = computed(() => {
    if (this.validatedOrg()) {
      return `✓ ${this.validatedOrg()?.name}`;
    }
    if (this.error()) {
      return null; // Error shown in banner
    }
    if (this.slug().length > 0 && !this.isValidSlug()) {
      return 'Use lowercase letters, numbers, and hyphens only';
    }
    return null;
  });

  ngOnInit(): void {
    // Check if slug is in URL already (e.g., /acme-corp)
    const pathSlug = this.route.snapshot.paramMap.get('slug');
    if (pathSlug) {
      this.slug.set(pathSlug);
    } else {
      // Try to load last used org from localStorage
      this.loadLastOrg();
    }

    // Set up the debounced validation with proper cleanup
    this.slugCheck$.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(350), // Slightly faster for better UX
      distinctUntilChanged(),
      tap(() => {
        this.isChecking.set(true);
        this.error.set(null);
        this.validatedOrg.set(null);
      }),
      switchMap(slug => this.validateSlug(slug))
    ).subscribe();
  }

  ngOnDestroy(): void {
    // Subject cleanup
    this.slugCheck$.complete();
  }

  /**
   * Load last used organization from localStorage for better UX
   */
  private loadLastOrg(): void {
    try {
      const lastOrg = localStorage.getItem(LAST_ORG_KEY);
      if (lastOrg && lastOrg.length >= 3) {
        this.slug.set(lastOrg);
        // Trigger validation
        this.slugCheck$.next(lastOrg);
      }
    } catch {
      // localStorage not available - ignore
    }
  }

  onSlugChange(value: string): void {
    // Normalize: lowercase, replace spaces with hyphens
    const normalized = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    this.slug.set(normalized);
    this.error.set(null);
    this.validatedOrg.set(null);
    
    // Trigger validation if slug is valid
    if (this.isValidSlug()) {
      this.slugCheck$.next(normalized);
    }
  }

  private validateSlug(slug: string) {
    return this.http.get<ApiResponse<TenantPublicInfo>>(`${this.apiUrl}/tenants/by-slug/${slug}`).pipe(
      tap(response => {
        this.isChecking.set(false);
        if (response.success && response.data) {
          this.validatedOrg.set(response.data);
        } else {
          this.error.set('Organization not found');
        }
      }),
      catchError(err => {
        this.isChecking.set(false);
        if (err.status === 404) {
          this.error.set('Organization not found. Check the URL or create a new one.');
        } else {
          this.error.set('Unable to verify organization. Please try again.');
        }
        return of(null);
      })
    );
  }

  handleSubmit(): void {
    if (!this.canSubmit()) return;

    const org = this.validatedOrg();
    if (org) {
      // Navigate to login with org context
      this.router.navigate([org.slug, 'login']);
    }
  }

  goToCreateOrg(): void {
    this.router.navigate(['/signup']);
  }
}
