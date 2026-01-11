/**
 * @fileoverview Global Application State Store
 * @description Centralized state management using Angular signals
 * @author Thuraya Systems
 * @version 2.0.0
 */

import { Injectable, signal, computed } from '@angular/core';

// Import all models from consolidated model files
import { Branch, Tenant } from '@core/models/branch.model';
import { User, Role } from '@core/models/user.model';
import { Product, ProductBatch, CartItem } from '@core/models/product.model';
import { Customer, Invoice, CustomerType } from '@core/models/sales.model';
import { 
  Supplier, 
  PurchaseOrder, 
  POStatus, 
  PurchaseBill, 
  PaymentRecord 
} from '@core/models/procurement.model';
import { Expense } from '@core/models/finance.model';
import { ViewState, SetupProgressItem } from '@core/models/ui.model';

// Re-export types for backwards compatibility with existing components
export type { 
  Branch, 
  Tenant, 
  User, 
  Role, 
  Product, 
  ProductBatch, 
  CartItem,
  Customer,
  Invoice,
  CustomerType,
  Supplier,
  PurchaseOrder,
  POStatus,
  PurchaseBill,
  PaymentRecord,
  Expense,
  ViewState
};

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  // ============================================================================
  // VIEW STATE
  // ============================================================================
  
  /** Current active view - always starts at 'auth' */
  currentView = signal<ViewState>('auth'); 

  // ============================================================================
  // MULTI-TENANCY STATE
  // ============================================================================
  
  /** Current tenant/organization */
  tenant = signal<Tenant | null>(null);
  
  /** All branches in the system */
  branches = signal<Branch[]>([]);
  
  /** All users in the system */
  users = signal<User[]>([]);
  
  /** Currently authenticated user */
  currentUser = signal<User | null>(null);

  // ============================================================================
  // PROCUREMENT STATE
  // ============================================================================
  
  suppliers = signal<Supplier[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);
  bills = signal<PurchaseBill[]>([]);

  // ============================================================================
  // INVENTORY STATE
  // ============================================================================
  
  products = signal<Product[]>([]);

  // ============================================================================
  // SALES & CRM STATE
  // ============================================================================
  
  customers = signal<Customer[]>([]);
  invoices = signal<Invoice[]>([]);

  // ============================================================================
  // FINANCE STATE
  // ============================================================================
  
  expenses = signal<Expense[]>([]);

  // ============================================================================
  // POS STATE
  // ============================================================================
  
  cart = signal<CartItem[]>([]);
  
  // ============================================================================
  // COMPUTED STATE
  // ============================================================================
  
  /** Total cart value */
  cartTotal = computed(() => 
    this.cart().reduce((total, item) => total + (item.price * item.quantity), 0)
  );
  
  /** Total items in cart */
  cartCount = computed(() => 
    this.cart().reduce((count, item) => count + item.quantity, 0)
  );
  
  /** Active branch (user's branch or first available) */
  activeBranch = computed(() => {
    const u = this.currentUser();
    if (!u) return this.branches()[0] || null;
    const branch = this.branches().find(b => b.id === u.branchId);
    return branch || this.branches()[0] || null;
  });

  /** Products below minimum stock level */
  lowStockItems = computed(() => {
    const branch = this.activeBranch();
    if (!branch) return [];
    return this.products().filter(p => p.branchId === branch.id && p.stock < (p.minStock || 20));
  });
  
  /** Total inventory value */
  totalStockValue = computed(() => {
    const branch = this.activeBranch();
    if (!branch) return 0;
    return this.products()
      .filter(p => p.branchId === branch.id)
      .reduce((val, p) => val + (p.cost * p.stock), 0);
  }); 

  // ============================================================================
  // ONBOARDING & SETUP STATE
  // ============================================================================
  
  showSetupGuide = signal(true);
  
  setupProgress = computed<SetupProgressItem[]>(() => [
    { id: 'tenant', label: 'Create Organization', done: !!this.tenant(), action: null },
    { id: 'branch', label: 'Setup First Branch', done: this.branches().length > 0, action: null },
    { id: 'suppliers', label: 'Add Your First Supplier', done: this.suppliers().length > 0, action: 'procurement-suppliers' },
    { id: 'inventory', label: 'Add Products', done: this.products().length > 0, action: 'inventory' }, 
    { id: 'customers', label: 'Add Customers', done: this.customers().length > 0, action: 'sales-customers' }
  ]);
  
  setupCompletion = computed(() => {
    const total = this.setupProgress().length;
    const done = this.setupProgress().filter(s => s.done).length;
    return Math.round((done / total) * 100);
  });
  
  /** Check if this is a first-time user with no data */
  isFirstTimeUser = computed(() => 
    this.products().length === 0 && 
    this.suppliers().length === 0 && 
    this.customers().length === 0
  );

  // ============================================================================
  // VIEW ACTIONS
  // ============================================================================
  
  setView(view: ViewState): void { 
    this.currentView.set(view);
  }
  
  dismissSetupGuide(): void { 
    this.showSetupGuide.set(false); 
  }

  /** Clear all store data (used on logout) */
  clearAll(): void {
    this.tenant.set(null);
    this.branches.set([]);
    this.users.set([]);
    this.currentUser.set(null);
    this.suppliers.set([]);
    this.purchaseOrders.set([]);
    this.bills.set([]);
    this.products.set([]);
    this.customers.set([]);
    this.invoices.set([]);
    this.expenses.set([]);
    this.cart.set([]);
    this.showSetupGuide.set(true);
  }

  // Set tenant from backend data
  setTenant(tenant: Tenant): void {
    this.tenant.set(tenant);
  }

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

  // Add branch from API response (uses real ID from backend)
  addBranchFromApi(branch: Branch): void {
    this.branches.update(b => {
      // Avoid duplicates
      if (b.some(existing => existing.id === branch.id)) {
        return b;
      }
      return [...b, branch];
    });
  }

  // Set branches from API (replaces all)
  setBranches(branches: Branch[]): void {
    this.branches.set(branches);
  }

  // Set users from API (replaces all)
  setUsers(users: User[]): void {
    this.users.set(users);
  }

  // Add a single user from API
  addUserFromApi(user: User): void {
    this.users.update(u => {
      // Avoid duplicates
      if (u.some(existing => existing.id === user.id)) {
        return u;
      }
      return [...u, user];
    });
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
    const s: Supplier = { 
      ...data as Supplier, 
      id: 's_' + Math.random().toString(36).substr(2,9), 
      code: data.code || 'SUP-' + Math.floor(Math.random() * 1000)
    };
    this.suppliers.update(curr => [...curr, s]);
  }
  updateSupplier(id: string, data: Partial<Supplier>) { this.suppliers.update(curr => curr.map(s => s.id === id ? { ...s, ...data } : s)); }
  deleteSupplier(id: string) { this.suppliers.update(curr => curr.filter(s => s.id !== id)); }

  createPO(data: Partial<PurchaseOrder>) {
    const user = this.currentUser();
    const userId = user?.id || 'system';
    const branchId = data.branchId || this.activeBranch()?.id || '';
    
    const po: PurchaseOrder = {
      id: 'PO-' + new Date().getFullYear() + '-' + Math.floor(Math.random()*1000), 
      supplierId: data.supplierId!, 
      branchId,
      date: data.date || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: data.expectedDeliveryDate, 
      status: 'Draft', 
      subTotal: data.subTotal || 0, 
      tax: data.tax || 0, 
      discount: data.discount || 0,
      grandTotal: data.grandTotal || 0, 
      createdBy: userId, 
      assignedTo: data.assignedTo || userId,
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
    const userId = this.currentUser()?.id || 'system';
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
      createdBy: userId,
      assignedTo: data.assignedTo || userId,
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
