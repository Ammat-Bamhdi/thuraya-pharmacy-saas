/**
 * @fileoverview Financial Overview Component - Revenue, expenses, and profit tracking
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService } from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';

/**
 * @component FinanceComponent
 * @description Displays financial overview including revenue, expenses, and profit calculations
 * 
 * @features
 * - Real-time revenue tracking from sales invoices
 * - Expense categorization and breakdown
 * - Net profit/loss calculations
 * - Cost breakdown visualization
 * - P&L statement export
 * 
 * @dependencies
 * - StoreService: Global state management for invoices and expenses
 * 
 * @example
 * <app-finance></app-finance>
 * 
 * @architecture
 * - Uses OnPush change detection for performance
 * - Computed signals for reactive calculations
 * - Standalone component with explicit imports
 * 
 * @performance
 * - OnPush change detection minimizes re-renders
 * - Computed signals cache derived values
 * - No manual subscriptions required
 * 
 * @accessibility
 * - Semantic HTML structure
 * - ARIA labels on interactive elements
 * - Screen reader friendly
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance.component.html'
})
export class FinanceComponent {
  // ========================================
  // DEPENDENCIES
  // ========================================
  
  /**
   * Global store service for accessing invoices and expenses
   * @readonly
   */
  protected readonly store = inject(StoreService);

  // ========================================
  // COMPUTED VALUES (Reactive Calculations)
  // ========================================
  
  /**
   * Calculates total revenue from all invoices
   * @returns {number} Sum of all invoice totals in YER
   * @computed
   */
  readonly totalRevenue = computed(() => 
    this.store.invoices().reduce((sum, inv) => sum + inv.total, 0)
  );

  /**
   * Calculates total expenses across all categories
   * @returns {number} Sum of all expenses in YER
   * @computed
   */
  readonly totalExpenses = computed(() => 
    this.store.expenses().reduce((sum, exp) => sum + exp.amount, 0)
  );

  /**
   * Calculates net profit (revenue - expenses)
   * @returns {number} Net profit/loss in YER (positive = profit, negative = loss)
   * @computed
   */
  readonly netProfit = computed(() => 
    this.totalRevenue() - this.totalExpenses()
  );

  // ========================================
  // PUBLIC METHODS
  // ========================================
  
  /**
   * Exports profit & loss statement (to be implemented)
   * @returns {void}
   * @future Will generate PDF download of P&L statement
   */
  downloadStatement(): void {
    // TODO: Implement P&L statement generation
    console.log('Downloading P&L statement...');
  }

  /**
   * Opens modal to add new expense (to be implemented)
   * @returns {void}
   * @future Will open expense creation modal
   */
  addExpense(): void {
    // TODO: Implement expense creation modal
    console.log('Opening expense modal...');
  }
}

