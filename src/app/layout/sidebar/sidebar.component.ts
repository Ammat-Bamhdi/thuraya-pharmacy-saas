/**
 * @fileoverview Navigation sidebar with route management
 * Production-ready with accessibility, logout confirmation, and clean UX
 * 
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, ViewState } from '@core/services/store.service';
import { AuthService } from '@core/services/auth.service';
import { IconComponent } from '@shared/components/icons/icons.component';

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
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fade-in {
      animation: fadeIn 0.15s ease-out forwards;
    }
    .animate-scale-in {
      animation: scaleIn 0.15s ease-out forwards;
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

  // Logout confirmation modal
  showLogoutModal = signal(false);
  isLoggingOut = signal(false);

  // User menu dropdown
  showUserMenu = signal(false);

  // Get user initials for avatar fallback
  get userInitials(): string {
    const name = this.store.currentUser()?.name || 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Get organization display name
  get organizationName(): string {
    return this.store.tenant()?.name || 'Organization';
  }

  // Get user display name
  get userName(): string {
    return this.store.currentUser()?.name || 'User';
  }

  // Get user avatar
  get userAvatar(): string | null {
    return this.store.currentUser()?.avatar || null;
  }

  // Get user role for display
  get userRole(): string {
    const role = this.store.currentUser()?.role;
    switch (role) {
      case 'super_admin': return 'Administrator';
      case 'branch_admin': return 'Branch Manager';
      case 'section_admin': return 'Staff';
      default: return 'User';
    }
  }

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
    this.showUserMenu.set(false);
  }

  // Toggle user menu
  toggleUserMenu(): void {
    this.showUserMenu.update(v => !v);
  }

  // Close user menu when clicking outside
  closeUserMenu(): void {
    this.showUserMenu.set(false);
  }

  // Open logout confirmation modal
  openLogoutModal(): void {
    this.showUserMenu.set(false);
    this.showLogoutModal.set(true);
  }

  // Close logout confirmation modal
  closeLogoutModal(): void {
    this.showLogoutModal.set(false);
  }

  // Confirm logout
  confirmLogout(): void {
    this.isLoggingOut.set(true);
    // Small delay for visual feedback
    setTimeout(() => {
      this.auth.logout();
      this.showLogoutModal.set(false);
      this.isLoggingOut.set(false);
    }, 300);
  }
}
