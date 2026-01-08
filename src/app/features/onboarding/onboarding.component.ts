/**
 * @fileoverview Multi-step onboarding wizard for new tenant setup
 * Clean, minimal, centered design
 */

import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Role } from '@core/services/store.service';
import { AuthService } from '@core/services/auth.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { FormsModule } from '@angular/forms';
import { COUNTRIES, CURRENCIES, ONBOARDING_I18N } from '@constants';

declare let XLSX: any;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.component.html',
  styles: [`
    .onboarding {
      min-height: 100vh;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      color: #111;
    }

    .top-bar {
      height: 56px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f0f0f0;
      position: sticky;
      top: 0;
      background: #fff;
      z-index: 100;
    }

    .logo { display: flex; align-items: center; gap: 8px; }

    .logo-icon {
      width: 28px; height: 28px;
      background: #111; border-radius: 6px;
      color: #fff; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
    }

    .logo span { font-size: 15px; font-weight: 600; color: #111; letter-spacing: -0.3px; }

    .top-actions { display: flex; align-items: center; gap: 8px; }

    .icon-btn {
      width: 36px; height: 36px; border: none; background: transparent;
      border-radius: 8px; color: #999; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .icon-btn:hover { background: #f5f5f5; color: #666; }

    .lang-btn {
      height: 32px; padding: 0 12px;
      border: 1px solid #e5e5e5; background: #fff; border-radius: 6px;
      font-size: 13px; color: #666; cursor: pointer; transition: all 0.15s;
    }
    .lang-btn:hover { border-color: #ccc; color: #333; }

    .progress-dots { display: flex; justify-content: center; gap: 8px; padding: 24px 0 16px; }

    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #e0e0e0; transition: all 0.2s;
    }
    .dot.active { background: #111; transform: scale(1.25); }
    .dot.completed { background: #111; }

    .content {
      flex: 1; display: flex; justify-content: center; align-items: center;
      padding: 24px;
      min-height: 0;
    }

    .step-content {
      width: 100%; max-width: 480px;
      animation: fadeIn 0.25s ease-out;
      display: flex; flex-direction: column;
      max-height: calc(100vh - 160px);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .step-content.center {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; min-height: 400px;
    }

    .step-header { margin-bottom: 28px; }
    .step-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.5px; }
    .step-header p { font-size: 15px; color: #666; margin: 0; }

    .hint-box {
      background: #f8f8f8; border-radius: 8px;
      padding: 12px 14px; font-size: 13px; color: #666;
      margin-bottom: 20px;
    }

    .tabs {
      display: flex; gap: 4px;
      background: #f5f5f5; padding: 4px; border-radius: 8px;
      margin-bottom: 20px; width: fit-content;
    }

    .tabs button {
      padding: 8px 16px; border: none; background: transparent;
      border-radius: 6px; font-size: 13px; font-weight: 500;
      color: #666; cursor: pointer; transition: all 0.15s;
    }
    .tabs button.active { background: #fff; color: #111; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

    .form-stack {
      display: flex; flex-direction: column; gap: 16px;
      flex: 1; min-height: 0; overflow: hidden;
    }

    .form-stack-scroll {
      flex: 1; min-height: 0; overflow: hidden;
      display: flex; flex-direction: column; gap: 16px;
    }

    .field { display: flex; flex-direction: column; gap: 6px; }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .field-row { grid-template-columns: 1fr; } }

    .field label { font-size: 13px; font-weight: 500; color: #333; }

    .field input, .field select {
      height: 44px; padding: 0 14px;
      border: 1px solid #e0e0e0; border-radius: 8px;
      font-size: 15px; color: #111; background: #fff;
      transition: all 0.15s; width: 100%;
    }
    .field input:focus, .field select:focus {
      outline: none; border-color: #111;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
    }
    .field input.error { border-color: #e53935; }
    .field input::placeholder { color: #aaa; }

    .field select {
      appearance: none; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 36px;
    }

    .error-text { font-size: 12px; color: #e53935; margin: -8px 0 0; }

    .radio-row { display: flex; gap: 12px; }

    .radio {
      flex: 1; display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border: 1px solid #e0e0e0; border-radius: 8px;
      cursor: pointer; transition: all 0.15s; font-size: 14px; color: #333;
    }
    .radio:hover { border-color: #ccc; }
    .radio.selected { border-color: #111; background: #fafafa; }
    .radio input { display: none; }

    .radio-check {
      width: 16px; height: 16px; border: 2px solid #ccc;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .radio.selected .radio-check { border-color: #111; }
    .radio.selected .radio-check::after {
      content: ''; width: 8px; height: 8px; background: #111; border-radius: 50%;
    }

    .primary-btn {
      height: 48px; padding: 0 24px;
      background: #111; color: #fff; border: none; border-radius: 8px;
      font-size: 15px; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.15s;
    }
    .primary-btn:hover:not(:disabled) { background: #222; }
    .primary-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .primary-btn.large { height: 52px; padding: 0 32px; font-size: 16px; }
    .primary-btn svg { transition: transform 0.15s; }
    .primary-btn:hover:not(:disabled) svg { transform: translateX(2px); }
    [dir="rtl"] .primary-btn:hover:not(:disabled) svg { transform: translateX(-2px); }

    .secondary-btn {
      height: 44px; padding: 0 20px;
      background: #111; color: #fff; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.15s; width: 100%;
    }
    .secondary-btn:hover:not(:disabled) { background: #222; }
    .secondary-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .back-btn {
      background: none; border: none;
      font-size: 14px; color: #666; cursor: pointer;
      padding: 8px 0; transition: color 0.15s;
    }
    .back-btn:hover { color: #111; }

    .skip-btn {
      background: none; border: none;
      font-size: 14px; color: #999; cursor: pointer;
      padding: 8px 12px; transition: color 0.15s;
    }
    .skip-btn:hover { color: #666; }

    .link-btn {
      background: none; border: none;
      font-size: 13px; color: #666; cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0; transition: color 0.15s;
    }
    .link-btn:hover { color: #111; }

    .dropzone {
      border: 2px dashed #e0e0e0; border-radius: 12px;
      padding: 32px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      text-align: center; position: relative; cursor: pointer;
      transition: all 0.15s;
    }
    .dropzone:hover { border-color: #ccc; background: #fafafa; }
    .dropzone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .dropzone svg { color: #999; }
    .dropzone span { font-size: 14px; color: #333; }
    .dropzone .hint { font-size: 12px; color: #999; }

    .item-list {
      border: 1px solid #e8e8e8; border-radius: 10px;
      background: #fff; flex: 1; min-height: 0;
      overflow-y: auto; max-height: 200px;
    }

    .item-list.large { max-height: 180px; }

    .list-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; font-size: 13px; color: #666;
    }

    .list-header strong { color: #111; font-weight: 600; }

    .list-summary {
      background: #f8f8f8; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; color: #666;
      display: flex; align-items: center; gap: 8px;
    }

    .list-summary strong { color: #111; font-weight: 600; }

    .list-toggle {
      background: none; border: none;
      font-size: 12px; color: #666; cursor: pointer;
      padding: 4px 8px; margin-left: auto;
      text-decoration: underline;
    }
    .list-toggle:hover { color: #111; }

    .list-section { display: flex; flex-direction: column; gap: 8px; }

    .list-more {
      padding: 10px 14px;
      font-size: 12px; color: #999;
      text-align: center;
      background: #fafafa;
      border-top: 1px solid #f0f0f0;
    }

    .item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #f5f5f5;
    }
    .item:last-child { border-bottom: none; }

    .item-num {
      width: 24px; height: 24px;
      background: #f0f0f0; border-radius: 50%;
      font-size: 11px; font-weight: 600; color: #666;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .item-avatar {
      width: 32px; height: 32px;
      background: #f0f0f0; border-radius: 50%;
      font-size: 12px; font-weight: 600; color: #666;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase; flex-shrink: 0;
    }

    .item-content { flex: 1; min-width: 0; }
    .item-name { display: block; font-size: 14px; font-weight: 500; color: #111; }
    .item-meta { display: block; font-size: 12px; color: #999; margin-top: 1px; }

    .remove-btn {
      width: 24px; height: 24px;
      background: none; border: none;
      font-size: 18px; color: #ccc; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: all 0.15s;
    }
    .item:hover .remove-btn { opacity: 1; }
    .remove-btn:hover { color: #e53935; }

    .empty {
      border: 2px dashed #e8e8e8; border-radius: 10px;
      padding: 32px; text-align: center;
      font-size: 14px; color: #999;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .empty svg { color: #ddd; }

    .step-footer {
      margin-top: auto; padding-top: 20px;
      border-top: 1px solid #f0f0f0;
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0; background: #fff;
    }

    .footer-actions { display: flex; align-items: center; gap: 8px; }

    /* Provisioning */
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #f0f0f0; border-top-color: #111;
      border-radius: 50%; margin-bottom: 24px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .muted { color: #999 !important; }

    .checklist {
      display: flex; flex-direction: column; gap: 12px;
      text-align: left; width: 100%; max-width: 280px; margin-top: 8px;
    }

    .check-item {
      display: flex; align-items: center; gap: 12px;
      font-size: 14px; color: #999; transition: color 0.2s;
    }
    .check-item.current { color: #666; }
    .check-item.done { color: #111; }

    .check-icon {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
    }

    .success-icon {
      width: 64px; height: 64px;
      background: #111; border-radius: 50%;
      color: #fff; font-size: 28px; font-weight: 300;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 24px;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }

    .modal {
      background: #fff; border-radius: 16px;
      padding: 28px; max-width: 360px; width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    }

    .modal h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    .modal p { font-size: 14px; color: #666; margin: 0 0 24px; }

    .modal-actions { display: flex; gap: 12px; }

    .modal-btn {
      flex: 1; height: 44px; border-radius: 8px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      transition: all 0.15s;
    }

    .modal-btn:not(.danger) {
      background: #fff; border: 1px solid #e0e0e0; color: #333;
    }
    .modal-btn:not(.danger):hover { background: #f5f5f5; }

    .modal-btn.danger {
      background: #e53935; border: none; color: #fff;
    }
    .modal-btn.danger:hover { background: #c62828; }

    /* Error State */
    .error-icon {
      width: 64px; height: 64px;
      background: #fef2f2; border-radius: 50%;
      color: #dc2626; font-size: 28px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 24px;
    }

    .error-title { color: #dc2626; margin-bottom: 8px; }

    .error-details {
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 8px; padding: 12px 16px;
      font-size: 13px; color: #991b1b;
      margin: 16px 0 24px; text-align: center;
      max-width: 320px;
    }

    .error-actions { display: flex; gap: 12px; }

    .retry-btn {
      height: 44px; padding: 0 24px;
      background: #111; color: #fff; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px;
      transition: all 0.15s;
    }
    .retry-btn:hover { background: #222; }
    .retry-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .back-link {
      background: none; border: none;
      font-size: 14px; color: #666; cursor: pointer;
      padding: 12px; transition: color 0.15s;
    }
    .back-link:hover { color: #111; }

    .progress-info {
      font-size: 12px; color: #999;
      margin-top: 16px;
    }
  `]
})
export class OnboardingComponent {
  private readonly auth = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  
  step = signal(1);
  provisionStep = signal(0);
  provisioningComplete = signal(false);
  showSkipConfirmation = signal(false);
  
  // Error handling for provisioning
  provisioningError = signal<string | null>(null);
  errorDetails = signal<string | null>(null);
  isRetrying = signal(false);
  
  language = signal<string>('en'); 
  
  isRtl = computed(() => this.language() === 'ar');
  dir = computed(() => this.isRtl() ? 'rtl' : 'ltr');
  t = computed(() => ONBOARDING_I18N[this.language() as 'en' | 'ar']);

  readonly countriesList = COUNTRIES;
  readonly currenciesList = CURRENCIES;
  readonly currentUser = computed(() => this.auth.user());

  constructor() {
    effect(() => {
      document.documentElement.dir = this.dir();
      document.documentElement.lang = this.language();
    }, { allowSignalWrites: true });

    effect(() => {
      const user = this.currentUser();
      if (user && !this.tenantName) {
        this.tenantName = user.name ? `${user.name}'s Pharmacy` : '';
      }
    }, { allowSignalWrites: true });
  }

  getStepLabel(stepNum: number): string {
    return (this.t().steps as Record<number, string>)[stepNum] || '';
  }

  getLocalizedLabel(item: { label: { en: string; ar: string } }): string {
    return item.label[this.language() as 'en' | 'ar'];
  }

  setLang(l: string) { this.language.set(l); }

  logout(): void {
    if (confirm('Are you sure you want to sign out?')) {
      this.auth.logout();
    }
  }

  // Form Data
  tenantName = '';
  country = 'Yemen';
  currency = 'YER';

  branchList = signal<{name: string, location: string}[]>([]);
  inputBranchName = '';
  inputBranchLocation = '';
  cityError = signal(false);
  branchBulkMode = signal(false);
  showBranchList = signal(true);
  
  // Computed for large lists
  hasManyBranches = computed(() => this.branchList().length > 20);
  branchDisplayList = computed(() => {
    const all = this.branchList();
    if (!this.showBranchList() || all.length <= 5) return all;
    return all.slice(0, 5);
  });

  availableCities = computed(() => {
    const countryData = COUNTRIES.find(c => c.value === this.country);
    if (!countryData) return [];
    return countryData.cities[this.language() as 'en' | 'ar'];
  });

  validateCity() {
    const city = this.inputBranchLocation.trim();
    if (!city) { this.cityError.set(false); return; }
    const cities = this.availableCities().map(c => c.toLowerCase());
    this.cityError.set(!cities.some(c => c === city.toLowerCase()));
  }

  bulkMode = signal(false);
  fileProcessing = signal(false);
  teamMembers = signal<{name: string, email: string, role: Role, branchIndex: number}[]>([]);
  newMemberName = '';
  newMemberEmail = '';
  newMemberRole: Role = 'branch_admin';
  newMemberBranchIndex = 0;
  showTeamList = signal(true);
  
  // Computed for large team lists
  hasManyTeamMembers = computed(() => this.teamMembers().length > 20);
  teamDisplayList = computed(() => {
    const all = this.teamMembers();
    if (!this.showTeamList() || all.length <= 5) return all;
    return all.slice(0, 5);
  });

  createdBranchIds: string[] = [];

  addLocalBranch() {
    this.validateCity();
    if (this.cityError()) return;
    if (this.inputBranchName && this.inputBranchLocation) {
      this.branchList.update(list => [...list, { name: this.inputBranchName, location: this.inputBranchLocation }]);
      this.inputBranchName = '';
      this.inputBranchLocation = '';
    }
  }

  removeLocalBranch(index: number) {
    this.branchList.update(list => list.filter((_, i) => i !== index));
  }

  handleBranchFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileProcessing.set(true);
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const newBranches: any[] = [];
      jsonData.forEach((row: any) => {
        const name = row['Name'] || row['name'] || row['Branch Name'];
        const location = row['Location'] || row['location'] || row['City'];
        if (name && location) newBranches.push({ name, location });
      });
      if (newBranches.length > 0) this.branchList.update(list => [...list, ...newBranches]);
      this.fileProcessing.set(false);
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  downloadBranchSample() {
    const data = [{ Name: 'Main Branch', Location: 'Sana\'a' }, { Name: 'Branch 2', Location: 'Aden' }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    XLSX.writeFile(wb, "branch_template.xlsx");
  }

  nextStep() {
    if (this.step() === 1) this.step.set(2);
    else if (this.step() === 2) { this.newMemberBranchIndex = 0; this.step.set(3); }
  }

  addTeamMember() {
    if (this.newMemberName && this.newMemberEmail) {
      this.teamMembers.update(members => [
        ...members, 
        { name: this.newMemberName, email: this.newMemberEmail, role: this.newMemberRole, branchIndex: Number(this.newMemberBranchIndex) }
      ]);
      this.newMemberName = '';
      this.newMemberEmail = '';
      this.newMemberRole = 'branch_admin';
    }
  }

  handleFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileProcessing.set(true);
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const newMembers: any[] = [];
      jsonData.forEach((row: any) => {
        const name = row['Name'] || row['name'] || row['Full Name'];
        const email = row['Email'] || row['email'];
        const roleRaw = row['Role'] || row['role'];
        const branchRaw = row['Branch'] || row['branch'];
        if (email) {
          let role: Role = 'section_admin';
          if (roleRaw?.toLowerCase().includes('manager') || roleRaw?.toLowerCase().includes('admin')) role = 'branch_admin';
          let bIndex = 0;
          if (branchRaw) {
            const foundIndex = this.branchList().findIndex(b => b.name.toLowerCase() === String(branchRaw).toLowerCase());
            if (foundIndex >= 0) bIndex = foundIndex;
          }
          newMembers.push({ name: name || email.split('@')[0], email, role, branchIndex: bIndex });
        }
      });
      if (newMembers.length > 0) this.teamMembers.update(m => [...m, ...newMembers]);
      this.fileProcessing.set(false);
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  downloadSample() {
    const branches = this.branchList();
    const data: any[] = [];
    
    // Create empty rows for each branch (Name and Email left blank for user to fill)
    if (branches.length === 0) {
      // No branches yet - create sample rows with placeholder branch
      data.push({ Name: '', Email: '', Role: '', Branch: 'Branch 1' });
      data.push({ Name: '', Email: '', Role: '', Branch: 'Branch 1' });
    } else {
      // One row per branch for user to fill in
      branches.forEach((branch) => {
        data.push({ Name: '', Email: '', Role: '', Branch: branch.name });
      });
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths for better UX
    ws['!cols'] = [
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 18 }, // Role
      { wch: 25 }, // Branch
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Team");
    
    // Add a "Roles" reference sheet with valid role options
    const rolesData = [
      { 'Valid Roles': 'branch_admin', 'Description': 'Branch Manager - Full branch access' },
      { 'Valid Roles': 'section_admin', 'Description': 'Staff Member - Limited access' }
    ];
    const rolesSheet = XLSX.utils.json_to_sheet(rolesData);
    rolesSheet['!cols'] = [{ wch: 15 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, rolesSheet, "Roles Reference");
    
    // Add a "Branches" reference sheet if branches exist
    if (branches.length > 0) {
      const branchesData = branches.map((b, i) => ({ 
        '#': i + 1, 
        'Branch Name': b.name, 
        'Location': b.location 
      }));
      const branchesSheet = XLSX.utils.json_to_sheet(branchesData);
      branchesSheet['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, branchesSheet, "Branches List");
    }
    
    XLSX.writeFile(wb, "team_import_template.xlsx");
  }

  removeTeamMember(index: number) {
    this.teamMembers.update(members => members.filter((_, i) => i !== index));
  }

  getBranchNameLocal(idx: number) {
    return this.branchList()[idx]?.name || 'Unassigned';
  }

  handleSkip() {
    if (this.teamMembers().length > 0) this.showSkipConfirmation.set(true);
    else this.startProvisioning();
  }

  confirmSkip() {
    this.teamMembers.set([]);
    this.showSkipConfirmation.set(false);
    this.startProvisioning();
  }

  cancelSkip() { this.showSkipConfirmation.set(false); }

  startProvisioning(isRetry = false) {
    if (this.branchList().length === 0) {
      alert('Please add at least one branch.');
      this.step.set(2);
      return;
    }

    this.step.set(4);
    this.provisionStep.set(1);
    this.provisioningError.set(null);
    this.errorDetails.set(null);
    this.isRetrying.set(isRetry);

    this.onboardingService.completeOnboarding(
      { name: this.tenantName, country: this.country, currency: this.currency, language: this.language() },
      this.branchList(),
      this.teamMembers()
    ).subscribe({
      next: (result) => {
        this.createdBranchIds = result.branches.map(b => b.id);
        this.provisionStep.set(2);
        setTimeout(() => this.provisionStep.set(3), 500);
        setTimeout(() => { this.provisionStep.set(4); this.provisioningComplete.set(true); }, 1000);
        this.isRetrying.set(false);
      },
      error: (error) => {
        console.error('[Onboarding] Setup failed:', error);
        console.error('[Onboarding] Error details:', JSON.stringify(error, null, 2));
        this.isRetrying.set(false);
        
        // Parse error message with better extraction
        let errorMsg = 'An unexpected error occurred';
        let details = '';
        
        if (error.status === 0) {
          errorMsg = 'Connection failed';
          details = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.status === 401) {
          errorMsg = 'Session expired';
          details = 'Your login session has expired. Please log in again.';
        } else if (error.status === 403) {
          errorMsg = 'Access denied';
          details = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
          errorMsg = 'Endpoint not found';
          details = `The API endpoint could not be found. Status: ${error.status}`;
        } else if (error.status === 413) {
          errorMsg = 'Request too large';
          details = `Too many items to process at once. Try with fewer branches (${this.branchList().length} branches).`;
        } else if (error.status === 500) {
          errorMsg = 'Server error';
          details = error.error?.message || error.error?.title || 'An internal server error occurred. Please try again.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timed out';
          details = 'The server took too long to respond. Your setup may still be in progress.';
        } else if (error.status === 429) {
          errorMsg = 'Too many requests';
          details = 'Please wait a moment and try again.';
        } else if (error.error?.message) {
          errorMsg = 'Setup failed';
          details = error.error.message;
        } else if (error.error?.title) {
          errorMsg = 'Setup failed';
          details = error.error.title;
        } else if (typeof error.error === 'string') {
          errorMsg = 'Setup failed';
          details = error.error;
        } else if (error.message && error.message !== 'Unknown error') {
          errorMsg = 'Setup failed';
          details = error.message;
        } else {
          // Fallback - show status code if available
          details = error.status ? `Server returned status ${error.status}` : 'Please check your connection and try again.';
        }
        
        this.provisioningError.set(errorMsg);
        this.errorDetails.set(details);
      }
    });
  }

  retryProvisioning() {
    this.startProvisioning(true);
  }

  goBackFromError() {
    this.provisioningError.set(null);
    this.errorDetails.set(null);
    this.provisionStep.set(0);
    this.step.set(1);
  }

  finish() {
    // SuperAdmin should always be able to proceed after provisioning
    // Even if they skipped team assignment
    console.log('[Onboarding] Finish clicked, calling completeOnboarding');
    console.log('[Onboarding] Created branches during this session:', this.createdBranchIds.length);
    this.auth.completeOnboarding();
  }
}
