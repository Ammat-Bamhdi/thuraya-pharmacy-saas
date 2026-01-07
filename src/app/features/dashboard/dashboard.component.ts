/**
 * @fileoverview Main dashboard with sales overview and quick statistics
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icons/icons.component';
import { SalesChartComponent } from '@shared/components/chart/chart.component';
import { StoreService } from '@core/services/store.service';
import { SetupService, SetupStatus } from '@core/services/setup.service';

/**
 * @component DashboardComponent
 * @description Main overview dashboard displaying sales metrics, top products, and quick stats
 * 
 * @features
 * - Real-time sales revenue tracking
 * - Top-selling products list
 * - Quick statistics (orders, inventory, revenue)
 * - Setup guide for new tenants
 * - Recent activity feed
 * 
 * @dependencies
 * - StoreService: Global state management
 * 
 * @example
 * <app-dashboard></app-dashboard>
 * 
 * @architecture
 * - Uses OnPush change detection for performance
 * - Signal-based reactive state management
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IconComponent, SalesChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styles: [`
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-in {
      animation: slideIn 0.5s ease-out;
    }
  `]
})
export class DashboardComponent implements OnInit {
  store = inject(StoreService);
  private setupService = inject(SetupService);

  /** Setup status for manager assignment card */
  setupStatus = signal<SetupStatus | null>(null);

  /** Whether the setup card has been dismissed this session */
  setupCardDismissed = signal(false);

  ngOnInit(): void {
    // Load setup status on dashboard init
    this.loadSetupStatus();
  }

  /**
   * Loads the setup status from the backend.
   * Shows the setup card if branches need manager assignment.
   */
  private loadSetupStatus(): void {
    this.setupService.getSetupStatus().subscribe(status => {
      this.setupStatus.set(status);
    });
  }

  /**
   * Navigates to the manager assignment page.
   */
  goToManagerAssignment(): void {
    this.store.setView('manager-assignment');
  }

  /**
   * Dismisses the setup card for this session.
   */
  dismissSetupCard(): void {
    this.setupCardDismissed.set(true);
  }
}

