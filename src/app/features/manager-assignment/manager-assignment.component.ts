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
    <div class="h-full flex flex-col gap-6 animate-fade-in overflow-hidden">
      
      <!-- Header -->
      <header class="shrink-0">
        <div class="flex items-center gap-3 mb-2">
          <button 
            (click)="goBack()"
            class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Go back to dashboard"
          >
            <app-icon name="arrow-left" [size]="20" class="text-slate-600"></app-icon>
          </button>
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-800">
              Assign Branch Managers
            </h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Assign managers to branches to complete your setup
            </p>
          </div>
        </div>
      </header>

      <!-- Status Card -->
      @if (setupStatus(); as status) {
        <div class="shrink-0 bg-white border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
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
              
              <!-- Progress Bar -->
              <div class="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-500"
                  [class.bg-emerald-500]="status.completionPercentage === 100"
                  [class.bg-teal-500]="status.completionPercentage < 100"
                  [style.width.%]="status.completionPercentage"
                ></div>
              </div>
              <span class="text-sm font-bold"
                [class.text-emerald-600]="status.completionPercentage === 100"
                [class.text-teal-600]="status.completionPercentage < 100"
              >
                {{ status.completionPercentage }}%
              </span>
            </div>

            @if (status.isSetupComplete) {
              <span class="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <app-icon name="check" [size]="16"></app-icon>
                All branches assigned!
              </span>
            }
          </div>
        </div>
      }

      <!-- Search & Bulk Actions Bar -->
      <div class="shrink-0 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <!-- Search -->
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
            class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <!-- Bulk Actions -->
        @if (selectedCount() > 0) {
          <div class="flex items-center gap-3 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
            <span class="text-sm font-medium text-teal-700">
              {{ selectedCount() }} selected
            </span>
            
            <!-- Bulk Manager Dropdown -->
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
              [disabled]="!bulkManagerId() || isAssigning()"
              class="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              @if (isAssigning()) {
                <app-icon name="loader" [size]="16" class="animate-spin"></app-icon>
              }
              Assign Selected
            </button>

            <button 
              (click)="clearSelection()"
              class="p-1.5 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
              aria-label="Clear selection"
            >
              <app-icon name="x" [size]="16"></app-icon>
            </button>
          </div>
        }
      </div>

      <!-- Branch List -->
      <div class="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        
        <!-- Table Header -->
        <div class="shrink-0 grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
          <div class="col-span-1 flex items-center">
            <input 
              type="checkbox"
              [checked]="isAllSelected()"
              [indeterminate]="isPartiallySelected()"
              (change)="toggleSelectAll()"
              class="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </div>
          <div class="col-span-3">Branch Name</div>
          <div class="col-span-2">Code</div>
          <div class="col-span-3">Location</div>
          <div class="col-span-3">Assign Manager</div>
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="flex-1 flex items-center justify-center p-8">
            <div class="flex flex-col items-center gap-3">
              <app-icon name="loader" [size]="32" class="text-teal-600 animate-spin"></app-icon>
              <p class="text-sm text-slate-500">Loading branches...</p>
            </div>
          </div>
        }

        <!-- Empty State -->
        @else if (branches().length === 0) {
          <div class="flex-1 flex items-center justify-center p-8">
            <div class="text-center max-w-sm">
              <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <app-icon name="check" [size]="32" class="text-emerald-600"></app-icon>
              </div>
              <h3 class="text-lg font-semibold text-slate-800 mb-2">All Caught Up!</h3>
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

        <!-- Branch Rows -->
        @else {
          <div class="flex-1 overflow-y-auto">
            @for (branch of branches(); track branch.id) {
              <div 
                class="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors items-center"
                [class.bg-teal-50]="branch.selected"
              >
                <!-- Checkbox -->
                <div class="col-span-1">
                  <input 
                    type="checkbox"
                    [checked]="branch.selected"
                    (change)="toggleBranch(branch)"
                    class="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </div>

                <!-- Name -->
                <div class="col-span-3">
                  <span class="font-medium text-slate-800">{{ branch.name }}</span>
                </div>

                <!-- Code -->
                <div class="col-span-2">
                  <span class="text-sm text-slate-600 font-mono">{{ branch.code }}</span>
                </div>

                <!-- Location -->
                <div class="col-span-3">
                  <span class="text-sm text-slate-600">{{ branch.location || '—' }}</span>
                </div>

                <!-- Manager Dropdown -->
                <div class="col-span-3 flex items-center gap-2">
                  <select 
                    [ngModel]="branch.selectedManagerId"
                    (ngModelChange)="onManagerSelect(branch, $event)"
                    class="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select manager...</option>
                    @for (manager of managers(); track manager.id) {
                      <option [value]="manager.id">{{ manager.name }}</option>
                    }
                  </select>

                  @if (branch.selectedManagerId) {
                    <button 
                      (click)="assignSingle(branch)"
                      [disabled]="isAssigning()"
                      class="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      title="Assign manager"
                    >
                      <app-icon name="check" [size]="16"></app-icon>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
              <span class="text-sm text-slate-600">
                Showing {{ (currentPage() - 1) * pageSize() + 1 }} - {{ Math.min(currentPage() * pageSize(), totalCount()) }} of {{ totalCount() }}
              </span>
              <div class="flex items-center gap-2">
                <button 
                  (click)="previousPage()"
                  [disabled]="currentPage() === 1"
                  class="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <app-icon name="chevron-left" [size]="18"></app-icon>
                </button>
                <span class="text-sm font-medium text-slate-700 px-3">
                  Page {{ currentPage() }} of {{ totalPages() }}
                </span>
                <button 
                  (click)="nextPage()"
                  [disabled]="currentPage() === totalPages()"
                  class="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <app-icon name="chevron-right" [size]="18"></app-icon>
                </button>
              </div>
            </div>
          }
        }
      </div>

      <!-- Success Toast -->
      @if (showSuccess()) {
        <div class="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in">
          <app-icon name="check" [size]="20"></app-icon>
          <span class="font-medium">{{ successMessage() }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
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

  /** Setup status */
  readonly setupStatus = signal<SetupStatus | null>(null);

  /** Available managers for dropdown */
  readonly managers = signal<ManagerOption[]>([]);

  /** Branches without managers (with selection state) */
  readonly branches = signal<SelectableBranch[]>([]);

  /** Search term */
  readonly searchTerm = signal('');

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
    this.setupService.getBranchesWithoutManager(
      this.currentPage(),
      this.pageSize(),
      this.searchTerm() || undefined
    ).subscribe({
      next: (response) => {
        this.branches.set(
          response.items.map(b => ({ ...b, selected: false }))
        );
        this.totalCount.set(response.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
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
   * Assigns manager to a single branch.
   */
  assignSingle(branch: SelectableBranch): void {
    if (!branch.selectedManagerId) return;

    this.isAssigning.set(true);
    this.setupService.assignManager(branch.id, branch.selectedManagerId).subscribe({
      next: (result) => {
        this.showSuccessToast(`Manager assigned to ${branch.name}`);
        this.loadBranches(); // Refresh list
        this.isAssigning.set(false);
      },
      error: () => {
        this.isAssigning.set(false);
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

    this.isAssigning.set(true);
    this.setupService.bulkAssignManager(selectedIds, this.bulkManagerId()).subscribe({
      next: (result) => {
        this.showSuccessToast(`Manager assigned to ${result.successCount} branch(es)`);
        this.clearSelection();
        this.loadBranches(); // Refresh list
        this.setupService.refreshSetupStatus();
        this.isAssigning.set(false);
      },
      error: () => {
        this.isAssigning.set(false);
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
    this.loadBranches();
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
}

