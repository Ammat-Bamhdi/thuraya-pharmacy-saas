/**
 * Procurement and Supplier Models
 */

export type SupplierStatus = 'Active' | 'Inactive';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  rating: number;
  status: SupplierStatus;
  category: string;
  website: string;
  bankDetails: string;
  lastOrderDate?: string;
}

export type POStatus = 'Draft' | 'Sent' | 'Closed' | 'Cancelled';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  branchId: string;
  date: string;
  expectedDeliveryDate?: string;
  status: POStatus;
  subTotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  termsConditions?: string;
  shippingAddress?: string;
  attachmentName?: string;
  createdBy: string;
  assignedTo?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export type PaymentMethod = 'Bank Transfer' | 'Cash' | 'Check' | 'Credit';

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  attachmentName?: string;
  note?: string;
  fileUrl?: string;
}

export type BillStatus = 'Unpaid' | 'Partial' | 'Paid';

export interface PurchaseBill {
  id: string;
  poId: string;
  supplierId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  receivedDate: string;
  totalAmount: number;
  paidAmount: number;
  status: BillStatus;
  payments: PaymentRecord[];
  note?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  createdDate: string;
  createdBy: string;
  assignedTo?: string;
}
