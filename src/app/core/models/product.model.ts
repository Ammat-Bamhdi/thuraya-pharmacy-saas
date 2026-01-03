/**
 * Product and Inventory Models
 */

export interface ProductBatch {
  id: string;
  poRef: string;
  batchNumber: string;
  quantity: number;
  cost: number;
  expiryDate: string;
  receivedDate: string;
}

export interface Product {
  id: string;
  branchId: string;
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
