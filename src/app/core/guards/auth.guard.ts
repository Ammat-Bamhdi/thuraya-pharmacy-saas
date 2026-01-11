/**
 * @fileoverview Route Guards for Authentication and Authorization
 * @description Functional guards for Angular 18+ router
 * @author Thuraya Systems
 * @version 1.0.0
 */

import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';

const TOKEN_KEY = 'thurayya_access_token';

/**
 * Auth Guard - Protects routes that require authentication
 * Redirects to auth page if user is not authenticated
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const store = inject(StoreService);
  
  // Check if user is authenticated
  if (authService.isAuthenticated()) {
    return true;
  }
  
  // Check for token in storage as fallback
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    // Token exists but auth not initialized yet - allow access
    // AuthService.initialize() will validate on startup
    return true;
  }
  
  // Not authenticated - redirect to auth
  store.setView('auth');
  return false;
};

/**
 * Guest Guard - Protects routes that should only be accessible to non-authenticated users
 * Redirects to dashboard if user is already authenticated
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const store = inject(StoreService);
  
  // If authenticated, redirect to dashboard
  if (authService.isAuthenticated()) {
    store.setView('dashboard');
    return false;
  }
  
  // Check for token in storage
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    store.setView('dashboard');
    return false;
  }
  
  return true;
};

/**
 * Role Guard Factory - Creates a guard that checks for specific roles
 * @param allowedRoles - Array of roles that can access the route
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const store = inject(StoreService);
    
    const user = authService.user();
    
    if (!user) {
      store.setView('auth');
      return false;
    }
    
    // Check if user's role is in allowed roles
    if (allowedRoles.includes(user.role)) {
      return true;
    }
    
    // User doesn't have required role - redirect to dashboard
    store.setView('dashboard');
    return false;
  };
}

/**
 * Super Admin Guard - Only super admins can access
 */
export const superAdminGuard: CanActivateFn = roleGuard(['SuperAdmin']);

/**
 * Admin Guard - Super admins and branch admins can access
 */
export const adminGuard: CanActivateFn = roleGuard(['SuperAdmin', 'BranchAdmin']);

/**
 * Onboarding Guard - Checks if user needs to complete onboarding
 */
export const onboardingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const store = inject(StoreService);
  
  // Check if this is a first-time login
  if (authService.isFirstLogin()) {
    // Allow access to onboarding
    return true;
  }
  
  // Not first login, redirect to dashboard
  store.setView('dashboard');
  return false;
};
