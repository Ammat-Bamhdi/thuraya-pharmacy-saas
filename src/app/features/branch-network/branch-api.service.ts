/**
 * Branch API Service
 * Handles all branch-related HTTP operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Branch } from '../../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BranchApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/branches`;

  // TODO: Connect to real backend
  getAll(): Observable<Branch[]> {
    return this.http.get<Branch[]>(this.apiUrl);
  }

  getById(id: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.apiUrl}/${id}`);
  }

  create(branch: Omit<Branch, 'id'>): Observable<Branch> {
    return this.http.post<Branch>(this.apiUrl, branch);
  }

  update(id: string, branch: Partial<Branch>): Observable<Branch> {
    return this.http.put<Branch>(`${this.apiUrl}/${id}`, branch);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  bulkCreate(branches: Omit<Branch, 'id'>[]): Observable<Branch[]> {
    return this.http.post<Branch[]>(`${this.apiUrl}/bulk`, branches);
  }
}
