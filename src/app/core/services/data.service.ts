/**
 * @fileoverview Data Service - Production-grade centralized data management
 * @description Provides typed API access with automatic StoreService sync for:
 * - Branches
 * - Products
 * - Suppliers
 * - Customers
 * - Invoices
 * - Purchase Orders
 * - Bills
 * 
 * All mutations persist to backend AND update local store for reactive UI
 * 
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, BehaviorSubject, finalize, forkJoin, catchError, of, map, throwError } from 'rxjs';
import { ApiService, PaginatedResponse, QueryParams, ApiError } from './api.service';
import { StoreService } from './store.service';
import { 
  Supplier, 
  PurchaseOrder, 
  PurchaseBill, 
  POStatus 
} from '@core/models/procurement.model';
import { Product } from '@core/models/product.model';
import { Customer } from '@core/models/sales.model';

// ============================================================================
// Interfaces
// ============================================================================

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  isOfflineEnabled: boolean;
  licenseCount: number;
  managerId?: string;
  managerName?: string;
}

export interface ProductStats {
  totalProducts: number;
  lowStockCount: number;
  expiringCount: number;
  totalStockValue: number;
  averageMargin: number;
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  totalBalance: number;
  averageRating: number;
}

export interface CustomerStats {
  totalCustomers: number;
  retailCustomers: number;
  wholesaleCustomers: number;
  totalBalance: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  totalSales: number;
  paidAmount: number;
  pendingAmount: number;
  paidCount: number;
  pendingCount: number;
  averageOrderValue: number;
}

export interface TodaySales {
  totalSales: number;
  transactionCount: number;
  averageOrderValue: number;
}

export interface Invoice {
  id: string;
  customerId?: string;
  customerName: string;
  branchId: string;
  branchName: string;
  date: string;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  total: number;
  paidAmount: number;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

// Request DTOs matching backend
export interface CreateSupplierRequest {
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  category?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  rating?: number;
  status?: 'Active' | 'Inactive';
  category?: string;
}

export interface CreateProductRequest {
  name: string;
  genericName?: string;
  sku: string;
  price: number;
  cost: number;
  category: string;
  supplierId?: string;
  minStock?: number;
  location?: string;
  branchId?: string;
  initialStock?: number;
  expiryDate?: string;
}

export interface UpdateProductRequest {
  name?: string;
  genericName?: string;
  sku?: string;
  price?: number;
  cost?: number;
  category?: string;
  supplierId?: string;
  minStock?: number;
  location?: string;
  expiryDate?: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  branchId: string;
  expectedDeliveryDate?: string;
  tax?: number;
  discount?: number;
  termsConditions?: string;
  shippingAddress?: string;
  assignedToId?: string;
  items: CreatePurchaseOrderItemRequest[];
}

export interface CreatePurchaseOrderItemRequest {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface ReceivePurchaseOrderRequest {
  billNumber: string;
  billDate: string;
  dueDate: string;
  receivedDate: string;
  note?: string;
  attachmentUrl?: string;
}

// ============================================================================
// Data Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly api = inject(ApiService);
  private readonly store = inject(StoreService);

  // Loading states with proper encapsulation
  private readonly _loadingBranches = signal(false);
  private readonly _loadingProducts = signal(false);
  private readonly _loadingSuppliers = signal(false);
  private readonly _loadingCustomers = signal(false);
  private readonly _loadingInvoices = signal(false);
  private readonly _loadingDashboard = signal(false);
  private readonly _loadingPurchaseOrders = signal(false);
  private readonly _loadingBills = signal(false);
  private readonly _saving = signal(false);

  readonly loadingBranches = this._loadingBranches.asReadonly();
  readonly loadingProducts = this._loadingProducts.asReadonly();
  readonly loadingSuppliers = this._loadingSuppliers.asReadonly();
  readonly loadingCustomers = this._loadingCustomers.asReadonly();
  readonly loadingInvoices = this._loadingInvoices.asReadonly();
  readonly loadingDashboard = this._loadingDashboard.asReadonly();
  readonly loadingPurchaseOrders = this._loadingPurchaseOrders.asReadonly();
  readonly loadingBills = this._loadingBills.asReadonly();
  readonly saving = this._saving.asReadonly();

  // Combined loading state for global loading indicator
  readonly isLoading = computed(() => 
    this._loadingBranches() || 
    this._loadingProducts() || 
    this._loadingSuppliers() || 
    this._loadingCustomers() || 
    this._loadingInvoices() ||
    this._loadingDashboard() ||
    this._loadingPurchaseOrders() ||
    this._loadingBills() ||
    this._saving()
  );

  // Error state
  private readonly _lastError = signal<string | null>(null);
  readonly lastError = this._lastError.asReadonly();

  // Cache subjects for real-time updates
  private branchesCache$ = new BehaviorSubject<Branch[]>([]);
  private productsCache$ = new BehaviorSubject<Product[]>([]);
  private suppliersCache$ = new BehaviorSubject<Supplier[]>([]);
  private customersCache$ = new BehaviorSubject<Customer[]>([]);

  // Observable streams for components to subscribe
  readonly branches$ = this.branchesCache$.asObservable();
  readonly products$ = this.productsCache$.asObservable();
  readonly suppliers$ = this.suppliersCache$.asObservable();
  readonly customers$ = this.customersCache$.asObservable();

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleAndThrow(operation: string) {
    return (error: ApiError): Observable<never> => {
      const message = `${operation} failed: ${error.message}`;
      this._lastError.set(message);
      console.error(message, error);
      return throwError(() => error);
    };
  }

  private handleWithFallback<T>(operation: string, fallback: T) {
    return (error: ApiError): Observable<T> => {
      const message = `${operation} failed: ${error.message}`;
      this._lastError.set(message);
      console.error(message, error);
      return of(fallback);
    };
  }

  clearError(): void {
    this._lastError.set(null);
  }

  // ============================================================================
  // Branches
  // ============================================================================

  getBranches(params?: QueryParams): Observable<PaginatedResponse<Branch>> {
    this._loadingBranches.set(true);
    return this.api.get<PaginatedResponse<Branch>>('branches', params).pipe(
      tap(response => {
        this.branchesCache$.next(response.items);
        // Sync with store
        this.store.setBranches(response.items.map(b => ({
          id: b.id,
          name: b.name,
          code: b.code,
          location: b.location,
          isOfflineEnabled: b.isOfflineEnabled,
          licenseCount: b.licenseCount
        })));
      }),
      finalize(() => this._loadingBranches.set(false))
    );
  }

  getBranch(id: string): Observable<Branch> {
    return this.api.get<Branch>(`branches/${id}`);
  }

  createBranch(data: Partial<Branch>): Observable<Branch> {
    this._saving.set(true);
    return this.api.post<Branch>('branches', data).pipe(
      tap(branch => {
        const current = this.branchesCache$.value;
        this.branchesCache$.next([...current, branch]);
        this.store.addBranchFromApi(branch);
      }),
      finalize(() => this._saving.set(false))
    );
  }

  updateBranch(id: string, data: Partial<Branch>): Observable<Branch> {
    this._saving.set(true);
    return this.api.put<Branch>(`branches/${id}`, data).pipe(
      tap(updated => {
        const current = this.branchesCache$.value;
        const index = current.findIndex(b => b.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.branchesCache$.next([...current]);
        }
      }),
      finalize(() => this._saving.set(false))
    );
  }

  deleteBranch(id: string): Observable<boolean> {
    this._saving.set(true);
    return this.api.delete<boolean>(`branches/${id}`).pipe(
      tap(() => {
        const current = this.branchesCache$.value;
        this.branchesCache$.next(current.filter(b => b.id !== id));
      }),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Suppliers - Full CRUD with Store Sync
  // ============================================================================

  getSuppliers(params?: QueryParams): Observable<PaginatedResponse<Supplier>> {
    this._loadingSuppliers.set(true);
    return this.api.get<PaginatedResponse<Supplier>>('suppliers', params).pipe(
      tap(response => {
        this.suppliersCache$.next(response.items);
        // Sync with store - set all suppliers
        this.store.suppliers.set(response.items);
      }),
      finalize(() => this._loadingSuppliers.set(false))
    );
  }

  getSupplier(id: string): Observable<Supplier> {
    return this.api.get<Supplier>(`suppliers/${id}`);
  }

  getSupplierStats(): Observable<SupplierStats> {
    return this.api.get<SupplierStats>('suppliers/stats');
  }

  /**
   * Create a new supplier - persists to backend AND updates store
   */
  createSupplier(data: CreateSupplierRequest): Observable<Supplier> {
    this._saving.set(true);
    
    // Sanitize data before sending
    const sanitizedData = this.sanitizeSupplierRequest(data);
    
    return this.api.post<Supplier>('suppliers', sanitizedData).pipe(
      tap(supplier => {
        // Update cache
        const current = this.suppliersCache$.value;
        this.suppliersCache$.next([...current, supplier]);
        
        // Sync with store - add new supplier with real ID from backend
        this.store.suppliers.update(suppliers => [...suppliers, supplier]);
      }),
      catchError(this.handleAndThrow('Create supplier')),
      finalize(() => this._saving.set(false))
    );
  }
  
  /**
   * Sanitize supplier request data - ensures proper types for backend
   */
  private sanitizeSupplierRequest(data: CreateSupplierRequest): Record<string, unknown> {
    const result: Record<string, unknown> = {
      code: data.code,
      name: data.name
    };
    
    // Only include optional fields if they have valid values
    if (data.contactPerson && data.contactPerson.trim()) {
      result['contactPerson'] = data.contactPerson.trim();
    }
    if (data.email && data.email.trim()) {
      result['email'] = data.email.trim();
    }
    if (data.phone && data.phone.trim()) {
      result['phone'] = data.phone.trim();
    }
    if (data.address && data.address.trim()) {
      result['address'] = data.address.trim();
    }
    if (data.city && data.city.trim()) {
      result['city'] = data.city.trim();
    }
    if (data.country && data.country.trim()) {
      result['country'] = data.country.trim();
    }
    if (data.paymentTerms && data.paymentTerms.trim()) {
      result['paymentTerms'] = data.paymentTerms.trim();
    }
    if (data.creditLimit !== undefined && data.creditLimit !== null) {
      result['creditLimit'] = data.creditLimit;
    }
    if (data.category && data.category.trim()) {
      result['category'] = data.category.trim();
    }
    
    return result;
  }

  /**
   * Update an existing supplier - persists to backend AND updates store
   */
  updateSupplier(id: string, data: UpdateSupplierRequest): Observable<Supplier> {
    this._saving.set(true);
    return this.api.put<Supplier>(`suppliers/${id}`, data).pipe(
      tap(updated => {
        // Update cache
        const current = this.suppliersCache$.value;
        const index = current.findIndex(s => s.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.suppliersCache$.next([...current]);
        }
        
        // Sync with store
        this.store.suppliers.update(suppliers => 
          suppliers.map(s => s.id === id ? updated : s)
        );
      }),
      catchError(this.handleAndThrow('Update supplier')),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Delete a supplier - persists to backend AND updates store
   */
  deleteSupplier(id: string): Observable<boolean> {
    this._saving.set(true);
    return this.api.delete<boolean>(`suppliers/${id}`).pipe(
      tap(() => {
        // Update cache
        const current = this.suppliersCache$.value;
        this.suppliersCache$.next(current.filter(s => s.id !== id));
        
        // Sync with store
        this.store.suppliers.update(suppliers => suppliers.filter(s => s.id !== id));
      }),
      catchError(this.handleWithFallback('Delete supplier', false)),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Products - Full CRUD with Store Sync
  // ============================================================================

  getProducts(params?: QueryParams): Observable<PaginatedResponse<Product>> {
    this._loadingProducts.set(true);
    return this.api.get<PaginatedResponse<Product>>('products', params).pipe(
      tap(response => {
        this.productsCache$.next(response.items);
        // Sync with store
        this.store.products.set(response.items);
      }),
      finalize(() => this._loadingProducts.set(false))
    );
  }

  getProduct(id: string): Observable<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  getLowStockProducts(branchId?: string): Observable<Product[]> {
    const params: QueryParams = branchId ? { branchId } : {};
    return this.api.get<Product[]>('products/low-stock', params);
  }

  getExpiringProducts(branchId?: string, days?: number): Observable<Product[]> {
    const params: QueryParams = {};
    if (branchId) params['branchId'] = branchId;
    if (days) params['days'] = days;
    return this.api.get<Product[]>('products/expiring', params);
  }

  getProductCategories(): Observable<string[]> {
    return this.api.get<string[]>('products/categories');
  }

  getProductStats(branchId?: string): Observable<ProductStats> {
    const params: QueryParams = branchId ? { branchId } : {};
    return this.api.get<ProductStats>('products/stats', params);
  }

  /**
   * Create a new product - persists to backend AND updates store
   */
  createProduct(data: CreateProductRequest): Observable<Product> {
    this._saving.set(true);
    
    // Sanitize data before sending - remove undefined/null/empty values for optional fields
    const sanitizedData = this.sanitizeProductRequest(data);
    
    return this.api.post<Product>('products', sanitizedData).pipe(
      tap(product => {
        // Update cache
        const current = this.productsCache$.value;
        this.productsCache$.next([...current, product]);
        
        // Sync with store - add product with real ID from backend
        this.store.products.update(products => [product, ...products]);
      }),
      catchError(this.handleAndThrow('Create product')),
      finalize(() => this._saving.set(false))
    );
  }
  
  /**
   * Sanitize product request data - ensures proper types for backend
   */
  private sanitizeProductRequest(data: CreateProductRequest): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: data.name,
      sku: data.sku,
      price: data.price,
      cost: data.cost,
      category: data.category || 'General'
    };
    
    // Only include optional fields if they have valid values
    if (data.genericName && data.genericName.trim()) {
      result['genericName'] = data.genericName.trim();
    }
    if (data.supplierId && data.supplierId.trim()) {
      result['supplierId'] = data.supplierId;
    }
    if (data.branchId && data.branchId.trim()) {
      result['branchId'] = data.branchId;
    }
    if (data.minStock !== undefined && data.minStock !== null) {
      result['minStock'] = data.minStock;
    }
    if (data.location && data.location.trim()) {
      result['location'] = data.location.trim();
    }
    if (data.initialStock !== undefined && data.initialStock !== null) {
      result['initialStock'] = data.initialStock;
    }
    if (data.expiryDate && data.expiryDate.trim()) {
      result['expiryDate'] = data.expiryDate;
    }
    
    return result;
  }

  /**
   * Update an existing product - persists to backend AND updates store
   */
  updateProduct(id: string, data: UpdateProductRequest): Observable<Product> {
    this._saving.set(true);
    return this.api.put<Product>(`products/${id}`, data).pipe(
      tap(updated => {
        // Update cache
        const current = this.productsCache$.value;
        const index = current.findIndex(p => p.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.productsCache$.next([...current]);
        }
        
        // Sync with store
        this.store.products.update(products => 
          products.map(p => p.id === id ? updated : p)
        );
      }),
      catchError(this.handleAndThrow('Update product')),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Delete a product - persists to backend AND updates store
   */
  deleteProduct(id: string): Observable<boolean> {
    this._saving.set(true);
    return this.api.delete<boolean>(`products/${id}`).pipe(
      tap(() => {
        // Update cache
        const current = this.productsCache$.value;
        this.productsCache$.next(current.filter(p => p.id !== id));
        
        // Sync with store
        this.store.products.update(products => products.filter(p => p.id !== id));
      }),
      catchError(this.handleWithFallback('Delete product', false)),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Purchase Orders - Full CRUD with Store Sync
  // ============================================================================

  getPurchaseOrders(params?: QueryParams): Observable<PurchaseOrder[]> {
    this._loadingPurchaseOrders.set(true);
    return this.api.get<PurchaseOrder[]>('purchase-orders', params).pipe(
      tap(orders => {
        // Sync with store
        this.store.purchaseOrders.set(orders);
      }),
      finalize(() => this._loadingPurchaseOrders.set(false))
    );
  }

  getPurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.api.get<PurchaseOrder>(`purchase-orders/${id}`);
  }

  /**
   * Create a new purchase order - persists to backend AND updates store
   */
  createPurchaseOrder(data: CreatePurchaseOrderRequest): Observable<PurchaseOrder> {
    this._saving.set(true);
    return this.api.post<PurchaseOrder>('purchase-orders', data).pipe(
      tap(order => {
        // Sync with store - add with real ID from backend
        this.store.purchaseOrders.update(orders => [order, ...orders]);
      }),
      catchError(this.handleAndThrow('Create purchase order')),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Update an existing purchase order
   */
  updatePurchaseOrder(id: string, data: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    this._saving.set(true);
    return this.api.put<PurchaseOrder>(`purchase-orders/${id}`, data).pipe(
      tap(updated => {
        // Sync with store
        this.store.purchaseOrders.update(orders => 
          orders.map(o => o.id === id ? updated : o)
        );
      }),
      catchError(this.handleAndThrow('Update purchase order')),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Delete a purchase order
   */
  deletePurchaseOrder(id: string): Observable<boolean> {
    this._saving.set(true);
    return this.api.delete<boolean>(`purchase-orders/${id}`).pipe(
      tap(() => {
        // Sync with store
        this.store.purchaseOrders.update(orders => orders.filter(o => o.id !== id));
      }),
      catchError(this.handleWithFallback('Delete purchase order', false)),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Approve a purchase order (change status to Sent)
   */
  approvePurchaseOrder(id: string): Observable<PurchaseOrder> {
    this._saving.set(true);
    return this.api.post<PurchaseOrder>(`purchase-orders/${id}/approve`, {}).pipe(
      tap(() => {
        this.store.purchaseOrders.update(orders => 
          orders.map(o => o.id === id ? { ...o, status: 'Sent' as POStatus } : o)
        );
      }),
      catchError(this.handleAndThrow('Approve purchase order')),
      finalize(() => this._saving.set(false))
    );
  }

  /**
   * Receive a purchase order - creates bill, updates stock
   * This is the key endpoint that triggers inventory updates
   */
  receivePurchaseOrder(id: string): Observable<PurchaseOrder> {
    this._saving.set(true);
    return this.api.post<PurchaseOrder>(`purchase-orders/${id}/receive`, {}).pipe(
      tap(() => {
        // Update PO status in store
        this.store.purchaseOrders.update(orders => 
          orders.map(o => o.id === id ? { ...o, status: 'Closed' as POStatus } : o)
        );
        
        // Refresh products to get updated stock levels
        this.getProducts({ pageSize: 1000 }).subscribe();
      }),
      catchError(this.handleAndThrow('Receive purchase order')),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Bills - Requires backend implementation
  // For now, sync with existing store methods for compatibility
  // ============================================================================

  getBills(params?: QueryParams): Observable<PurchaseBill[]> {
    this._loadingBills.set(true);
    // Backend endpoint: /api/purchase-bills or similar
    return this.api.get<PurchaseBill[]>('purchase-bills', params).pipe(
      tap(bills => {
        this.store.bills.set(bills);
      }),
      catchError(() => {
        // Fallback to store data if endpoint not available
        return of(this.store.bills());
      }),
      finalize(() => this._loadingBills.set(false))
    );
  }

  /**
   * Create bill from PO - for now delegates to store for backward compatibility
   * TODO: Wire to backend /api/purchase-bills endpoint when available
   */
  createBill(poId: string, data: {
    billNumber: string;
    billDate: string;
    receivedDate: string;
    dueDate: string;
    assignedTo?: string;
    attachmentName?: string;
    attachmentUrl?: string;
  }): Observable<PurchaseBill | null> {
    this._saving.set(true);
    
    // Use store method for now - this updates local state
    // In production, this should call the backend API
    this.store.createBill(poId, data);
    
    // Get the created bill from store
    const bill = this.store.bills().find(b => b.poId === poId);
    
    this._saving.set(false);
    return of(bill || null);
  }

  /**
   * Record payment on a bill
   */
  addBillPayment(billId: string, payment: {
    date: string;
    amount: number;
    method: 'Cash' | 'Bank Transfer' | 'Check' | 'Credit';
    reference?: string;
    attachmentName?: string;
    fileUrl?: string;
  }): Observable<PurchaseBill | null> {
    this._saving.set(true);
    
    // Use store method for now
    this.store.addBillPayment(billId, payment);
    
    const bill = this.store.bills().find(b => b.id === billId);
    this._saving.set(false);
    return of(bill || null);
  }

  // ============================================================================
  // Customers
  // ============================================================================

  getCustomers(params?: QueryParams): Observable<PaginatedResponse<Customer>> {
    this._loadingCustomers.set(true);
    return this.api.get<PaginatedResponse<Customer>>('customers', params).pipe(
      tap(response => {
        this.customersCache$.next(response.items);
        // Sync with store
        this.store.customers.set(response.items);
      }),
      finalize(() => this._loadingCustomers.set(false))
    );
  }

  searchCustomers(query: string): Observable<Customer[]> {
    return this.api.get<Customer[]>('customers/search', { q: query });
  }

  getCustomer(id: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${id}`);
  }

  getCustomerStats(): Observable<CustomerStats> {
    return this.api.get<CustomerStats>('customers/stats');
  }

  createCustomer(data: Partial<Customer>): Observable<Customer> {
    this._saving.set(true);
    return this.api.post<Customer>('customers', data).pipe(
      tap(customer => {
        const current = this.customersCache$.value;
        this.customersCache$.next([...current, customer]);
        this.store.customers.update(customers => [...customers, customer]);
      }),
      catchError(this.handleAndThrow('Create customer')),
      finalize(() => this._saving.set(false))
    );
  }

  updateCustomer(id: string, data: Partial<Customer>): Observable<Customer> {
    this._saving.set(true);
    return this.api.put<Customer>(`customers/${id}`, data).pipe(
      tap(updated => {
        const current = this.customersCache$.value;
        const index = current.findIndex(c => c.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.customersCache$.next([...current]);
        }
        this.store.customers.update(customers => 
          customers.map(c => c.id === id ? updated : c)
        );
      }),
      catchError(this.handleAndThrow('Update customer')),
      finalize(() => this._saving.set(false))
    );
  }

  deleteCustomer(id: string): Observable<boolean> {
    this._saving.set(true);
    return this.api.delete<boolean>(`customers/${id}`).pipe(
      tap(() => {
        const current = this.customersCache$.value;
        this.customersCache$.next(current.filter(c => c.id !== id));
        this.store.customers.update(customers => customers.filter(c => c.id !== id));
      }),
      catchError(this.handleWithFallback('Delete customer', false)),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Invoices / Sales
  // ============================================================================

  getInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    this._loadingInvoices.set(true);
    return this.api.get<PaginatedResponse<Invoice>>('invoices', params).pipe(
      finalize(() => this._loadingInvoices.set(false))
    );
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(`invoices/${id}`);
  }

  getInvoiceStats(params?: QueryParams): Observable<InvoiceStats> {
    return this.api.get<InvoiceStats>('invoices/stats', params);
  }

  getTodaySales(branchId?: string): Observable<TodaySales> {
    const params: QueryParams = branchId ? { branchId } : {};
    return this.api.get<TodaySales>('invoices/today', params);
  }

  createInvoice(data: {
    branchId?: string;
    customerId?: string;
    items: { productId: string; quantity: number; price: number }[];
  }): Observable<Invoice> {
    this._saving.set(true);
    return this.api.post<Invoice>('invoices', data).pipe(
      tap(() => {
        // Update product stock in store after sale
        const items = data.items;
        this.store.products.update(products => 
          products.map(p => {
            const soldItem = items.find(i => i.productId === p.id);
            if (soldItem) {
              return { ...p, stock: Math.max(0, p.stock - soldItem.quantity) };
            }
            return p;
          })
        );
      }),
      catchError(this.handleAndThrow('Create invoice')),
      finalize(() => this._saving.set(false))
    );
  }

  updateInvoiceStatus(id: string, status: string, paidAmount?: number): Observable<Invoice> {
    this._saving.set(true);
    return this.api.put<Invoice>(`invoices/${id}/status`, { status, paidAmount }).pipe(
      catchError(this.handleAndThrow('Update invoice status')),
      finalize(() => this._saving.set(false))
    );
  }

  // ============================================================================
  // Dashboard Data
  // ============================================================================

  getDashboardData(branchId?: string): Observable<{
    productStats: ProductStats;
    todaySales: TodaySales;
    lowStockProducts: Product[];
    expiringProducts: Product[];
  }> {
    this._loadingDashboard.set(true);
    
    return forkJoin({
      productStats: this.getProductStats(branchId).pipe(
        catchError(() => of({
          totalProducts: 0,
          lowStockCount: 0,
          expiringCount: 0,
          totalStockValue: 0,
          averageMargin: 0
        } as ProductStats))
      ),
      todaySales: this.getTodaySales(branchId).pipe(
        catchError(() => of({
          totalSales: 0,
          transactionCount: 0,
          averageOrderValue: 0
        } as TodaySales))
      ),
      lowStockProducts: this.getLowStockProducts(branchId).pipe(
        catchError(() => of([] as Product[]))
      ),
      expiringProducts: this.getExpiringProducts(branchId, 30).pipe(
        catchError(() => of([] as Product[]))
      )
    }).pipe(
      finalize(() => this._loadingDashboard.set(false))
    );
  }

  // ============================================================================
  // Initialization - Load all essential data
  // ============================================================================

  /**
   * Load initial data for the application after login
   * Fetches all essential data from backend and syncs to store
   */
  loadInitialData(): Observable<boolean> {
    return forkJoin({
      branches: this.getBranches({ pageSize: 100 }).pipe(catchError(() => of({ items: [] }))),
      suppliers: this.getSuppliers({ pageSize: 500 }).pipe(catchError(() => of({ items: [] }))),
      products: this.getProducts({ pageSize: 1000 }).pipe(catchError(() => of({ items: [] }))),
      customers: this.getCustomers({ pageSize: 500 }).pipe(catchError(() => of({ items: [] }))),
      purchaseOrders: this.getPurchaseOrders({ pageSize: 500 }).pipe(catchError(() => of([]))),
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Refresh all data from backend
   */
  refreshAll(): Observable<boolean> {
    this.clearCache();
    return this.loadInitialData();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.api.clearCache();
    this.branchesCache$.next([]);
    this.productsCache$.next([]);
    this.suppliersCache$.next([]);
    this.customersCache$.next([]);
  }
}
