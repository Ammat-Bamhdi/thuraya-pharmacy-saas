/**
 * Branch API Service
 * Handles all branch-related HTTP operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Branch } from '../../models';
import { ApiService, PaginatedResponse, QueryParams } from '../../core/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class BranchApiService {
  constructor() { }
  private readonly api = inject(ApiService);
  private readonly endpoint = 'branches';

  getAll(params?: QueryParams): Observable<PaginatedResponse<Branch>> {
    return this.api.get<PaginatedResponse<Branch>>(this.endpoint, params);
  }

  getById(id: string): Observable<Branch> {
    return this.api.get<Branch>(`${this.endpoint}/${id}`);
  }

  create(branch: Omit<Branch, 'id'>): Observable<Branch> {
    return this.api.post<Branch>(this.endpoint, branch);
  }

  update(id: string, branch: Partial<Branch>): Observable<Branch> {
    return this.api.put<Branch>(`${this.endpoint}/${id}`, branch);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>(`${this.endpoint}/${id}`);
  }

  bulkCreate(items: Omit<Branch, 'id'>[]): Observable<Branch[]> {
    return this.api.post<Branch[]>(`${this.endpoint}/bulk`, { items });
  }
}
