/**
 * @fileoverview Application settings and configuration management
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, Role } from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';
import { FormsModule } from '@angular/forms';

type SettingsTab = 'general' | 'branches' | 'team' | 'security' | 'data';

/**
 * @component SettingsComponent
 * @description System settings and configuration interface
 * 
 * @features
 * - General application settings
 * - Branch management
 * - Team and access control
 * - Security preferences
 * - Data management and exports
 * 
 * @dependencies
 * - StoreService: Settings and configuration state
 * 
 * @example
 * <app-settings></app-settings>
 * 
 * @architecture
 * - OnPush change detection
 * - Tab-based navigation
 * - Signal-based state
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html'
})
export class SettingsComponent {
  store = inject(StoreService);
  activeTab = signal<SettingsTab>('general');

  newEmployee = {
    name: '',
    email: '',
    role: 'branch_admin' as Role,
    branchId: ''
  };

  updateOrg(field: string, value: any) {
    this.store.updateTenant({ [field]: value });
  }

  getBranchName(branchId?: string) {
    if (!branchId) return 'Global (All Branches)';
    return this.store.branches().find(b => b.id === branchId)?.name || 'Unknown';
  }

  addEmployee() {
    this.store.inviteUser(this.newEmployee.email, this.newEmployee.role, this.newEmployee.branchId);
    // Reset form
    this.newEmployee = {
      name: '',
      email: '',
      role: 'branch_admin',
      branchId: ''
    };
  }
}

