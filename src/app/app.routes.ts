/**
 * @fileoverview Application routes with lazy loading
 * @description Implements code-splitting for optimal bundle size
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { Routes } from '@angular/router';

/**
 * Application routes configuration
 * Uses lazy loading (loadComponent) for code splitting
 * Each feature module is loaded on-demand
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
    title: 'Login - Thuraya Pharmacy'
  },
  {
    path: 'onboarding',
    loadComponent: () => import('@features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    title: 'Setup - Thuraya Pharmacy'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('@features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Dashboard - Thuraya Pharmacy'
  },
  {
    path: 'inventory',
    loadComponent: () => import('@features/inventory/inventory.component').then(m => m.InventoryComponent),
    title: 'Inventory - Thuraya Pharmacy'
  },
  {
    path: 'pos',
    loadComponent: () => import('@features/pos/pos.component').then(m => m.POSComponent),
    title: 'Point of Sale - Thuraya Pharmacy'
  },
  {
    path: 'users',
    loadComponent: () => import('@features/users/users.component').then(m => m.UsersComponent),
    title: 'User Management - Thuraya Pharmacy'
  },
  {
    path: 'settings',
    loadComponent: () => import('@features/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Settings - Thuraya Pharmacy'
  },
  {
    path: 'finance',
    loadComponent: () => import('@features/finance/finance.component').then(m => m.FinanceComponent),
    title: 'Finance - Thuraya Pharmacy'
  },
  // Procurement routes with sub-navigation
  {
    path: 'procurement',
    loadComponent: () => import('@features/procurement/procurement.component').then(m => m.ProcurementComponent),
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
    title: 'Branch Network - Thuraya Pharmacy'
  },
  // Fallback
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
