import { Product } from '../types';

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Kopi Susu Gula Aren',
    sku: 'MN001',
    price: 18000,
    costPrice: 8000,
    stock: 45,
    minStock: 10,
    category: 'Minuman',
    color: '#8B5A2B', // Brown Coffee
  },
  {
    id: 'prod-2',
    name: 'Es Teh Manis Jumbo',
    sku: 'MN002',
    price: 6000,
    costPrice: 15000 / 10, // ~1500
    stock: 95,
    minStock: 15,
    category: 'Minuman',
    color: '#D2691E', // Amber Tea
  },
  {
    id: 'prod-3',
    name: 'Nasi Goreng Spesial',
    sku: 'MK001',
    price: 25000,
    costPrice: 12000,
    stock: 12, // Low stock to trigger alert
    minStock: 15,
    category: 'Makanan',
    color: '#E47A2E', // Roasted Orange
  },
  {
    id: 'prod-4',
    name: 'Indomie Goreng Nyemek',
    sku: 'MK002',
    price: 15000,
    costPrice: 6000,
    stock: 35,
    minStock: 10,
    category: 'Makanan',
    color: '#FFD700', // Gold/Yellow
  },
  {
    id: 'prod-5',
    name: 'Roti Bakar Cokelat Keju',
    sku: 'MK003',
    price: 18000,
    costPrice: 7500,
    stock: 22,
    minStock: 8,
    category: 'Makanan',
    color: '#CD853F', // Toasted Brown
  },
  {
    id: 'prod-6',
    name: 'Keripik Singkong Balado',
    sku: 'CM001',
    price: 10000,
    costPrice: 4500,
    stock: 40,
    minStock: 10,
    category: 'Cemilan',
    color: '#B22222', // Red Chili
  },
  {
    id: 'prod-7',
    name: 'Dimsum Ayam (4 pcs)',
    sku: 'CM002',
    price: 16000,
    costPrice: 7000,
    stock: 8, // Low stock warning
    minStock: 10,
    category: 'Cemilan',
    color: '#DEB887', // Steamed dough
  },
  {
    id: 'prod-8',
    name: 'Air Mineral 600ml',
    sku: 'MN003',
    price: 4000,
    costPrice: 1800,
    stock: 150,
    minStock: 20,
    category: 'Minuman',
    color: '#1E90FF', // Sky Blue
  }
];

export const DEFAULT_CATEGORIES: string[] = ['Semua', 'Makanan', 'Minuman', 'Cemilan'];
