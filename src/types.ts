export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice: number; // For gross profit calculations
  stock: number;
  minStock: number; // Low stock alert threshold
  category: string;
  image?: string; // Optional image URL
  color: string; // Dynamic background colors for items without images
}

export type Category = string;

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercentage: number; // Custom item discount
}

export type PaymentMethod = 'CASH' | 'DEBIT_CREDIT' | 'QRIS' | 'E_WALLET';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  points: number; // Loyalty points
  createdAt: string;
}

export interface Order {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: {
    productId: string;
    productName: string;
    price: number;
    costPrice: number;
    quantity: number;
    subtotal: number;
    discountPercentage: number;
  }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashAmountPaid?: number; // Cash paid by customer
  changeAmount?: number; // Change given back
  customerId?: string;
  customerName?: string;
  pointsEarnedValue?: number;
  notes?: string;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxRate: number; // Percentage (e.g., 11% for PPN in Indonesia)
  currency: string; // Default: 'Rp'
  receiptFooterMessage: string;
  enableLoyalty: boolean;
  pointsPerRupiah: number; // e.g. earn 1 point for every Rp 1.000 spent
  ownerPin?: string; // Default: '1234'
  kasirPin?: string; // Default: '0000'
  enableLockScreen?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  pointsValuePerPoint?: number; // Rupiah value per point redeemed (e.g., Rp 100 per point)
}

export interface Promo {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number; // e.g. 10 for 10% or 10000 for Rp 10.000
  minPurchase: number;
  isActive: boolean;
}

export interface CashierShift {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  totalSales?: number;
  cashSales?: number;
  qrisSales?: number;
  debitCreditSales?: number;
  eWalletSales?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  address?: string;
}

export interface RestockOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  timestamp: string;
  items: {
    productId: string;
    productName: string;
    costPrice: number;
    quantity: number;
    subtotal: number;
  }[];
  totalAmount: number;
  notes?: string;
}

export interface Expense {
  id: string;
  category: 'OPERASIONAL' | 'GAJI' | 'SEWA' | 'LISTRIK_AIR' | 'RESTOCK' | 'LAINNYA';
  amount: number;
  timestamp: string;
  description: string;
}

export type UserRole = 'OWNER' | 'KASIR';

export interface UserSession {
  role: UserRole;
  name: string;
  loggedInAt: string;
}

export type ActiveTab = 'kasir' | 'produk' | 'riwayat' | 'laporan' | 'pelanggan' | 'pengaturan';
