import { Product, Order, Customer, StoreSettings, PaymentMethod } from '../types';
import { DEFAULT_PRODUCTS } from '../data/defaultProducts';
import { 
  uploadProductToCloud, 
  uploadCustomerToCloud, 
  uploadOrderToCloud, 
  deleteProductFromCloud, 
  deleteCustomerFromCloud 
} from './supabase';

const KEYS = {
  PRODUCTS: 'pos_products',
  CUSTOMERS: 'pos_customers',
  ORDERS: 'pos_orders',
  SETTINGS: 'pos_settings',
  PROMOS: 'pos_promos',
  SHIFTS: 'pos_shifts',
  SUPPLIERS: 'pos_suppliers',
  RESTOCK_ORDERS: 'pos_restock_orders',
  EXPENSES: 'pos_expenses',
};

// Initial state helpers
const getInitialSettings = (): StoreSettings => ({
  storeName: 'Exora POS',
  address: 'Jl. Jenderal Sudirman No. 45, Jakarta Selatan',
  phone: '0812-3456-7890',
  taxRate: 11, // Standard PPN 11% in Indonesia
  currency: 'Rp',
  receiptFooterMessage: 'Terima kasih atas kunjungan Anda!',
  enableLoyalty: true,
  pointsPerRupiah: 0.001, // 1 point per Rp 1.000 spent
  pointsValuePerPoint: 100, // Rp 100 per point redeemed (10 points = Rp 1.000)
  ownerPin: '1234',
  kasirPin: '0000',
  enableLockScreen: true,
  supabaseUrl: '',
  supabaseAnonKey: '',
});

const getInitialPromos = (): Promo[] => [
  { id: 'promo-1', code: 'DISKON10', name: 'Promo Hemat 10%', type: 'PERCENTAGE', value: 10, minPurchase: 50000, isActive: true },
  { id: 'promo-2', code: 'HEMAT50K', name: 'Potongan Rp 50.000', type: 'FIXED', value: 50000, minPurchase: 300000, isActive: true },
  { id: 'promo-3', code: 'MERDEKA', name: 'Gajian Merdeka 17%', type: 'PERCENTAGE', value: 17, minPurchase: 100000, isActive: true }
];

const getInitialSuppliers = (): Supplier[] => [
  { id: 'sup-1', name: 'PT Sinar Abadi', contactName: 'Bapak Rian', phone: '081233334444', address: 'Kawasan Industri Pulogadung, Jakarta' },
  { id: 'sup-2', name: 'CV Indo Pratama', contactName: 'Ibu Listya', phone: '085755556666', address: 'Ruko Mangga Dua Blok C-5, Jakarta' },
  { id: 'sup-3', name: 'Grosir Mandiri Jaya', contactName: 'Hendra', phone: '081988889999', address: 'Pasar Pagi Asemka No. 12, Jakarta' }
];

const getInitialExpenses = (): Expense[] => {
  const today = new Date();
  return [
    { id: 'exp-1', category: 'SEWA', amount: 2500000, timestamp: new Date(today.getFullYear(), today.getMonth() - 1, 5).toISOString(), description: 'Sewa ruko bulanan' },
    { id: 'exp-2', category: 'LISTRIK_AIR', amount: 450000, timestamp: new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString(), description: 'Tagihan listrik & air toko' },
    { id: 'exp-3', category: 'GAJI', amount: 3000000, timestamp: new Date(today.getFullYear(), today.getMonth() - 1, 28).toISOString(), description: 'Gaji karyawan kasir' },
    { id: 'exp-4', category: 'OPERASIONAL', amount: 150000, timestamp: new Date(today.getFullYear(), today.getMonth(), 2).toISOString(), description: 'Beli kertas struk & plastik' },
    { id: 'exp-5', category: 'LISTRIK_AIR', amount: 480000, timestamp: new Date(today.getFullYear(), today.getMonth(), 10).toISOString(), description: 'Tagihan listrik berjalan' },
  ];
};

import { Promo, CashierShift, Supplier, RestockOrder, Expense } from '../types';

const getInitialCustomers = (): Customer[] => [
  {
    id: 'cust-1',
    name: 'Budi Santoso',
    phone: '081299991111',
    email: 'budi@shoppail.com',
    points: 120,
    createdAt: new Date('2026-01-10').toISOString(),
  },
  {
    id: 'cust-2',
    name: 'Siti Rahma',
    phone: '087888882222',
    email: 'siti@mail.com',
    points: 250,
    createdAt: new Date('2026-03-05').toISOString(),
  },
  {
    id: 'cust-3',
    name: 'Adi Prasetyo',
    phone: '085677773333',
    points: 40,
    createdAt: new Date('2026-05-20').toISOString(),
  }
];

const generateSingleMockOrder = (
  date: Date, 
  products: Product[], 
  customers: Customer[], 
  paymentMethods: PaymentMethod[],
  seq: number
): Order => {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  const receiptNumber = `KSR-${dateStr}-${String(seq).padStart(4, '0')}-${rand}`;
  
  // Pick some random products from DEFAULT_PRODUCTS (1 to 3 items)
  const itemCount = Math.floor(1 + Math.random() * 3);
  const shuffled = [...products].sort(() => 0.5 - Math.random());
  const selectedProducts = shuffled.slice(0, itemCount);
  
  const items = selectedProducts.map(p => {
    const qty = Math.floor(1 + Math.random() * 2);
    const subtotal = p.price * qty;
    return {
      productId: p.id,
      productName: p.name,
      price: p.price,
      costPrice: p.costPrice || (p.price * 0.5), // fallback if cost price doesn't exist
      quantity: qty,
      subtotal,
      discountPercentage: 0,
    };
  });

  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = 0;
  const taxAmount = Math.round(subtotal * 0.11);
  const total = subtotal + taxAmount;
  
  const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  const customer = Math.random() > 0.4 ? customers[Math.floor(Math.random() * customers.length)] : null;
  
  const order: Order = {
    id: `ord-mock-${date.getTime()}-${seq}-${Math.random().toString(36).substring(2, 6)}`,
    receiptNumber,
    timestamp: date.toISOString(),
    items,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    paymentMethod,
  };

  if (customer) {
    order.customerId = customer.id;
    order.customerName = customer.name;
    order.pointsEarnedValue = Math.floor(total * 0.001);
  }

  return order;
};

const getInitialOrders = (): Order[] => {
  const orders: Order[] = [];
  const products = DEFAULT_PRODUCTS;
  const customers = getInitialCustomers();
  const paymentMethods: PaymentMethod[] = ['CASH', 'QRIS', 'DEBIT_CREDIT', 'E_WALLET'];
  
  const today = new Date();
  let receiptCounter = 1;

  // 1. Generate historical orders for the last 12 months (excluding the last 7 days)
  for (let m = 11; m >= 0; m--) {
    const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const ordersInMonth = m === 0 ? 5 : Math.floor(3 + Math.random() * 3); // some activity every month
    
    for (let i = 0; i < ordersInMonth; i++) {
      const orderDate = new Date(targetMonthDate);
      // scatter across the month (1 to 28)
      orderDate.setDate(Math.floor(1 + Math.random() * 27));
      
      // If it's the current month, ensure dates are at least 8 days ago to avoid overlap with our active last 7 days
      if (m === 0) {
        orderDate.setDate(Math.max(1, today.getDate() - 10 - i));
      }
      
      // Make hours realistic
      orderDate.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
      
      orders.push(generateSingleMockOrder(orderDate, products, customers, paymentMethods, receiptCounter++));
    }
  }

  // 2. Generate active daily orders for the last 7 days
  for (let d = 6; d >= 0; d--) {
    const orderDate = new Date(today);
    orderDate.setDate(today.getDate() - d);
    // 2 to 5 orders per day
    const dailyCount = Math.floor(2 + Math.random() * 3);
    for (let i = 0; i < dailyCount; i++) {
      const singleOrderDate = new Date(orderDate);
      singleOrderDate.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      orders.push(generateSingleMockOrder(singleOrderDate, products, customers, paymentMethods, receiptCounter++));
    }
  }

  // Sort descending by timestamp
  return orders;
  // Note: the calling function handles saving or returns it sorted, we can return pre-sorted
};

export const DB = {
  // --- SETTINGS ---
  getSettings(): StoreSettings {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (!data) {
      const init = getInitialSettings();
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(data);
    if (parsed.storeName === 'Kasir Pintar Mandiri' || parsed.storeName === 'Exoea POS' || parsed.storeName === 'Kasir Pintar' || !parsed.storeName) {
      parsed.storeName = 'Exora POS';
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(parsed));
    }
    return parsed;
  },

  saveSettings(settings: StoreSettings): void {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  // --- PRODUCTS ---
  getProducts(): Product[] {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(data);
  },

  saveProducts(products: Product[]): void {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  addProduct(product: Omit<Product, 'id'>): Product {
    const products = this.getProducts();
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
    };
    products.push(newProduct);
    this.saveProducts(products);
    
    // Background sync to Supabase
    uploadProductToCloud(newProduct, this.getSettings()).catch(console.error);
    
    return newProduct;
  },

  updateProduct(product: Product): void {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
      this.saveProducts(products);
      
      // Background sync to Supabase
      uploadProductToCloud(product, this.getSettings()).catch(console.error);
    }
  },

  deleteProduct(id: string): void {
    const products = this.getProducts();
    const filtered = products.filter((p) => p.id !== id);
    this.saveProducts(filtered);
    
    // Background sync to Supabase
    deleteProductFromCloud(id, this.getSettings()).catch(console.error);
  },

  // --- CUSTOMERS ---
  getCustomers(): Customer[] {
    const data = localStorage.getItem(KEYS.CUSTOMERS);
    if (!data) {
      const init = getInitialCustomers();
      localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(init));
      return init;
    }
    return JSON.parse(data);
  },

  saveCustomers(customers: Customer[]): void {
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  addCustomer(customer: Omit<Customer, 'id' | 'points' | 'createdAt'>): Customer {
    const customers = this.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      points: 0,
      createdAt: new Date().toISOString(),
    };
    customers.push(newCustomer);
    this.saveCustomers(customers);
    
    // Background sync to Supabase
    uploadCustomerToCloud(newCustomer, this.getSettings()).catch(console.error);
    
    return newCustomer;
  },

  updateCustomer(customer: Customer): void {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === customer.id);
    if (index !== -1) {
      customers[index] = customer;
      this.saveCustomers(customers);
      
      // Background sync to Supabase
      uploadCustomerToCloud(customer, this.getSettings()).catch(console.error);
    }
  },

  deductCustomerPoints(customerId: string, points: number): void {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === customerId);
    if (index !== -1) {
      customers[index].points = Math.max(0, customers[index].points - points);
      this.saveCustomers(customers);
      
      // Background sync to Supabase
      uploadCustomerToCloud(customers[index], this.getSettings()).catch(console.error);
    }
  },

  deleteCustomer(id: string): void {
    const customers = this.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    this.saveCustomers(filtered);
    
    // Background sync to Supabase
    deleteCustomerFromCloud(id, this.getSettings()).catch(console.error);
  },

  // --- ORDERS / TRANSACTIONS ---
  getOrders(): Order[] {
    const data = localStorage.getItem(KEYS.ORDERS);
    if (!data || data === '[]') {
      const initOrders = getInitialOrders().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(initOrders));
      return initOrders;
    }
    return JSON.parse(data);
  },

  saveOrders(orders: Order[]): void {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },

  createOrder(orderData: Omit<Order, 'id' | 'receiptNumber' | 'timestamp'>): Order {
    const orders = this.getOrders();
    const products = this.getProducts();
    const customers = this.getCustomers();

    // 1. Generate Order ID and Receipt Number
    const now = new Date();
    const orderId = `ord-${Date.now()}`;
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900); // 3 digit random
    const seq = String(orders.length + 1).padStart(4, '0');
    const receiptNumber = `KSR-${dateStr}-${seq}-${rand}`;

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      receiptNumber,
      timestamp: now.toISOString(),
    };

    // 2. Deduct inventory stock
    orderData.items.forEach((item) => {
      const pIndex = products.findIndex((p) => p.id === item.productId);
      if (pIndex !== -1) {
        products[pIndex].stock = Math.max(0, products[pIndex].stock - item.quantity);
      }
    });
    this.saveProducts(products);

    // 3. Add loyalty points to customer if applicable
    if (orderData.customerId && orderData.pointsEarnedValue) {
      const cIndex = customers.findIndex((c) => c.id === orderData.customerId);
      if (cIndex !== -1) {
        customers[cIndex].points += orderData.pointsEarnedValue;
      }
      this.saveCustomers(customers);
    }

    // 4. Save order record
    orders.unshift(newOrder); // Add to beginning (latest first)
    this.saveOrders(orders);

    // 5. Log shift sale if there is an active shift
    this.logShiftSale(newOrder.paymentMethod, newOrder.total);

    // Background sync to Supabase (Order, updated products stock, and customer points)
    const settings = this.getSettings();
    uploadOrderToCloud(newOrder, settings).catch(console.error);
    
    orderData.items.forEach((item) => {
      const updatedProd = products.find(p => p.id === item.productId);
      if (updatedProd) {
        uploadProductToCloud(updatedProd, settings).catch(console.error);
      }
    });

    if (orderData.customerId) {
      const updatedCust = customers.find(c => c.id === orderData.customerId);
      if (updatedCust) {
        uploadCustomerToCloud(updatedCust, settings).catch(console.error);
      }
    }

    return newOrder;
  },

  // --- PROMOS ---
  getPromos(): Promo[] {
    const data = localStorage.getItem(KEYS.PROMOS);
    if (!data) {
      const init = getInitialPromos();
      localStorage.setItem(KEYS.PROMOS, JSON.stringify(init));
      return init;
    }
    return JSON.parse(data);
  },
  savePromos(promos: Promo[]): void {
    localStorage.setItem(KEYS.PROMOS, JSON.stringify(promos));
  },
  addPromo(promo: Omit<Promo, 'id'>): Promo {
    const promos = this.getPromos();
    const newPromo = { ...promo, id: `promo-${Date.now()}` };
    promos.push(newPromo);
    this.savePromos(promos);
    return newPromo;
  },
  updatePromo(promo: Promo): void {
    const promos = this.getPromos();
    const idx = promos.findIndex(p => p.id === promo.id);
    if (idx !== -1) {
      promos[idx] = promo;
      this.savePromos(promos);
    }
  },
  deletePromo(id: string): void {
    const promos = this.getPromos();
    this.savePromos(promos.filter(p => p.id !== id));
  },

  // --- SUPPLIERS ---
  getSuppliers(): Supplier[] {
    const data = localStorage.getItem(KEYS.SUPPLIERS);
    if (!data) {
      const init = getInitialSuppliers();
      localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(init));
      return init;
    }
    return JSON.parse(data);
  },
  saveSuppliers(suppliers: Supplier[]): void {
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(suppliers));
  },
  addSupplier(supplier: Omit<Supplier, 'id'>): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier = { ...supplier, id: `sup-${Date.now()}` };
    suppliers.push(newSupplier);
    this.saveSuppliers(suppliers);
    return newSupplier;
  },
  updateSupplier(supplier: Supplier): void {
    const suppliers = this.getSuppliers();
    const idx = suppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      suppliers[idx] = supplier;
      this.saveSuppliers(suppliers);
    }
  },
  deleteSupplier(id: string): void {
    const suppliers = this.getSuppliers();
    this.saveSuppliers(suppliers.filter(s => s.id !== id));
  },

  // --- EXPENSES ---
  getExpenses(): Expense[] {
    const data = localStorage.getItem(KEYS.EXPENSES);
    if (!data) {
      const init = getInitialExpenses();
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify(init));
      return init;
    }
    return JSON.parse(data);
  },
  saveExpenses(expenses: Expense[]): void {
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));
  },
  addExpense(expense: Omit<Expense, 'id' | 'timestamp'>): Expense {
    const expenses = this.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  },
  deleteExpense(id: string): void {
    const expenses = this.getExpenses();
    this.saveExpenses(expenses.filter(e => e.id !== id));
  },

  // --- RESTOCK ---
  getRestockOrders(): RestockOrder[] {
    const data = localStorage.getItem(KEYS.RESTOCK_ORDERS);
    return data ? JSON.parse(data) : [];
  },
  saveRestockOrders(orders: RestockOrder[]): void {
    localStorage.setItem(KEYS.RESTOCK_ORDERS, JSON.stringify(orders));
  },
  createRestockOrder(supplierId: string, supplierName: string, items: RestockOrder['items'], totalAmount: number, notes?: string): RestockOrder {
    const orders = this.getRestockOrders();
    const products = this.getProducts();

    const newOrder: RestockOrder = {
      id: `restock-${Date.now()}`,
      supplierId,
      supplierName,
      timestamp: new Date().toISOString(),
      items,
      totalAmount,
      notes
    };

    // Update stocks and cost prices for the restocked products
    items.forEach(item => {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) {
        products[pIdx].stock += item.quantity;
        if (item.costPrice > 0) {
          products[pIdx].costPrice = item.costPrice;
        }
      }
    });
    this.saveProducts(products);

    orders.unshift(newOrder);
    this.saveRestockOrders(orders);

    // Also automatically log as an expense!
    this.addExpense({
      category: 'RESTOCK',
      amount: totalAmount,
      description: `Restock dari ${supplierName} (ID: ${newOrder.id.slice(-6)})`
    });

    return newOrder;
  },

  // --- SHIFTS ---
  getShifts(): CashierShift[] {
    const data = localStorage.getItem(KEYS.SHIFTS);
    return data ? JSON.parse(data) : [];
  },
  saveShifts(shifts: CashierShift[]): void {
    localStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
  },
  getActiveShift(): CashierShift | null {
    const shifts = this.getShifts();
    const active = shifts.find(s => s.status === 'OPEN');
    return active || null;
  },
  openShift(openedBy: string, openingCash: number): CashierShift {
    const shifts = this.getShifts();
    const active = this.getActiveShift();
    if (active) return active;

    const newShift: CashierShift = {
      id: `shift-${Date.now()}`,
      openedBy,
      openedAt: new Date().toISOString(),
      openingCash,
      expectedCash: openingCash,
      totalSales: 0,
      cashSales: 0,
      qrisSales: 0,
      debitCreditSales: 0,
      eWalletSales: 0,
      status: 'OPEN'
    };

    shifts.unshift(newShift);
    this.saveShifts(shifts);
    return newShift;
  },
  closeShift(closingCash: number, notes?: string): CashierShift {
    const shifts = this.getShifts();
    const activeIdx = shifts.findIndex(s => s.status === 'OPEN');
    if (activeIdx === -1) throw new Error("Tidak ada shift yang aktif.");

    const active = shifts[activeIdx];
    active.status = 'CLOSED';
    active.closedAt = new Date().toISOString();
    active.closingCash = closingCash;
    active.notes = notes;

    shifts[activeIdx] = active;
    this.saveShifts(shifts);
    return active;
  },
  logShiftSale(paymentMethod: PaymentMethod, amount: number): void {
    const shifts = this.getShifts();
    const activeIdx = shifts.findIndex(s => s.status === 'OPEN');
    if (activeIdx === -1) return; // No active shift, ignore

    const active = shifts[activeIdx];
    active.totalSales = (active.totalSales || 0) + amount;
    
    if (paymentMethod === 'CASH') {
      active.cashSales = (active.cashSales || 0) + amount;
      active.expectedCash = (active.expectedCash || 0) + amount;
    } else if (paymentMethod === 'QRIS') {
      active.qrisSales = (active.qrisSales || 0) + amount;
    } else if (paymentMethod === 'DEBIT_CREDIT') {
      active.debitCreditSales = (active.debitCreditSales || 0) + amount;
    } else if (paymentMethod === 'E_WALLET') {
      active.eWalletSales = (active.eWalletSales || 0) + amount;
    }

    shifts[activeIdx] = active;
    this.saveShifts(shifts);
  },

  // --- RESET ALL DATA ---
  resetAllData(): void {
    localStorage.removeItem(KEYS.PRODUCTS);
    localStorage.removeItem(KEYS.CUSTOMERS);
    localStorage.removeItem(KEYS.ORDERS);
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.PROMOS);
    localStorage.removeItem(KEYS.SHIFTS);
    localStorage.removeItem(KEYS.SUPPLIERS);
    localStorage.removeItem(KEYS.RESTOCK_ORDERS);
    localStorage.removeItem(KEYS.EXPENSES);
  }
};
