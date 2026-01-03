/**
 * Branch and Organization Models
 */

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  isOfflineEnabled: boolean;
  licenseCount: number;
  managerId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  country: string;
  currency: string;
  language: 'en' | 'ar';
}
