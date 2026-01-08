/**
 * @fileoverview Manager Assignment Component
 * @description Dedicated page for assigning managers to branches that don't have one.
 * Supports bulk operations, search, and pagination for handling large datasets.
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 * 
 * @features
 * - Paginated list of branches without managers
 * - Search/filter functionality
 * - Bulk selection with "Select All" option
 * - Manager dropdown for each branch or bulk assignment
 * - Progress tracking with completion percentage
 * - Responsive design for mobile/desktop
 * 
 * @architecture
 * - Uses OnPush change detection for performance
 * - Signal-based reactive state
 * - Lazy-loaded as a standalone component
 */

import { 
  Component, 
  OnInit, 
  inject, 
  signal, 
  computed,
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  SetupService, 
  BranchForAssignment, 
  ManagerOption,
  SetupStatus 
} from '@core/services/setup.service';
import { StoreService } from '@core/services/store.service';
import { IconComponent } from '@shared/components/icons/icons.component';

/**
 * Extended branch with selection state for UI.
 */
interface SelectableBranch extends BranchForAssignment {
  selected: boolean;
  selectedManagerId?: string;
}

@Component({
  selector: 'app-manager-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col gap-4 animate-fade-in overflow-hidden bg-slate-50 p-2 md:p-4 rounded-xl">
      
      <!-- Header -->
      <header class="shrink-0 flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <button 
            (click)="goBack()"
            class="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors shadow-sm"
            aria-label="Go back to dashboard"
          >
            <app-icon name="arrow-left" [size]="20" class="text-slate-600"></app-icon>
          </button>
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-800">
              Assign Branch Managers
            </h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Pick a manager for each branch and track completion in real time.
            </p>
          </div>
        </div>
      </header>

      <!-- Status / Overview -->
      @if (setupStatus(); as status) {
        <section class="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <div 
                class="w-3 h-3 rounded-full"
                [class.bg-emerald-500]="status.isSetupComplete"
                [class.bg-amber-500]="!status.isSetupComplete"
              ></div>
              <span class="text-sm font-medium text-slate-700">
                {{ status.branchesWithManagers }} of {{ status.totalBranches }} branches assigned
              </span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                <div 
                  class="h-full transition-all duration-700 ease-out relative"
                  [class.bg-emerald-500]="status.completionPercentage === 100"
                  [class.bg-teal-500]="status.completionPercentage < 100"
                  [style.width.%]="status.completionPercentage"
                >
                  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <span class="text-sm font-bold min-w-[3rem] text-right"
                [class.text-emerald-600]="status.completionPercentage === 100"
                [class.text-teal-600]="status.completionPercentage < 100"
              >
                {{ status.completionPercentage }}%
              </span>
            </div>
            @if (status.isSetupComplete) {
              <div class="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                <app-icon name="check" [size]="16"></app-icon>
                All branches assigned!
              </div>
            } @else {
              <div class="text-xs text-slate-500">
                Pending: {{ status.branchesWithoutManagers }} branch(es)
              </div>
            }
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 lg:col-span-2">
            <div class="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
              <div class="flex flex-wrap gap-2 items-center">
                <span class="text-sm font-semibold text-slate-700">Filters</span>
                <div class="relative w-full sm:w-72">
                  <app-icon 
                    name="search" 
                    [size]="18" 
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  ></app-icon>
                  <input 
                    type="text"
                    [ngModel]="searchTerm()"
                    (ngModelChange)="onSearchChange($event)"
                    placeholder="Search branches..."
                    class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                  />
                </div>
              </div>

              <div class="flex flex-wrap gap-2 items-center">
                <div class="text-sm text-slate-500">
                  Showing {{ (currentPage() - 1) * pageSize() + 1 }} - {{ Math.min(currentPage() * pageSize(), totalCount()) }} of {{ totalCount() }}
                </div>
                <div class="flex items-center gap-1">
                  <button 
                    (click)="previousPage()"
                    [disabled]="currentPage() === 1"
                    class="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <app-icon name="chevron-left" [size]="18"></app-icon>
                  </button>
                  <span class="text-sm font-medium text-slate-700 px-2">
                    Page {{ currentPage() }} / {{ totalPages() }}
                  </span>
                  <button 
                    (click)="nextPage()"
                    [disabled]="currentPage() === totalPages()"
                    class="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <app-icon name="chevron-right" [size]="18"></app-icon>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2 items-center bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
              <span class="text-sm font-medium text-teal-700">Bulk assign</span>
              <select 
                [ngModel]="bulkManagerId()"
                (ngModelChange)="bulkManagerId.set($event)"
                class="px-3 py-1.5 border border-teal-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select manager...</option>
                @for (manager of managers(); track manager.id) {
                  <option [value]="manager.id">
                    {{ manager.name }} ({{ manager.assignedBranchCount }} branches)
                  </option>
                }
              </select>
              <button 
                (click)="assignBulk()"
                [disabled]="!bulkManagerId() || selectedCount() === 0 || isAssigning()"
                class="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                @if (isAssigning()) {
                  <app-icon name="loader" [size]="16" class="animate-spin"></app-icon>
                }
                Assign selected ({{ selectedCount() }})
              </button>
              <button 
                (click)="clearSelection()"
                class="p-2 text-teal-700 hover:bg-teal-100 rounded-lg transition-colors text-sm"
                aria-label="Clear selection"
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      }

      <!-- Branch List -->
      <section class="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

        <!-- Loading -->
        @if (isLoading()) {
          <div class="flex-1 flex items-center justify-center p-8">
            <div class="flex flex-col items-center gap-3 text-slate-500">
              <app-icon name="loader" [size]="32" class="text-teal-600 animate-spin"></app-icon>
              <p class="text-sm">Loading branches...</p>
            </div>
          </div>
        }

        <!-- Empty -->
        @else if (branches().length === 0) {
          <div class="flex-1 flex items-center justify-center p-8">
            <div class="text-center max-w-sm">
              <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <app-icon name="check" [size]="32" class="text-emerald-600"></app-icon>
              </div>
              <h3 class="text-lg font-semibold text-slate-800 mb-2">All caught up!</h3>
              <p class="text-sm text-slate-500">
                @if (searchTerm()) {
                  No branches found matching "{{ searchTerm() }}".
                } @else {
                  All branches have managers assigned. Great job!
                }
              </p>
              @if (searchTerm()) {
                <button 
                  (click)="clearSearch()"
                  class="mt-4 text-sm text-teal-600 hover:underline"
                >
                  Clear search
                </button>
              }
            </div>
          </div>
        }

        <!-- List -->
        @else {
          <div class="flex-1 overflow-y-auto divide-y divide-slate-100">
            @for (branch of branches(); track branch.id) {
              <div 
                class="flex flex-col md:grid md:grid-cols-12 gap-3 px-4 py-3 transition-all duration-300 hover:bg-slate-50"
                [class.bg-teal-50]="branch.selected"
                [class.opacity-60]="assigningBranchId() === branch.id"
              >
                <!-- Checkbox -->
                <div class="md:col-span-1 flex items-start pt-1">
                  <input 
                    type="checkbox"
                    [checked]="branch.selected"
                    (change)="toggleBranch(branch)"
                    class="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </div>

                <!-- Branch info -->
                <div class="md:col-span-5 flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-slate-800">{{ branch.name }}</span>
                    <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ branch.code }}</span>
                  </div>
                  <div class="text-sm text-slate-500">{{ branch.location || '—' }}</div>
                </div>

                <!-- Manager assignment -->
                <div class="md:col-span-6 flex flex-col md:flex-row md:items-center gap-2">
                  <select 
                    [ngModel]="branch.selectedManagerId"
                    (ngModelChange)="onManagerSelect(branch, $event)"
                    [disabled]="assigningBranchId() === branch.id"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <option value="">Select manager...</option>
                    @for (manager of managers(); track manager.id) {
                      <option [value]="manager.id">{{ manager.name }}</option>
                    }
                  </select>

                  <div class="flex items-center gap-2">
                    @if (assigningBranchId() === branch.id) {
                      <div class="px-3 py-2 bg-teal-100 rounded-lg flex items-center justify-center min-w-[36px]">
                        <app-icon name="loader" [size]="16" class="text-teal-600 animate-spin"></app-icon>
                      </div>
                    } @else {
                      <button 
                        (click)="assignSingle(branch)"
                        [disabled]="!branch.selectedManagerId"
                        class="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-2 min-w-[44px]"
                        title="Assign manager"
                      >
                        <app-icon name="check" [size]="16"></app-icon>
                        <span class="text-sm font-medium hidden sm:inline">Assign</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Toast -->
      @if (showSuccess()) {
        <div 
          class="fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in z-50 min-w-[300px]"
          [class.bg-emerald-600]="successMessage() && !successMessage()!.startsWith('Error')"
          [class.bg-red-600]="successMessage() && successMessage()!.startsWith('Error')"
          [class.text-white]="true"
          [class.ring-2]="true"
          [class.ring-emerald-300]="successMessage() && !successMessage()!.startsWith('Error')"
          [class.ring-red-300]="successMessage() && successMessage()!.startsWith('Error')"
        >
          @if (successMessage() && successMessage()!.startsWith('Error')) {
            <div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <app-icon name="alert-circle" [size]="20"></app-icon>
            </div>
          } @else {
            <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-bounce">
              <app-icon name="check" [size]="20"></app-icon>
            </div>
          }
          <span class="font-semibold flex-1">{{ successMessage() }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-slide-in {
      animation: slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .animate-shimmer {
      animation: shimmer 2s infinite;
    }
    
    @keyframes fade-out {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.95); }
    }
    .animate-fade-out {
      animation: fade-out 0.3s ease-in;
    }
  `]
})
export class ManagerAssignmentComponent implements OnInit {
  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------
  
  private readonly setupService = inject(SetupService);
  private readonly store = inject(StoreService);

  // Expose Math to template
  protected readonly Math = Math;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Loading state */
  readonly isLoading = signal(true);

  /** Assignment in progress */
  readonly isAssigning = signal(false);
  
  /** Track which branch is currently being assigned */
  readonly assigningBranchId = signal<string | null>(null);
  
  /** Track branches that were just assigned (for animation) */
  readonly recentlyAssigned = signal<Set<string>>(new Set());

  /** Setup status */
  readonly setupStatus = signal<SetupStatus | null>(null);

  /** Available managers for dropdown */
  readonly managers = signal<ManagerOption[]>([]);

  /** Branches without managers (with selection state) */
  readonly branches = signal<SelectableBranch[]>([]);

  /** Search term */
  readonly searchTerm = signal('');

  /** Debounce timer for search */
  private searchTimer: any = null;

  /** Current page */
  readonly currentPage = signal(1);

  /** Page size */
  readonly pageSize = signal(50);

  /** Total count */
  readonly totalCount = signal(0);

  /** Bulk manager selection */
  readonly bulkManagerId = signal('');

  /** Success toast */
  readonly showSuccess = signal(false);
  readonly successMessage = signal('');

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  /** Total pages */
  readonly totalPages = computed(() => 
    Math.ceil(this.totalCount() / this.pageSize()) || 1
  );

  /** Number of selected branches */
  readonly selectedCount = computed(() => 
    this.branches().filter(b => b.selected).length
  );

  /** Check if all visible branches are selected */
  readonly isAllSelected = computed(() => {
    const all = this.branches();
    return all.length > 0 && all.every(b => b.selected);
  });

  /** Check if some but not all are selected */
  readonly isPartiallySelected = computed(() => {
    const selected = this.selectedCount();
    const total = this.branches().length;
    return selected > 0 && selected < total;
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    this.loadData();
  }

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  /**
   * Loads all required data: setup status, managers, and branches.
   */
  private loadData(): void {
    this.isLoading.set(true);

    // Load setup status
    this.setupService.getSetupStatus().subscribe(status => {
      this.setupStatus.set(status);
    });

    // Load available managers
    this.setupService.getAvailableManagers().subscribe(managers => {
      this.managers.set(managers);
    });

    // Load branches
    this.loadBranches();
  }

  /**
   * Loads branches without managers with current pagination/search.
   */
  private loadBranches(): void {
    console.log('[ManagerAssignment] Loading branches...');
    this.setupService.getBranchesWithoutManager(
      this.currentPage(),
      this.pageSize(),
      this.searchTerm() || undefined
    ).subscribe({
      next: (response) => {
        console.log('[ManagerAssignment] Branches loaded:', { count: response.items.length, total: response.totalCount });
        // Preserve recently assigned state when refreshing
        const recentlyAssignedSet = this.recentlyAssigned();
        this.branches.set(
          response.items.map(b => ({ 
            ...b, 
            selected: false,
            // Keep manager name if branch was recently assigned (for display)
            managerName: recentlyAssignedSet.has(b.id) ? b.managerName : undefined
          }))
        );
        this.totalCount.set(response.totalCount);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[ManagerAssignment] Failed to load branches:', error);
        this.branches.set([]);
        this.isLoading.set(false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Selection Actions
  // ---------------------------------------------------------------------------

  /**
   * Toggles selection for a single branch.
   */
  toggleBranch(branch: SelectableBranch): void {
    this.branches.update(branches => 
      branches.map(b => 
        b.id === branch.id ? { ...b, selected: !b.selected } : b
      )
    );
  }

  /**
   * Toggles select all / deselect all.
   */
  toggleSelectAll(): void {
    const shouldSelect = !this.isAllSelected();
    this.branches.update(branches => 
      branches.map(b => ({ ...b, selected: shouldSelect }))
    );
  }

  /**
   * Clears all selections.
   */
  clearSelection(): void {
    this.branches.update(branches => 
      branches.map(b => ({ ...b, selected: false }))
    );
    this.bulkManagerId.set('');
  }

  // ---------------------------------------------------------------------------
  // Manager Assignment Actions
  // ---------------------------------------------------------------------------

  /**
   * Sets the selected manager for a branch (before assignment).
   */
  onManagerSelect(branch: SelectableBranch, managerId: string): void {
    this.branches.update(branches =>
      branches.map(b =>
        b.id === branch.id ? { ...b, selectedManagerId: managerId } : b
      )
    );
  }

  /**
   * Assigns manager to a single branch with optimistic UI updates.
   */
  assignSingle(branch: SelectableBranch): void {
    if (!branch.selectedManagerId) {
      console.warn('[ManagerAssignment] No manager selected for branch:', branch.id);
      return;
    }
    if (this.assigningBranchId() === branch.id) {
      console.warn('[ManagerAssignment] Already assigning this branch:', branch.id);
      return;
    }

    const branchId = branch.id;
    const managerId = branch.selectedManagerId;
    const managerName = this.managers().find(m => m.id === managerId)?.name || 'Manager';

    console.log('[ManagerAssignment] Assigning manager:', { branchId, managerId, managerName });
    
    // Optimistic UI update - show immediate feedback
    this.assigningBranchId.set(branchId);
    
    // Store manager name in branch for display
    this.branches.update(branches =>
      branches.map(b =>
        b.id === branchId ? { ...b, managerName, selectedManagerId: managerId } : b
      )
    );
    
    // Optimistically update progress (will be corrected after backend response)
    this.updateProgressOptimistically(1);
    
    this.setupService.assignManager(branchId, managerId).subscribe({
      next: (result) => {
        console.log('[ManagerAssignment] Assignment successful:', result);
        console.log('[ManagerAssignment] Result details:', {
          successCount: result.successCount,
          failedCount: result.failedCount,
          errors: result.errors
        });
        
        // Check if assignment actually succeeded
        if (result.successCount === 0) {
          console.error('[ManagerAssignment] Assignment returned successCount 0!');
          const errorMsg = result.errors.length > 0 ? result.errors[0] : 'Assignment failed - no branches were updated';
          this.successMessage.set(`Error: ${errorMsg}`);
          this.showSuccess.set(true);
          setTimeout(() => this.showSuccess.set(false), 5000);
          
          // Revert optimistic update
          this.revertProgressOptimistically(1);
          
          // Clear assigning state
          this.assigningBranchId.set(null);
          this.isAssigning.set(false);
          return;
        }
        
        // Mark as recently assigned for visual feedback
        this.recentlyAssigned.update(set => new Set(set).add(branchId));
        
        // Show success toast with manager name
        this.showSuccessToast(`✓ ${managerName} assigned to ${branch.name}`);
        
        // Remove branch locally for immediate feedback
        this.branches.update(branches => branches.filter(b => b.id !== branchId));
        this.totalCount.update(t => Math.max(0, t - result.successCount));

        // Clear assigning state
        this.assigningBranchId.set(null);

        // Refresh status and list
        setTimeout(() => {
          this.refreshStatus();
          this.loadBranches();
        }, 500);
      },
      error: (error) => {
        console.error('[ManagerAssignment] Assignment failed:', error);
        console.error('[ManagerAssignment] Error status:', error?.status);
        console.error('[ManagerAssignment] Error message:', error?.message);
        console.error('[ManagerAssignment] Error details:', error?.error);
        
        // Revert optimistic update
        this.revertProgressOptimistically(1);
        
        // Remove manager name from branch
        this.branches.update(branches =>
          branches.map(b =>
            b.id === branchId ? { ...b, managerName: undefined, selectedManagerId: branch.selectedManagerId } : b
          )
        );
        
        // Clear assigning state on error
        console.log('[ManagerAssignment] Clearing assigning state due to error...');
        this.assigningBranchId.set(null);
        console.log('[ManagerAssignment] State cleared - assigningBranchId:', this.assigningBranchId());
        
        // Show error message
        const errorMsg = error?.error?.message || error?.message || 'Failed to assign manager';
        this.successMessage.set(`Error: ${errorMsg}`);
        this.showSuccess.set(true);
        setTimeout(() => this.showSuccess.set(false), 5000);
      }
    });
  }

  /**
   * Assigns manager to all selected branches.
   */
  assignBulk(): void {
    const selectedIds = this.branches()
      .filter(b => b.selected)
      .map(b => b.id);
    
    if (selectedIds.length === 0 || !this.bulkManagerId()) return;

    console.log('[ManagerAssignment] Bulk assigning manager:', { branchIds: selectedIds, managerId: this.bulkManagerId() });
    this.isAssigning.set(true);
    this.setupService.bulkAssignManager(selectedIds, this.bulkManagerId()).subscribe({
      next: (result) => {
        console.log('[ManagerAssignment] Bulk assignment successful:', result);
        this.showSuccessToast(`Manager assigned to ${result.successCount} branch(es)`);
        this.clearSelection();
        
        // Delay to ensure backend transaction has committed and EF Core cache is cleared
        setTimeout(() => {
          this.loadBranches(); // Refresh list - assigned branches should disappear
          this.refreshStatus(); // Refresh status and percentage
        }, 500);
        
        this.isAssigning.set(false);
      },
      error: (error) => {
        console.error('[ManagerAssignment] Bulk assignment failed:', error);
        console.error('[ManagerAssignment] Full error object:', JSON.stringify(error, null, 2));
        this.isAssigning.set(false);
        // Show error message
        const errorMsg = error?.error?.message || error?.message || 'Failed to assign manager';
        this.successMessage.set(`Error: ${errorMsg}`);
        this.showSuccess.set(true);
        setTimeout(() => this.showSuccess.set(false), 5000);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Search & Pagination
  // ---------------------------------------------------------------------------

  /**
   * Handles search term change with debounce.
   */
  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1); // Reset to first page
    
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.loadBranches();
    }, 300);
  }

  /**
   * Clears the search.
   */
  clearSearch(): void {
    this.searchTerm.set('');
    this.loadBranches();
  }

  /**
   * Goes to next page.
   */
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadBranches();
    }
  }

  /**
   * Goes to previous page.
   */
  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadBranches();
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Returns to the dashboard.
   */
  goBack(): void {
    this.store.setView('dashboard');
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  /**
   * Shows a success toast message.
   */
  private showSuccessToast(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3000);
  }

  /**
   * Refreshes the setup status to update the percentage.
   * Only updates if backend shows progress (doesn't revert optimistic updates).
   */
  private refreshStatus(): void {
    console.log('[ManagerAssignment] Refreshing setup status...');
    const currentOptimistic = this.setupStatus();
    this.setupService.getSetupStatus().subscribe({
      next: (status) => {
        console.log('[ManagerAssignment] Setup status refreshed:', status);
        
        // Only update if backend shows equal or more progress than optimistic
        // This prevents reverting optimistic updates
        if (currentOptimistic) {
          const backendProgress = status.branchesWithManagers;
          const optimisticProgress = currentOptimistic.branchesWithManagers;
          
          // Use the higher value to preserve optimistic updates
          if (backendProgress >= optimisticProgress) {
            this.setupStatus.set(status);
          } else {
            console.log('[ManagerAssignment] Backend status stale, keeping optimistic update');
            // Keep optimistic but update other fields that might have changed
            this.setupStatus.set({
              ...currentOptimistic,
              totalBranches: status.totalBranches // Update total if it changed
            });
          }
        } else {
          this.setupStatus.set(status);
        }
      },
      error: (error) => {
        console.error('[ManagerAssignment] Failed to refresh status:', error);
        // Keep current state on error
      }
    });
  }

  /**
   * Optimistically updates progress bar (before backend confirms).
   */
  private updateProgressOptimistically(count: number): void {
    const current = this.setupStatus();
    if (!current) return;
    
    const newWithManagers = current.branchesWithManagers + count;
    const newTotal = current.totalBranches;
    const newPercentage = newTotal === 0 ? 100 : Math.round((newWithManagers / newTotal) * 100);
    
    this.setupStatus.set({
      ...current,
      branchesWithManagers: newWithManagers,
      branchesWithoutManagers: newTotal - newWithManagers,
      completionPercentage: newPercentage,
      isSetupComplete: newWithManagers === newTotal,
      requiresAttention: newTotal > 0 && ((newTotal - newWithManagers) / newTotal) > 0.10
    });
  }

  /**
   * Reverts optimistic progress update on error.
   */
  private revertProgressOptimistically(count: number): void {
    const current = this.setupStatus();
    if (!current) return;
    
    const newWithManagers = Math.max(0, current.branchesWithManagers - count);
    const newTotal = current.totalBranches;
    const newPercentage = newTotal === 0 ? 100 : Math.round((newWithManagers / newTotal) * 100);
    
    this.setupStatus.set({
      ...current,
      branchesWithManagers: newWithManagers,
      branchesWithoutManagers: newTotal - newWithManagers,
      completionPercentage: newPercentage,
      isSetupComplete: newWithManagers === newTotal,
      requiresAttention: newTotal > 0 && ((newTotal - newWithManagers) / newTotal) > 0.10
    });
  }

  /**
   * Refreshes data with retry logic to handle EF Core caching delays.
   * Keeps success state visible until backend confirms.
   */
  private refreshWithRetry(branchId: string, retries: number = 5, attempt: number = 1): void {
    console.log(`[ManagerAssignment] Refreshing (attempt ${attempt}/${retries})...`);
    
    // Refresh status first (with protection against reverting optimistic updates)
    this.refreshStatus();
    
    // Wait before checking
    setTimeout(() => {
      const currentStatus = this.setupStatus();
      const branchStillExists = this.branches().some(b => b.id === branchId);
      
      console.log(`[ManagerAssignment] After refresh - Status: ${currentStatus?.branchesWithManagers} managers, Branch exists: ${branchStillExists}`);
      
      // Refresh branch list (but preserve success state)
      this.loadBranches();
      
      // Check after branch list loads
      setTimeout(() => {
        const stillExists = this.branches().some(b => b.id === branchId);
        const statusManagers = currentStatus?.branchesWithManagers || 0;
        
        if (!stillExists && statusManagers > 0) {
          // Success! Branch removed and status updated
          console.log('[ManagerAssignment] ✅ Success confirmed - Branch removed, status updated');
          // Keep success state visible for 3 seconds before clearing
          setTimeout(() => {
            this.recentlyAssigned.update(set => {
              const newSet = new Set(set);
              newSet.delete(branchId);
              return newSet;
            });
          }, 3000);
        } else if (stillExists && statusManagers === 0 && attempt < retries) {
          // Backend not updated yet, retry
          console.log(`[ManagerAssignment] ⏳ Retry ${attempt + 1}: Backend not updated yet`);
          setTimeout(() => {
            this.refreshWithRetry(branchId, retries, attempt + 1);
          }, 1500); // Longer delay between retries
        } else if (statusManagers > 0) {
          // Status updated but branch still visible (might be on different page)
          // Keep success state - assignment was successful
          console.log('[ManagerAssignment] ✅ Status updated, keeping success state');
          setTimeout(() => {
            this.recentlyAssigned.update(set => {
              const newSet = new Set(set);
              newSet.delete(branchId);
              return newSet;
            });
          }, 5000); // Keep visible longer since assignment succeeded
        } else {
          // Max retries or unclear state - keep success state since assignment API succeeded
          console.log('[ManagerAssignment] ⚠️ Max retries or unclear state, keeping success state');
          setTimeout(() => {
            this.recentlyAssigned.update(set => {
              const newSet = new Set(set);
              newSet.delete(branchId);
              return newSet;
            });
          }, 5000);
        }
      }, 800);
    }, 1000);
  }
}

