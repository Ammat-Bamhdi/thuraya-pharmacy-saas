import { Injectable, signal, computed, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

/**
 * Enhanced Analytics Service using Angular 21 linkedSignals
 * Demonstrates modern state management patterns
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  // Primary signals
  readonly selectedBranchId = signal<string>('');
  readonly selectedDateRange = signal<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });

  // LinkedSignal - automatically updates when dependencies change
  // This is an Angular 21 feature that creates derived state
  readonly analyticsData = linkedSignal(() => {
    const branchId = this.selectedBranchId();
    const dateRange = this.selectedDateRange();
    
    // Simulate fetching analytics data based on branch and date
    return this.calculateAnalytics(branchId, dateRange);
  });

  // Computed signals for derived state
  readonly totalRevenue = computed(() => {
    return this.analyticsData().reduce((sum, item) => sum + item.revenue, 0);
  });

  readonly averageTransactionValue = computed(() => {
    const data = this.analyticsData();
    if (data.length === 0) return 0;
    return this.totalRevenue() / data.length;
  });

  readonly topProducts = computed(() => {
    return this.analyticsData()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  });

  // Real-time updates using toSignal
  readonly currentTime = toSignal(interval(1000), { initialValue: Date.now() });

  private calculateAnalytics(branchId: string, dateRange: { start: Date; end: Date }) {
    // Mock analytics calculation
    return Array.from({ length: 10 }, (_, i) => ({
      id: `${branchId}-${i}`,
      date: new Date(dateRange.start.getTime() + i * 86400000),
      revenue: Math.random() * 10000,
      transactions: Math.floor(Math.random() * 50),
      productsSold: Math.floor(Math.random() * 200)
    }));
  }

  updateBranch(branchId: string) {
    this.selectedBranchId.set(branchId);
  }

  updateDateRange(start: Date, end: Date) {
    this.selectedDateRange.set({ start, end });
  }
}
