/**
 * @fileoverview Main dashboard with unified Getting Started experience
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-08
 */

import { Component, inject, ChangeDetectionStrategy, OnInit, AfterViewInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icons/icons.component';
import { SalesChartComponent } from '@shared/components/chart/chart.component';
import { StoreService } from '@core/services/store.service';
import { SetupService, SetupStatus } from '@core/services/setup.service';
import { SetupProgressItem } from '@core/models/ui.model';

/**
 * @component DashboardComponent
 * @description Main overview dashboard with unified getting started experience
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IconComponent, SalesChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styles: [`
    /* ========== Getting Started Card ========== */
    .getting-started-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      overflow: hidden;
      box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.02);
    }

    /* Header */
    .card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      background: white;
      border-bottom: 1px solid #f1f5f9;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      min-width: 0;
    }

    .icon-container {
      width: 3rem;
      height: 3rem;
      border-radius: 0.875rem;
      background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.25);
      transition: all 0.3s ease;
    }

    .icon-container.complete {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .icon-container svg {
      width: 1.5rem;
      height: 1.5rem;
      color: white;
    }

    .header-text {
      min-width: 0;
    }

    .title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
      line-height: 1.3;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0.25rem 0 0;
      line-height: 1.4;
    }

    /* Progress Ring */
    .progress-section {
      flex-shrink: 0;
      margin-left: auto;
    }

    .progress-ring {
      position: relative;
      width: 3.5rem;
      height: 3.5rem;
    }

    .progress-ring svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .ring-bg {
      fill: none;
      stroke: #e2e8f0;
      stroke-width: 3;
    }

    .ring-fill {
      fill: none;
      stroke: url(#progress-gradient);
      stroke-width: 3;
      stroke-linecap: round;
      transition: stroke-dasharray 0.5s ease;
    }

    .progress-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #0d9488;
    }

    .dismiss-btn {
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .dismiss-btn:hover {
      background: #f1f5f9;
      color: #64748b;
    }

    .dismiss-btn:focus-visible {
      outline: 2px solid #14b8a6;
      outline-offset: 2px;
    }

    .dismiss-btn svg {
      width: 1rem;
      height: 1rem;
    }

    /* Steps Grid */
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
      padding: 1rem 1.25rem 1.25rem;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 0.75rem;
      border: 1.5px solid transparent;
      background: white;
      cursor: default;
      transition: all 0.2s ease;
      text-align: left;
    }

    .step-item.actionable {
      cursor: pointer;
      border-color: #e2e8f0;
    }

    .step-item.actionable:hover {
      border-color: #14b8a6;
      background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.1);
    }

    .step-item.actionable:focus-visible {
      outline: 2px solid #14b8a6;
      outline-offset: 2px;
    }

    .step-item.done {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border-color: #bbf7d0;
    }

    .step-item.locked {
      opacity: 0.5;
      border-style: dashed;
      border-color: #e2e8f0;
    }

    .step-indicator {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .step-item.done .step-indicator {
      background: #10b981;
      color: white;
    }

    .step-item.done .step-indicator svg {
      width: 0.875rem;
      height: 0.875rem;
    }

    .step-item.actionable .step-indicator {
      background: #f1f5f9;
      color: #64748b;
      border: 1.5px solid #e2e8f0;
    }

    .step-item.actionable:hover .step-indicator {
      background: #14b8a6;
      color: white;
      border-color: #14b8a6;
    }

    .step-item.locked .step-indicator {
      background: #f8fafc;
      color: #94a3b8;
      border: 1.5px dashed #cbd5e1;
    }

    .step-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }

    .step-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #334155;
      line-height: 1.3;
    }

    .step-item.done .step-label {
      color: #166534;
    }

    .step-cta {
      font-size: 0.75rem;
      font-weight: 600;
      color: #0d9488;
    }

    .step-status {
      font-size: 0.75rem;
      font-weight: 500;
      color: #16a34a;
    }

    .step-locked {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    /* Complete Actions */
    .complete-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      justify-content: center;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .action-btn svg {
      width: 1.125rem;
      height: 1.125rem;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.25);
    }

    .action-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(20, 184, 166, 0.35);
    }

    .action-btn.primary:focus-visible {
      outline: 2px solid #14b8a6;
      outline-offset: 2px;
    }

    .action-btn.secondary {
      background: white;
      color: #475569;
      border: 1.5px solid #e2e8f0;
    }

    .action-btn.secondary:hover {
      border-color: #14b8a6;
      color: #0d9488;
      transform: translateY(-2px);
    }

    .action-btn.secondary:focus-visible {
      outline: 2px solid #14b8a6;
      outline-offset: 2px;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .card-header {
        flex-wrap: wrap;
        gap: 1rem;
      }

      .progress-section {
        margin-left: 0;
        order: -1;
        width: 100%;
        display: flex;
        justify-content: flex-end;
      }

      .steps-grid {
        grid-template-columns: 1fr;
      }

      .complete-actions {
        flex-direction: column;
      }

      .action-btn {
        width: 100%;
        justify-content: center;
      }
    }

    /* Animations */
    @keyframes slideIn {
      from { 
        opacity: 0; 
        transform: translateY(-10px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }

    .getting-started-card {
      animation: slideIn 0.4s ease-out;
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit {
  store = inject(StoreService);
  private setupService = inject(SetupService);

  /** Setup status for manager assignment tracking */
  private setupStatus = signal<SetupStatus | null>(null);

  /** Whether the getting started card has been dismissed */
  private gettingStartedDismissed = signal(false);

  ngOnInit(): void {
    this.loadSetupStatus();
  }
  
  ngAfterViewInit(): void {
    // Refresh when component becomes visible (e.g., returning from manager assignment)
    this.loadSetupStatus();
  }

  /**
   * Loads the setup status from the backend.
   */
  private loadSetupStatus(): void {
    this.setupService.getSetupStatus().subscribe(status => {
      this.setupStatus.set(status);
    });
  }

  /**
   * Computes all setup steps including both onboarding and manager assignment.
   * Order: 1. Organization, 2. Branches, 3. Branch Managers, 4. Suppliers, 5. Products, 6. Customers
   */
  allSetupSteps = computed((): SetupProgressItem[] => {
    const baseSteps = this.store.setupProgress();
    const status = this.setupStatus();
    
    // Insert manager assignment as step 3 (after branches, before suppliers)
    // baseSteps: [tenant, branch, suppliers, inventory, customers]
    // Desired:   [tenant, branch, managers, suppliers, inventory, customers]
    
    const steps: SetupProgressItem[] = [];
    
    // Step 1: Organization
    const tenantStep = baseSteps.find(s => s.id === 'tenant');
    if (tenantStep) steps.push(tenantStep);
    
    // Step 2: Branches
    const branchStep = baseSteps.find(s => s.id === 'branch');
    if (branchStep) steps.push(branchStep);
    
    // Step 3: Branch Managers (only if branches exist)
    if (status && status.totalBranches > 0) {
      const hasUnassignedBranches = status.branchesWithoutManagers > 0;
      steps.push({
        id: 'managers',
        label: 'Assign Branch Managers',
        done: !hasUnassignedBranches,
        action: hasUnassignedBranches ? 'manager-assignment' : null
      });
    }
    
    // Steps 4-6: Suppliers, Products, Customers
    const remainingSteps = baseSteps.filter(s => 
      s.id !== 'tenant' && s.id !== 'branch'
    );
    steps.push(...remainingSteps);
    
    return steps;
  });

  /**
   * Calculates overall progress percentage
   */
  overallProgress = computed((): number => {
    const steps = this.allSetupSteps();
    if (steps.length === 0) return 100;
    
    const completed = steps.filter(s => s.done).length;
    return Math.round((completed / steps.length) * 100);
  });

  /**
   * Determines if all setup steps are complete
   */
  isSetupComplete = computed((): boolean => {
    return this.overallProgress() === 100;
  });

  /**
   * Determines if we should show the getting started card
   */
  showGettingStarted = computed((): boolean => {
    // Don't show if dismissed
    if (this.gettingStartedDismissed()) return false;
    
    // Show for first-time users
    if (this.store.isFirstTimeUser()) return true;
    
    // Show if setup guide is visible and not complete
    if (this.store.showSetupGuide() && this.store.setupCompletion() < 100) return true;
    
    // Show if there are branches needing managers
    const status = this.setupStatus();
    if (status && status.requiresAttention && status.totalBranches > 0) return true;
    
    return false;
  });

  /**
   * Dismisses the getting started card
   */
  dismissGettingStarted(): void {
    this.gettingStartedDismissed.set(true);
    this.store.dismissSetupGuide();
  }

  /**
   * Handles click on a setup step
   */
  handleStepClick(step: SetupProgressItem): void {
    if (step.action && !step.done) {
      this.store.setView(step.action);
    }
  }
}
