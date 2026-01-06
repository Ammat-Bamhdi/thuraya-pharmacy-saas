/**
 * Product API Service
 * Handles all product-related HTTP operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../../models';
import { ApiService, PaginatedResponse, QueryParams } from '../../core/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class ProductApiService {
  private readonly api = inject(ApiService);
  private readonly endpoint = 'products';

  getAll(params?: QueryParams): Observable<PaginatedResponse<Product>> {
    return this.api.get<PaginatedResponse<Product>>(this.endpoint, params);
  }

  getById(id: string): Observable<Product> {
    return this.api.get<Product>(`${this.endpoint}/${id}`);
  }

  create(product: Omit<Product, 'id'>): Observable<Product> {
    return this.api.post<Product>(this.endpoint, product);
  }

  update(id: string, product: Partial<Product>): Observable<Product> {
    return this.api.put<Product>(`${this.endpoint}/${id}`, product);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`${this.endpoint}/${id}`);
  }

  search(query: string): Observable<Product[]> {
    return this.api.get<Product[]>(`${this.endpoint}/search`, { q: query });
  }

  getLowStock(): Observable<Product[]> {
    return this.api.get<Product[]>(`${this.endpoint}/low-stock`);
  }

  getExpiringSoon(): Observable<Product[]> {
    return this.api.get<Product[]>(`${this.endpoint}/expiring-soon`);
  }
}
