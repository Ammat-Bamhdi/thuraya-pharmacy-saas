/**
 * @fileoverview Sales management and CRM interface
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, Customer, Invoice } from '@core/services/store.service';
import { DataService } from '@core/services/data.service';
import { IconComponent } from '@shared/components/icons/icons.component';
import { FormsModule } from '@angular/forms';
import { YEMEN_LOCATIONS } from '@constants/locations.const';

/**
 * @component SalesComponent
 * @description Sales history, customer relationship management, and invoice tracking
 * 
 * @features
 * - Customer database management
 * - Invoice history and search
 * - Sales analytics and reporting
 * - Customer type pricing (Retail/Wholesale/Hospital)
 * - Export functionality
 * - Multi-branch sales tracking
 * 
 * @dependencies
 * - StoreService: Sales and customer data
 * - YEMEN_LOCATIONS: Address data
 * 
 * @example
 * <app-sales></app-sales>
 * 
 * @architecture
 * - OnPush change detection for performance
 * - Signal-based reactive state
 * - Computed filtered lists
 * - Tab-based navigation
 * 
 * @performance
 * - Optimized for large invoice lists
 * - Debounced search
 * - Computed filtering
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales.component.html'
})
export class SalesComponent {
  store = inject(StoreService);
  private readonly dataService = inject(DataService);
  Math = Math;
  
  // Saving state
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Active Tab derived from global state
  activeTab = computed(() => {
      const view = this.store.currentView();
      if (view === 'sales-customers' || view === 'sales-invoices') {
          return view;
      }
      return 'sales-customers'; // Default fallback
  });

  showCustomerModal = signal(false);
  showInvoiceModal = signal(false);
  
  // Branch Context
  selectedBranchId = signal<string>(''); 
  showBranchMenu = signal(false);

  // Table State
  searchQuery = signal('');
  customerTypeFilter = signal('All');
  invoiceStatusFilter = signal('All');
  
  pageSize = signal(10);
  currentPage = signal(1);
  sortConfig = signal<{key: string, direction: 'asc' | 'desc'}>({ key: 'name', direction: 'asc' }); 

  activeActionRow = signal<string | null>(null);
  actionMenuPosition = signal<{x: number, y: number}>({x: 0, y: 0});
  showColumnMenu = signal(false);

  editingId = signal<string | null>(null);
  selectedInvoice = signal<Invoice | null>(null);

  // Columns
  allCustomerColumns = [
    { key: 'name', label: 'Customer', visible: true },
    { key: 'type', label: 'Type', visible: true },
    { key: 'phone', label: 'Phone', visible: true },
    { key: 'email', label: 'Email', visible: false },
    { key: 'creditLimit', label: 'Limit', visible: true },
    { key: 'balance', label: 'Balance / Usage', visible: true },
    { key: 'city', label: 'City', visible: true },
  ];

  allInvoiceColumns = [
    { key: 'id', label: 'Invoice #', visible: true },
    { key: 'customerId', label: 'Customer', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'total', label: 'Amount', visible: true },
  ];

  custColVisibility = signal<Record<string, boolean>>(
    this.allCustomerColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.visible }), {})
  );

  invColVisibility = signal<Record<string, boolean>>(
    this.allInvoiceColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.visible }), {})
  );

  visibleCustomerColumns = computed(() => this.allCustomerColumns.filter(c => this.custColVisibility()[c.key]));
  visibleInvoiceColumns = computed(() => this.allInvoiceColumns.filter(c => this.invColVisibility()[c.key]));

  // --- Location Data ---
  yemenGovernorates = Object.keys(YEMEN_LOCATIONS).sort();
  availableDistricts = signal<string[]>([]);

  // New Customer Form Model
  newCustomer: Partial<Customer> = { 
    name: '', 
    companyName: '',
    phone: '', 
    email: '', 
    type: 'Standard', 
    billingAddress: '',
    city: '',
    state: '',
    country: 'Yemen',
    paymentTerms: 'Immediate',
    creditLimit: 0,
    priceGroup: 'Retail',
    assignedSalesRep: '',
    source: 'Walk-in',
    communicationPrefs: [],
    notes: '',
    bankAccount: ''
  };

  // Validation State
  formErrors = signal<Record<string, string>>({
    name: '', companyName: '', phone: '', email: '', creditLimit: '', state: '', city: '', billingAddress: '', assignedSalesRep: '', emailPref: ''
  });

  constructor() {
      // Default branch init
      effect(() => {
          const branches = this.store.branches();
          if (branches.length > 0 && !this.selectedBranchId()) {
              this.selectedBranchId.set(branches[0].id);
          }
      });
  }

  validateField(field: string) {
    const c = this.newCustomer;
    this.formErrors.update(errors => {
        const newErrors = { ...errors };
        switch(field) {
            case 'name':
                newErrors.name = !c.name ? 'Full Name is required' : '';
                break;
            case 'companyName':
                newErrors.companyName = !c.companyName ? 'Company Name is required' : '';
                break;
            case 'phone':
                newErrors.phone = !c.phone ? 'Phone is required' : '';
                break;
            case 'email':
                newErrors.email = (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) ? 'Invalid email format' : '';
                if (!c.email && c.communicationPrefs?.includes('Email')) {
                    newErrors.emailPref = 'Email is required for Email preference';
                } else {
                    newErrors.emailPref = '';
                }
                break;
            case 'creditLimit':
                newErrors.creditLimit = (c.creditLimit! < 0) ? 'Credit limit cannot be negative' : '';
                break;
            case 'state':
                newErrors.state = !c.state ? 'State/Governorate is required' : '';
                break;
            case 'city':
                newErrors.city = !c.city ? 'City is required' : '';
                break;
            case 'billingAddress':
                newErrors.billingAddress = !c.billingAddress ? 'Address is required' : '';
                break;
            case 'assignedSalesRep':
                newErrors.assignedSalesRep = !c.assignedSalesRep ? 'Sales Rep is required' : '';
                break;
        }
        return newErrors;
    });
  }

  // Logic
  onCountryChange() {
      this.newCustomer.state = '';
      this.newCustomer.city = '';
      this.availableDistricts.set([]);
      this.validateField('state');
  }

  onStateChange() {
      const state = this.newCustomer.state || '';
      if (this.newCustomer.country === 'Yemen' && YEMEN_LOCATIONS[state]) {
          this.availableDistricts.set(YEMEN_LOCATIONS[state]);
      } else {
          this.availableDistricts.set([]);
      }
      this.newCustomer.city = '';
      this.validateField('state');
      this.validateField('city');
  }

  // Computed form validation with memoization
  isFormValid = computed(() => {
    const errors = this.formErrors();
    const hasVisibleErrors = Object.values(errors).some(val => val !== '');
    if (hasVisibleErrors) return false;

    const c = this.newCustomer;
    
    // Required fields check (All except email, bankAccount, notes)
    if (!c.name || !c.companyName || !c.phone || !c.type) return false;
    if (!c.billingAddress || !c.city || !c.state || !c.country) return false;
    if (!c.source || !c.assignedSalesRep || !c.priceGroup || !c.paymentTerms) return false;
    
    if (c.creditLimit! < 0) return false;
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return false;
    if (c.communicationPrefs?.includes('Email') && !c.email) return false;

    return true;
  });

  togglePref(pref: string) {
    const current = this.newCustomer.communicationPrefs || [];
    if (pref === 'Email' && !this.newCustomer.email && !current.includes('Email')) return; 

    if (current.includes(pref)) {
        this.newCustomer.communicationPrefs = current.filter(p => p !== pref);
    } else {
        this.newCustomer.communicationPrefs = [...current, pref];
    }
    
    if (pref === 'Email') this.validateField('email');
  }

  hasPref(pref: string) {
      return this.newCustomer.communicationPrefs?.includes(pref);
  }

  // Computed Data - Split into separate computeds for better memoization
  filteredCustomers = computed(() => {
    const search = this.searchQuery().toLowerCase();
    const sort = this.sortConfig();
    const type = this.customerTypeFilter();
    let data = [...this.store.customers()];
    
    data = data.filter(c => {
      const matchesSearch = !search || c.name.toLowerCase().includes(search) || c.phone.includes(search);
      const matchesType = type === 'All' || c.type === type;
      return matchesSearch && matchesType;
    });

    data.sort((a, b) => this.compareValues(a, b, sort));
    return data;
  });

  filteredInvoices = computed(() => {
    const search = this.searchQuery().toLowerCase();
    const sort = this.sortConfig();
    const status = this.invoiceStatusFilter();
    const branchId = this.selectedBranchId();
    let data = [...this.store.invoices()];
    
    // Filter by branch
    if (branchId) data = data.filter(i => i.branchId === branchId);
    
    // Filter by status and search
    data = data.filter(i => {
      const matchesSearch = !search || i.id.toLowerCase().includes(search) || 
        this.getCustomerName(i.customerId).toLowerCase().includes(search);
      const matchesStatus = status === 'All' || i.status === status;
      return matchesSearch && matchesStatus;
    });

    data.sort((a, b) => this.compareValues(a, b, sort));
    return data;
  });

  // Main filtered data computed based on active tab
  filteredData = computed(() => {
    return this.activeTab() === 'sales-customers' ? this.filteredCustomers() : this.filteredInvoices();
  });

  paginatedData = computed(() => {
     const start = (this.currentPage() - 1) * this.pageSize();
     return (this.filteredData() as any[]).slice(start, start + this.pageSize());
  });

  // Helpers
  compareValues(a: any, b: any, sort: {key: string, direction: 'asc' | 'desc'}) {
      let aVal = a[sort.key];
      let bVal = b[sort.key];
      
      if (sort.key === 'customerId') {
          aVal = this.getCustomerName(a.customerId);
          bVal = this.getCustomerName(b.customerId);
      }

      if (typeof aVal === 'string') {
          return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
  }

  getCustomerName(id: string) {
    return this.store.customers().find(c => c.id === id)?.name || 'Unknown';
  }

  getBranchName(id: string) { return this.store.branches().find(b => b.id === id)?.name || 'Unknown'; }

  getCustomerAddress(id: string) {
    return this.store.customers().find(c => c.id === id)?.billingAddress || 'No address provided';
  }

  getProductName(id: string) {
      return this.store.products().find(p => p.id === id)?.name || 'Product';
  }

  getCustomerValue(c: Customer, key: string): any { return (c as any)[key]; }
  getInvoiceValue(i: Invoice, key: string): any { return (i as any)[key]; }

  isNumericCol(key: string) {
      return ['creditLimit', 'balance', 'total'].includes(key);
  }

  getInitials(name: string) {
      if(!name) return '??';
      const parts = name.split(' ');
      if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
  }

  // Actions
  toggleColumnMenu(e: Event) {
    e.stopPropagation();
    this.showColumnMenu.update(v => !v);
  }

  toggleColumn(key: string) {
    if (this.activeTab() === 'sales-customers') {
        this.custColVisibility.update(v => ({...v, [key]: !v[key]}));
    } else {
        this.invColVisibility.update(v => ({...v, [key]: !v[key]}));
    }
  }

  sort(key: string) {
    const current = this.sortConfig();
    this.sortConfig.set({ key, direction: (current.key === key && current.direction === 'asc') ? 'desc' : 'asc' });
  }

  changePage(delta: number) {
    const newPage = this.currentPage() + delta;
    const maxPage = Math.ceil(this.filteredData().length / this.pageSize());
    if (newPage >= 1 && newPage <= maxPage) {
       this.currentPage.set(newPage);
    }
  }

  openCustomerModal() {
    this.editingId.set(null);
    this.newCustomer = { 
        name: '', companyName: '', phone: '', email: '', type: 'Standard', billingAddress: '',
        city: '', state: '', country: 'Yemen', paymentTerms: 'Immediate', creditLimit: 0,
        priceGroup: 'Retail', assignedSalesRep: '', source: 'Walk-in', communicationPrefs: [], notes: '', bankAccount: ''
    };
    this.formErrors.set({name: '', companyName: '', phone: '', email: '', creditLimit: '', state: '', city: '', billingAddress: '', assignedSalesRep: '', emailPref: ''});
    this.availableDistricts.set([]);
    this.showCustomerModal.set(true);
  }

  editCustomer(id: string) {
      const c = this.store.customers().find(cust => cust.id === id);
      if (c) {
          this.editingId.set(id);
          this.newCustomer = { ...c };
          
          // Re-trigger location logic for dropdowns
          if (c.country === 'Yemen' && c.state && YEMEN_LOCATIONS[c.state]) {
              this.availableDistricts.set(YEMEN_LOCATIONS[c.state]);
          } else {
              this.availableDistricts.set([]);
          }

          // Reset errors for a clean state (assuming data is valid, or validation will catch it on save)
          this.formErrors.set({name: '', companyName: '', phone: '', email: '', creditLimit: '', state: '', city: '', billingAddress: '', assignedSalesRep: '', emailPref: ''});
          this.showCustomerModal.set(true);
      }
  }

  saveCustomer() {
    if(this.isFormValid()) {
      this.saving.set(true);
      this.errorMessage.set(null);
      
      if (this.editingId()) {
          // Update existing customer via API
          this.dataService.updateCustomer(this.editingId()!, this.newCustomer).subscribe({
            next: () => {
              this.saving.set(false);
              this.showCustomerModal.set(false);
            },
            error: (err) => {
              this.saving.set(false);
              this.errorMessage.set(err.message || 'Failed to update customer');
            }
          });
      } else {
          // Create new customer via API
          this.dataService.createCustomer(this.newCustomer).subscribe({
            next: () => {
              this.saving.set(false);
              this.showCustomerModal.set(false);
            },
            error: (err) => {
              this.saving.set(false);
              this.errorMessage.set(err.message || 'Failed to create customer');
            }
          });
      }
    }
  }

  viewInvoice(id: string) {
      const inv = this.store.invoices().find(i => i.id === id);
      if (inv) {
          this.selectedInvoice.set(inv);
          this.showInvoiceModal.set(true);
      }
  }

  updateInvoiceStatus(id: string, status: any) {
      this.store.updateInvoice(id, { status });
      // Update local view immediately for smoother UX
      this.selectedInvoice.update(curr => curr ? ({ ...curr, status }) : null);
  }

  closeInvoiceModal() {
      this.showInvoiceModal.set(false);
      this.selectedInvoice.set(null);
  }

  openActionMenu(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (this.activeActionRow() === id) { this.closeActionMenu(); return; }

    const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 192; 
    const x = buttonRect.right - menuWidth;
    let y = buttonRect.bottom + 5;
    if (y + 100 > window.innerHeight) y = buttonRect.top - 100;

    this.actionMenuPosition.set({ x, y });
    this.activeActionRow.set(id);
    this.showColumnMenu.set(false);
  }

  closeActionMenu() {
    this.activeActionRow.set(null);
    this.showColumnMenu.set(false);
  }
}

