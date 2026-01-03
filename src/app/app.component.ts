/**
 * @fileoverview Root application component and shell
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
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

/**
 * @component AppComponent
 * @description Root application shell with navigation and view management
 * 
 * @features
 * - Application shell layout
 * - View routing via signal-based state
 * - Onboarding wizard for new users
 * - Sidebar navigation
 * - Responsive layout
 * 
 * @architecture
 * - OnPush change detection
 * - Signal-based view state
 * - Standalone component architecture
 * - Feature-based modular imports
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    // Layout
    SidebarComponent,
    // Features
    AuthComponent,
    DashboardComponent,
    InventoryComponent,
    POSComponent,
    OnboardingComponent,
    UsersComponent,
    SettingsComponent,
    ProcurementComponent,
    SalesComponent,
    FinanceComponent
  ],
  template: `
    <!-- Auth Screen -->
    @if (store.currentView() === 'auth') {
      <app-auth></app-auth>
    }
    <!-- Onboarding Full Screen Overlay -->
    @else if (store.currentView() === 'onboarding') {
      <app-onboarding></app-onboarding>
    } @else {
      <div class="flex h-screen w-screen p-4 gap-4 overflow-hidden animate-fade-in">
        <!-- Sidebar -->
        <div class="w-64 h-full shrink-0">
          <app-sidebar></app-sidebar>
        </div>

        <!-- Main Content Area -->
        <main class="flex-1 h-full min-w-0 relative">
          @if (store.currentView() === 'dashboard') {
             <app-dashboard class="block h-full"></app-dashboard>
          }
          @else if (store.currentView() === 'inventory') {
             <app-inventory class="block h-full"></app-inventory>
          }
          @else if (store.currentView().startsWith('procurement')) {
             <app-procurement class="block h-full"></app-procurement>
          }
          @else if (store.currentView().startsWith('sales')) {
             <app-sales class="block h-full"></app-sales>
          }
          @else if (store.currentView() === 'finance') {
             <app-finance class="block h-full"></app-finance>
          }
          @else if (store.currentView() === 'pos') {
             <app-pos class="block h-full"></app-pos>
          }
          @else if (store.currentView() === 'users') {
             <app-users class="block h-full"></app-users>
          }
          @else if (store.currentView() === 'settings') {
             <app-settings class="block h-full"></app-settings>
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
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    // Check authentication state on app load
    this.auth.checkAuthState();
  }
}

