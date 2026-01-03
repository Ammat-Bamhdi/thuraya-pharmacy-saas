/**
 * @fileoverview Navigation sidebar with route management
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, ViewState } from '@core/services/store.service';
import { AuthService } from '@core/services/auth.service';
import { IconComponent } from '@shared/components/icons/icons.component';

/**
 * @component SidebarComponent
 * @description Navigation sidebar with tab switching and state management
 * 
 * @features
 * - Tab-based navigation
 * - Active tab highlighting
 * - Badge indicators for notifications
 * - Responsive collapsible design
 * - Branch context display
 * 
 * @dependencies
 * - StoreService: Global state and navigation
 * 
 * @example
 * <app-sidebar></app-sidebar>
 * 
 * @architecture
 * - OnPush change detection
 * - Signal-based active state
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(148, 163, 184, 0.5);
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-down {
      animation: slideDown 0.2s ease-out forwards;
    }
  `]
})
export class SidebarComponent {
  readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  
  // Track open state locally
  expandedGroups = signal<Record<string, boolean>>({
    'procurement': true,
    'sales': true
  });

  // Determines if a specific sub-view is active
  isActive(view: ViewState): boolean {
    return this.store.currentView() === view;
  }

  // Visual helper: Parent is "active" if one of its children is currently viewed
  isParentActive(group: string): boolean {
    const view = this.store.currentView();
    if (group === 'procurement') return view.startsWith('procurement-');
    if (group === 'sales') return view.startsWith('sales-');
    return false;
  }

  isGroupOpen(group: string): boolean {
    return this.expandedGroups()[group];
  }

  // Handle Parent Click: Toggle Group + Default Navigation
  handleGroupClick(group: 'procurement' | 'sales') {
    const wasOpen = this.expandedGroups()[group];
    
    // Toggle state
    this.expandedGroups.update(curr => ({ ...curr, [group]: !wasOpen }));

    // Auto-select first child if opening
    if (!wasOpen) {
      if (group === 'procurement') this.setView('procurement-orders');
      if (group === 'sales') this.setView('sales-customers');
    }
  }

  setView(view: ViewState) {
    this.store.setView(view);
  }

  logout(): void {
    this.auth.logout();
  }
}
