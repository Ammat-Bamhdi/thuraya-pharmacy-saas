/**
 * User API Service
 * Handles all user-related HTTP operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  // TODO: Connect to real backend
  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  update(id: string, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  bulkInvite(users: Omit<User, 'id'>[]): Observable<User[]> {
    return this.http.post<User[]>(`${this.apiUrl}/bulk-invite`, users);
  }

  getByBranch(branchId: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/by-branch/${branchId}`);
  }
}
