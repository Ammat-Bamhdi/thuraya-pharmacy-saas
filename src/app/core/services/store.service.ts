
import { Injectable, signal, computed } from '@angular/core';

// --- Domain Interfaces ---

export interface ProductBatch {
  id: string;
  poRef: string;        // Reference to the Purchase Order
  batchNumber: string;  // Manufacturer Batch/Lot Number
  quantity: number;     // Current remaining quantity
  cost: number;         // Cost for this specific batch
  expiryDate: string;
  receivedDate: string;
}

export interface Product {
  id: string;
  branchId: string; // NEW: Inventory is strictly scoped to a branch
  name: string;
  genericName: string;
  sku: string;
  price: number; 
  cost: number;  
  margin: number; 
  stock: number; 
  expiryDate: string; 
  category: string;
  supplierId: string; 
  minStock: number; 
  location?: string; 
  batches: ProductBatch[];
}

export interface CartItem extends Product {
  quantity: number;
}

export type Role = 'super_admin' | 'branch_admin' | 'section_admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId?: string; // The branch this user is currently operating in
  sectionId?: string;
  status: 'active' | 'invited' | 'suspended';
  avatar?: string;
}

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

// --- Procurement Interfaces ---

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
  status: 'Active' | 'Inactive';
  category: string;
  website: string;
  bankDetails: string;
  createdDate: string;
  lastOrderDate?: string;
}

export type POStatus = 'Draft' | 'Sent' | 'Closed' | 'Cancelled';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  branchId: string; // NEW: Which branch is this order for?
  date: string; 
  expectedDeliveryDate?: string;
  status: POStatus;
  
  // Financials (Expected)
  subTotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  
  // Details
  termsConditions?: string;
  shippingAddress?: string;
  attachmentName?: string;
  
  // Audit
  createdBy: string; // User ID
  assignedTo?: string; // User ID
  
  items: { productId: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string }[];
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'Bank Transfer' | 'Cash' | 'Check' | 'Credit';
  reference?: string; // Check # or Transaction ID
  attachmentName?: string; // Mock for PDF/Image
  note?: string;
  fileUrl?: string; // In-memory URL for demo purposes
}

// The Real Financial Document
export interface PurchaseBill {
  id: string;
  poId: string;           // Link to PO
  supplierId: string;
  billNumber: string;     // Supplier's Invoice #
  billDate: string;
  dueDate: string;
  receivedDate: string;
  
  totalAmount: number;
  paidAmount: number;
  status: 'Unpaid' | 'Partial' | 'Paid';
  
  payments: PaymentRecord[]; // History
  note?: string;
  
  // Bill Attachment (PDF/Image)
  attachmentName?: string;
  attachmentUrl?: string;

  // Audit & Assignment
  createdDate: string;
  createdBy: string;      // User ID or Name
  assignedTo?: string;    // User ID who owns this task
}

// --- Sales & CRM Interfaces ---
export type CustomerType = 'Standard' | 'Premium' | 'VIP' | 'Corporate' | 'Insurance';

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
  priceGroup?: 'Retail' | 'Wholesale' | 'Distributor';
  bankAccount?: string;
  assignedSalesRep?: string; 
  source?: string;
  communicationPrefs?: string[]; 
  notes?: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  branchId: string; // NEW: Scoped to branch
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  total: number;
  items: { productId: string; quantity: number; price: number }[];
}

// --- Finance Interfaces ---
export interface Expense {
  id: string;
  category: 'Rent' | 'Utilities' | 'Salaries' | 'Supplies' | 'Marketing';
  amount: number;
  date: string;
  description: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  currentView = signal<ViewState>('auth'); 

  // --- Multi-Tenancy Data ---
  tenant = signal<Tenant | null>(null);
  
  branches = signal<Branch[]>([
    { id: 'b1', name: "Sana'a Central", code: 'SAN-01', location: "Hadda St, Sana'a", isOfflineEnabled: true, licenseCount: 5 },
    { id: 'b2', name: "Aden Seaside", code: 'ADE-01', location: "Main St, Aden", isOfflineEnabled: true, licenseCount: 3 }
  ]);

  users = signal<User[]>([
    { id: 'u1', name: 'Dr. Ahmed Al-Yemeni', email: 'ahmed@thuraya.pharmacy', role: 'super_admin', branchId: 'b1', status: 'active', avatar: 'https://picsum.photos/seed/u1/32/32' },
    { id: 'u2', name: 'Sarah Ali', email: 'sarah@thuraya.pharmacy', role: 'branch_admin', branchId: 'b1', status: 'active', avatar: 'https://picsum.photos/seed/u2/32/32' },
    { id: 'u3', name: 'Omar Khaled', email: 'omar@thuraya.pharmacy', role: 'branch_admin', branchId: 'b2', status: 'active', avatar: 'https://picsum.photos/seed/u3/32/32' }
  ]);

  currentUser = signal<User>(this.users()[0]);

  // --- Procurement State ---
  suppliers = signal<Supplier[]>([
    { 
      id: 's1', code: 'SUP-001', name: 'Pharma Yemen Ltd', contactPerson: 'Khaled Al-Qadi', email: 'orders@pharmayemen.com', phone: '+967 777 111 222', 
      address: 'Industrial Zone', city: "Sana'a", state: 'Amanat Al Asimah', country: 'Yemen', zipCode: '12345', paymentTerms: 'Net 30', 
      creditLimit: 5000000, currentBalance: 450000, rating: 5, status: 'Active', category: 'Pharmaceuticals', website: '', bankDetails: '', createdDate: '2024-01-01'
    },
    {
      id: 's2', code: 'SUP-002', name: 'Al-Amal Medical Supplies', contactPerson: 'Dr. Fatima', email: 'sales@alamal.com', phone: '+967 770 555 666',
      address: 'Hadda Street', city: "Sana'a", state: 'Amanat Al Asimah', country: 'Yemen', zipCode: '12346', paymentTerms: 'Immediate',
      creditLimit: 2000000, currentBalance: 0, rating: 4, status: 'Active', category: 'Equipment', website: '', bankDetails: '', createdDate: '2024-02-15'
    },
    {
      id: 's3', code: 'SUP-003', name: 'Yemen Drug Store', contactPerson: 'Omar Saeed', email: 'info@yemendrugs.com', phone: '+967 771 999 888',
      address: 'Taiz Street', city: "Ibb", state: 'Ibb', country: 'Yemen', zipCode: '44556', paymentTerms: 'Net 60',
      creditLimit: 10000000, currentBalance: 1250000, rating: 5, status: 'Active', category: 'Pharmaceuticals', website: '', bankDetails: '', createdDate: '2024-01-20'
    }
  ]);

  purchaseOrders = signal<PurchaseOrder[]>([
    { 
      id: 'PO-2025-001', supplierId: 's1', branchId: 'b1', date: '2025-01-15', expectedDeliveryDate: '2025-01-20', status: 'Closed', 
      subTotal: 450000, tax: 0, discount: 0, grandTotal: 450000, createdBy: 'u1', assignedTo: 'u1', 
      items: [{ productId: '1', quantity: 300, unitCost: 1200 }, { productId: '2', quantity: 36, unitCost: 2500 }]
    },
    // Billed & Pending (Eligible for Import) - For Branch 1
    {
      id: 'PO-2025-002', supplierId: 's1', branchId: 'b1', date: '2025-02-10', expectedDeliveryDate: '2025-02-15', status: 'Sent',
      subTotal: 600000, tax: 0, discount: 0, grandTotal: 600000, createdBy: 'u1', assignedTo: 'u2',
      items: [
        { productId: '3', quantity: 500, unitCost: 800 }, // Cipro
        { productId: '4', quantity: 1000, unitCost: 200 } // Omeprazole
      ]
    },
    // Unbilled (Not Eligible for Import) - For Branch 2
    {
      id: 'PO-2025-003', supplierId: 's3', branchId: 'b2', date: '2025-02-18', expectedDeliveryDate: '2025-02-25', status: 'Sent',
      subTotal: 250000, tax: 0, discount: 0, grandTotal: 250000, createdBy: 'u1', assignedTo: 'u3',
      items: [
        { productId: '5', quantity: 250, unitCost: 1000 } // Vitamin C
      ]
    },
    // Draft - For Branch 1
    {
      id: 'PO-2025-004', supplierId: 's2', branchId: 'b1', date: '2025-02-20', expectedDeliveryDate: '', status: 'Draft',
      subTotal: 150000, tax: 0, discount: 0, grandTotal: 150000, createdBy: 'u2', assignedTo: 'u2',
      items: [
        { productId: '6', quantity: 10, unitCost: 15000 } // Glucometer
      ]
    }
  ]);

  bills = signal<PurchaseBill[]>([
    {
      id: 'BILL-001', poId: 'PO-2025-001', supplierId: 's1', billNumber: 'INV-998877',
      billDate: '2025-01-15', dueDate: '2025-02-15', receivedDate: '2025-01-15',
      totalAmount: 450000, paidAmount: 450000, status: 'Paid',
      payments: [{ id: 'PAY-1', date: '2025-01-20', amount: 450000, method: 'Bank Transfer', reference: 'TRX-123' }],
      createdDate: '2025-01-15', createdBy: 'u1', assignedTo: 'u1'
    },
    {
      id: 'BILL-002', poId: 'PO-2025-002', supplierId: 's1', billNumber: 'INV-223344',
      billDate: '2025-02-12', dueDate: '2025-03-12', receivedDate: '2025-02-12',
      totalAmount: 600000, paidAmount: 0, status: 'Unpaid', payments: [],
      createdDate: '2025-02-12', createdBy: 'u1', assignedTo: 'u2'
    }
  ]);

  // --- Inventory State (Distributed per Branch) ---
  products = signal<Product[]>([
    // Branch 1 Inventory (Sana'a)
    { 
      id: '1', branchId: 'b1', name: 'Panadol Extra', genericName: 'Paracetamol', sku: 'PAN-001', price: 1500, cost: 1200, margin: 25, stock: 124, 
      category: 'Analgesic', expiryDate: '2026-05-20', supplierId: 's1', minStock: 50, location: 'Shelf A1',
      batches: [
        { id: 'b_1', poRef: 'PO-2024-001', batchNumber: 'LOT-99A', quantity: 100, cost: 1200, expiryDate: '2026-05-20', receivedDate: '2024-01-01' },
        { id: 'b_2', poRef: 'PO-2024-055', batchNumber: 'LOT-99B', quantity: 24, cost: 1250, expiryDate: '2026-08-01', receivedDate: '2024-06-01' }
      ]
    },
    { 
      id: '2', branchId: 'b1', name: 'Amoclan', genericName: 'Amoxicillin', sku: 'AMO-500', price: 3200, cost: 2500, margin: 28, stock: 80, 
      category: 'Antibiotic', expiryDate: '2025-11-10', supplierId: 's2', minStock: 20, location: 'Shelf B3',
      batches: []
    },
    // Branch 2 Inventory (Aden) - Same products, different stock/location
    { 
      id: '1_b2', branchId: 'b2', name: 'Panadol Extra', genericName: 'Paracetamol', sku: 'PAN-001', price: 1600, cost: 1200, margin: 33, stock: 45, 
      category: 'Analgesic', expiryDate: '2026-05-20', supplierId: 's1', minStock: 50, location: 'Bin 12',
      batches: [
        { id: 'b_1_2', poRef: 'OPENING', batchNumber: 'LOT-99A', quantity: 45, cost: 1200, expiryDate: '2026-05-20', receivedDate: '2024-01-01' }
      ]
    },
    
    // New Products (Pending Import) - placeholders usually created when PO is drafted
    {
        id: '3', branchId: 'b1', name: 'Cipro 500mg', genericName: 'Ciprofloxacin', sku: 'CIP-500', price: 0, cost: 800, margin: 0, stock: 0,
        category: 'Antibiotic', expiryDate: '', supplierId: 's1', minStock: 30, location: 'Warehouse', batches: []
    },
    {
        id: '4', branchId: 'b1', name: 'Omeprazole 20mg', genericName: 'Omeprazole', sku: 'OME-20', price: 0, cost: 200, margin: 0, stock: 0,
        category: 'Gastrointestinal', expiryDate: '', supplierId: 's1', minStock: 100, location: 'Shelf C1', batches: []
    },
    {
        id: '5', branchId: 'b2', name: 'Vitamin C 1000mg', genericName: 'Ascorbic Acid', sku: 'VIT-C-1G', price: 0, cost: 1000, margin: 0, stock: 0,
        category: 'Supplement', expiryDate: '', supplierId: 's3', minStock: 20, location: 'Shelf D1', batches: []
    },
    {
        id: '6', branchId: 'b1', name: 'Glucometer Accu-Chek', genericName: 'Blood Glucose Meter', sku: 'ACCU-01', price: 25000, cost: 15000, margin: 66, stock: 5,
        category: 'Equipment', expiryDate: '', supplierId: 's2', minStock: 2, location: 'Display 1', batches: []
    }
  ]);

  // --- Sales & CRM State ---
  customers = signal<Customer[]>([
    { id: 'c1', name: 'Walk-in Customer', phone: '', type: 'Standard', creditLimit: 0, balance: 0 },
    { id: 'c2', name: 'Al-Amal Hospital', companyName: 'Al-Amal Medical Group', phone: '+967 1 202020', email: 'procurement@amal.hospital', type: 'Corporate', creditLimit: 1000000, balance: 150000, city: "Sana'a", country: 'Yemen' },
    { id: 'c3', name: 'Mohammed Ali', phone: '+967 777 000 111', type: 'Premium', creditLimit: 50000, balance: 12000, city: "Aden", state: 'Aden', country: 'Yemen', billingAddress: 'Main St' },
    { id: 'c4', name: 'Al-Hayat Insurance', phone: '+967 1 444 555', type: 'Insurance', creditLimit: 5000000, balance: 450000, city: "Sana'a", country: 'Yemen' }
  ]);

  invoices = signal<Invoice[]>([
    { id: 'INV-1001', customerId: 'c1', branchId: 'b1', date: '2025-01-20', status: 'Paid', total: 4500, items: [] },
    { id: 'INV-1002', customerId: 'c2', branchId: 'b1', date: '2025-02-01', status: 'Pending', total: 150000, items: [] },
    { id: 'INV-1003', customerId: 'c3', branchId: 'b2', date: '2025-02-10', status: 'Overdue', total: 12000, items: [] }
  ]);

  // --- Finance State ---
  expenses = signal<Expense[]>([
    { id: 'e1', category: 'Rent', amount: 150000, date: '2025-02-01', description: 'Monthly Branch Rent' },
    { id: 'e2', category: 'Utilities', amount: 45000, date: '2025-02-05', description: 'Electricity Bill' }
  ]);

  // Cart State (POS)
  cart = signal<CartItem[]>([]);
  
  // Computed State
  cartTotal = computed(() => this.cart().reduce((total, item) => total + (item.price * item.quantity), 0));
  cartCount = computed(() => this.cart().reduce((count, item) => count + item.quantity, 0));
  
  // Active Branch Logic (Defaults to user's branch or first available)
  activeBranch = computed(() => {
    const u = this.currentUser();
    const branch = this.branches().find(b => b.id === u.branchId);
    return branch || this.branches()[0];
  });

  lowStockItems = computed(() => this.products().filter(p => p.branchId === this.activeBranch().id && p.stock < (p.minStock || 20)));
  totalStockValue = computed(() => this.products().filter(p => p.branchId === this.activeBranch().id).reduce((val, p) => val + (p.cost * p.stock), 0)); 

  // Setup / Onboarding Tracking
  showSetupGuide = signal(true);
  setupProgress = computed(() => [
      { id: 'tenant', label: 'Create Organization', done: !!this.tenant(), action: null },
      { id: 'branch', label: 'Setup First Branch', done: this.branches().length > 0, action: null },
      { id: 'inventory', label: 'Add Inventory', done: this.products().length > 0, action: 'inventory' as ViewState }, 
      { id: 'suppliers', label: 'Add Suppliers', done: this.suppliers().length > 0, action: 'procurement-suppliers' as ViewState },
      { id: 'team', label: 'Invite Team Members', done: this.users().length > 3, action: 'users' as ViewState }
  ]);
  setupCompletion = computed(() => {
    const total = this.setupProgress().length;
    const done = this.setupProgress().filter(s => s.done).length;
    return Math.round((done / total) * 100);
  });

  // Actions
  setView(view: ViewState) { this.currentView.set(view); }
  dismissSetupGuide() { this.showSetupGuide.set(false); }

  // Tenant / Onboarding Actions
  createTenant(data: Partial<Tenant>) {
    const id = 't_' + Math.random().toString(36).substr(2, 9);
    this.tenant.set({ id, name: data.name!, country: data.country || 'Yemen', currency: data.currency || 'YER', language: data.language || 'en' });
    return id;
  }
  updateTenant(data: Partial<Tenant>) { this.tenant.update(t => t ? ({ ...t, ...data }) : null); }
  addBranch(data: Partial<Branch>) {
    const id = 'b_' + Math.random().toString(36).substr(2, 9);
    this.branches.update(b => [...b, { id, name: data.name!, code: data.code || 'BR-01', location: data.location || '', isOfflineEnabled: data.isOfflineEnabled || false, licenseCount: data.licenseCount || 1 }]);
    return id;
  }
  inviteUser(email: string, role: Role, branchId?: string, sectionId?: string) {
    const newUser: User = { id: 'u_' + Math.random().toString(36).substr(2, 9), name: email.split('@')[0], email, role, branchId, sectionId, status: 'invited', avatar: `https://picsum.photos/seed/${Math.random()}/32/32` };
    this.users.update(u => [...u, newUser]);
  }

  // Auth Actions
  updateCurrentUser(user: User) {
    this.currentUser.set(user);
    // Also update in users array if exists
    this.users.update(users => {
      const idx = users.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        const updated = [...users];
        updated[idx] = user;
        return updated;
      }
      return [...users, user];
    });
  }

  // Inventory Actions
  addProduct(product: Partial<Product> & { initialPoRef?: string }) {
    // If no branch ID provided, default to active branch context
    const branchId = product.branchId || this.activeBranch().id;

    const newProduct: Product = {
      id: 'p_' + Math.random().toString(36).substr(2, 9), 
      branchId: branchId,
      name: product.name!, genericName: product.genericName || '', sku: product.sku || 'SKU-' + Math.floor(Math.random() * 10000),
      price: Number(product.price) || 0, cost: Number(product.cost) || 0, margin: Number(product.margin) || 0, stock: Number(product.stock) || 0,
      category: product.category || 'General', expiryDate: product.expiryDate || new Date().toISOString().split('T')[0], supplierId: product.supplierId || 's1',
      minStock: Number(product.minStock) || 10, location: product.location || 'Warehouse', batches: []
    };
    if (newProduct.stock > 0) {
      newProduct.batches.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), poRef: product.initialPoRef || 'OPENING-STOCK', batchNumber: 'BATCH-INIT', quantity: newProduct.stock, cost: newProduct.cost, expiryDate: newProduct.expiryDate, receivedDate: new Date().toISOString().split('T')[0] });
    }
    this.products.update(p => [newProduct, ...p]);
    return newProduct.id;
  }
  updateProduct(id: string, data: Partial<Product>) { this.products.update(products => products.map(p => p.id === id ? { ...p, ...data } : p)); }
  deleteProduct(id: string) { this.products.update(products => products.filter(p => p.id !== id)); }

  // Procurement Actions
  addSupplier(data: Partial<Supplier>) {
    const s: Supplier = { ...data as Supplier, id: 's_' + Math.random().toString(36).substr(2,9), code: data.code || 'SUP-' + Math.floor(Math.random() * 1000), createdDate: new Date().toISOString().split('T')[0] };
    this.suppliers.update(curr => [...curr, s]);
  }
  updateSupplier(id: string, data: Partial<Supplier>) { this.suppliers.update(curr => curr.map(s => s.id === id ? { ...s, ...data } : s)); }
  deleteSupplier(id: string) { this.suppliers.update(curr => curr.filter(s => s.id !== id)); }

  createPO(data: Partial<PurchaseOrder>) {
    const po: PurchaseOrder = {
      id: 'PO-' + new Date().getFullYear() + '-' + Math.floor(Math.random()*1000), 
      supplierId: data.supplierId!, 
      branchId: data.branchId || this.activeBranch().id, // Default to current if not specified
      date: data.date || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: data.expectedDeliveryDate, 
      status: 'Draft', 
      subTotal: data.subTotal || 0, 
      tax: data.tax || 0, 
      discount: data.discount || 0,
      grandTotal: data.grandTotal || 0, 
      createdBy: this.currentUser().id, 
      assignedTo: data.assignedTo || this.currentUser().id,
      items: data.items || [], 
      termsConditions: data.termsConditions || '',
      shippingAddress: data.shippingAddress || '', 
      attachmentName: data.attachmentName
    };
    this.purchaseOrders.update(curr => [po, ...curr]);
  }
  updatePurchaseOrder(id: string, data: Partial<PurchaseOrder>) { this.purchaseOrders.update(curr => curr.map(p => p.id === id ? { ...p, ...data } : p)); }
  deletePurchaseOrder(id: string) { this.purchaseOrders.update(curr => curr.filter(p => p.id !== id)); }

  // --- Create Bill (The "Approved/Received" Action) ---
  createBill(poId: string, data: { billNumber: string, billDate: string, receivedDate: string, dueDate: string, assignedTo?: string, attachmentName?: string, attachmentUrl?: string }) {
    const currentOrders = this.purchaseOrders();
    const poIndex = currentOrders.findIndex(p => p.id === poId);
    if (poIndex === -1) return;

    const currentPO = currentOrders[poIndex];
    if (currentPO.status === 'Closed') return; // Already billed

    // 1. Create the Bill Record
    const newBill: PurchaseBill = {
      id: 'BILL-' + Math.floor(Math.random() * 100000),
      poId: currentPO.id,
      supplierId: currentPO.supplierId,
      billNumber: data.billNumber,
      billDate: data.billDate,
      dueDate: data.dueDate,
      receivedDate: data.receivedDate,
      totalAmount: currentPO.grandTotal,
      paidAmount: 0,
      status: 'Unpaid',
      payments: [],
      createdDate: new Date().toISOString(),
      createdBy: this.currentUser().id,
      assignedTo: data.assignedTo || this.currentUser().id,
      attachmentName: data.attachmentName,
      attachmentUrl: data.attachmentUrl
    };
    this.bills.update(b => [newBill, ...b]);

    // 2. Process Inventory (Add Stock Batches to the Specific Branch)
    const itemsToReceive = currentPO.items;
    
    this.products.update(prods => {
      return prods.map(p => {
        // ONLY update products belonging to the PO's destination branch
        if (p.branchId !== currentPO.branchId) return p;

        const item = itemsToReceive.find(i => i.productId === p.id);
        if (item) {
          const newBatch: ProductBatch = {
              id: 'batch_' + Math.random().toString(36).substr(2,9),
              poRef: currentPO.id,
              batchNumber: item.batchNumber || 'BATCH-' + currentPO.id,
              quantity: item.quantity,
              cost: item.unitCost,
              expiryDate: item.expiryDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              receivedDate: data.receivedDate
          };
          const updatedBatches = [...p.batches, newBatch];
          const newStock = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
          const nearestExpiry = updatedBatches.filter(b => b.quantity > 0).map(b => b.expiryDate).sort()[0] || p.expiryDate;
          return { ...p, batches: updatedBatches, stock: newStock, expiryDate: nearestExpiry };
        }
        return p;
      });
    });

    // 3. Update PO Status to Closed
    this.purchaseOrders.update(curr => 
      curr.map(p => p.id === poId ? { ...p, status: 'Closed' } : p)
    );

    // 4. Update Supplier Balance (Increase debt)
    this.suppliers.update(supps => 
      supps.map(s => s.id === currentPO.supplierId ? { ...s, currentBalance: s.currentBalance + currentPO.grandTotal } : s)
    );
  }

  // Record a payment on a Bill
  addBillPayment(billId: string, payment: Partial<PaymentRecord>) {
    this.bills.update(currentBills => {
      return currentBills.map(bill => {
        if (bill.id === billId) {
          const remaining = bill.totalAmount - bill.paidAmount;
          let paymentAmount = Number(payment.amount) || 0;
          
          if (paymentAmount > remaining) paymentAmount = remaining;
          if (paymentAmount < 0) paymentAmount = 0;

          const newPayment: PaymentRecord = {
            id: 'PAY-' + Math.floor(Math.random() * 100000),
            date: payment.date || new Date().toISOString().split('T')[0],
            amount: paymentAmount,
            method: payment.method || 'Cash',
            reference: payment.reference,
            attachmentName: payment.attachmentName,
            note: payment.note,
            fileUrl: payment.fileUrl
          };
          
          const updatedPayments = [...bill.payments, newPayment];
          const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
          
          let newStatus: 'Unpaid' | 'Partial' | 'Paid' = 'Unpaid';
          if (totalPaid >= bill.totalAmount - 0.01) newStatus = 'Paid';
          else if (totalPaid > 0) newStatus = 'Partial';

          return { ...bill, payments: updatedPayments, paidAmount: totalPaid, status: newStatus };
        }
        return bill;
      });
    });

    // Separate update for supplier balance
    const bill = this.bills().find(b => b.id === billId);
    if (bill && Number(payment.amount) > 0) {
       this.suppliers.update(supps => 
         supps.map(s => s.id === bill.supplierId ? { ...s, currentBalance: Math.max(0, s.currentBalance - (Number(payment.amount) || 0)) } : s)
       );
    }
  }

  updateBill(id: string, data: Partial<PurchaseBill>) {
    this.bills.update(curr => curr.map(b => b.id === id ? { ...b, ...data } : b));
  }

  // Sales Actions
  addCustomer(data: Partial<Customer>) {
    const c: Customer = {
      id: 'c_' + Math.random().toString(36).substr(2,9), name: data.name!, companyName: data.companyName, phone: data.phone || '', email: data.email || '', type: data.type || 'Standard',
      billingAddress: data.billingAddress, city: data.city, state: data.state, country: data.country || 'Yemen', paymentTerms: data.paymentTerms, creditLimit: Number(data.creditLimit) || 0,
      priceGroup: data.priceGroup, assignedSalesRep: data.assignedSalesRep, source: data.source, communicationPrefs: data.communicationPrefs || [], notes: data.notes, bankAccount: data.bankAccount, balance: 0
    };
    this.customers.update(curr => [...curr, c]);
  }
  updateCustomer(id: string, data: Partial<Customer>) { this.customers.update(curr => curr.map(c => c.id === id ? { ...c, ...data } : c)); }
  
  createInvoice(customerId: string, branchId: string, items: any[], total: number) {
    const inv: Invoice = { 
        id: 'INV-' + Math.floor(Math.random() * 10000), 
        customerId, 
        branchId, // Scoped to branch
        date: new Date().toISOString().split('T')[0], 
        status: 'Paid', 
        total, 
        items 
    };
    this.invoices.update(curr => [inv, ...curr]);
  }
  updateInvoice(id: string, data: Partial<Invoice>) { this.invoices.update(curr => curr.map(i => i.id === id ? { ...i, ...data } : i)); }

  // POS Actions
  addToCart(product: Product) {
    this.cart.update(currentCart => {
      const existing = currentCart.find(item => item.id === product.id);
      if (existing) { return currentCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item); }
      return [...currentCart, { ...product, quantity: 1 }];
    });
  }
  removeFromCart(productId: string) { this.cart.update(c => c.filter(i => i.id !== productId)); }
  clearCart() { this.cart.set([]); }
  
  checkout(customerId: string, branchId: string) {
    const currentCart = this.cart();
    const total = this.cartTotal();
    
    // Create invoice scoped to branch
    this.createInvoice(customerId, branchId, currentCart.map(c => ({ productId: c.id, quantity: c.quantity, price: c.price })), total);
    
    // Only update products in the current active branch
    this.products.update(currentProducts => {
      return currentProducts.map(p => {
        if (p.branchId !== branchId) return p;

        const cartItem = currentCart.find(c => c.id === p.id);
        if (cartItem) {
          let remainingToDeduct = cartItem.quantity;
          const sortedBatches = [...p.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
          const updatedBatches = sortedBatches.map(batch => {
             if (remainingToDeduct <= 0) return batch;
             if (batch.quantity >= remainingToDeduct) { const newQty = batch.quantity - remainingToDeduct; remainingToDeduct = 0; return { ...batch, quantity: newQty }; } 
             else { remainingToDeduct -= batch.quantity; return { ...batch, quantity: 0 }; }
          });
          const newStock = p.batches.length > 0 ? updatedBatches.reduce((sum, b) => sum + b.quantity, 0) : Math.max(0, p.stock - cartItem.quantity);
          return { ...p, batches: updatedBatches, stock: newStock };
        }
        return p;
      });
    });
    this.clearCart();
  }
}
