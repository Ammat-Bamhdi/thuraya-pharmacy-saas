/**
 * Sales API Service
 * Handles all sales and CRM operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Invoice, Customer } from '../../models';
import { ApiService, PaginatedResponse, QueryParams } from '../../core/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class SalesApiService {
  private readonly api = inject(ApiService);

  // Invoice operations
  getAllInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    return this.api.get<PaginatedResponse<Invoice>>('invoices', params);
  }

  getInvoiceById(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(`invoices/${id}`);
  }

  createInvoice(invoice: Omit<Invoice, 'id'>): Observable<Invoice> {
    return this.api.post<Invoice>('invoices', invoice);
  }

  updateInvoice(id: string, invoice: Partial<Invoice>): Observable<Invoice> {
    return this.api.put<Invoice>(`invoices/${id}`, invoice);
  }

  // Customer operations
  getAllCustomers(params?: QueryParams): Observable<PaginatedResponse<Customer>> {
    return this.api.get<PaginatedResponse<Customer>>('customers', params);
  }

  getCustomerById(id: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${id}`);
  }

  createCustomer(customer: Omit<Customer, 'id'>): Observable<Customer> {
    return this.api.post<Customer>('customers', customer);
  }

  updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
    return this.api.put<Customer>(`customers/${id}`, customer);
  }

  deleteCustomer(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`customers/${id}`);
  }

  // Customer search
  searchCustomers(query: string): Observable<Customer[]> {
    return this.api.get<Customer[]>('customers/search', { q: query });
  }
}
