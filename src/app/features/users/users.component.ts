/**
 * @fileoverview User management and team member administration
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Role } from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';

/**
 * @component UsersComponent
 * @description User account management and role assignment
 * 
 * @features
 * - User CRUD operations
 * - Role assignment and permissions
 * - Invite new members
 * - Activity tracking
 * - Profile management
 * 
 * @dependencies
 * - StoreService: User data and state
 * 
 * @example
 * <app-users></app-users>
 * 
 * @architecture
 * - OnPush change detection
 * - Signal-based modal state
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html'
})
export class UsersComponent {
  // ========================================
  // DEPENDENCIES
  // ========================================
  
  /**
   * Global store for user data
   * @readonly
   */
  protected readonly store = inject(StoreService);
  
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  /**
   * Controls visibility of invite member modal
   * @signal
   */
  readonly showInviteModal = signal(false);
  
  newEmail = '';
  newRole: Role = 'branch_admin';
  selectedBranch = '';

  formatRole(role: string) {
    return role.replace('_', ' ');
  }

  getScopeLabel(user: any): string {
    if (user.role === 'super_admin') return 'Global';
    if (user.branchId) {
      const b = this.store.branches().find(b => b.id === user.branchId);
      return b ? b.name : 'Unknown Branch';
    }
    return 'Unassigned';
  }

  invite() {
    this.store.inviteUser(this.newEmail, this.newRole, this.selectedBranch || undefined);
    this.showInviteModal.set(false);
    this.newEmail = '';
    // Show toast logic here normally
  }
}

