/**
 * @fileoverview Onboarding Service - Handles API calls during tenant setup
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, tap, catchError, switchMap, concatMap, reduce } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { StoreService, Role } from './store.service';

// DTOs for API requests
export interface UpdateTenantRequest {
  name: string;
  country: string;
  currency: string;
  language?: string;
}

export interface CreateBranchRequest {
  name: string;
  code: string;
  location: string;
  isOfflineEnabled: boolean;
  licenseCount: number;
  managerId?: string;
}

export interface InviteUserRequest {
  email: string;
  name: string;
  role: string;
  branchId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
}

export interface BranchDto {
  id: string;
  name: string;
  code: string;
  location: string;
  isOfflineEnabled: boolean;
  licenseCount: number;
  managerId?: string;
  managerName?: string;
}

export interface TenantDto {
  id: string;
  name: string;
  country: string;
  currency: string;
  language: string;
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(StoreService);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Update the tenant organization details
   */
  updateTenant(data: UpdateTenantRequest): Observable<TenantDto> {
    return this.http.put<ApiResponse<TenantDto>>(`${this.apiUrl}/tenants/current`, data).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to update tenant');
        }
        return response.data;
      }),
      tap(tenant => {
        // Update local store
        this.store.setTenant({
          id: tenant.id,
          name: tenant.name,
          country: tenant.country,
          currency: tenant.currency,
          language: tenant.language as 'en' | 'ar'
        });
      }),
      catchError(error => {
        console.error('Failed to update tenant:', error);
        throw error;
      })
    );
  }

  /**
   * Create a single branch
   */
  createBranch(data: { name: string; location: string; isOfflineEnabled?: boolean }): Observable<BranchDto> {
    const request: CreateBranchRequest = {
      name: data.name,
      code: this.generateBranchCode(data.name),
      location: data.location,
      isOfflineEnabled: data.isOfflineEnabled ?? true,
      licenseCount: 1
    };

    return this.http.post<ApiResponse<BranchDto>>(`${this.apiUrl}/branches`, request).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to create branch');
        }
        return response.data;
      }),
      tap(branch => {
        // Add to local store
        this.store.addBranchFromApi({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          location: branch.location,
          isOfflineEnabled: branch.isOfflineEnabled,
          licenseCount: branch.licenseCount
        });
      }),
      catchError(error => {
        console.error('Failed to create branch:', error);
        throw error;
      })
    );
  }

  /**
   * Create multiple branches using bulk endpoint with batching
   * Handles large lists (500+) efficiently
   */
  createBranches(branches: { name: string; location: string }[]): Observable<BranchDto[]> {
    if (branches.length === 0) {
      return of([]);
    }

    // Convert to API request format
    const items: CreateBranchRequest[] = branches.map(b => ({
      name: b.name,
      code: this.generateBranchCode(b.name),
      location: b.location,
      isOfflineEnabled: true,
      licenseCount: 1
    }));

    // For large lists, split into batches and process sequentially
    const BATCH_SIZE = 200;
    if (items.length <= BATCH_SIZE) {
      // Small list - single bulk request
      return this.bulkCreateBranches(items);
    }

    // Large list - split into batches and process sequentially
    const batches: CreateBranchRequest[][] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    // Process batches sequentially to avoid overwhelming the server
    return from(batches).pipe(
      concatMap(batch => this.bulkCreateBranches(batch)),
      reduce((acc: BranchDto[], batch: BranchDto[]) => [...acc, ...batch], [])
    );
  }

  /**
   * Bulk create branches via single API call
   */
  private bulkCreateBranches(items: CreateBranchRequest[]): Observable<BranchDto[]> {
    return this.http.post<ApiResponse<BranchDto[]>>(`${this.apiUrl}/branches/bulk`, { items }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to create branches');
        }
        return response.data;
      }),
      tap(branches => {
        // Add all to local store
        branches.forEach(branch => {
          this.store.addBranchFromApi({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            location: branch.location,
            isOfflineEnabled: branch.isOfflineEnabled,
            licenseCount: branch.licenseCount
          });
        });
      }),
      catchError(error => {
        console.error('Bulk branch creation failed:', error);
        throw error;
      })
    );
  }

  /**
   * Invite a team member
   */
  inviteUser(data: { email: string; name: string; role: Role; branchId?: string }): Observable<any> {
    const request: InviteUserRequest = {
      email: data.email,
      name: data.name,
      role: this.mapRoleToApi(data.role),
      branchId: data.branchId
    };

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/users/invite`, request).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to invite user');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Failed to invite user:', error);
        throw error;
      })
    );
  }

  /**
   * Invite multiple team members
   */
  inviteUsers(users: { email: string; name: string; role: Role; branchId?: string }[]): Observable<any[]> {
    if (users.length === 0) {
      return of([]);
    }

    const requests = users.map(u => this.inviteUser(u).pipe(catchError(() => of(null))));
    return forkJoin(requests);
  }

  /**
   * Complete the onboarding process
   */
  completeOnboarding(
    tenant: UpdateTenantRequest,
    branches: { name: string; location: string }[],
    teamMembers: { name: string; email: string; role: Role; branchIndex: number }[]
  ): Observable<{ tenant: TenantDto; branches: BranchDto[]; invitations: any[] }> {
    // Step 1: Update tenant
    return this.updateTenant(tenant).pipe(
      // Step 2: Create branches
      switchMap(tenantResult => {
        return this.createBranches(branches).pipe(
          map(branchesResult => ({ tenant: tenantResult, branches: branchesResult }))
        );
      }),
      // Step 3: Invite team members
      switchMap(({ tenant, branches }) => {
        // Map branch indices to actual branch IDs
        const usersWithBranchIds = teamMembers.map(member => ({
          email: member.email,
          name: member.name,
          role: member.role,
          branchId: branches[member.branchIndex]?.id || branches[0]?.id
        }));

        return this.inviteUsers(usersWithBranchIds).pipe(
          map(invitations => ({ tenant, branches, invitations }))
        );
      })
    );
  }

  /**
   * Generate a branch code from name
   */
  private generateBranchCode(name: string): string {
    const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const suffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${prefix}-${suffix}`;
  }

  /**
   * Map frontend role to API role format
   */
  private mapRoleToApi(role: Role): string {
    const roleMap: Record<Role, string> = {
      'super_admin': 'SuperAdmin',
      'branch_admin': 'BranchAdmin',
      'section_admin': 'SectionAdmin'
    };
    return roleMap[role] || 'SectionAdmin';
  }
}

