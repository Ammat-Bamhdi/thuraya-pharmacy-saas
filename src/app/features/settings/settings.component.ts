/**
 * @fileoverview Application settings and configuration management
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, Role } from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';
import { FormsModule } from '@angular/forms';

type SettingsTab = 'general' | 'branches' | 'team' | 'security' | 'data';

/**
 * @component SettingsComponent
 * @description System settings and configuration interface
 * Production-ready with proper state management
 * 
 * @version 2.0.0
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

  // Computed values for current organization data
  orgName = computed(() => this.store.tenant()?.name || '');
  orgCountry = computed(() => this.store.tenant()?.country || 'Saudi Arabia');
  orgCurrency = computed(() => this.store.tenant()?.currency || 'SAR');
  orgLanguage = computed(() => this.store.tenant()?.language || 'en');

  // Form state for editing
  editedName = signal('');
  editedCountry = signal('');
  editedCurrency = signal('');
  isSaving = signal(false);
  saveSuccess = signal(false);

  newEmployee = {
    name: '',
    email: '',
    role: 'branch_admin' as Role,
    branchId: ''
  };

  constructor() {
    // Initialize edit fields with current values when component loads
    // Using setTimeout to ensure store is populated
    setTimeout(() => this.resetEditFields(), 0);
  }

  resetEditFields(): void {
    this.editedName.set(this.orgName());
    this.editedCountry.set(this.orgCountry());
    this.editedCurrency.set(this.orgCurrency());
  }

  updateOrg(field: string, value: string): void {
    // Update local signal immediately for responsive UI
    if (field === 'name') this.editedName.set(value);
    if (field === 'country') this.editedCountry.set(value);
    if (field === 'currency') this.editedCurrency.set(value);
    
    // Update store
    this.store.updateTenant({ [field]: value });
    
    // Show save feedback
    this.showSaveSuccess();
  }

  private showSaveSuccess(): void {
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 2000);
  }

  getBranchName(branchId?: string): string {
    if (!branchId) return 'Global (All Branches)';
    return this.store.branches().find(b => b.id === branchId)?.name || 'Unknown';
  }

  addEmployee(): void {
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

