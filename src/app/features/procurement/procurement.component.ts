/**
 * @fileoverview Procurement Module - Optimized for Angular 18+
 * @description Purchase orders, bills, and supplier management with signals
 */

import { 
  Component, 
  inject, 
  signal, 
  computed, 
  effect, 
  ChangeDetectionStrategy,
  DestroyRef,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  StoreService, 
  Supplier, 
  PurchaseOrder, 
  POStatus, 
  PurchaseBill, 
  PaymentRecord 
} from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';
import { 
  FormBuilder, 
  ReactiveFormsModule, 
  Validators, 
  FormsModule 
} from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// ============================================================================
// INTERFACES
// ============================================================================

interface POItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
  isNetworkImport?: boolean;
  productDetails?: ProductOption;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price?: number;
  margin?: number;
  category: string;
  supplierId: string;
  branchId?: string;
  stock?: number;
  existsInTarget?: boolean;
  targetStock?: number;
  otherBranches?: string[];
  branchNames?: string[];
}

interface QuickProduct {
  name: string;
  sku: string;
  cost: number;
  price: number;
  category: string;
}

interface MenuPosition {
  x: number;
  y: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, IconComponent, ReactiveFormsModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './procurement.component.html'
})
export class ProcurementComponent {
  // -------------------------------------------------------------------------
  // DEPENDENCIES (private readonly for tree-shaking)
  // -------------------------------------------------------------------------
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly store = inject(StoreService);
  
  // Local signal to track current view for template reactivity with OnPush
  readonly currentView = signal(this.store.currentView());

  // -------------------------------------------------------------------------
  // REACTIVE STATE - UI Signals
  // -------------------------------------------------------------------------
  
  // Tab state derived from global view
  readonly activeTab = computed(() => {
    const view = this.store.currentView();
    return view.startsWith('procurement-') ? view : 'procurement-orders';
  });

  // Modal visibility
  readonly showSupplierModal = signal(false);
  readonly showPOModal = signal(false);
  readonly showReceiveModal = signal(false);
  readonly showDeactivateModal = signal(false);
  readonly showReceiptModal = signal(false);
  readonly showQuickProductModal = signal(false);
  readonly showBranchMenu = signal(false);
  readonly showProductDropdown = signal(false);

  // Branch context
  readonly selectedBranchId = signal('');

  // Editing state
  readonly editingId = signal<string | null>(null);
  readonly editingPOId = signal<string | null>(null);
  readonly editingBillId = signal<string | null>(null);
  
  // Non-signal state (simpler for temporary values)
  activeReceivePOId: string | null = null;
  activeDeactivateId: string | null = null;

  // Document viewer
  readonly selectedReceiptUrl = signal<string | null>(null);
  readonly selectedReceiptName = signal('');
  readonly viewerTitle = signal('Document Viewer');

  // Action menu
  readonly activeActionRow = signal<string | null>(null);
  readonly actionMenuPosition = signal<MenuPosition>({ x: 0, y: 0 });

  // Filters
  readonly searchText = signal('');
  readonly poSearchText = signal('');
  readonly billSearchText = signal('');
  readonly poStatusFilter = signal('All');
  readonly billStatusFilter = signal('All');

  // Upload state
  readonly uploadedFileName = signal('');
  readonly tempFileUrl = signal<string | null>(null);
  readonly billUploadedName = signal('');
  readonly billTempUrl = signal<string | null>(null);

  // PO Builder
  readonly poItems = signal<POItem[]>([]);
  readonly poTaxRate = signal(0);
  readonly poDiscount = signal(0);

  // Product search
  readonly searchQueryInternal = signal('');
  readonly selectedProduct = signal<ProductOption | null>(null);
  readonly selectedSupplierId = signal('');
  readonly selectedBranchIdForPO = signal('');
  readonly optimizedProductOptions = signal<ProductOption[]>([]);
  searchCategory = 'All';

  // Quick product form
  quickProduct: QuickProduct = { name: '', sku: '', cost: 0, price: 0, category: 'General' };

  // -------------------------------------------------------------------------
  // FORMS (lazy initialization)
  // -------------------------------------------------------------------------
  
  readonly supplierForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    contactPerson: [''],
    email: [''],
    phone: [''],
    address: [''],
    city: [''],
    country: ['Yemen'],
    paymentTerms: ['Net 30'],
    creditLimit: [0],
    rating: [5],
    status: [true],
    category: ['Pharmaceuticals']
  });

  readonly poForm = this.fb.nonNullable.group({
    supplierId: ['', Validators.required],
    branchId: ['', Validators.required],
    date: [this.today],
    expectedDeliveryDate: [''],
    status: ['Draft', Validators.required],
    shippingAddress: [''],
    termsConditions: [''],
    createdBy: [''],
    assignedTo: ['']
  });

  readonly receiveForm = this.fb.nonNullable.group({
    billNumber: ['', Validators.required],
    billDate: [this.today, Validators.required],
    dueDate: [this.today, Validators.required],
    receivedDate: [this.today],
    assignedTo: [''],
    attachmentName: [''],
    attachmentUrl: ['']
  });

  readonly paymentForm = this.fb.nonNullable.group({
    date: [this.today, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['Cash', Validators.required],
    reference: [''],
    attachmentName: [''],
    fileUrl: ['']
  });

  // -------------------------------------------------------------------------
  // COMPUTED VALUES (memoized, only recalculate on dependency change)
  // -------------------------------------------------------------------------

  readonly activeBill = computed(() => 
    this.store.bills().find(b => b.id === this.editingBillId())
  );

  readonly remainingBalance = computed(() => {
    const bill = this.activeBill();
    return bill ? Math.max(0, bill.totalAmount - bill.paidAmount) : 0;
  });

  readonly pendingPOs = computed(() =>
    this.store.purchaseOrders().filter(po => 
      po.status !== 'Closed' && po.status !== 'Cancelled'
    )
  );

  readonly filteredSuppliers = computed(() => {
    const search = this.searchText().toLowerCase();
    return search
      ? this.store.suppliers().filter(s => s.name.toLowerCase().includes(search))
      : this.store.suppliers();
  });

  readonly filteredPOs = computed(() => {
    const branchId = this.selectedBranchId();
    const search = this.poSearchText().toLowerCase();
    const status = this.poStatusFilter();

    return this.store.purchaseOrders()
      .filter(po => {
        if (branchId && po.branchId !== branchId) return false;
        if (status !== 'All' && po.status !== status) return false;
        if (search && !po.id.toLowerCase().includes(search) && 
            !this.getSupplierName(po.supplierId).toLowerCase().includes(search)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly filteredBills = computed(() => {
    const branchId = this.selectedBranchId();
    const search = this.billSearchText().toLowerCase();
    const status = this.billStatusFilter();
    
    const branchPOIds = new Set(
      this.store.purchaseOrders()
        .filter(p => p.branchId === branchId)
        .map(p => p.id)
    );

    return this.store.bills()
      .filter(b => {
        if (!branchPOIds.has(b.poId)) return false;
        if (status !== 'All' && b.status !== status) return false;
        if (search && 
            !b.billNumber.toLowerCase().includes(search) &&
            !this.getSupplierName(b.supplierId).toLowerCase().includes(search) &&
            !b.poId.toLowerCase().includes(search)) return false;
        return true;
      })
      .sort((a, b) => b.billDate.localeCompare(a.billDate));
  });

  readonly financialSummary = computed(() => {
    const items = this.poItems();
    const subTotal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    const taxAmount = subTotal * (this.poTaxRate() / 100);
    return { 
      subTotal, 
      taxAmount, 
      grandTotal: subTotal + taxAmount - this.poDiscount() 
    };
  });

  // -------------------------------------------------------------------------
  // SEARCH DEBOUNCER
  // -------------------------------------------------------------------------
  
  private readonly searchDebouncer = new Subject<string>();

  // -------------------------------------------------------------------------
  // CONSTRUCTOR - Setup effects and subscriptions
  // -------------------------------------------------------------------------

  constructor() {
    // Sync local view signal with store and trigger change detection for OnPush
    effect(() => {
      const view = this.store.currentView();
      this.currentView.set(view);
      this.cdr.markForCheck();
    }, { allowSignalWrites: true });

    // Auto-select first branch
    effect(() => {
      const branches = this.store.branches();
      if (branches.length > 0 && !this.selectedBranchId()) {
        this.selectedBranchId.set(branches[0].id);
      }
    });

    // Debounced product search with automatic cleanup
    this.searchDebouncer.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => this.performOptimizedSearch(query));
  }

  // -------------------------------------------------------------------------
  // UTILITY GETTERS
  // -------------------------------------------------------------------------

  private get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  // -------------------------------------------------------------------------
  // LOOKUP METHODS (cached via store signals)
  // -------------------------------------------------------------------------

  getSupplierName = (id: string): string => 
    this.store.suppliers().find(s => s.id === id)?.name ?? 'Unknown';

  getBranchName = (id: string): string => 
    this.store.branches().find(b => b.id === id)?.name ?? 'Unknown';

  getUserName = (id?: string): string => 
    this.store.users().find(u => u.id === id)?.name ?? 'Unknown';

  getBillStatusLabel = (status: string): string => status;

  // -------------------------------------------------------------------------
  // SUPPLIER OPERATIONS
  // -------------------------------------------------------------------------

  openSupplierModal(supplier?: Supplier): void {
    if (supplier) {
      this.editingId.set(supplier.id);
      this.supplierForm.patchValue({ ...supplier, status: supplier.status === 'Active' });
    } else {
      this.editingId.set(null);
      this.supplierForm.reset({
        code: `SUP-${Math.floor(Math.random() * 10000)}`,
        status: true,
        category: 'Pharmaceuticals',
        country: 'Yemen',
        paymentTerms: 'Net 30',
        rating: 5
      });
    }
    this.showSupplierModal.set(true);
    this.closeActionMenu();
  }

  closeSupplierModal = (): void => this.showSupplierModal.set(false);

  saveSupplier(): void {
    if (!this.supplierForm.valid) return;
    
    const val = this.supplierForm.getRawValue();
    const status: 'Active' | 'Inactive' = val.status ? 'Active' : 'Inactive';
    const data = { ...val, status };
    
    const id = this.editingId();
    id ? this.store.updateSupplier(id, data) : this.store.addSupplier(data);
    this.closeSupplierModal();
  }

  editSupplierFromMenu(): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    const supplier = this.store.suppliers().find(s => s.id === id);
    if (supplier) this.openSupplierModal(supplier);
  }

  deleteSupplierFromMenu(): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    this.activeDeactivateId = id;
    this.showDeactivateModal.set(true);
    this.closeActionMenu();
  }

  closeDeactivateModal(): void {
    this.showDeactivateModal.set(false);
    this.activeDeactivateId = null;
  }

  confirmDeactivation(): void {
    if (this.activeDeactivateId) {
      this.store.updateSupplier(this.activeDeactivateId, { status: 'Inactive' });
      this.closeDeactivateModal();
    }
  }

  // -------------------------------------------------------------------------
  // PO OPERATIONS
  // -------------------------------------------------------------------------

  openPOModal(po?: PurchaseOrder): void {
    if (po) {
      this.editingPOId.set(po.id);
      this.selectedSupplierId.set(po.supplierId);
      this.selectedBranchIdForPO.set(po.branchId);
      this.poTaxRate.set(po.subTotal ? (po.tax / po.subTotal) * 100 : 0);
      this.poDiscount.set(po.discount);
      this.poForm.patchValue(po);
      
      const products = this.store.products();
      this.poItems.set(po.items.map(i => {
        const product = products.find(p => p.id === i.productId);
        return {
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          expiryDate: i.expiryDate ?? null,
          productName: product?.name ?? 'Unknown Product',
          productDetails: product as ProductOption
        };
      }));
    } else {
      this.editingPOId.set(null);
      this.selectedSupplierId.set('');
      const defaultBranch = this.selectedBranchId() || this.store.branches()[0]?.id || '';
      this.selectedBranchIdForPO.set(defaultBranch);
      
      const userId = this.store.currentUser()?.id || '';
      this.poForm.reset({
        date: this.today,
        status: 'Draft',
        supplierId: '',
        branchId: defaultBranch,
        createdBy: userId,
        assignedTo: userId
      });
      this.poItems.set([]);
      this.poTaxRate.set(0);
      this.poDiscount.set(0);
    }
    this.showPOModal.set(true);
  }

  closePOModal = (): void => this.showPOModal.set(false);

  savePO(): void {
    const val = this.poForm.getRawValue();
    const targetBranchId = this.selectedBranchIdForPO();

    const finalItems = this.poItems().map(item => {
      if (item.isNetworkImport && item.productDetails) {
        const newId = this.store.addProduct({
          name: item.productDetails.name,
          sku: item.productDetails.sku,
          cost: item.productDetails.cost,
          price: item.productDetails.price ?? item.productDetails.cost * 1.2,
          margin: item.productDetails.margin,
          category: item.productDetails.category,
          supplierId: item.productDetails.supplierId,
          branchId: targetBranchId,
          minStock: 10,
          stock: 0
        });
        return { 
          productId: newId, 
          quantity: item.quantity, 
          unitCost: item.unitCost, 
          expiryDate: item.expiryDate ?? undefined 
        };
      }
      return { 
        productId: item.productId, 
        quantity: item.quantity, 
        unitCost: item.unitCost, 
        expiryDate: item.expiryDate ?? undefined 
      };
    });

    const { subTotal, grandTotal } = this.financialSummary();
    const tax = subTotal * (this.poTaxRate() / 100);
    const data = { 
      ...val, 
      status: val.status as POStatus,
      subTotal, 
      tax, 
      discount: this.poDiscount(), 
      grandTotal, 
      items: finalItems 
    };

    const editId = this.editingPOId();
    if (editId) {
      const linkedBill = this.store.bills().find(b => b.poId === editId);
      if (linkedBill?.status === 'Paid' || linkedBill?.status === 'Partial') {
        alert(`Cannot edit Order. Linked Bill ${linkedBill.billNumber} has processed payments.`);
        return;
      }
      this.store.updatePurchaseOrder(editId, data);
    } else {
      this.store.createPO(data);
    }
    this.closePOModal();
  }

  // -------------------------------------------------------------------------
  // PRODUCT SEARCH (Optimized single-pass algorithm)
  // -------------------------------------------------------------------------

  onSearchInput(value: string): void {
    this.searchQueryInternal.set(value);
    this.searchDebouncer.next(value);
  }

  private performOptimizedSearch(query: string): void {
    const search = query.toLowerCase();
    if (!search) {
      this.optimizedProductOptions.set([]);
      this.showProductDropdown.set(false);
      return;
    }

    const supplierId = this.selectedSupplierId();
    const targetBranchId = this.selectedBranchIdForPO();
    if (!supplierId || !targetBranchId) return;

    const catFilter = this.searchCategory;
    const consolidated = new Map<string, ProductOption>();
    const results: ProductOption[] = [];
    const MAX_RESULTS = 20;

    for (const p of this.store.products()) {
      if (results.length >= MAX_RESULTS) break;
      if (p.supplierId !== supplierId) continue;
      if (catFilter !== 'All' && p.category !== catFilter) continue;
      
      const nameLower = p.name.toLowerCase();
      const skuLower = p.sku.toLowerCase();
      if (!nameLower.includes(search) && !skuLower.includes(search)) continue;

      const key = nameLower + skuLower;
      const existing = consolidated.get(key);

      if (!existing) {
        const entry: ProductOption = {
          ...p,
          existsInTarget: p.branchId === targetBranchId,
          targetStock: p.branchId === targetBranchId ? p.stock : 0,
          otherBranches: [p.branchId!],
          branchNames: [this.getBranchName(p.branchId!)]
        };
        consolidated.set(key, entry);
        results.push(entry);
      } else if (p.branchId === targetBranchId) {
        existing.id = p.id;
        existing.cost = p.cost;
        existing.stock = p.stock;
        existing.existsInTarget = true;
        existing.targetStock = p.stock;
      }
    }

    this.optimizedProductOptions.set(results);
    this.showProductDropdown.set(true);
  }

  // -------------------------------------------------------------------------
  // QUICK PRODUCT
  // -------------------------------------------------------------------------

  openQuickProductModal(): void {
    if (!this.selectedBranchIdForPO()) {
      alert('Please select a destination branch first.');
      return;
    }
    this.quickProduct = { 
      name: this.searchQueryInternal(), 
      sku: '', 
      cost: 0, 
      price: 0, 
      category: 'General' 
    };
    this.showQuickProductModal.set(true);
    this.showProductDropdown.set(false);
  }

  closeQuickProductModal = (): void => this.showQuickProductModal.set(false);

  saveQuickProduct(): void {
    const { name, sku, cost, price, category } = this.quickProduct;
    const supplierId = this.selectedSupplierId();
    const branchId = this.selectedBranchIdForPO();
    
    if (!name || !supplierId || !branchId) return;

    const newId = this.store.addProduct({
      name,
      sku: sku || `SKU-${Math.floor(Math.random() * 10000)}`,
      cost: Number(cost),
      price: Number(price) || Number(cost) * 1.2,
      category,
      supplierId,
      branchId,
      stock: 0,
      minStock: 10
    });

    const fullProduct = this.store.products().find(p => p.id === newId);
    if (fullProduct) {
      this.selectedProduct.set(fullProduct as ProductOption);
      this.searchQueryInternal.set(fullProduct.name);
    }
    this.closeQuickProductModal();
  }

  // -------------------------------------------------------------------------
  // PO ITEM MANAGEMENT
  // -------------------------------------------------------------------------

  selectProduct(p: ProductOption, cost: HTMLInputElement, qty: HTMLInputElement, expiry: HTMLInputElement): void {
    this.selectedProduct.set(p);
    this.searchQueryInternal.set(p.name);
    cost.value = String(p.cost);
    qty.value = '1';
    expiry.value = '';
    this.showProductDropdown.set(false);
  }

  addItemToPO(qty: HTMLInputElement, cost: HTMLInputElement, expiry: HTMLInputElement): void {
    const p = this.selectedProduct();
    if (!p) return;

    this.poItems.update(items => [...items, {
      productId: p.id,
      productName: p.name,
      quantity: Number(qty.value) || 1,
      unitCost: Number(cost.value) || 0,
      expiryDate: expiry.value || null,
      isNetworkImport: !p.existsInTarget,
      productDetails: p
    }]);
    
    this.searchQueryInternal.set('');
    this.selectedProduct.set(null);
  }

  updateItem(index: number, field: keyof Pick<POItem, 'quantity' | 'unitCost' | 'expiryDate'>, value: unknown): void {
    this.poItems.update(items => {
      const updated = [...items];
      const cleanValue = field === 'expiryDate' ? value : Number(value);
      if (typeof cleanValue === 'number' && cleanValue < 0) return items;
      updated[index] = { ...updated[index], [field]: cleanValue };
      return updated;
    });
  }

  removeItemFromPO(index: number): void {
    this.poItems.update(items => items.filter((_, i) => i !== index));
  }

  hideProductDropdownDelayed = (): void => {
    setTimeout(() => this.showProductDropdown.set(false), 200);
  };

  onSearchFocus(): void {
    if (this.searchQueryInternal()) this.showProductDropdown.set(true);
  }

  // -------------------------------------------------------------------------
  // ACTION MENU
  // -------------------------------------------------------------------------

  openActionMenu(e: MouseEvent, id: string): void {
    e.stopPropagation();
    if (this.activeActionRow() === id) {
      this.closeActionMenu();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.actionMenuPosition.set({ x: rect.right - 224, y: rect.bottom + 5 });
    this.activeActionRow.set(id);
  }

  closeActionMenu = (): void => this.activeActionRow.set(null);

  editPOFromMenu(): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    const linkedBill = this.store.bills().find(b => b.poId === id);
    if (linkedBill?.status === 'Paid' || linkedBill?.status === 'Partial') {
      alert(`Cannot edit Order. Linked Bill ${linkedBill.billNumber} has processed payments.`);
      this.closeActionMenu();
      return;
    }
    
    const po = this.store.purchaseOrders().find(p => p.id === id);
    if (po) this.openPOModal(po);
    this.closeActionMenu();
  }

  updatePOStatusFromMenu(status: POStatus): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    if (status !== 'Closed') {
      const linkedBill = this.store.bills().find(b => b.poId === id);
      if (linkedBill?.status === 'Paid' || linkedBill?.status === 'Partial') {
        alert(`Cannot revert Order status. Linked Bill ${linkedBill.billNumber} has processed payments.`);
        this.closeActionMenu();
        return;
      }
    }
    this.store.updatePurchaseOrder(id, { status });
    this.closeActionMenu();
  }

  deletePOFromMenu(): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    const linkedBill = this.store.bills().find(b => b.poId === id);
    if (linkedBill) {
      alert(`Cannot delete Order. It is linked to Bill ${linkedBill.billNumber}.`);
      this.closeActionMenu();
      return;
    }
    if (confirm('Delete order?')) this.store.deletePurchaseOrder(id);
    this.closeActionMenu();
  }

  // -------------------------------------------------------------------------
  // BILL MANAGEMENT
  // -------------------------------------------------------------------------

  openReceiveModalFromMenu(): void {
    const id = this.activeActionRow();
    if (!id) return;
    
    const po = this.store.purchaseOrders().find(p => p.id === id);
    if (!po || po.status === 'Closed') {
      alert('Order is closed or invalid.');
      return;
    }
    
    this.editingBillId.set(null);
    this.activeReceivePOId = id;
    this.resetBillForm();
    this.showReceiveModal.set(true);
    this.closeActionMenu();
  }

  openNewBillModal(): void {
    this.editingBillId.set(null);
    this.activeReceivePOId = null;
    this.resetBillForm();
    this.showReceiveModal.set(true);
  }

  private resetBillForm(): void {
    this.receiveForm.reset({
      billNumber: '',
      billDate: this.today,
      dueDate: this.today,
      receivedDate: this.today,
      assignedTo: this.store.currentUser()?.id || '',
      attachmentName: '',
      attachmentUrl: ''
    });
    this.billUploadedName.set('');
    this.billTempUrl.set(null);
  }

  openBillModal(bill: PurchaseBill): void {
    this.editingBillId.set(bill.id);
    this.paymentForm.reset({
      date: this.today,
      amount: 0,
      method: 'Cash',
      reference: '',
      attachmentName: '',
      fileUrl: ''
    });
    this.uploadedFileName.set('');
    this.tempFileUrl.set(null);
    this.showReceiveModal.set(true);
  }

  openReceiveModal(po?: PurchaseOrder): void {
    if (po) this.activeReceivePOId = po.id;
    
    this.receiveForm.reset({
      billNumber: `BILL-${Math.floor(Math.random() * 10000)}`,
      billDate: this.today,
      dueDate: this.today,
      receivedDate: this.today
    });
    this.billUploadedName.set('');
    this.billTempUrl.set(null);
    this.showReceiveModal.set(true);
    this.closeActionMenu();
  }

  closeReceiveModal(): void {
    this.showReceiveModal.set(false);
    this.activeReceivePOId = null;
    this.editingBillId.set(null);
  }

  onPoSelect(event: Event): void {
    this.activeReceivePOId = (event.target as HTMLSelectElement).value;
  }

  handleBillUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    this.billUploadedName.set(file.name);
    const url = URL.createObjectURL(file);
    this.billTempUrl.set(url);
    this.receiveForm.patchValue({ attachmentName: file.name, attachmentUrl: url });
  }

  saveBill(): void {
    if (!this.receiveForm.valid || !this.activeReceivePOId || this.editingBillId()) return;
    
    const val = this.receiveForm.getRawValue();
    this.store.createBill(this.activeReceivePOId, val);
    this.closeReceiveModal();
  }

  // -------------------------------------------------------------------------
  // PAYMENT OPERATIONS
  // -------------------------------------------------------------------------

  setFullBalance = (): void => this.paymentForm.patchValue({ amount: this.remainingBalance() });

  isAmountInvalid = (): boolean => (this.paymentForm.get('amount')?.value ?? 0) > this.remainingBalance();

  handleReceiptUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    this.uploadedFileName.set(file.name);
    const url = URL.createObjectURL(file);
    this.tempFileUrl.set(url);
    this.paymentForm.patchValue({ attachmentName: file.name, fileUrl: url });
  }

  submitPayment(): void {
    const billId = this.editingBillId();
    if (!this.paymentForm.valid || !billId || this.isAmountInvalid()) return;
    
    const val = this.paymentForm.getRawValue();
    this.store.addBillPayment(billId, {
      ...val,
      method: val.method as 'Cash' | 'Bank Transfer' | 'Check' | 'Credit'
    });
    this.paymentForm.reset({
      date: this.today,
      amount: 0,
      method: 'Cash',
      reference: '',
      attachmentName: '',
      fileUrl: ''
    });
    this.uploadedFileName.set('');
    this.tempFileUrl.set(null);
  }

  // -------------------------------------------------------------------------
  // DOCUMENT VIEWER
  // -------------------------------------------------------------------------

  viewReceipt(payment: PaymentRecord): void {
    this.selectedReceiptName.set(payment.attachmentName || 'Unknown File');
    this.selectedReceiptUrl.set(payment.fileUrl || null);
    this.viewerTitle.set('Payment Receipt');
    this.showReceiptModal.set(true);
  }

  viewOriginalBill(): void {
    const bill = this.activeBill();
    if (bill?.attachmentUrl) {
      this.selectedReceiptName.set(bill.attachmentName || 'Invoice');
      this.selectedReceiptUrl.set(bill.attachmentUrl);
      this.viewerTitle.set('Supplier Invoice');
      this.showReceiptModal.set(true);
    }
  }

  viewBillAttachment(bill: PurchaseBill): void {
    if (bill.attachmentUrl) {
      this.selectedReceiptName.set(bill.attachmentName || 'Invoice');
      this.selectedReceiptUrl.set(bill.attachmentUrl);
      this.viewerTitle.set('Supplier Invoice');
      this.showReceiptModal.set(true);
    }
  }

  closeReceiptModal(): void {
    this.showReceiptModal.set(false);
    this.selectedReceiptUrl.set(null);
  }

  isPdf = (filename: string): boolean => filename.toLowerCase().endsWith('.pdf');

  getSafeUrl = (url: string): SafeResourceUrl => 
    this.sanitizer.bypassSecurityTrustResourceUrl(url);

  // -------------------------------------------------------------------------
  // FORM HELPERS
  // -------------------------------------------------------------------------

  onSupplierChange(): void {
    this.selectedSupplierId.set(this.poForm.get('supplierId')?.value ?? '');
    this.poItems.set([]);
  }

  onBranchChange(): void {
    this.selectedBranchIdForPO.set(this.poForm.get('branchId')?.value ?? '');
    this.poItems.set([]);
  }
}

