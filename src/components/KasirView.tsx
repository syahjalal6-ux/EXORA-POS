import { useState, useMemo, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Minus, Trash2, Tag, User, UserPlus, 
  Receipt, Check, ChevronRight, X, Sparkles, ShoppingCart, AlertCircle,
  Lock, Unlock, FileText, Calendar, DollarSign, Award
} from 'lucide-react';
import { Product, CartItem, Customer, StoreSettings, PaymentMethod, Order, UserSession, Promo, CashierShift } from '../types';
import { formatCurrency } from '../services/utils';
import { DB } from '../services/db';

interface KasirViewProps {
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  userSession: UserSession | null;
  onOrderCompleted: (orderData: Omit<Order, 'id' | 'receiptNumber' | 'timestamp'>) => void;
  onAddCustomer: (customer: { name: string; phone: string; email?: string }) => void;
  onRefreshProducts: () => void;
}

export default function KasirView({
  products,
  customers,
  settings,
  userSession,
  onOrderCompleted,
  onAddCustomer,
  onRefreshProducts,
}: KasirViewProps) {
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0); // Cart level discount
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  // Modals/Checkouts
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [newOrderResult, setNewOrderResult] = useState<Order | null>(null);
  
  // Custom Customer Adding State
  const [isAddingCustomerInline, setIsAddingCustomerInline] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Shift States
  const [activeShift, setActiveShift] = useState<CashierShift | null>(() => DB.getActiveShift());
  const [isOpeningShiftModalOpen, setIsOpeningShiftModalOpen] = useState(false);
  const [isShiftDetailsModalOpen, setIsShiftDetailsModalOpen] = useState(false);
  const [shiftOpeningCash, setShiftOpeningCash] = useState<string>('100000');
  const [shiftCashierName, setShiftCashierName] = useState(() => userSession?.name || 'Kasir');
  const [shiftClosingCash, setShiftClosingCash] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [closedShiftSummary, setClosedShiftSummary] = useState<CashierShift | null>(null);

  // Promo / Coupon States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState('');

  // Points Redemption States
  const [redeemPoints, setRedeemPoints] = useState(false);

  // Sync state cashier name with session changes
  useEffect(() => {
    if (userSession?.name) {
      setShiftCashierName(userSession.name);
    }
  }, [userSession]);

  // Force opening shift modal if no active shift and block checkouts
  useEffect(() => {
    if (!activeShift && settings.enableLockScreen !== false) {
      setIsOpeningShiftModalOpen(true);
    }
  }, [activeShift, settings]);

  // 1. Categories list
  const categories = useMemo(() => {
    const list = new Set(products.map((p) => p.category));
    return ['Semua', ...Array.from(list)];
  }, [products]);

  // 2. Filter products based on search and selected category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // 3. Find selected customer
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Customer Tier calculations
  const customerTier = useMemo(() => {
    if (!currentCustomer) return null;
    const pts = currentCustomer.points || 0;
    if (pts >= 500) return { name: 'Gold Member', discount: 7, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (pts >= 100) return { name: 'Silver Member', discount: 3, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
    return { name: 'Bronze Member', discount: 0, color: 'text-slate-500 bg-slate-50 border-slate-200' };
  }, [currentCustomer]);

  // Points redemption value calculation
  const pointsRedemption = useMemo(() => {
    if (!currentCustomer || !redeemPoints) return { pointsToRedeem: 0, discountValue: 0 };
    const valuePerPoint = settings.pointsValuePerPoint || 100;
    
    // Calculate subtotal of cart items before cart-level discounts
    const subtotal = cart.reduce((acc, item) => {
      const itemSubtotal = item.product.price * item.quantity;
      const itemDiscount = itemSubtotal * (item.discountPercentage / 100);
      return acc + (itemSubtotal - itemDiscount);
    }, 0);

    // Max cash value we can deduct is the subtotal
    const maxRedeemablePoints = Math.min(
      currentCustomer.points,
      Math.ceil(subtotal / valuePerPoint)
    );

    return {
      pointsToRedeem: maxRedeemablePoints,
      discountValue: maxRedeemablePoints * valuePerPoint
    };
  }, [currentCustomer, redeemPoints, cart, settings]);

  // 4. Cart calculations
  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => {
      const itemSubtotal = item.product.price * item.quantity;
      const itemDiscount = itemSubtotal * (item.discountPercentage / 100);
      return acc + (itemSubtotal - itemDiscount);
    }, 0);

    // Calculate Member automatic tier discount amount
    const memberDiscountPercentage = customerTier ? customerTier.discount : 0;
    const memberDiscountAmount = subtotal * (memberDiscountPercentage / 100);

    // Calculate applied promo code discount
    let promoDiscountAmount = 0;
    if (appliedPromo && appliedPromo.isActive) {
      if (subtotal >= appliedPromo.minPurchase) {
        if (appliedPromo.type === 'PERCENTAGE') {
          promoDiscountAmount = (subtotal - memberDiscountAmount) * (appliedPromo.value / 100);
        } else {
          promoDiscountAmount = appliedPromo.value;
        }
      }
    }

    // Manual global discount percentage
    const manualDiscountAmount = (subtotal - memberDiscountAmount - promoDiscountAmount) * (discountPercentage / 100);

    // Point redemption discount
    const pointsDiscountAmount = pointsRedemption.discountValue;

    // Total discounts combined
    const totalDiscountAmount = memberDiscountAmount + promoDiscountAmount + manualDiscountAmount + pointsDiscountAmount;

    const taxableAmount = Math.max(0, subtotal - totalDiscountAmount);
    const taxAmount = Math.round(taxableAmount * (settings.taxRate / 100));
    const total = taxableAmount + taxAmount;

    // Calculate loyalty points earned (points are earned on the actual final paid total)
    let loyaltyPointsEarned = 0;
    if (settings.enableLoyalty && currentCustomer) {
      loyaltyPointsEarned = Math.floor(total * settings.pointsPerRupiah);
    }

    return {
      subtotal,
      memberDiscountAmount,
      promoDiscountAmount,
      manualDiscountAmount,
      pointsDiscountAmount,
      discountAmount: totalDiscountAmount,
      taxAmount,
      total,
      loyaltyPointsEarned,
    };
  }, [cart, discountPercentage, settings, customerTier, appliedPromo, pointsRedemption]);

  // Cart actions
  const addToCart = (product: Product) => {
    if (!activeShift) {
      setIsOpeningShiftModalOpen(true);
      return;
    }
    if (product.stock <= 0) return;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      
      if (existingIndex !== -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty >= product.stock) return prevCart; // Exceeds stock limit

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + 1,
        };
        return updated;
      } else {
        return [...prevCart, { product, quantity: 1, discountPercentage: 0 }];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === productId);
      if (existingIndex === -1) return prevCart;

      const item = prevCart[existingIndex];
      const targetProduct = products.find((p) => p.id === productId);
      if (!targetProduct) return prevCart;

      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prevCart.filter((item) => item.product.id !== productId);
      } else if (newQty > targetProduct.stock) {
        // Warning or stop
        return prevCart; 
      } else {
        const updated = [...prevCart];
        updated[existingIndex] = { ...item, quantity: newQty };
        return updated;
      }
    });
  };

  const setItemDiscount = (productId: string, percentage: number) => {
    const val = Math.max(0, Math.min(100, percentage));
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product.id === productId) {
          return { ...item, discountPercentage: val };
        }
        return item;
      });
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercentage(0);
    setSelectedCustomerId('');
    setNotes('');
  };

  // Checkout handling
  const handleOpenCheckout = () => {
    if (!activeShift) {
      setIsOpeningShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) return;
    setIsCheckoutOpen(true);
    setCashReceived(String(totals.total)); // Default cash input to exact amount
  };

  const handleInlineCustomerSave = (e: FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;
    onAddCustomer({
      name: newCustName,
      phone: newCustPhone,
    });
    setNewCustName('');
    setNewCustPhone('');
    setIsAddingCustomerInline(false);
  };

  const changeDue = useMemo(() => {
    const cash = parseFloat(cashReceived) || 0;
    return Math.max(0, cash - totals.total);
  }, [cashReceived, totals.total]);

  // Confirm payment
  const handleProcessPayment = () => {
    const cash = parseFloat(cashReceived) || 0;
    if (paymentMethod === 'CASH' && cash < totals.total) {
      alert('Jumlah tunai yang diterima kurang dari total yang harus dibayar.');
      return;
    }

    const orderPayload = {
      items: cart.map((item) => {
        const pSubtotal = item.product.price * item.quantity;
        const discountAmt = pSubtotal * (item.discountPercentage / 100);
        return {
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          costPrice: item.product.costPrice,
          quantity: item.quantity,
          subtotal: pSubtotal - discountAmt,
          discountPercentage: item.discountPercentage,
        };
      }),
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      paymentMethod,
      cashAmountPaid: paymentMethod === 'CASH' ? cash : undefined,
      changeAmount: paymentMethod === 'CASH' ? changeDue : undefined,
      customerId: selectedCustomerId || undefined,
      customerName: currentCustomer?.name || undefined,
      pointsEarnedValue: totals.loyaltyPointsEarned > 0 ? totals.loyaltyPointsEarned : undefined,
      notes: notes.trim() || undefined,
    };

    // Deduct customer points if points were redeemed
    if (selectedCustomerId && pointsRedemption.pointsToRedeem > 0) {
      DB.deductCustomerPoints(selectedCustomerId, pointsRedemption.pointsToRedeem);
    }

    const savedDoc = DB.createOrder(orderPayload);
    
    // Refresh active shift state since DB.createOrder logs sales to shift
    const refreshedShift = DB.getActiveShift();
    setActiveShift(refreshedShift);

    setNewOrderResult(savedDoc);
    setIsCheckoutOpen(false);
    setIsReceiptOpen(true);
    
    // Reset cart and states
    setCart([]);
    setDiscountPercentage(0);
    setSelectedCustomerId('');
    setNotes('');
    setAppliedPromo(null);
    setRedeemPoints(false);
    setPromoCodeInput('');
    setPromoError('');

    onRefreshProducts(); // Force refresh stock lists
    onOrderCompleted(orderPayload); // Notify App shell to refresh customer points list and other statistics
  };

  const appendCash = (amount: number) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived(String(current + amount));
  };

  const setExactCash = (amount: number) => {
    setCashReceived(String(amount));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-5">
      {/* LEFT PORTION: Products Directory */}
      <div className="flex-1 flex flex-col min-w-0" id="kasir-register-panel">
        
        {/* Cashier Shift Info Bar */}
        <div className={`mb-3 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all ${
          activeShift 
            ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
            : 'bg-amber-50/40 border-amber-100 text-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              activeShift ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {activeShift ? <Unlock className="h-4 w-4 animate-pulse" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-wider">
                {activeShift ? 'Sesi Shift Aktif' : 'Sesi Shift Tutup'}
              </p>
              <p className="text-[11px] font-medium opacity-90 mt-0.5">
                {activeShift 
                  ? `Kasir: ${activeShift.openedBy} • Mulai: ${new Date(activeShift.openedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • Modal Awal: ${formatCurrency(activeShift.openingCash)}`
                  : 'Registrasi kasir dikunci. Silakan buka shift kasir baru untuk memulai penjualan.'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeShift ? (
              <>
                <span className="text-xs font-mono font-bold bg-white border border-emerald-200/55 px-2 py-1 rounded">
                  Tunai Laci: {formatCurrency(activeShift.openingCash + (activeShift.cashSales || 0))}
                </span>
                <button
                  onClick={() => {
                    setShiftClosingCash(String(activeShift.openingCash + (activeShift.cashSales || 0)));
                    setShiftNotes('');
                    setIsShiftDetailsModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="h-3 w-3" />
                  Akhiri Shift
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsOpeningShiftModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Unlock className="h-3 w-3" />
                Buka Sesi Shift
              </button>
            )}
          </div>
        </div>

        {/* Top bar with Search & Filters */}
        <div className="mb-4 bg-white rounded-xl border border-slate-100 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="product-search-input"
                type="text"
                placeholder="Cari produk atau SKU..."
                className="w-full text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category selection */}
            <div className="flex gap-2 overflow-x-auto w-full no-scrollbar py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-medium px-4 py-2 rounded-lg transition-all border whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  id={`cat-filter-${cat.toLowerCase().replace(/ /g, '-')}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col justify-center items-center bg-white border border-slate-100 rounded-xl p-8 text-center shadow-xs">
              <AlertCircle className="h-10 w-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-semibold text-slate-700">Tidak ada produk ditemukan</h3>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian Anda atau ganti kategori.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((prod) => {
                const getCartQty = cart.find((i) => i.product.id === prod.id)?.quantity || 0;
                const isOutOfStock = prod.stock <= 0;
                const isLowStock = prod.stock > 0 && prod.stock <= prod.minStock;

                return (
                  <motion.div
                    key={prod.id}
                    layoutId={`product-${prod.id}`}
                    whileTap={{ scale: isOutOfStock ? 1 : 0.98 }}
                    onClick={() => !isOutOfStock && addToCart(prod)}
                    className={`group relative bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col text-left justify-between select-none cursor-pointer ${
                      isOutOfStock ? 'opacity-65 border-slate-200 bg-slate-50/50' : 'border-slate-100 hover:border-emerald-300'
                    }`}
                    id={`product-card-${prod.id}`}
                  >
                    {/* Visual box as avatar with product image or SKU with preset color */}
                    <div 
                      className="h-28 flex items-center justify-center text-white relative font-semibold text-2xl transition-all overflow-hidden bg-slate-100 shrink-0"
                      style={!prod.image ? { backgroundColor: prod.color || '#10b981' } : undefined}
                    >
                      {prod.image ? (
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{prod.sku.slice(-3)}</span>
                      )}
                      
                      {/* Floating Stock indicator */}
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md bg-black/40 backdrop-blur-xs text-white z-10 font-mono">
                        Stok: {prod.stock}
                      </span>

                      {/* Display warning badge if stock is low or out */}
                      {isOutOfStock ? (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                          <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-md tracking-wider">HABIS</span>
                        </div>
                      ) : isLowStock ? (
                        <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white z-10 animate-pulse">
                          MIN
                        </span>
                      ) : null}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{prod.category}</p>
                        <h4 className="text-[13px] font-semibold text-slate-800 line-clamp-2 mt-0.5 group-hover:text-emerald-700 transition">
                          {prod.name}
                        </h4>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(prod.price)}</span>
                        
                        {/* Selected Indicator/Quantity */}
                        {getCartQty > 0 && (
                          <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] font-extrabold bg-emerald-600 text-white rounded-full">
                            x{getCartQty}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PORTION: Register Active Basket (Cart) */}
      <div 
        className="w-full lg:w-96 flex flex-col bg-white border border-slate-150 rounded-xl overflow-hidden shadow-xs"
        id="kasir-cart-panel"
      >
        {/* Cart Header */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-slate-800">Keranjang Belanja</span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition"
              title="Kosongkan keranjang"
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Customer Select Option */}
        <div className="p-4 border-b border-slate-100 bg-emerald-50/20">
          {!isAddingCustomerInline ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <select
                  id="customer-select"
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none bg-white cursor-pointer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Pilih Pelanggan (Umum)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone.slice(-4)}) — Pt: {c.points}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setIsAddingCustomerInline(true)}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 p-1.5 rounded-lg transition-all"
                title="Tambah Pelanggan Baru"
                id="add-customer-inline-btn"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleInlineCustomerSave} className="flex flex-col gap-2 bg-white border border-emerald-100 p-2.5 rounded-lg">
              <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wide">Pelanggan Baru</span>
              <input
                type="text"
                placeholder="Nama Lengkap"
                className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded-md focus:outline-none"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="No. Telepon / WhatsApp"
                className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded-md focus:outline-none"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                required
              />
              <div className="flex gap-1.5 mt-1 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddingCustomerInline(false)}
                  className="text-[10px] font-semibold text-slate-500 px-2 py-1 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 text-white text-[10px] font-semibold px-3 py-1 rounded hover:bg-emerald-700 transition"
                  id="save-customer-inline-btn"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          )}

          {currentCustomer && (
            <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold mt-2.5 bg-emerald-50/50 p-1.5 rounded border border-emerald-100/30">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500 animate-pulse" />
                Loyalty: {currentCustomer.name}
              </span>
              <span>Poin saat ini: {currentCustomer.points}</span>
            </div>
          )}
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[160px]">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-10 w-10 text-slate-350 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <Receipt className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-xs font-medium text-slate-400">Keranjang masih kosong</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ketuk produk untuk menambahkannya ke sini.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={item.product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col pb-3 border-b border-slate-50"
                  id={`cart-item-${item.product.id}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-slate-700 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.product.sku} — {formatCurrency(item.product.price)}</p>
                    </div>
                    <button
                      onClick={() => removeCartItem(item.product.id)}
                      className="text-slate-350 hover:text-red-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Pricing and discounts on item level */}
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    {/* Item Discount Field */}
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-medium text-slate-500">Disc%:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-10 border border-slate-200 text-center rounded text-[10px] font-bold p-0.5 focus:outline-none"
                        value={item.discountPercentage}
                        onChange={(e) => setItemDiscount(item.product.id, parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button
                        onClick={() => updateCartQty(item.product.id, -1)}
                        className="px-2 py-1 text-slate-500 hover:bg-slate-200 transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2.5 font-bold text-xs text-slate-800 font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(item.product.id, 1)}
                        className={`px-2 py-1 text-slate-500 hover:bg-slate-200 transition ${
                          item.quantity >= item.product.stock ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title="Tambah kuantitas"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Row subtotal */}
                    <div className="text-right flex-1 select-none">
                      <span className="text-xs font-bold text-slate-800">
                        {formatCurrency(
                          (item.product.price * item.quantity) * (1 - item.discountPercentage / 100)
                        )}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Global Cart Summary Panel */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2 text-xs">
          
          {/* Member Tier Discount */}
          {customerTier && customerTier.discount > 0 && (
            <div className="flex justify-between text-indigo-700 font-semibold bg-indigo-50 p-2 rounded border border-indigo-100/40">
              <span className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5" />
                Diskon {customerTier.name} ({customerTier.discount}%)
              </span>
              <span className="font-mono">-{formatCurrency(totals.memberDiscountAmount)}</span>
            </div>
          )}

          {/* Promo Code System */}
          <div className="bg-slate-100/50 p-2.5 rounded-lg border border-slate-200/40 mt-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1.5">Kupon / Promo Otomatis</span>
            
            {!appliedPromo ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Masukkan kode kupon..."
                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs uppercase font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value);
                    setPromoError('');
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPromoError('');
                    if (!promoCodeInput.trim()) return;
                    const promos = DB.getPromos();
                    const found = promos.find(
                      (p) => p.code.toLowerCase() === promoCodeInput.trim().toLowerCase() && p.isActive
                    );
                    if (!found) {
                      setPromoError('Kupon tidak valid / tidak aktif');
                      setAppliedPromo(null);
                      return;
                    }
                    if (totals.subtotal < found.minPurchase) {
                      setPromoError(`Min. belanja ${formatCurrency(found.minPurchase)}`);
                      setAppliedPromo(null);
                      return;
                    }
                    setAppliedPromo(found);
                    setPromoError('');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded transition text-xs"
                >
                  Pakai
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/60 p-1.5 rounded">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-bold text-emerald-800 text-xs">{appliedPromo.code}</span>
                  <span className="text-[10px] text-emerald-600 font-medium">({appliedPromo.type === 'PERCENTAGE' ? `${appliedPromo.value}%` : formatCurrency(appliedPromo.value)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoCodeInput('');
                  }}
                  className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5"
                >
                  Batal
                </button>
              </div>
            )}

            {promoError && (
              <p className="text-[10px] text-red-500 font-semibold mt-1">{promoError}</p>
            )}

            {appliedPromo && (
              <div className="flex justify-between text-emerald-700 font-bold text-[11px] mt-1.5 px-0.5">
                <span>Potongan Kupon</span>
                <span className="font-mono">-{formatCurrency(totals.promoDiscountAmount)}</span>
              </div>
            )}
          </div>

          {/* Loyalty Points Redemption Box */}
          {currentCustomer && currentCustomer.points > 0 && (
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/40 mt-1 flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Tukar Poin Loyalty</span>
                <span className="text-[11px] text-amber-700 font-medium mt-0.5">
                  Tukar {pointsRedemption.pointsToRedeem} Poin = Diskon <strong className="font-semibold">{formatCurrency(pointsRedemption.discountValue)}</strong>
                </span>
              </div>
              <input
                type="checkbox"
                checked={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.checked)}
                className="h-4 w-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
              />
            </div>
          )}

          <div className="border-t border-slate-200/60 my-1.5"></div>

          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-500">
            <span className="flex items-center gap-1">
              Diskon Global (%)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                id="cart-discount-input"
                type="number"
                min="0"
                max="100"
                className="w-12 border border-slate-200 text-center rounded bg-white text-xs font-bold py-0.5 focus:outline-none"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              />
              <span className="font-mono font-medium text-slate-600">
                (-{formatCurrency(totals.memberDiscountAmount + totals.promoDiscountAmount + totals.manualDiscountAmount + totals.pointsDiscountAmount)})
              </span>
            </div>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>PPN ({settings.taxRate}%)</span>
            <span className="font-mono">{formatCurrency(totals.taxAmount)}</span>
          </div>

          <div className="border-t border-slate-200/60 my-1"></div>

          <div className="flex justify-between text-base font-extrabold text-slate-900 select-none">
            <span>TOTAL BAYAR</span>
            <span className="font-mono text-emerald-700">{formatCurrency(totals.total)}</span>
          </div>

          {totals.loyaltyPointsEarned > 0 && (
            <div className="flex items-center gap-1 bg-emerald-100/50 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200/35 self-end">
              <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500 animate-pulse" />
              Pelanggan mendapatkan +{totals.loyaltyPointsEarned} Poin
            </div>
          )}

          {/* Checkout triggers */}
          <button
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className={`w-full mt-2 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              cart.length === 0
                ? 'bg-slate-200 border border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md'
            }`}
            id="cart-checkout-btn"
          >
            Selesaikan Transaksi ({cart.reduce((s, c) => s + c.quantity, 0)} Item)
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MODAL CHECKOUT & PAYMENT INCOMING */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col"
              id="checkout-payment-modal"
            >
              {/* Checkout modal header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Proses Pembayaran</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Selesaikan order dengan metode pembayaran terpilih.</p>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 flex flex-col md:flex-row gap-5">
                {/* Visual pricing summaries */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex flex-col text-center">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mb-1">TOTAL TAGIHAN</span>
                    <span className="text-2xl font-black text-emerald-700 font-mono">
                      {formatCurrency(totals.total)}
                    </span>
                  </div>

                  {/* Payment profile selection */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">METODE BAYAR</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'CASH', name: 'TUNAI / CASH' },
                        { id: 'QRIS', name: 'QRIS / DIGITAL' },
                        { id: 'DEBIT_CREDIT', name: 'KARTU DEBIT/KREDIT' },
                        { id: 'E_WALLET', name: 'E-WALLET (SHOPEEPAY/OVO)' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(m.id as PaymentMethod);
                            if (m.id !== 'CASH') setCashReceived(String(totals.total)); // Non-cash means matching payments
                          }}
                          className={`text-xs font-bold py-3 px-2 rounded-xl border text-center transition-all ${
                            paymentMethod === m.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes / Catatan Belanja */}
                  <div className="mt-2 text-left">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Catatan Transaksi</label>
                    <textarea
                      placeholder="Masukkan catatan jika ada (opsional)..."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cash Processing controls */}
                {paymentMethod === 'CASH' && (
                  <div className="w-full md:w-64 flex flex-col gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">TUNAI DITERIMA</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                        <input
                          id="cash-received-input"
                          type="number"
                          placeholder="Masukkan Tunai"
                          className="w-full border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-black font-mono text-slate-800 text-right focus:outline-emerald-500"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Exact selection button shortcuts */}
                    <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                      <button
                        onClick={() => setExactCash(totals.total)}
                        className="bg-emerald-50 text-emerald-800 py-1.5 border border-emerald-200/50 rounded-lg hover:bg-emerald-100"
                      >
                        Pas: {formatCurrency(totals.total)}
                      </button>
                      <button
                        onClick={() => setExactCash(10000)}
                        className="bg-slate-100 py-1.5 rounded-lg hover:bg-slate-200"
                      >
                        10.000
                      </button>
                      <button
                        onClick={() => setExactCash(20000)}
                        className="bg-slate-100 py-1.5 rounded-lg hover:bg-slate-200"
                      >
                        20.000
                      </button>
                      <button
                        onClick={() => setExactCash(50000)}
                        className="bg-slate-100 py-1.5 rounded-lg hover:bg-slate-200"
                      >
                        50.000
                      </button>
                      <button
                        onClick={() => setExactCash(100000)}
                        className="bg-slate-100 py-1.5 rounded-lg hover:bg-slate-200 text-slate-800 font-bold"
                      >
                        100.000
                      </button>
                      <button
                        onClick={() => appendCash(50000)}
                        className="bg-emerald-50 text-emerald-800 py-1.5 border border-emerald-200/30 rounded-lg hover:bg-emerald-100 font-bold"
                      >
                        + 50 Rb
                      </button>
                    </div>

                    {/* Change refund panel */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-500">UANG KEMBALIAN:</span>
                      <span className={`font-mono font-black text-sm ${changeDue > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {formatCurrency(changeDue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout actions */}
              <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleProcessPayment}
                  className="px-6 py-2.5 rounded-lg text-white font-bold bg-emerald-600 hover:bg-emerald-700 transition shadow-sm hover:shadow-md flex items-center gap-1.5 cursor-pointer text-sm"
                  id="process-payment-btn"
                >
                  <Check className="h-4 w-4" />
                  Konfirmasi Pembayaran
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PRINT RECEIPT (STRUK BELANJA) */}
      <AnimatePresence>
        {isReceiptOpen && newOrderResult && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-100 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col border border-slate-300"
              id="printed-receipt-container"
            >
              {/* Receipt controller buttons */}
              <div className="bg-white flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Transaksi Berhasil
                </span>
                <button
                  onClick={() => setIsReceiptOpen(false)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Printable receipt mockup */}
              <div className="p-4 overflow-y-auto flex-1 flex justify-center">
                <div id="thermal-receipt-slip" className="bg-white border text-center border-slate-300/80 w-full max-w-[280px] p-4 font-mono text-[11px] text-slate-800 shadow-sm leading-relaxed relative">
                  {/* Jagged border helper top */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-repeat-x flex justify-between overflow-hidden opacity-10">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="h-2 w-2 bg-slate-800 rotate-45 transform -translate-y-1"></div>
                    ))}
                  </div>

                  {/* Receipt Header details */}
                  <h4 className="font-extrabold text-xs uppercase text-slate-900 tracking-wider mb-0.5">{settings.storeName}</h4>
                  <p className="text-[9px] text-slate-500 leading-tight mb-0.5">{settings.address}</p>
                  <p className="text-[9.5px] text-slate-500">Telp: {settings.phone}</p>
                  
                  <div className="border-t border-dashed border-slate-300 my-2"></div>
                  
                  {/* Order detail values */}
                  <div className="text-left flex flex-col gap-0.5 text-[9.5px] text-slate-600">
                    <div className="flex justify-between">
                      <span>No: {newOrderResult.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tgl: {new Date(newOrderResult.timestamp).toLocaleString('id-ID', { hour12: false })}</span>
                    </div>
                    {newOrderResult.customerName && (
                      <div className="flex justify-between font-bold text-slate-800 mt-0.5">
                        <span>Pelanggan: {newOrderResult.customerName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Metode: {newOrderResult.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-2"></div>

                  {/* Items list */}
                  <div className="flex flex-col gap-1.5 text-left text-[10px]">
                    {newOrderResult.items.map((it, idx) => (
                      <div key={idx} className="flex flex-col">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-800">{it.productName}</span>
                          <span className="font-semibold text-slate-900 font-mono">{formatCurrency(it.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 pl-1">
                          <span>{it.quantity} x {formatCurrency(it.price)}</span>
                          {it.discountPercentage > 0 && (
                            <span className="text-amber-600 font-medium font-mono">Disc {it.discountPercentage}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-2"></div>

                  {/* Overall pricing totals inside receipt */}
                  <div className="flex flex-col gap-0.5 text-right font-mono text-[10px] pl-5 text-slate-700">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(newOrderResult.subtotal)}</span>
                    </div>
                    {newOrderResult.discountAmount > 0 && (
                      <div className="flex justify-between text-amber-600 font-semibold">
                        <span>Disk Global:</span>
                        <span>-{formatCurrency(newOrderResult.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>PPN ({settings.taxRate}%):</span>
                      <span>{formatCurrency(newOrderResult.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-[11px] border-t border-slate-200 mt-1 pt-1">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(newOrderResult.total)}</span>
                    </div>
                    
                    {newOrderResult.paymentMethod === 'CASH' && (
                      <>
                        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                          <span>Bayar Tunai:</span>
                          <span>{formatCurrency(newOrderResult.cashAmountPaid || 0)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Kembali:</span>
                          <span>{formatCurrency(newOrderResult.changeAmount || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-2"></div>

                  {newOrderResult.pointsEarnedValue && (
                    <p className="text-[9.5px] font-bold text-emerald-800 mb-1 flex items-center justify-center gap-1">
                      ★ Dapat +{newOrderResult.pointsEarnedValue} Poin Loyalty
                    </p>
                  )}

                  {newOrderResult.notes && (
                    <div className="text-left bg-slate-50 p-1.5 border rounded text-[8.5px] text-slate-500 mb-2">
                       <span className="font-bold">Memo:</span> {newOrderResult.notes}
                    </div>
                  )}

                  {/* Footers */}
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-tight px-1 mt-3">
                    {settings.receiptFooterMessage}
                  </p>
                  <p className="text-[8px] text-slate-400 mt-2">Powered by Exora POS</p>
                </div>
              </div>

              {/* Print action buttons */}
              <div className="p-3 bg-white flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Cetak Struk
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition cursor-pointer"
                >
                  Transaksi Baru
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 1. OPENING SHIFT MODAL */}
        {isOpeningShiftModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6"
            >
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2 text-left">
                <Unlock className="h-5 w-5 text-amber-500" />
                Mulai Sesi Shift Baru
              </h3>
              <p className="text-xs text-slate-500 mb-5 text-left font-medium">Masukkan detail kasir dan modal awal dalam laci kasir untuk melacak transaksi.</p>
              
              <div className="flex flex-col gap-4 text-left">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nama Kasir / Operator</label>
                  <input
                    type="text"
                    value={shiftCashierName}
                    onChange={(e) => setShiftCashierName(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nama operator kasir..."
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Uang Modal Awal (Cash) (Rp)</label>
                  <input
                    type="number"
                    value={shiftOpeningCash}
                    onChange={(e) => setShiftOpeningCash(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="100000"
                    required
                  />
                </div>

                <button
                  onClick={() => {
                    if (!shiftCashierName.trim()) {
                      alert('Silakan masukkan nama kasir.');
                      return;
                    }
                    const opCash = parseFloat(shiftOpeningCash) || 0;
                    const opened = DB.openShift(shiftCashierName, opCash);
                    setActiveShift(opened);
                    setIsOpeningShiftModalOpen(false);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-sm transition mt-2 cursor-pointer"
                >
                  Mulai Sesi Shift
                </button>
                
                {settings.enableLockScreen === false && (
                  <button
                    onClick={() => setIsOpeningShiftModalOpen(false)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                  >
                    Nanti Saja
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. SHIFT DETAILS / CLOSING MODAL */}
        {isShiftDetailsModalOpen && activeShift && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="text-left">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Lock className="h-5 w-5 text-emerald-600" />
                    Konfirmasi Akhiri Shift
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Selesaikan shift kasir dan catat selisih uang jika ada.</p>
                </div>
                <button
                  onClick={() => setIsShiftDetailsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto text-xs flex flex-col gap-4 text-left">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-slate-400 font-semibold uppercase text-[10px]">Nama Kasir</p>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{activeShift.openedBy}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold uppercase text-[10px]">Waktu Mulai</p>
                    <p className="font-bold text-slate-800 mt-0.5">{new Date(activeShift.openedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Rincian Keuangan Shift</span>
                  
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-600">Modal Awal Kas:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(activeShift.openingCash)}</span>
                  </div>
                  
                  <div className="flex justify-between py-1 border-b border-slate-50 text-emerald-700">
                    <span className="font-semibold">Penjualan Tunai:</span>
                    <span className="font-mono font-bold">+{formatCurrency(activeShift.cashSales || 0)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>Penjualan QRIS:</span>
                    <span className="font-mono font-bold">+{formatCurrency(activeShift.qrisSales || 0)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                    <span>Penjualan E-Wallet:</span>
                    <span className="font-mono font-bold">+{formatCurrency(activeShift.eWalletSales || 0)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 font-extrabold text-xs text-slate-950 bg-slate-50 p-2 rounded">
                    <span>Total yang Diharapkan di Laci (Modal + Tunai):</span>
                    <span className="font-mono">{formatCurrency(activeShift.openingCash + (activeShift.cashSales || 0))}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Jumlah Uang Aktual di Laci (Tunai) (Rp)</label>
                    <input
                      type="number"
                      className="w-full text-base border border-slate-200 rounded-lg p-2.5 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0"
                      value={shiftClosingCash}
                      onChange={(e) => setShiftClosingCash(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Hitung uang tunai fisik yang ada di dalam laci kasir saat ini, lalu masukkan di sini.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Catatan Kasir (Opsional)</label>
                    <textarea
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Tulis alasan jika ada selisih, atau catatan operasional lainnya..."
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsShiftDetailsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const actCash = parseFloat(shiftClosingCash) || 0;
                    const closed = DB.closeShift(actCash, shiftNotes);
                    setActiveShift(null);
                    setClosedShiftSummary(closed);
                    setIsShiftDetailsModalOpen(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Tutup Shift & Kunci POS
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 3. CLOSED SHIFT SUMMARY / REPORT RECEIPT MODAL */}
        {closedShiftSummary && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-5"
            >
              <div id="thermal-receipt-slip" className="bg-white p-4 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 text-left">
                <h4 className="font-extrabold text-xs text-center border-b border-slate-200 pb-2 mb-3">EXORA POS • LAPORAN SHIFT</h4>
                
                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-bold">{closedShiftSummary.openedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buka Shift:</span>
                    <span>{new Date(closedShiftSummary.openedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2 mb-2">
                    <span>Tutup Shift:</span>
                    <span>{closedShiftSummary.closedAt ? new Date(closedShiftSummary.closedAt).toLocaleString() : '-'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Modal Awal:</span>
                    <span>{formatCurrency(closedShiftSummary.openingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penjualan Tunai:</span>
                    <span>{formatCurrency(closedShiftSummary.cashSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penjualan QRIS:</span>
                    <span>{formatCurrency(closedShiftSummary.qrisSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penjualan E-Wallet:</span>
                    <span>{formatCurrency(closedShiftSummary.eWalletSales || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-2">
                    <span>Ekspektasi Kas Laci:</span>
                    <span>{formatCurrency(closedShiftSummary.expectedCash || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-indigo-700">
                    <span>Aktual Kas Laci:</span>
                    <span>{formatCurrency(closedShiftSummary.closingCash || 0)}</span>
                  </div>

                  {(() => {
                    const variance = (closedShiftSummary.closingCash || 0) - (closedShiftSummary.expectedCash || 0);
                    return (
                      <div className={`flex justify-between font-extrabold text-xs border-t border-b border-double p-1 mt-2 ${
                        variance === 0 
                          ? 'text-emerald-700 bg-emerald-50' 
                          : variance > 0 
                            ? 'text-indigo-700 bg-indigo-50' 
                            : 'text-red-700 bg-red-50'
                      }`}>
                        <span>Selisih:</span>
                        <span>
                          {variance === 0 
                            ? 'PAS (Sesuai)' 
                            : variance > 0 
                              ? `LEBIH (+${formatCurrency(variance)})` 
                              : `KURANG (${formatCurrency(variance)})`
                          }
                        </span>
                      </div>
                    );
                  })()}

                  {closedShiftSummary.notes && (
                    <div className="mt-3 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      <strong className="block text-slate-600 mb-0.5 text-left">Catatan Kasir:</strong>
                      {closedShiftSummary.notes}
                    </div>
                  )}
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-6 border-t pt-2">Laporan Sesi Selesai • Exora POS</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Cetak Laporan
                </button>
                <button
                  onClick={() => {
                    setClosedShiftSummary(null);
                    setIsOpeningShiftModalOpen(true); // Force opening modal since there is no active shift now!
                  }}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
