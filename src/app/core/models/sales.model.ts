/**
 * Sales and Customer Models
 */

export type CustomerType = 'Standard' | 'Premium' | 'VIP' | 'Corporate' | 'Insurance';

export type PriceGroup = 'Retail' | 'Wholesale' | 'Distributor';

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone: string;
  billingAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  type: CustomerType;
  paymentTerms?: string;
  creditLimit: number;
  balance: number;
  priceGroup?: PriceGroup;
  bankAccount?: string;
  assignedSalesRep?: string;
  source?: string;
  communicationPrefs?: string[];
  notes?: string;
}

export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue';

export interface Invoice {
  id: string;
  customerId: string;
  branchId: string;
  date: string;
  status: InvoiceStatus;
  total: number;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  productId: string;
  quantity: number;
  price: number;
}
