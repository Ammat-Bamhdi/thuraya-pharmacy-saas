/**
 * UI and Application State Models
 */

// Expanded ViewState for Sidebar Sub-Navigation
export type ViewState = 
  | 'auth'
  | 'onboarding' 
  | 'dashboard' 
  | 'inventory' 
  // Procurement Sub-views
  | 'procurement-orders' 
  | 'procurement-bills' 
  | 'procurement-suppliers' 
  // Sales Sub-views
  | 'sales-customers' 
  | 'sales-invoices' 
  // Others
  | 'finance' 
  | 'pos' 
  | 'users' 
  | 'settings';

// Setup Progress Item
export interface SetupProgressItem {
  id: string;
  label: string;
  done: boolean;
  action: ViewState | null;
}

// Menu Position for Action Menus
export interface MenuPosition {
  x: number;
  y: number;
}

// Column Configuration
export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

// Sort Configuration
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Pagination State
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}
