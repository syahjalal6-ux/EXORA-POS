import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Order, Customer, StoreSettings } from '../types';

let clientInstance: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

// Helper to get client dynamically (supports Env variables or runtime setting overrides)
export const getSupabaseClient = (settings?: StoreSettings): SupabaseClient | null => {
  const metaEnv = (import.meta as any).env || {};
  const url = metaEnv.VITE_SUPABASE_URL || settings?.supabaseUrl || '';
  const key = metaEnv.VITE_SUPABASE_ANON_KEY || settings?.supabaseAnonKey || '';

  if (!url || !key) {
    clientInstance = null;
    return null;
  }

  if (clientInstance && url === lastUsedUrl && key === lastUsedKey) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(url, key, {
      auth: { persistSession: false }
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    return clientInstance;
  } catch (err) {
    console.error('Supabase init error:', err);
    return null;
  }
};

// Check if credentials are set
export const isSupabaseConfigured = (settings?: StoreSettings): boolean => {
  const client = getSupabaseClient(settings);
  return client !== null;
};

// Test if credentials are valid and connection is active
export const testSupabaseConnection = async (url: string, key: string): Promise<{ success: boolean; hasTables: boolean; message: string }> => {
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    
    // Check connection by selecting from 'products' table
    const { error } = await client.from('products').select('id').limit(1);
    
    if (error) {
      if (error.message && error.message.includes('relation "products" does not exist')) {
        return {
          success: true,
          hasTables: false,
          message: 'Koneksi Sukses! Namun tabel database belum dibuat. Silakan jalankan script SQL Schema di SQL Editor Supabase Anda.'
        };
      }
      return {
        success: false,
        hasTables: false,
        message: `Koneksi gagal: ${error.message}`
      };
    }

    return {
      success: true,
      hasTables: true,
      message: 'Koneksi Sukses! Seluruh tabel terdeteksi dengan benar dan siap sinkronisasi.'
    };
  } catch (err: any) {
    return {
      success: false,
      hasTables: false,
      message: `Terjadi kesalahan saat menghubungkan: ${err?.message || err}`
    };
  }
};

// Save a single order to Supabase
export const uploadOrderToCloud = async (order: Order, settings?: StoreSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client.from('orders').upsert({
      id: order.id,
      receipt_number: order.receiptNumber,
      timestamp: order.timestamp,
      items: order.items,
      subtotal: order.subtotal,
      discount_amount: order.discountAmount,
      tax_amount: order.taxAmount,
      total: order.total,
      payment_method: order.paymentMethod,
      cash_amount_paid: order.cashAmountPaid || null,
      change_amount: order.changeAmount || null,
      customer_id: order.customerId || null,
      customer_name: order.customerName || null,
      points_earned_value: order.pointsEarnedValue || 0,
      notes: order.notes || null,
    });

    if (error) {
      console.error('Gagal upload order:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase upload order error:', err);
    return false;
  }
};

// Update/Upload a product to Supabase
export const uploadProductToCloud = async (product: Product, settings?: StoreSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client.from('products').upsert({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      cost_price: product.costPrice || 0,
      stock: product.stock,
      min_stock: product.minStock || 5,
      category: product.category,
      image: product.image || null,
      color: product.color,
    });

    if (error) {
      console.error('Gagal upload produk:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase upload product error:', err);
    return false;
  }
};

// Update/Upload a customer to Supabase
export const uploadCustomerToCloud = async (customer: Customer, settings?: StoreSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client.from('customers').upsert({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      points: customer.points || 0,
      created_at: customer.createdAt,
    });

    if (error) {
      console.error('Gagal upload pelanggan:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase upload customer error:', err);
    return false;
  }
};

// Delete a product from Supabase
export const deleteProductFromCloud = async (id: string, settings?: StoreSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client.from('products').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error(err);
    return false;
  }
};

// Delete a customer from Supabase
export const deleteCustomerFromCloud = async (id: string, settings?: StoreSettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const { error } = await client.from('customers').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error(err);
    return false;
  }
};

// Push all local data and hard overwrite Supabase (Backup Cloud)
export const pushAllLocalToCloud = async (
  products: Product[],
  customers: Customer[],
  orders: Order[],
  settings?: StoreSettings
): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient(settings);
  if (!client) return { success: false, message: 'Supabase belum dikonfigurasi.' };

  try {
    // 1. Upload Customers
    if (customers.length > 0) {
      const customersPayload = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || null,
        points: c.points || 0,
        created_at: c.createdAt,
      }));
      const { error: cErr } = await client.from('customers').upsert(customersPayload);
      if (cErr) return { success: false, message: `Gagal backup pelanggan: ${cErr.message}` };
    }

    // 2. Upload Products
    if (products.length > 0) {
      const productsPayload = products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        cost_price: p.costPrice || 0,
        stock: p.stock,
        min_stock: p.minStock || 5,
        category: p.category,
        image: p.image || null,
        color: p.color,
      }));
      const { error: pErr } = await client.from('products').upsert(productsPayload);
      if (pErr) return { success: false, message: `Gagal backup produk: ${pErr.message}` };
    }

    // 3. Upload Orders
    if (orders.length > 0) {
      const ordersPayload = orders.map(o => ({
        id: o.id,
        receipt_number: o.receiptNumber,
        timestamp: o.timestamp,
        items: o.items,
        subtotal: o.subtotal,
        discount_amount: o.discountAmount,
        tax_amount: o.taxAmount,
        total: o.total,
        payment_method: o.paymentMethod,
        cash_amount_paid: o.cashAmountPaid || null,
        change_amount: o.changeAmount || null,
        customer_id: o.customerId || null,
        customer_name: o.customerName || null,
        points_earned_value: o.pointsEarnedValue || 0,
        notes: o.notes || null,
      }));

      // Chunk large order sets to avoid reaching payload size limits
      const chunkSize = 100;
      for (let i = 0; i < ordersPayload.length; i += chunkSize) {
        const chunk = ordersPayload.slice(i, i + chunkSize);
        const { error: oErr } = await client.from('orders').upsert(chunk);
        if (oErr) return { success: false, message: `Gagal backup transaksi (block ke-${i}): ${oErr.message}` };
      }
    }

    return { success: true, message: 'Seluruh data lokal berhasil dicadangkan (Sync Out) ke cloud database Supabase!' };
  } catch (err: any) {
    return { success: false, message: `Gagal sinkronisasi data: ${err?.message || err}` };
  }
};

// Pull cloud data to overwrite local storage (Restore Local)
export const pullCloudToLocal = async (
  settings?: StoreSettings
): Promise<{ success: boolean; message: string; products?: Product[]; customers?: Customer[]; orders?: Order[] }> => {
  const client = getSupabaseClient(settings);
  if (!client) return { success: false, message: 'Supabase belum dikonfigurasi.' };

  try {
    // 1. Fetch products
    const { data: pData, error: pErr } = await client.from('products').select('*');
    if (pErr) return { success: false, message: `Gagal mengambil produk: ${pErr.message}` };

    // 2. Fetch customers
    const { data: cData, error: cErr } = await client.from('customers').select('*');
    if (cErr) return { success: false, message: `Gagal mengambil pelanggan: ${cErr.message}` };

    // 3. Fetch orders
    const { data: oData, error: oErr } = await client.from('orders').select('*').order('timestamp', { ascending: false });
    if (oErr) return { success: false, message: `Gagal mengambil transaksi: ${oErr.message}` };

    // Convert keys from snake_case to camelCase mapping
    const mappedProducts: Product[] = (pData || []).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
      costPrice: Number(p.cost_price),
      stock: Number(p.stock),
      minStock: Number(p.min_stock),
      category: p.category,
      image: p.image || undefined,
      color: p.color,
    }));

    const mappedCustomers: Customer[] = (cData || []).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || undefined,
      points: Number(c.points),
      createdAt: c.created_at,
    }));

    const mappedOrders: Order[] = (oData || []).map(o => ({
      id: o.id,
      receiptNumber: o.receipt_number,
      timestamp: o.timestamp,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
      subtotal: Number(o.subtotal),
      discountAmount: Number(o.discount_amount),
      taxAmount: Number(o.tax_amount),
      total: Number(o.total),
      paymentMethod: o.payment_method,
      cashAmountPaid: o.cash_amount_paid ? Number(o.cash_amount_paid) : undefined,
      changeAmount: o.change_amount ? Number(o.change_amount) : undefined,
      customerId: o.customer_id || undefined,
      customerName: o.customer_name || undefined,
      pointsEarnedValue: o.points_earned_value ? Number(o.points_earned_value) : undefined,
      notes: o.notes || undefined,
    }));

    return {
      success: true,
      message: 'Berhasil mengunduh seluruh data terbaru dari cloud database Supabase.',
      products: mappedProducts,
      customers: mappedCustomers,
      orders: mappedOrders,
    };
  } catch (err: any) {
    return { success: false, message: `Gagal sinkronisasi data: ${err?.message || err}` };
  }
};
