/**
 * @fileoverview Application routes with lazy loading and guards
 * @description Implements code-splitting for optimal bundle size
 * Supports tenant-first authentication flow with path-based routing
 * 
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard, onboardingGuard } from '@core/guards/auth.guard';

/**
 * Application routes configuration
 * Uses lazy loading (loadComponent) for code splitting
 * Protected routes use authGuard for authentication
 * 
 * Auth Flow:
 * 1. / -> Org selection (enter org slug)
 * 2. /:slug/login -> Login to specific org
 * 3. /signup -> Create new org (Google OAuth creates tenant)
 * 4. /auth -> Legacy auth (redirects to /)
 */
export const routes: Routes = [
  // Org Selection (home for unauthenticated users)
  {
    path: '',
    loadComponent: () => import('@features/auth/org-selection.component').then(m => m.OrgSelectionComponent),
    canActivate: [guestGuard],
    title: 'Sign in - Thuraya Pharmacy'
  },
  // New org signup
  {
    path: 'signup',
    loadComponent: () => import('@features/auth/auth.component').then(m => m.AuthComponent),
    canActivate: [guestGuard],
    data: { mode: 'signup' },
    title: 'Create Organization - Thuraya Pharmacy'
  },
  // Legacy auth route - redirect to org selection
  {
    path: 'auth',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'onboarding',
    loadComponent: () => import('@features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard, onboardingGuard],
    title: 'Setup - Thuraya Pharmacy'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('@features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'Dashboard - Thuraya Pharmacy'
  },
  {
    path: 'inventory',
    loadComponent: () => import('@features/inventory/inventory.component').then(m => m.InventoryComponent),
    canActivate: [authGuard],
    title: 'Inventory - Thuraya Pharmacy'
  },
  {
    path: 'pos',
    loadComponent: () => import('@features/pos/pos.component').then(m => m.POSComponent),
    canActivate: [authGuard],
    title: 'Point of Sale - Thuraya Pharmacy'
  },
  {
    path: 'users',
    loadComponent: () => import('@features/users/users.component').then(m => m.UsersComponent),
    canActivate: [authGuard, adminGuard],
    title: 'User Management - Thuraya Pharmacy'
  },
  {
    path: 'settings',
    loadComponent: () => import('@features/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings - Thuraya Pharmacy'
  },
  {
    path: 'finance',
    loadComponent: () => import('@features/finance/finance.component').then(m => m.FinanceComponent),
    canActivate: [authGuard],
    title: 'Finance - Thuraya Pharmacy'
  },
  // Procurement routes with sub-navigation
  {
    path: 'procurement',
    loadComponent: () => import('@features/procurement/procurement.component').then(m => m.ProcurementComponent),
    canActivate: [authGuard],
    title: 'Procurement - Thuraya Pharmacy',
    children: [
      { path: '', redirectTo: 'orders', pathMatch: 'full' },
      { path: 'orders', loadComponent: () => import('@features/procurement/procurement.component').then(m => m.ProcurementComponent) },
      { path: 'bills', loadComponent: () => import('@features/procurement/procurement.component').then(m => m.ProcurementComponent) },
      { path: 'suppliers', loadComponent: () => import('@features/procurement/procurement.component').then(m => m.ProcurementComponent) }
    ]
  },
  // Sales routes with sub-navigation
  {
    path: 'sales',
    loadComponent: () => import('@features/sales/sales.component').then(m => m.SalesComponent),
    canActivate: [authGuard],
    title: 'Sales - Thuraya Pharmacy',
    children: [
      { path: '', redirectTo: 'customers', pathMatch: 'full' },
      { path: 'customers', loadComponent: () => import('@features/sales/sales.component').then(m => m.SalesComponent) },
      { path: 'invoices', loadComponent: () => import('@features/sales/sales.component').then(m => m.SalesComponent) }
    ]
  },
  // Branch Network
  {
    path: 'branches',
    loadComponent: () => import('@features/branch-network/branch-network.component').then(m => m.BranchNetworkComponent),
    canActivate: [authGuard, adminGuard],
    title: 'Branch Network - Thuraya Pharmacy'
  },
  // Tenant-scoped login route (must be before wildcard)
  {
    path: ':slug/login',
    loadComponent: () => import('@features/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign in - Thuraya Pharmacy'
  },
  // Fallback - authenticated users go to dashboard, unauthenticated to org selection
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
