/**
 * Procurement API Service
 * Handles all procurement and supplier operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PurchaseOrder, Supplier } from '../../models';
import { ApiService, PaginatedResponse, QueryParams } from '../../core/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class ProcurementApiService {
  private readonly api = inject(ApiService);

  // Purchase Order operations
  getAllPurchaseOrders(params?: QueryParams): Observable<PaginatedResponse<PurchaseOrder>> {
    return this.api.get<PaginatedResponse<PurchaseOrder>>('purchase-orders', params);
  }

  getPurchaseOrderById(id: string): Observable<PurchaseOrder> {
    return this.api.get<PurchaseOrder>(`purchase-orders/${id}`);
  }

  createPurchaseOrder(po: Omit<PurchaseOrder, 'id'>): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>('purchase-orders', po);
  }

  updatePurchaseOrder(id: string, po: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    return this.api.put<PurchaseOrder>(`purchase-orders/${id}`, po);
  }

  approvePurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>(`purchase-orders/${id}/approve`, {});
  }

  receivePurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>(`purchase-orders/${id}/receive`, {});
  }

  // Supplier operations
  getAllSuppliers(params?: QueryParams): Observable<PaginatedResponse<Supplier>> {
    return this.api.get<PaginatedResponse<Supplier>>('suppliers', params);
  }

  getSupplierById(id: string): Observable<Supplier> {
    return this.api.get<Supplier>(`suppliers/${id}`);
  }

  createSupplier(supplier: Omit<Supplier, 'id'>): Observable<Supplier> {
    return this.api.post<Supplier>('suppliers', supplier);
  }

  updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier> {
    return this.api.put<Supplier>(`suppliers/${id}`, supplier);
  }

  deleteSupplier(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`suppliers/${id}`);
  }
}
