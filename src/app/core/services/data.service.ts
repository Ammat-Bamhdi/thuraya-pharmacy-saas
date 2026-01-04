/**
 * @fileoverview Data Service - Centralized data management for all domains
 * @description Provides typed API access for:
 * - Branches
 * - Products
 * - Suppliers
 * - Customers
 * - Invoices
 * - Purchase Orders
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { ApiService, PaginatedResponse, QueryParams } from './api.service';
import { StoreService } from './store.service';

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

export interface Product {
  id: string;
  branchId: string;
  name: string;
  genericName: string;
  sku: string;
  price: number;
  cost: number;
  margin: number;
  stock: number;
  expiryDate?: string;
  category: string;
  supplierId?: string;
  supplierName?: string;
  minStock: number;
  location: string;
  batches?: ProductBatch[];
}

export interface ProductBatch {
  id: string;
  poRef: string;
  batchNumber: string;
  quantity: number;
  cost: number;
  expiryDate: string;
  receivedDate: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  rating: number;
  status: 'Active' | 'Inactive';
  category: string;
  lastOrderDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone: string;
  billingAddress?: string;
  city?: string;
  country?: string;
  type: 'Retail' | 'Wholesale' | 'Hospital' | 'Clinic';
  paymentTerms: string;
  creditLimit: number;
  balance: number;
  priceGroup?: number;
  assignedSalesRepName?: string;
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

// ============================================================================
// Data Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly api = inject(ApiService);
  private readonly store = inject(StoreService);

  // Loading states
  private readonly _loadingBranches = signal(false);
  private readonly _loadingProducts = signal(false);
  private readonly _loadingSuppliers = signal(false);
  private readonly _loadingCustomers = signal(false);
  private readonly _loadingInvoices = signal(false);

  readonly loadingBranches = this._loadingBranches.asReadonly();
  readonly loadingProducts = this._loadingProducts.asReadonly();
  readonly loadingSuppliers = this._loadingSuppliers.asReadonly();
  readonly loadingCustomers = this._loadingCustomers.asReadonly();
  readonly loadingInvoices = this._loadingInvoices.asReadonly();

  // Cache subjects for real-time updates
  private branchesCache$ = new BehaviorSubject<Branch[]>([]);
  private productsCache$ = new BehaviorSubject<Product[]>([]);
  private suppliersCache$ = new BehaviorSubject<Supplier[]>([]);
  private customersCache$ = new BehaviorSubject<Customer[]>([]);

  // ============================================================================
  // Branches
  // ============================================================================

  getBranches(params?: QueryParams): Observable<PaginatedResponse<Branch>> {
    this._loadingBranches.set(true);
    return this.api.get<PaginatedResponse<Branch>>('branches', params).pipe(
      tap(response => {
        this._loadingBranches.set(false);
        this.branchesCache$.next(response.items);
        // Also update store
        this.store.setBranches(response.items.map(b => ({
          id: b.id,
          name: b.name,
          code: b.code,
          location: b.location,
          isOfflineEnabled: b.isOfflineEnabled,
          licenseCount: b.licenseCount
        })));
      })
    );
  }

  getBranch(id: string): Observable<Branch> {
    return this.api.get<Branch>(`branches/${id}`);
  }

  createBranch(data: Partial<Branch>): Observable<Branch> {
    return this.api.post<Branch>('branches', data).pipe(
      tap(branch => {
        const current = this.branchesCache$.value;
        this.branchesCache$.next([...current, branch]);
      })
    );
  }

  updateBranch(id: string, data: Partial<Branch>): Observable<Branch> {
    return this.api.put<Branch>(`branches/${id}`, data).pipe(
      tap(updated => {
        const current = this.branchesCache$.value;
        const index = current.findIndex(b => b.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.branchesCache$.next([...current]);
        }
      })
    );
  }

  deleteBranch(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`branches/${id}`).pipe(
      tap(() => {
        const current = this.branchesCache$.value;
        this.branchesCache$.next(current.filter(b => b.id !== id));
      })
    );
  }

  // ============================================================================
  // Products
  // ============================================================================

  getProducts(params?: QueryParams): Observable<PaginatedResponse<Product>> {
    this._loadingProducts.set(true);
    return this.api.get<PaginatedResponse<Product>>('products', params).pipe(
      tap(response => {
        this._loadingProducts.set(false);
        this.productsCache$.next(response.items);
      })
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

  createProduct(data: Partial<Product> & { initialStock?: number }): Observable<Product> {
    return this.api.post<Product>('products', data).pipe(
      tap(product => {
        const current = this.productsCache$.value;
        this.productsCache$.next([...current, product]);
      })
    );
  }

  updateProduct(id: string, data: Partial<Product>): Observable<Product> {
    return this.api.put<Product>(`products/${id}`, data).pipe(
      tap(updated => {
        const current = this.productsCache$.value;
        const index = current.findIndex(p => p.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.productsCache$.next([...current]);
        }
      })
    );
  }

  deleteProduct(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`products/${id}`).pipe(
      tap(() => {
        const current = this.productsCache$.value;
        this.productsCache$.next(current.filter(p => p.id !== id));
      })
    );
  }

  // ============================================================================
  // Suppliers
  // ============================================================================

  getSuppliers(params?: QueryParams): Observable<PaginatedResponse<Supplier>> {
    this._loadingSuppliers.set(true);
    return this.api.get<PaginatedResponse<Supplier>>('suppliers', params).pipe(
      tap(response => {
        this._loadingSuppliers.set(false);
        this.suppliersCache$.next(response.items);
      })
    );
  }

  getSupplier(id: string): Observable<Supplier> {
    return this.api.get<Supplier>(`suppliers/${id}`);
  }

  getSupplierStats(): Observable<SupplierStats> {
    return this.api.get<SupplierStats>('suppliers/stats');
  }

  createSupplier(data: Partial<Supplier>): Observable<Supplier> {
    return this.api.post<Supplier>('suppliers', data).pipe(
      tap(supplier => {
        const current = this.suppliersCache$.value;
        this.suppliersCache$.next([...current, supplier]);
      })
    );
  }

  updateSupplier(id: string, data: Partial<Supplier>): Observable<Supplier> {
    return this.api.put<Supplier>(`suppliers/${id}`, data).pipe(
      tap(updated => {
        const current = this.suppliersCache$.value;
        const index = current.findIndex(s => s.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.suppliersCache$.next([...current]);
        }
      })
    );
  }

  deleteSupplier(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`suppliers/${id}`).pipe(
      tap(() => {
        const current = this.suppliersCache$.value;
        this.suppliersCache$.next(current.filter(s => s.id !== id));
      })
    );
  }

  // ============================================================================
  // Customers
  // ============================================================================

  getCustomers(params?: QueryParams): Observable<PaginatedResponse<Customer>> {
    this._loadingCustomers.set(true);
    return this.api.get<PaginatedResponse<Customer>>('customers', params).pipe(
      tap(response => {
        this._loadingCustomers.set(false);
        this.customersCache$.next(response.items);
      })
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
    return this.api.post<Customer>('customers', data).pipe(
      tap(customer => {
        const current = this.customersCache$.value;
        this.customersCache$.next([...current, customer]);
      })
    );
  }

  updateCustomer(id: string, data: Partial<Customer>): Observable<Customer> {
    return this.api.put<Customer>(`customers/${id}`, data).pipe(
      tap(updated => {
        const current = this.customersCache$.value;
        const index = current.findIndex(c => c.id === id);
        if (index >= 0) {
          current[index] = updated;
          this.customersCache$.next([...current]);
        }
      })
    );
  }

  deleteCustomer(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`customers/${id}`).pipe(
      tap(() => {
        const current = this.customersCache$.value;
        this.customersCache$.next(current.filter(c => c.id !== id));
      })
    );
  }

  // ============================================================================
  // Invoices / Sales
  // ============================================================================

  getInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    this._loadingInvoices.set(true);
    return this.api.get<PaginatedResponse<Invoice>>('invoices', params).pipe(
      tap(() => this._loadingInvoices.set(false))
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
    return this.api.post<Invoice>('invoices', data);
  }

  updateInvoiceStatus(id: string, status: string, paidAmount?: number): Observable<Invoice> {
    return this.api.put<Invoice>(`invoices/${id}/status`, { status, paidAmount });
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
    // This would ideally be a single endpoint, but we can combine multiple calls
    return new Observable(observer => {
      Promise.all([
        this.getProductStats(branchId).toPromise(),
        this.getTodaySales(branchId).toPromise(),
        this.getLowStockProducts(branchId).toPromise(),
        this.getExpiringProducts(branchId, 30).toPromise()
      ]).then(([productStats, todaySales, lowStockProducts, expiringProducts]) => {
        observer.next({
          productStats: productStats!,
          todaySales: todaySales!,
          lowStockProducts: lowStockProducts || [],
          expiringProducts: expiringProducts || []
        });
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Load initial data for the application
   */
  loadInitialData(): Observable<boolean> {
    return new Observable(observer => {
      // Load branches first as other data depends on them
      this.getBranches({ pageSize: 100 }).subscribe({
        next: () => {
          observer.next(true);
          observer.complete();
        },
        error: (error) => {
          console.error('Failed to load initial data:', error);
          observer.next(false);
          observer.complete();
        }
      });
    });
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

