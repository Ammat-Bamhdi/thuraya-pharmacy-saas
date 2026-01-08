/**
 * @fileoverview Root application component and shell
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// Layout
import { SidebarComponent } from '@layout/sidebar/sidebar.component';

// Core
import { StoreService } from '@core/services/store.service';
import { AuthService } from '@core/services/auth.service';

// Features
import { AuthComponent } from '@features/auth/auth.component';
import { DashboardComponent } from '@features/dashboard/dashboard.component';
import { InventoryComponent } from '@features/inventory/inventory.component';
import { POSComponent } from '@features/pos/pos.component';
import { OnboardingComponent } from '@features/onboarding/onboarding.component';
import { UsersComponent } from '@features/users/users.component';
import { SettingsComponent } from '@features/settings/settings.component';
import { ProcurementComponent } from '@features/procurement/procurement.component';
import { SalesComponent } from '@features/sales/sales.component';
import { FinanceComponent } from '@features/finance/finance.component';
import { ManagerAssignmentComponent } from '@features/manager-assignment/manager-assignment.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SidebarComponent,
    AuthComponent,
    DashboardComponent,
    InventoryComponent,
    POSComponent,
    OnboardingComponent,
    UsersComponent,
    SettingsComponent,
    ProcurementComponent,
    SalesComponent,
    FinanceComponent,
    ManagerAssignmentComponent
  ],
  template: `
    <!-- Loading State while initializing auth -->
    @if (!auth.initialized()) {
      <div class="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div class="text-center">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-500/20 mx-auto mb-4 animate-pulse">
            T
          </div>
          <p class="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    }
    
    <!-- Auth Screen -->
    @else if (store.currentView() === 'auth') {
      <app-auth></app-auth>
    }
    
    <!-- Onboarding Full Screen Overlay -->
    @else if (store.currentView() === 'onboarding') {
      <app-onboarding></app-onboarding>
    } 
    
    <!-- Main App Layout -->
    @else {
      <div class="flex h-screen w-screen p-4 gap-4 overflow-hidden animate-fade-in">
        <!-- Sidebar -->
        <div class="w-64 h-full shrink-0">
          <app-sidebar></app-sidebar>
        </div>

        <!-- Main Content Area -->
        <main class="flex-1 h-full min-w-0 relative">
          @switch (store.currentView()) {
            @case ('dashboard') {
              <app-dashboard class="block h-full"></app-dashboard>
            }
            @case ('manager-assignment') {
              <app-manager-assignment class="block h-full"></app-manager-assignment>
            }
            @case ('inventory') {
              <app-inventory class="block h-full"></app-inventory>
            }
            @case ('procurement-orders') {
              <app-procurement class="block h-full"></app-procurement>
            }
            @case ('procurement-bills') {
              <app-procurement class="block h-full"></app-procurement>
            }
            @case ('procurement-suppliers') {
              <app-procurement class="block h-full"></app-procurement>
            }
            @case ('sales-customers') {
              <app-sales class="block h-full"></app-sales>
            }
            @case ('sales-invoices') {
              <app-sales class="block h-full"></app-sales>
            }
            @case ('finance') {
              <app-finance class="block h-full"></app-finance>
            }
            @case ('pos') {
              <app-pos class="block h-full"></app-pos>
            }
            @case ('users') {
              <app-users class="block h-full"></app-users>
            }
            @case ('settings') {
              <app-settings class="block h-full"></app-settings>
            }
          }
        </main>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
  `]
})
export class AppComponent implements OnInit {
  protected readonly store = inject(StoreService);
  protected readonly auth = inject(AuthService);

  async ngOnInit(): Promise<void> {
    // Filter out browser extension errors that clutter the console
    this.setupErrorFiltering();
    
    // Initialize auth state - validates token against backend
    // This is the single source of truth for auth
    await this.auth.initialize();
  }

  /**
   * Filters out non-critical browser extension errors from console
   */
  private setupErrorFiltering(): void {
    const originalError = console.error;
    const originalWarn = console.warn;

    // Filter browser extension errors
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      // Ignore Chrome extension errors
      if (
        message.includes('message channel closed') ||
        message.includes('asynchronous response') ||
        message.includes('Extension context invalidated') ||
        message.includes('chrome-extension://')
      ) {
        return; // Silently ignore
      }
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      // Ignore Chrome extension warnings
      if (
        message.includes('message channel closed') ||
        message.includes('asynchronous response') ||
        message.includes('Extension context invalidated')
      ) {
        return; // Silently ignore
      }
      originalWarn.apply(console, args);
    };

    // Also catch unhandled promise rejections from extensions
    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || event.reason?.toString() || '';
      if (
        message.includes('message channel closed') ||
        message.includes('asynchronous response') ||
        message.includes('Extension context invalidated')
      ) {
        event.preventDefault(); // Prevent error from showing
        return;
      }
    });
  }
}
