/**
 * @fileoverview Manager Assignment Component
 * @description Clean, panel-free interface for assigning managers to branches.
 * Shows only unassigned branches. Uses color-coded states:
 * - Pending (🟡 Yellow) — Manager selected, not saved yet
 * - Unassigned (⚪ Gray) — No manager assigned
 * 
 * After saving, branches disappear from this list (they're now assigned).
 * Progress is tracked via the setup status API.
 * 
 * @author Thuraya Systems
 * @version 6.0.0
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
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  SetupService, 
  BranchForAssignment, 
  ManagerOption,
  SetupStatus 
} from '@core/services/setup.service';
import { StoreService } from '@core/services/store.service';

interface PendingAssignment {
  branchId: string;
  branchName: string;
  managerId: string;
  managerName: string;
}

interface SelectableBranch extends BranchForAssignment {
  selected: boolean;
  selectedManagerId?: string;
}

@Component({
  selector: 'app-manager-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Sidebar -->
      <aside class="sidebar">
        <button (click)="goBack()" class="back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Dashboard
        </button>

        <div class="sidebar-content">
          <div class="header-section">
            <h1 class="page-title">Assign Branch Managers</h1>
            <p class="page-desc">
              Select a manager for each branch. Your selections become 
              <strong>Pending</strong> until you click <strong>Save All</strong>.
              After saving, assigned branches will no longer appear here.
            </p>
          </div>

          <!-- Progress -->
          @if (setupStatus(); as status) {
            <div class="progress-card">
              <div class="progress-header">
                <span class="progress-label">Progress</span>
                <span class="progress-value">{{ status.branchesWithManagers }}/{{ status.totalBranches }}</span>
              </div>
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  [style.width.%]="status.completionPercentage"
                  [class.complete]="status.completionPercentage === 100"
                ></div>
              </div>
              <div class="progress-stats">
                <span class="stat">
                  <span class="stat-dot assigned"></span>
                  {{ status.branchesWithManagers }} assigned
                </span>
                <span class="stat">
                  <span class="stat-dot unassigned"></span>
                  {{ status.branchesWithoutManagers }} remaining
                </span>
              </div>
            </div>
          }

          <!-- Status Legend -->
          <div class="legend">
            <div class="legend-title">How it works</div>
            <div class="legend-items">
              <div class="legend-item">
                <span class="legend-num">1</span>
                <span class="legend-text">Select a manager from the dropdown</span>
              </div>
              <div class="legend-item">
                <span class="legend-num">2</span>
                <span class="legend-text">Row turns <strong>yellow</strong> (pending)</span>
              </div>
              <div class="legend-item">
                <span class="legend-num">3</span>
                <span class="legend-text">Click <strong>Save All</strong> to confirm</span>
              </div>
              <div class="legend-item">
                <span class="legend-num">4</span>
                <span class="legend-text">Saved branches are removed from list</span>
              </div>
            </div>
          </div>

          <!-- Bulk Assign -->
          <div class="bulk-section">
            <div class="bulk-label">Bulk assign</div>
            <p class="bulk-desc">Select multiple branches using checkboxes, then assign them all at once.</p>
            <div class="bulk-row">
              <select 
                [ngModel]="bulkManagerId()"
                (ngModelChange)="bulkManagerId.set($event)"
                class="bulk-select"
                [disabled]="selectedCount() === 0"
              >
                <option value="">Choose manager...</option>
                @for (manager of managers(); track manager.id) {
                  <option [value]="manager.id">{{ manager.name }}</option>
                }
              </select>
              <button 
                (click)="applyBulkSelection()"
                [disabled]="!bulkManagerId() || selectedCount() === 0"
                class="bulk-btn"
              >
                Apply
              </button>
            </div>
            @if (selectedCount() > 0) {
              <div class="bulk-hint">{{ selectedCount() }} branch{{ selectedCount() > 1 ? 'es' : '' }} selected</div>
            }
          </div>
        </div>

        <!-- Save Button (Fixed at bottom) -->
        <div class="save-section">
          @if (pendingCount() > 0) {
            <div class="save-alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ pendingCount() }} unsaved change{{ pendingCount() > 1 ? 's' : '' }}
            </div>
          }
          <button 
            (click)="saveAllAssignments()"
            [disabled]="pendingCount() === 0 || isAssigning()"
            class="save-btn"
          >
            @if (isAssigning()) {
              <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
              </svg>
              Saving...
            } @else {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save All Assignments
            }
          </button>
          @if (pendingCount() > 0) {
            <button (click)="clearAllPending()" class="discard-btn">
              Discard changes
            </button>
          }
        </div>
      </aside>

      <!-- Main -->
      <main class="main">
        <!-- Toolbar -->
        <header class="toolbar">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input 
              type="search"
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search branches..."
              class="search-input"
            />
            @if (searchTerm()) {
              <button (click)="clearSearch()" class="search-clear">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            }
          </div>

          <div class="toolbar-right">
            <span class="record-count">{{ totalCount() }} branches need managers</span>
            <div class="pagination">
              <button 
                (click)="previousPage()"
                [disabled]="currentPage() === 1"
                class="page-btn"
                title="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span class="page-info">{{ currentPage() }} / {{ totalPages() }}</span>
              <button 
                (click)="nextPage()"
                [disabled]="currentPage() >= totalPages()"
                class="page-btn"
                title="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        <!-- Content -->
        <div class="content">
          @if (isLoading()) {
            <div class="state-view">
              <svg class="spinner lg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
              </svg>
              <p>Loading branches...</p>
            </div>
          } @else if (branches().length === 0) {
            <div class="state-view">
              @if (searchTerm()) {
                <div class="state-icon muted">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <h3>No results</h3>
                <p>No branches match "{{ searchTerm() }}"</p>
                <button (click)="clearSearch()" class="link-btn">Clear search</button>
              } @else {
                <div class="state-icon success">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3>All done!</h3>
                <p>Every branch has a manager assigned.</p>
                <button (click)="goBack()" class="link-btn">Return to Dashboard</button>
              }
            </div>
          } @else {
            <!-- Table Header -->
            <div class="table-head">
              <div class="col-check">
                <input 
                  type="checkbox"
                  [checked]="isAllSelected()"
                  [indeterminate]="isPartiallySelected()"
                  (change)="toggleSelectAll()"
                  class="checkbox"
                  title="Select all"
                />
              </div>
              <div class="col-status">Status</div>
              <div class="col-branch">Branch</div>
              <div class="col-manager">Manager</div>
            </div>

            <!-- Table Body -->
            <ul class="table-body">
              @for (branch of branches(); track branch.id) {
                <li 
                  class="row"
                  [class.selected]="branch.selected"
                  [class.is-pending]="hasPendingAssignment(branch.id)"
                >
                  <div class="col-check">
                    <input 
                      type="checkbox"
                      [checked]="branch.selected"
                      (change)="toggleBranch(branch)"
                      class="checkbox"
                    />
                  </div>

                  <div class="col-status">
                    @if (hasPendingAssignment(branch.id)) {
                      <span class="status pending" title="Pending — click Save All to confirm">
                        <span class="status-dot"></span>
                        Pending
                      </span>
                    } @else {
                      <span class="status unassigned" title="Unassigned — select a manager">
                        <span class="status-dot"></span>
                        Unassigned
                      </span>
                    }
                  </div>

                  <div class="col-branch">
                    <span class="branch-name">{{ branch.name }}</span>
                    <span class="branch-meta">
                      <code class="branch-code">{{ branch.code }}</code>
                      @if (branch.location) {
                        <span class="sep">•</span>
                        <span>{{ branch.location }}</span>
                      }
                    </span>
                  </div>

                  <div class="col-manager">
                    <div class="manager-select-wrap">
                      <select 
                        [ngModel]="branch.selectedManagerId || ''"
                        (ngModelChange)="onManagerSelect(branch, $event)"
                        [disabled]="isAssigning()"
                        class="manager-select"
                        [class.has-pending]="hasPendingAssignment(branch.id)"
                      >
                        <option value="">Select manager...</option>
                        @for (manager of managers(); track manager.id) {
                          <option [value]="manager.id">{{ manager.name }}</option>
                        }
                      </select>
                      @if (branch.selectedManagerId) {
                        <button 
                          (click)="clearBranchSelection(branch)"
                          class="clear-btn"
                          title="Clear selection"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      }
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </main>

      <!-- Toast -->
      @if (showToast()) {
        <div class="toast" [class.error]="toastType() === 'error'" [class.success]="toastType() === 'success'">
          @if (toastType() === 'error') {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --text: #0f172a;
      --text-2: #64748b;
      --text-3: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --green: #10b981;
      --green-bg: #ecfdf5;
      --yellow: #f59e0b;
      --yellow-bg: #fffbeb;
      --yellow-border: #fde68a;
      --gray: #94a3b8;
      --gray-bg: #f8fafc;
      --red: #ef4444;
      --radius: 8px;
      --transition: 150ms ease;
      display: block;
      height: 100%;
    }

    .page {
      display: grid;
      grid-template-columns: 300px 1fr;
      height: 100%;
      background: var(--bg);
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .page { 
        grid-template-columns: 1fr; 
        grid-template-rows: auto 1fr;
        overflow-y: auto;
      }
    }

    /* ===== SIDEBAR ===== */
    .sidebar {
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: 50vh; }
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      margin: 10px 16px;
      background: none;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-2);
      cursor: pointer;
      transition: all var(--transition);
      flex-shrink: 0;
    }
    .back-btn:hover { background: var(--border-light); color: var(--text); }

    .sidebar-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      overflow-y: auto;
      padding: 0 16px 16px;
      min-height: 0;
    }

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 6px;
    }
    .page-desc {
      font-size: 13px;
      color: var(--text-2);
      margin: 0;
      line-height: 1.5;
    }
    .page-desc strong { color: var(--text); font-weight: 500; }

    /* Progress */
    .progress-card {
      background: var(--bg);
      border-radius: var(--radius);
      padding: 12px;
    }
    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .progress-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .progress-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    .progress-bar {
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    .progress-fill.complete { background: var(--green); }
    .progress-stats {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text-2);
    }
    .stat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .stat-dot.assigned { background: var(--green); }
    .stat-dot.unassigned { background: var(--gray); }

    /* Legend */
    .legend {
      background: var(--bg);
      border-radius: var(--radius);
      padding: 12px;
    }
    .legend-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }
    .legend-items { display: flex; flex-direction: column; gap: 8px; }
    .legend-item { display: flex; align-items: flex-start; gap: 10px; }
    .legend-num {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--border);
      border-radius: 50%;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-2);
      flex-shrink: 0;
    }
    .legend-text {
      font-size: 12px;
      color: var(--text-2);
      line-height: 1.4;
    }
    .legend-text strong { color: var(--text); }

    /* Bulk Assign */
    .bulk-section {
      background: var(--bg);
      border-radius: var(--radius);
      padding: 12px;
    }
    .bulk-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .bulk-desc {
      font-size: 11px;
      color: var(--text-3);
      margin: 0 0 8px;
      line-height: 1.4;
    }
    .bulk-row { display: flex; gap: 6px; }
    .bulk-select {
      flex: 1;
      height: 32px;
      padding: 0 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text);
      cursor: pointer;
    }
    .bulk-select:disabled { opacity: 0.5; cursor: not-allowed; }
    .bulk-select:focus { outline: none; border-color: var(--primary); }
    .bulk-btn {
      padding: 0 12px;
      height: 32px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
      transition: all var(--transition);
    }
    .bulk-btn:hover:not(:disabled) { background: var(--border-light); }
    .bulk-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .bulk-hint { font-size: 11px; color: var(--primary); margin-top: 6px; font-weight: 500; }

    /* Save Section */
    .save-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .save-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--yellow-bg);
      border: 1px solid var(--yellow-border);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--yellow);
    }
    .save-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      height: 40px;
      background: var(--primary);
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: white;
      cursor: pointer;
      transition: all var(--transition);
    }
    .save-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .discard-btn {
      width: 100%;
      padding: 8px;
      background: none;
      border: 1px dashed var(--border);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-2);
      cursor: pointer;
      transition: all var(--transition);
    }
    .discard-btn:hover { border-color: var(--red); color: var(--red); }

    /* ===== MAIN ===== */
    .main {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      height: 100%;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .search-box {
      position: relative;
      width: 240px;
      flex-shrink: 0;
    }
    @media (max-width: 600px) { .search-box { width: 100%; } }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-3);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: 34px;
      padding: 0 32px;
      background: var(--bg);
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 13px;
      color: var(--text);
      transition: all var(--transition);
    }
    .search-input::placeholder { color: var(--text-3); }
    .search-input:hover { border-color: var(--border); }
    .search-input:focus {
      outline: none;
      background: var(--surface);
      border-color: var(--primary);
    }
    .search-clear {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 4px;
      color: var(--text-3);
      cursor: pointer;
    }
    .search-clear:hover { background: var(--border-light); color: var(--text); }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .record-count {
      font-size: 12px;
      color: var(--text-2);
    }

    .pagination {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text-2);
      cursor: pointer;
      transition: all var(--transition);
    }
    .page-btn:hover:not(:disabled) { background: var(--border-light); color: var(--text); }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-info {
      font-size: 12px;
      color: var(--text-2);
      padding: 0 8px;
      min-width: 50px;
      text-align: center;
    }

    /* Content */
    .content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--surface);
      min-height: 0;
    }

    /* State View */
    .state-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }
    .state-view h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      margin: 12px 0 4px;
    }
    .state-view p {
      font-size: 13px;
      color: var(--text-2);
      margin: 0;
    }
    .state-icon {
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    .state-icon.muted { background: var(--bg); color: var(--text-3); }
    .state-icon.success { background: var(--green-bg); color: var(--green); }
    .link-btn {
      margin-top: 12px;
      padding: 6px 12px;
      background: none;
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
    }
    .link-btn:hover { background: var(--border-light); }

    /* Table */
    .table-head {
      display: grid;
      grid-template-columns: 44px 100px 1fr 220px;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 10px;
      font-weight: 600;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    @media (max-width: 700px) {
      .table-head { display: none; }
    }

    .table-body {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .row {
      display: grid;
      grid-template-columns: 44px 100px 1fr 220px;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-light);
      transition: background var(--transition);
    }
    @media (max-width: 700px) {
      .row {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 12px 16px;
        position: relative;
      }
      .col-check { position: absolute; top: 12px; right: 16px; }
      .col-status { order: 1; }
      .col-branch { order: 2; }
      .col-manager { order: 3; }
    }
    .row:hover { background: var(--bg); }
    .row.selected { background: rgba(59,130,246,0.04); }
    .row.is-pending { background: var(--yellow-bg); }
    .row.is-pending:hover { background: #fef3c7; }

    .col-check { display: flex; align-items: center; justify-content: center; }
    .checkbox {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      cursor: pointer;
      accent-color: var(--primary);
    }

    /* Status */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .status.pending { background: var(--yellow-bg); color: var(--yellow); }
    .status.pending .status-dot { background: var(--yellow); }
    .status.unassigned { background: var(--gray-bg); color: var(--gray); }
    .status.unassigned .status-dot { background: var(--gray); }

    /* Branch */
    .col-branch { min-width: 0; }
    .branch-name {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .branch-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      font-size: 11px;
      color: var(--text-3);
    }
    .branch-code {
      padding: 1px 4px;
      background: var(--bg);
      border-radius: 3px;
      font-size: 10px;
      font-family: ui-monospace, monospace;
    }
    .sep { color: var(--border); }

    /* Manager */
    .col-manager { display: flex; align-items: center; }
    @media (max-width: 700px) {
      .col-manager { flex-direction: column; align-items: stretch; }
    }

    .manager-select-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .manager-select {
      flex: 1;
      height: 34px;
      padding: 0 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      color: var(--text-2);
      cursor: pointer;
      transition: all var(--transition);
    }
    .manager-select:hover:not(:disabled) { border-color: var(--text-3); }
    .manager-select:focus { outline: none; border-color: var(--primary); }
    .manager-select.has-pending {
      color: var(--text);
      border-color: var(--yellow);
      background: var(--yellow-bg);
    }
    .manager-select:disabled { opacity: 0.6; cursor: not-allowed; }
    .clear-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text-3);
      cursor: pointer;
      flex-shrink: 0;
      transition: all var(--transition);
    }
    .clear-btn:hover { border-color: var(--red); color: var(--red); background: #fef2f2; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--text);
      color: white;
      border-radius: var(--radius);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 13px;
      font-weight: 500;
      z-index: 100;
      animation: slideUp 0.25s ease;
    }
    .toast.error { background: var(--red); }
    .toast.success { background: var(--green); }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .spinner { animation: spin 0.8s linear infinite; }
    .spinner.lg { color: var(--text-3); }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class ManagerAssignmentComponent implements OnInit {
  private readonly setupService = inject(SetupService);
  private readonly store = inject(StoreService);

  // State
  readonly isLoading = signal(true);
  readonly isAssigning = signal(false);
  readonly setupStatus = signal<SetupStatus | null>(null);
  readonly managers = signal<ManagerOption[]>([]);
  readonly branches = signal<SelectableBranch[]>([]);
  readonly searchTerm = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(50);
  readonly totalCount = signal(0);
  readonly bulkManagerId = signal('');
  readonly showToast = signal(false);
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error' | 'info'>('info');

  /** Persistent pending assignments across pages: branchId → PendingAssignment */
  readonly pendingMap = signal<Map<string, PendingAssignment>>(new Map());

  private searchTimer: any = null;

  // Computed
  readonly pendingCount = computed(() => this.pendingMap().size);
  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()) || 1);
  readonly selectedCount = computed(() => this.branches().filter(b => b.selected).length);

  readonly isAllSelected = computed(() => {
    const all = this.branches();
    return all.length > 0 && all.every(b => b.selected);
  });

  readonly isPartiallySelected = computed(() => {
    const all = this.branches();
    const sel = all.filter(b => b.selected).length;
    return sel > 0 && sel < all.length;
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.setupService.getSetupStatus().subscribe(s => this.setupStatus.set(s));
    this.setupService.getAvailableManagers().subscribe(m => this.managers.set(m));
    this.loadBranches();
  }

  private loadBranches(): void {
    this.setupService.getBranchesWithoutManager(
      this.currentPage(),
      this.pageSize(),
      this.searchTerm() || undefined
    ).subscribe({
      next: (res) => {
        const pending = this.pendingMap();
        const merged = res.items.map(b => ({
          ...b,
          selected: false,
          selectedManagerId: pending.get(b.id)?.managerId
        }));
        this.branches.set(merged);
        this.totalCount.set(res.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.branches.set([]);
        this.totalCount.set(0);
        this.isLoading.set(false);
        this.toast('Failed to load branches', 'error');
      }
    });
  }

  hasPendingAssignment(branchId: string): boolean {
    return this.pendingMap().has(branchId);
  }

  toggleBranch(branch: SelectableBranch): void {
    this.branches.update(list =>
      list.map(b => b.id === branch.id ? { ...b, selected: !b.selected } : b)
    );
  }

  toggleSelectAll(): void {
    const select = !this.isAllSelected();
    this.branches.update(list => list.map(b => ({ ...b, selected: select })));
  }

  onManagerSelect(branch: SelectableBranch, managerId: string): void {
    this.branches.update(list =>
      list.map(b => b.id === branch.id ? { ...b, selectedManagerId: managerId || undefined } : b)
    );

    this.pendingMap.update(map => {
      const newMap = new Map(map);
      if (managerId) {
        const mgr = this.managers().find(m => m.id === managerId);
        newMap.set(branch.id, {
          branchId: branch.id,
          branchName: branch.name,
          managerId,
          managerName: mgr?.name || 'Unknown'
        });
      } else {
        newMap.delete(branch.id);
      }
      return newMap;
    });
  }

  clearBranchSelection(branch: SelectableBranch): void {
    this.onManagerSelect(branch, '');
  }

  applyBulkSelection(): void {
    const selected = this.branches().filter(b => b.selected);
    if (selected.length === 0 || !this.bulkManagerId()) return;

    const managerId = this.bulkManagerId();
    const mgr = this.managers().find(m => m.id === managerId);
    const managerName = mgr?.name || 'Unknown';

    this.branches.update(list =>
      list.map(b => b.selected ? { ...b, selectedManagerId: managerId } : b)
    );

    this.pendingMap.update(map => {
      const newMap = new Map(map);
      for (const b of selected) {
        newMap.set(b.id, {
          branchId: b.id,
          branchName: b.name,
          managerId,
          managerName
        });
      }
      return newMap;
    });

    this.toast(`Applied to ${selected.length} branch${selected.length > 1 ? 'es' : ''}`, 'info');
    this.bulkManagerId.set('');
    this.branches.update(list => list.map(b => ({ ...b, selected: false })));
  }

  clearAllPending(): void {
    this.pendingMap.set(new Map());
    this.branches.update(list => list.map(b => ({ ...b, selectedManagerId: undefined })));
  }

  saveAllAssignments(): void {
    const pending = this.pendingMap();
    if (pending.size === 0) return;

    // Group by managerId for efficient bulk assignment
    const grouped = new Map<string, string[]>();
    for (const [branchId, a] of pending) {
      const list = grouped.get(a.managerId) ?? [];
      list.push(branchId);
      grouped.set(a.managerId, list);
    }

    this.isAssigning.set(true);

    const requests = Array.from(grouped.entries()).map(([managerId, branchIds]) =>
      this.setupService.bulkAssignManager(branchIds, managerId).pipe(
        map(result => ({ managerId, branchIds, result })),
        catchError(error => of({ managerId, branchIds, error }))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        let success = 0;
        let failed = 0;
        const savedIds: string[] = [];

        for (const r of results) {
          if ('error' in r) {
            failed += r.branchIds.length;
          } else {
            success += r.result.successCount;
            failed += r.result.failedCount;
            if (r.result.successCount > 0) {
              savedIds.push(...r.branchIds.slice(0, r.result.successCount));
            }
          }
        }

        // Clear saved from pending
        if (savedIds.length > 0) {
          this.pendingMap.update(map => {
            const newMap = new Map(map);
            for (const id of savedIds) newMap.delete(id);
            return newMap;
          });
        }

        if (success > 0) {
          this.toast(
            failed > 0
              ? `Saved ${success}, ${failed} failed`
              : `${success} assignment${success > 1 ? 's' : ''} saved!`,
            'success'
          );
        } else if (failed > 0) {
          this.toast('Failed to save assignments', 'error');
        }

        // Refresh data to remove assigned branches
        this.refreshStatus();
        this.loadBranches();
        this.isAssigning.set(false);
      },
      error: () => {
        this.toast('Failed to save', 'error');
        this.isAssigning.set(false);
      }
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadBranches(), 300);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(1);
    this.loadBranches();
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadBranches();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadBranches();
    }
  }

  goBack(): void {
    this.store.setView('dashboard');
  }

  private toast(msg: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3500);
  }

  private refreshStatus(): void {
    this.setupService.getSetupStatus().subscribe({
      next: (s) => this.setupStatus.set(s),
      error: () => {}
    });
  }
}
