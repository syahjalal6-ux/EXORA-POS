import { useState, useMemo, FormEvent, DragEvent, ChangeEvent, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Trash2, ArrowUpDown, Tag, AlertTriangle, Check, X, Upload, Image, Trash,
  Truck, FileText, PlusCircle, Calendar, Boxes
} from 'lucide-react';
import { Product, Category, Supplier, RestockOrder } from '../types';
import { formatCurrency } from '../services/utils';
import { DB } from '../services/db';

interface ProdukViewProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onRefreshProducts: () => void;
}

const COLOR_PRESETS = [
  '#8B5A2B', // Coffee Brown
  '#D2691E', // Tea Amber
  '#E47A2E', // Fried Rice Toast
  '#FFD700', // Gold/Noodle yellow
  '#CD853F', // Toasted bread
  '#B22222', // Balado red
  '#DEB887', // Dimsum pale
  '#1E90FF', // Mineral water blue
  '#10B981', // Emerald green
  '#EF4444', // Bright red
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
];

export default function ProdukView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onRefreshProducts,
}: ProdukViewProps) {
  // Sub navigation tabs inside ProdukView
  const [activeSubTab, setActiveSubTab] = useState<'produk' | 'supplier' | 'restock'>('produk');

  // Supplier CRUD States
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DB.getSuppliers());
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Restock Transactions States
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>(() => DB.getRestockOrders());
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedRestockSupplierId, setSelectedRestockSupplierId] = useState('');
  const [restockCart, setRestockCart] = useState<Array<{ productId: string; name: string; quantity: number; costPrice: number }>>([]);
  const [tempRestockProductId, setTempRestockProductId] = useState('');
  const [tempRestockQty, setTempRestockQty] = useState<number>(10);
  const [tempRestockCost, setTempRestockCost] = useState<number>(0);

  // Sync suppliers and restock when sub-tab switches
  useEffect(() => {
    setSuppliers(DB.getSuppliers());
    setRestockOrders(DB.getRestockOrders());
  }, [activeSubTab]);

  // --- Supplier CRUD Handlers ---
  const handleOpenAddSupplier = () => {
    setEditingSupplierId(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupAddress('');
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSupName(supplier.name);
    setSupContact(supplier.contactName || '');
    setSupPhone(supplier.phone);
    setSupAddress(supplier.address || '');
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e: FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim()) {
      alert('Nama supplier dan nomor telepon wajib diisi.');
      return;
    }

    const supplierData = {
      name: supName,
      contactName: supContact || undefined,
      phone: supPhone,
      address: supAddress || undefined,
    };

    if (editingSupplierId) {
      DB.updateSupplier({ id: editingSupplierId, ...supplierData });
    } else {
      DB.addSupplier(supplierData);
    }

    setSuppliers(DB.getSuppliers());
    setIsSupplierModalOpen(false);
  };

  const handleDeleteSupplier = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus supplier "${name}"?`)) {
      DB.deleteSupplier(id);
      setSuppliers(DB.getSuppliers());
    }
  };

  // --- Restock Handlers ---
  const handleOpenAddRestock = () => {
    setSelectedRestockSupplierId('');
    setRestockCart([]);
    setTempRestockProductId('');
    setTempRestockQty(10);
    setTempRestockCost(0);
    setIsRestockModalOpen(true);
  };

  const handleAddProductToRestockCart = () => {
    if (!tempRestockProductId) return;
    const prod = products.find(p => p.id === tempRestockProductId);
    if (!prod) return;

    const existingIdx = restockCart.findIndex(item => item.productId === tempRestockProductId);
    if (existingIdx !== -1) {
      const updated = [...restockCart];
      updated[existingIdx].quantity += tempRestockQty;
      if (tempRestockCost > 0) {
        updated[existingIdx].costPrice = tempRestockCost;
      }
      setRestockCart(updated);
    } else {
      setRestockCart([...restockCart, {
        productId: tempRestockProductId,
        name: prod.name,
        quantity: tempRestockQty,
        costPrice: tempRestockCost || prod.costPrice || 0
      }]);
    }

    setTempRestockProductId('');
    setTempRestockQty(10);
    setTempRestockCost(0);
  };

  const handleRemoveFromRestockCart = (index: number) => {
    setRestockCart(restockCart.filter((_, i) => i !== index));
  };

  const handleSaveRestock = () => {
    if (!selectedRestockSupplierId) {
      alert('Silakan pilih supplier.');
      return;
    }
    if (restockCart.length === 0) {
      alert('Daftar restock masih kosong. Tambahkan produk terlebih dahulu.');
      return;
    }

    const sup = suppliers.find(s => s.id === selectedRestockSupplierId);
    if (!sup) return;

    const items = restockCart.map(item => ({
      productId: item.productId,
      productName: item.name,
      costPrice: item.costPrice,
      quantity: item.quantity,
      subtotal: item.costPrice * item.quantity
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    DB.createRestockOrder(
      selectedRestockSupplierId,
      sup.name,
      items,
      totalAmount,
      'Transaksi restock masuk'
    );

    setRestockOrders(DB.getRestockOrders());
    setIsRestockModalOpen(false);
    onRefreshProducts();
  };

  // Filters & searches
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals for Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formCostPrice, setFormCostPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formMinStock, setFormMinStock] = useState(5);
  const [formCategory, setFormCategory] = useState('');
  const [formColor, setFormColor] = useState(COLOR_PRESETS[0]);
  const [formImage, setFormImage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Derived list of current categories
  const categories = useMemo(() => {
    const list = new Set(products.map((p) => p.category));
    return ['Semua', ...Array.from(list)];
  }, [products]);

  // Handle opening modal for CREATE
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormSku(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPrice(0);
    setFormCostPrice(0);
    setFormStock(10);
    setFormMinStock(5);
    setFormCategory(categories[1] || 'Makanan');
    setFormColor(COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]);
    setFormImage('');
    setIsModalOpen(true);
  };

  // Handle opening modal for EDIT
  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormPrice(p.price);
    setFormCostPrice(p.costPrice || 0);
    setFormStock(p.stock);
    setFormMinStock(p.minStock || 5);
    setFormCategory(p.category);
    setFormColor(p.color || COLOR_PRESETS[0]);
    setFormImage(p.image || '');
    setIsModalOpen(true);
  };

  // Save changes
  const handleSaveProduct = (e: FormEvent) => {
    e.preventDefault();
    if (!formName || !formSku || !formCategory || formPrice <= 0) {
      alert('Harap isi nama, SKU, kategori, dan harga produk dengan benar.');
      return;
    }

    // Check duplicate SKU
    const isSkuDuplicate = products.some((p) => p.sku === formSku && p.id !== editingId);
    if (isSkuDuplicate) {
      alert('SKU Produk sudah terdaftar! Harap gunakan kode SKU lain yang unik.');
      return;
    }

    const payload = {
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      price: Number(formPrice),
      costPrice: Number(formCostPrice),
      stock: Number(formStock),
      minStock: Number(formMinStock),
      category: formCategory.trim(),
      color: formColor,
      image: formImage || undefined,
    };

    if (editingId) {
      onUpdateProduct({ ...payload, id: editingId });
    } else {
      onAddProduct(payload);
    }
    setIsModalOpen(false);
  };

  // Stock quick editor (increases usability significantly)
  const handleQuickStockUpdate = (p: Product, delta: number) => {
    const newStock = Math.max(0, p.stock + delta);
    onUpdateProduct({
      ...p,
      stock: newStock,
    });
  };

  // Delete product with confirmation
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus produk "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      onDeleteProduct(id);
    }
  };

  // Filtering & Sorting pipeline
  const processedProducts = useMemo(() => {
    // 1. Filter
    let result = products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    // 2. Sort
    result.sort((a, b) => {
      let fieldA: any = a[sortBy];
      let fieldB: any = b[sortBy];

      if (typeof fieldA === 'string') {
        fieldA = fieldA.toLowerCase();
        fieldB = fieldB.toLowerCase();
      }

      if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
      if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchQuery, selectedCategory, sortBy, sortOrder]);

  const toggleSort = (field: 'name' | 'stock' | 'price') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/20">
      
      {/* Sub-navigation tabs inside ProdukView */}
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar whitespace-nowrap bg-white rounded-xl p-1 border shadow-xs gap-1">
        <button
          onClick={() => setActiveSubTab('produk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeSubTab === 'produk'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Boxes className="h-4 w-4" />
          Katalog Produk & Stok
        </button>

        <button
          onClick={() => setActiveSubTab('supplier')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeSubTab === 'supplier'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Truck className="h-4 w-4" />
          Mitra Supplier
        </button>

        <button
          onClick={() => setActiveSubTab('restock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeSubTab === 'restock'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <PlusCircle className="h-4 w-4" />
          Transaksi Restock Masuk
        </button>
      </div>

      {activeSubTab === 'produk' && (
        <>
          {/* Upper actions bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-xs mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                id="inventory-search-input"
                type="text"
                placeholder="Cari SKU atau nama produk..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category selection */}
            <select
              id="inventory-category-select"
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none text-slate-600 font-medium cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="Semua">Semua Kategori</option>
              {categories.filter(c => c !== 'Semua').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
            id="btn-tambah-produk"
          >
            <Plus className="h-4 w-4" />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-white rounded-xl border border-slate-150 overflow-hidden flex-1 shadow-xs flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold select-none uppercase tracking-wider">
                <th className="p-4 w-12">No</th>
                <th 
                  onClick={() => toggleSort('name')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    Nama Produk / SKU
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="p-4">Kategori</th>
                <th 
                  onClick={() => toggleSort('price')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap text-right"
                >
                  <span className="flex items-center gap-1 justify-end">
                    Harga Jual
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="p-4 text-right">Harga Modal</th>
                <th className="p-4 text-right">Margin Keuntungan</th>
                <th 
                  onClick={() => toggleSort('stock')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap text-center"
                >
                  <span className="flex items-center gap-1 justify-center">
                    Stok
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-10 text-slate-400">
                    <div className="flex flex-col items-center">
                      <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                      <p className="font-semibold">Produk tidak ditemukan</p>
                      <p className="text-[10px] mt-1 text-slate-400">Silakan tambahkan produk baru atau ubah pencarian.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedProducts.map((p, index) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= (p.minStock || 5);
                  
                  // Margin calculation
                  const marginPercentage = p.price > 0 
                    ? Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100)
                    : 0;

                  return (
                    <tr 
                      key={p.id} 
                      className="border-b border-slate-100 hover:bg-slate-50/70 transition-all font-medium text-slate-700"
                      id={`inventory-row-${p.id}`}
                    >
                      <td className="p-4 font-mono text-slate-400 text-center">{index + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          {/* Image or Colored box circle marker */}
                          {p.image ? (
                            <img 
                              src={p.image} 
                              alt={p.name} 
                              className="h-7 w-7 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span 
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                              style={{ backgroundColor: p.color || '#10b981' }}
                            >
                              {p.sku.slice(-3)}
                            </span>
                          )}
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-slate-800 text-sm line-clamp-1">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-wide mt-0.5">{p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase">
                          <Tag className="h-2.5 w-2.5" />
                          {p.category}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800 font-mono">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="p-4 text-right text-slate-500 font-mono">
                        {formatCurrency(p.costPrice || 0)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-block font-bold text-xs ${
                          marginPercentage > 40 ? 'text-emerald-600' : marginPercentage > 15 ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {marginPercentage}% ({formatCurrency(p.price - (p.costPrice || 0))})
                        </span>
                      </td>
                      {/* ADJUSTABLE QUICK STOCK INCREMENTS */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 shadow-xs">
                          <button
                            onClick={() => handleQuickStockUpdate(p, -1)}
                            className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-bold"
                            title="Kurangi Stok (1)"
                          >
                            -
                          </button>
                          <span className="px-3.5 font-black font-mono text-slate-800">{p.stock}</span>
                          <button
                            onClick={() => handleQuickStockUpdate(p, 1)}
                            className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-bold"
                            title="Tambah Stok (1)"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-1 leading-none rounded-md bg-red-100 text-red-600 uppercase border border-red-200">
                            HABIS
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-1 leading-none rounded-md bg-amber-100 text-amber-700 uppercase border border-amber-200 animate-pulse">
                            MENIPIS
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-1 leading-none rounded-md bg-emerald-100 text-emerald-700 uppercase border border-emerald-250">
                            AMAN
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition"
                            title="Edit Produk"
                            id={`inventory-edit-btn-${p.id}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition"
                            title="Hapus Produk"
                            id={`inventory-delete-btn-${p.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-left border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base" id="product-modal-title">
                {editingId ? 'Edit Detail Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 flex flex-col gap-4 text-slate-700">
              {/* Product Name */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Nama Produk *</label>
                <input
                  id="form-product-name"
                  type="text"
                  placeholder="Contoh: Es Teh Lemon Selasih"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={64}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* SKU Code */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">SKU / Kode Unik *</label>
                  <input
                    id="form-product-sku"
                    type="text"
                    placeholder="PRD001"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono uppercase focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    maxLength={16}
                    required
                  />
                </div>

                {/* Categories */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Kategori *</label>
                  <input
                    id="form-product-category"
                    type="text"
                    placeholder="Contoh: Makanan"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    list="available-categories"
                    required
                  />
                  <datalist id="available-categories">
                    {categories.filter(c => c !== 'Semua').map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                    <option value="Makanan" />
                    <option value="Minuman" />
                    <option value="Cemilan" />
                    <option value="Lainnya" />
                  </datalist>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Harga Modal (Rp)</label>
                  <input
                    id="form-product-cost-price"
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                    value={formCostPrice || ''}
                    onChange={(e) => setFormCostPrice(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Harga Jual (Rp) *</label>
                  <input
                    id="form-product-price"
                    type="number"
                    min="1"
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                    value={formPrice || ''}
                    onChange={(e) => setFormPrice(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              {/* Stock Inventory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Stok Saat Ini *</label>
                  <input
                    id="form-product-stock"
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                    value={formStock}
                    onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Min. Batas Stok Rendah</label>
                  <input
                    id="form-product-min-stock"
                    type="number"
                    min="0"
                    placeholder="5"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Product Photo Upload Field */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Foto Produk (Opsional)</label>
                
                {formImage ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-50 flex items-center justify-center">
                    <img 
                      src={formImage} 
                      alt="Pratinjau foto produk" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('product-image-uploader') as HTMLInputElement;
                          if (input) input.click();
                        }}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-805 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Ganti Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormImage('')}
                        className="p-2 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                      >
                        <Trash className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        if (file.size > 1.5 * 1024 * 1024) {
                          alert('Ukuran file terlalu besar! Silakan pilih foto di bawah 1.5 MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onClick={() => {
                      const input = document.getElementById('product-image-uploader') as HTMLInputElement;
                      if (input) input.click();
                    }}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center min-h-[112px] bg-slate-50/50 ${
                      isDragging 
                        ? 'border-emerald-500 bg-emerald-50/30' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-750">Pilih atau Seret Foto ke Sini</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, rasio persegi disarankan (Maks 1.5MB)</p>
                    </div>
                  </div>
                )}

                <input
                  id="product-image-uploader"
                  type="file"
                  accept="image/*"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 1.5 * 1024 * 1024) {
                        alert('Ukuran file terlalu besar! Silakan pilih foto di bawah 1.5 MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormImage(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Grid block colors selection */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1.5">Warna Tampilan Kartu</label>
                <div className="flex flex-wrap gap-2.5 p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormColor(col)}
                      className="h-5 w-5 rounded-full flex items-center justify-center transition hover:scale-115 cursor-pointer relative"
                      style={{ backgroundColor: col }}
                    >
                      {formColor === col && (
                        <Check className="h-3 w-3 text-white font-bold stroke-[3px]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submitting Actions */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-150 -mx-5 -mb-5 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-xs hover:shadow-md transition"
                  id="save-product-modal-btn"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* activeSubTab === 'supplier' Panel */}
      {activeSubTab === 'supplier' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-xs flex items-center justify-between">
            <div className="text-left">
              <h3 className="font-extrabold text-slate-800 text-sm">Daftar Mitra Supplier</h3>
              <p className="text-xs text-slate-400 mt-0.5">Kelola data mitra supplier untuk mempermudah pencatatan stok masuk.</p>
            </div>
            <button
              onClick={handleOpenAddSupplier}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Mitra Baru
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-extrabold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                    <th className="p-4">Nama Supplier</th>
                    <th className="p-4">Kontak Person</th>
                    <th className="p-4">No. Telepon</th>
                    <th className="p-4">Alamat</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                        Belum ada data supplier. Silakan tambah supplier baru.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{s.name}</td>
                        <td className="p-4">{s.contactName || '-'}</td>
                        <td className="p-4 font-mono font-bold text-slate-700">{s.phone}</td>
                        <td className="p-4 max-w-xs truncate">{s.address || '-'}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditSupplier(s)}
                              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(s.id, s.name)}
                              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* activeSubTab === 'restock' Panel */}
      {activeSubTab === 'restock' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-xs flex items-center justify-between">
            <div className="text-left">
              <h3 className="font-extrabold text-slate-800 text-sm">Riwayat Stok Masuk (Restock)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Catat barang masuk dari supplier dan perbarui harga modal secara otomatis.</p>
            </div>
            <button
              onClick={handleOpenAddRestock}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              Restock Baru
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-extrabold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                    <th className="p-4">Tanggal & Waktu</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Rincian Barang</th>
                    <th className="p-4 text-right">Total Biaya</th>
                    <th className="p-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {restockOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                        Belum ada transaksi restock. Silakan buat restock baru.
                      </td>
                    </tr>
                  ) : (
                    restockOrders.map((ro) => (
                      <tr key={ro.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-750">
                          {new Date(ro.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4 font-bold text-slate-800">{ro.supplierName}</td>
                        <td className="p-4 max-w-xs">
                          <div className="space-y-1">
                            {ro.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] gap-2">
                                <span className="text-slate-700 font-medium">{item.productName}</span>
                                <span className="text-slate-400 font-mono shrink-0">
                                  x{item.quantity} ({formatCurrency(item.costPrice)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right font-extrabold text-slate-900 font-mono">
                          {formatCurrency(ro.totalAmount)}
                        </td>
                        <td className="p-4 text-slate-400 italic text-[11px]">{ro.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-left border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingSupplierId ? 'Edit Detail Supplier' : 'Tambah Supplier Baru'}
              </h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 flex flex-col gap-4 text-slate-700">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 block mb-1">Nama Supplier *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Sinar Abadi"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 block mb-1">Kontak Person (Nama Sales)</label>
                <input
                  type="text"
                  placeholder="Contoh: Pak Hendra"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 block mb-1">No. Telepon *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 0812XXXXXXXX"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-450 block mb-1">Alamat Kantor/Gudang</label>
                <textarea
                  placeholder="Alamat lengkap supplier..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                />
              </div>

              <div className="p-4 bg-slate-50/70 border-t border-slate-150 -mx-5 -mb-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-sm transition cursor-pointer"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-left border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <PlusCircle className="h-5 w-5 text-emerald-600" />
                Catat Transaksi Restock Baru
              </h3>
              <button
                onClick={() => setIsRestockModalOpen(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col md:flex-row gap-5">
              {/* Left Column: Form Selector */}
              <div className="flex-1 space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 block mb-1">Pilih Supplier Mitra *</label>
                  <select
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    value={selectedRestockSupplierId}
                    onChange={(e) => setSelectedRestockSupplierId(e.target.value)}
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Tambah Produk ke Daftar</span>
                  
                  <div>
                    <label className="text-[10px] font-semibold text-slate-450 block mb-1">Nama Produk *</label>
                    <select
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      value={tempRestockProductId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTempRestockProductId(val);
                        const prod = products.find(p => p.id === val);
                        if (prod) {
                          setTempRestockCost(prod.costPrice || 0);
                        }
                      }}
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-450 block mb-1">Jumlah Masuk *</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        value={tempRestockQty}
                        onChange={(e) => setTempRestockQty(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-450 block mb-1">Harga Beli per Unit (Rp) *</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        value={tempRestockCost}
                        onChange={(e) => setTempRestockCost(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddProductToRestockCart}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                  >
                    + Tambah ke Keranjang Restock
                  </button>
                </div>
              </div>

              {/* Right Column: Checkout Cart */}
              <div className="w-full md:w-80 bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between min-h-[300px]">
                <div className="space-y-3 flex-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-450 block border-b pb-1.5 border-slate-200">Daftar Restock</span>
                  
                  {restockCart.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-1">
                      <Boxes className="h-8 w-8 text-slate-350" />
                      <p className="text-[10px] font-medium">Belum ada barang ditambahkan</p>
                    </div>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 text-xs">
                      {restockCart.map((item, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center gap-2 text-left">
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-bold text-slate-800 truncate">{item.name}</p>
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {item.quantity} x {formatCurrency(item.costPrice)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFromRestockCart(idx)}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 mb-4">
                    <span>Total Biaya Restock:</span>
                    <span className="font-mono text-base text-emerald-700">
                      {formatCurrency(restockCart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0))}
                    </span>
                  </div>

                  <button
                    onClick={handleSaveRestock}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                  >
                    Simpan Transaksi Restock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
