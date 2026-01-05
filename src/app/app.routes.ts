/**
 * @fileoverview Application routes with lazy loading and guards
 * @description Implements code-splitting for optimal bundle size
 * @author Thuraya Systems
 * @version 1.1.0
 */

import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard, onboardingGuard } from '@core/guards/auth.guard';

/**
 * Application routes configuration
 * Uses lazy loading (loadComponent) for code splitting
 * Protected routes use authGuard for authentication
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadComponent: () => import('@features/auth/auth.component').then(m => m.AuthComponent),
    canActivate: [guestGuard],
    title: 'Login - Thuraya Pharmacy'
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
  // Fallback
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
