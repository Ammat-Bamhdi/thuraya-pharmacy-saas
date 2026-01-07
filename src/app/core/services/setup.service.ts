/**
 * @fileoverview Setup Status Service
 * @description Handles setup completion tracking and manager assignment operations.
 * Used by the dashboard to show setup progress and guide users through
 * completing their branch manager assignments.
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 * 
 * @example
 * // In a component:
 * setupService.getSetupStatus().subscribe(status => {
 *   if (status.requiresAttention) {
 *     // Show setup card
 *   }
 * });
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// =============================================================================
// DTOs
// =============================================================================

/**
 * Setup status from the backend.
 * Shows manager assignment completion for branches.
 */
export interface SetupStatus {
  totalBranches: number;
  branchesWithManagers: number;
  branchesWithoutManagers: number;
  completionPercentage: number;
  isSetupComplete: boolean;
  requiresAttention: boolean;
}

/**
 * Branch DTO for manager assignment.
 */
export interface BranchForAssignment {
  id: string;
  name: string;
  code: string;
  location: string;
  managerId?: string;
  managerName?: string;
}

/**
 * Manager option for dropdown selection.
 * Lightweight DTO optimized for UI performance.
 */
export interface ManagerOption {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedBranchCount: number;
}

/**
 * Request to assign manager to multiple branches.
 */
export interface BulkAssignManagerRequest {
  branchIds: string[];
  managerId: string;
}

/**
 * Response from bulk manager assignment.
 */
export interface BulkAssignManagerResponse {
  successCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Paginated response for branches.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable({
  providedIn: 'root'
})
export class SetupService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // ---------------------------------------------------------------------------
  // Reactive State
  // ---------------------------------------------------------------------------

  /** Current setup status - cached and reactive */
  private _setupStatus = new BehaviorSubject<SetupStatus | null>(null);
  
  /** Observable of current setup status */
  readonly setupStatus$ = this._setupStatus.asObservable();

  /** Signal for setup status (for use with Angular signals) */
  readonly setupStatus = signal<SetupStatus | null>(null);

  /** Computed: Does setup require attention? */
  readonly requiresAttention = computed(() => {
    const status = this.setupStatus();
    return status ? status.requiresAttention : false;
  });

  /** Computed: Setup completion percentage */
  readonly completionPercentage = computed(() => {
    const status = this.setupStatus();
    return status ? status.completionPercentage : 0;
  });

  /** Computed: Number of branches needing managers */
  readonly pendingBranchCount = computed(() => {
    const status = this.setupStatus();
    return status ? status.branchesWithoutManagers : 0;
  });

  // ---------------------------------------------------------------------------
  // Setup Status Operations
  // ---------------------------------------------------------------------------

  /**
   * Fetches the current setup status from the backend.
   * 
   * @remarks
   * This endpoint returns:
   * - Total branches count
   * - Branches with/without managers
   * - Completion percentage
   * - Flags for UI decisions
   * 
   * @returns Observable<SetupStatus>
   */
  getSetupStatus(): Observable<SetupStatus> {
    return this.http.get<ApiResponse<SetupStatus>>(`${this.apiUrl}/branches/setup-status`).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get setup status');
        }
        return response.data;
      }),
      tap(status => {
        this._setupStatus.next(status);
        this.setupStatus.set(status);
      }),
      catchError(error => {
        console.error('Failed to get setup status:', error);
        // Return default status on error
        const defaultStatus: SetupStatus = {
          totalBranches: 0,
          branchesWithManagers: 0,
          branchesWithoutManagers: 0,
          completionPercentage: 100,
          isSetupComplete: true,
          requiresAttention: false
        };
        return of(defaultStatus);
      })
    );
  }

  /**
   * Refreshes the setup status.
   * Call this after manager assignments to update the UI.
   */
  refreshSetupStatus(): void {
    this.getSetupStatus().subscribe();
  }

  // ---------------------------------------------------------------------------
  // Branch Operations
  // ---------------------------------------------------------------------------

  /**
   * Gets branches that don't have a manager assigned.
   * 
   * @param page - Page number (1-based)
   * @param pageSize - Items per page
   * @param search - Optional search term
   * @returns Paginated list of branches without managers
   */
  getBranchesWithoutManager(
    page: number = 1, 
    pageSize: number = 50, 
    search?: string
  ): Observable<PaginatedResponse<BranchForAssignment>> {
    const params: any = { page, pageSize };
    if (search) params.search = search;

    return this.http.get<ApiResponse<PaginatedResponse<BranchForAssignment>>>(
      `${this.apiUrl}/branches/without-manager`,
      { params }
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get branches');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Failed to get branches without manager:', error);
        throw error;
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Manager Operations
  // ---------------------------------------------------------------------------

  /**
   * Gets users available to be assigned as branch managers.
   * Only includes SuperAdmin and BranchAdmin roles.
   * 
   * @returns List of manager options for dropdown selection
   */
  getAvailableManagers(): Observable<ManagerOption[]> {
    return this.http.get<ApiResponse<ManagerOption[]>>(
      `${this.apiUrl}/branches/available-managers`
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get managers');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Failed to get available managers:', error);
        return of([]);
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Assignment Operations
  // ---------------------------------------------------------------------------

  /**
   * Assigns a manager to multiple branches at once.
   * 
   * @param branchIds - Array of branch IDs to assign
   * @param managerId - The user ID of the manager
   * @returns Response with success/failure counts
   * 
   * @example
   * setupService.bulkAssignManager(['branch-1', 'branch-2'], 'manager-id')
   *   .subscribe(result => {
   *     console.log(`Assigned ${result.successCount} branches`);
   *   });
   */
  bulkAssignManager(branchIds: string[], managerId: string): Observable<BulkAssignManagerResponse> {
    const request: BulkAssignManagerRequest = { branchIds, managerId };

    return this.http.post<ApiResponse<BulkAssignManagerResponse>>(
      `${this.apiUrl}/branches/bulk-assign-manager`,
      request
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to assign manager');
        }
        return response.data;
      }),
      tap(() => {
        // Refresh setup status after assignment
        this.refreshSetupStatus();
      }),
      catchError(error => {
        console.error('Failed to bulk assign manager:', error);
        throw error;
      })
    );
  }

  /**
   * Assigns a manager to a single branch.
   * Convenience method that wraps bulkAssignManager.
   * 
   * @param branchId - The branch ID to assign
   * @param managerId - The user ID of the manager
   */
  assignManager(branchId: string, managerId: string): Observable<BulkAssignManagerResponse> {
    return this.bulkAssignManager([branchId], managerId);
  }
}

