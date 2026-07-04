import { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Boxes, History, TrendingUp, Users, 
  Settings, Menu, X, ArrowUpRight, Sparkles, AlertCircle, Lock, LogOut,
  Download, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// DB & Types
import { DB } from './services/db';
import { ActiveTab, Product, Order, Customer, StoreSettings, UserSession } from './types';

// Components
import KasirView from './components/KasirView';
import ProdukView from './components/ProdukView';
import RiwayatView from './components/RiwayatView';
import LaporanView from './components/LaporanView';
import PelangganView from './components/PelangganView';
import PengaturanView from './components/PengaturanView';
import LockScreen from './components/LockScreen';
import OwnerVerifyGate from './components/OwnerVerifyGate';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('kasir');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PWA installation promoter state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isAppStandalone, setIsAppStandalone] = useState(false);

  // Detect PWA status and handle events
  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOSDevice(ios);

    // Detect standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (navigator as any).standalone === true;
    setIsAppStandalone(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Track successful install
    window.addEventListener('appinstalled', () => {
      console.log('Exora POS installed successfully!');
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerPWAInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    }
  };

  // Operator Sessions
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem('pos_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Temporarily unlocked pages for Staff Kasir session (re-locks on switch unless unlocked again)
  const [temporaryOwnerUnlockedTabs, setTemporaryOwnerUnlockedTabs] = useState<Record<string, boolean>>({});

  // Global States backed by LocalStorage DB
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Exora POS',
    address: '',
    phone: '',
    taxRate: 11,
    currency: 'Rp',
    receiptFooterMessage: '',
    enableLoyalty: true,
    pointsPerRupiah: 0.001,
    ownerPin: '1234',
    kasirPin: '0000',
    enableLockScreen: true,
    supabaseUrl: '',
    supabaseAnonKey: ''
  });

  // Load database entities initially
  useEffect(() => {
    setProducts(DB.getProducts());
    setOrders(DB.getOrders());
    setCustomers(DB.getCustomers());
    setSettings(DB.getSettings());
  }, []);

  // Relational trigger reloads
  const refreshProducts = () => setProducts(DB.getProducts());
  const refreshOrders = () => setOrders(DB.getOrders());
  const refreshCustomers = () => setCustomers(DB.getCustomers());
  const refreshSettings = () => setSettings(DB.getSettings());

  // Database CRUD operations
  const handleAddProduct = (payload: Omit<Product, 'id'>) => {
    DB.addProduct(payload);
    refreshProducts();
  };

  const handleUpdateProduct = (prod: Product) => {
    DB.updateProduct(prod);
    refreshProducts();
  };

  const handleDeleteProduct = (id: string) => {
    DB.deleteProduct(id);
    refreshProducts();
  };

  const handleAddCustomer = (payload: Omit<Customer, 'id' | 'points' | 'createdAt'>) => {
    DB.addCustomer(payload);
    refreshCustomers();
  };

  const handleDeleteCustomer = (id: string) => {
    DB.deleteCustomer(id);
    refreshCustomers();
  };

  const handleSaveSettings = (newSettings: StoreSettings) => {
    DB.saveSettings(newSettings);
    refreshSettings();
  };

  const handleResetDatabase = () => {
    DB.resetAllData();
  };

  // Sync Out / Sync In State Restoration
  const handleSyncRestore = (restoredProducts: Product[], restoredCustomers: Customer[], restoredOrders: Order[]) => {
    DB.saveProducts(restoredProducts);
    DB.saveCustomers(restoredCustomers);
    DB.saveOrders(restoredOrders);

    setProducts(restoredProducts);
    setCustomers(restoredCustomers);
    setOrders(restoredOrders);
  };

  // Quick stat notifications for side rail alerts
  const lowStockAlertCount = useMemo(() => {
    return products.filter((p) => p.stock <= (p.minStock || 5)).length;
  }, [products]);

  // Handle transaction placements
  const handleOrderCompleted = (orderPayload: Omit<Order, 'id' | 'receiptNumber' | 'timestamp'>) => {
    refreshOrders();
    refreshProducts();
    refreshCustomers();
  };

  // Operator state mutators
  const handleLogin = (session: UserSession) => {
    setUserSession(session);
    sessionStorage.setItem('pos_user_session', JSON.stringify(session));
  };

  const handleLogout = () => {
    setUserSession(null);
    setTemporaryOwnerUnlockedTabs({});
    sessionStorage.removeItem('pos_user_session');
  };

  // Render respective tab layouts (with OwnerVerifyGate controls)
  const renderContent = () => {
    const isRestricted = ['produk', 'laporan', 'pelanggan', 'pengaturan'].includes(activeTab);
    const isUnlocked = temporaryOwnerUnlockedTabs[activeTab];

    if (isRestricted && userSession?.role === 'KASIR' && !isUnlocked) {
      return (
        <OwnerVerifyGate 
          settings={settings}
          onSuccess={() => {
            setTemporaryOwnerUnlockedTabs(prev => ({ ...prev, [activeTab]: true }));
          }}
          onCancel={() => {
            setActiveTab('kasir');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'kasir':
        return (
          <KasirView
            products={products}
            customers={customers}
            settings={settings}
            userSession={userSession}
            onOrderCompleted={handleOrderCompleted}
            onAddCustomer={handleAddCustomer}
            onRefreshProducts={refreshProducts}
          />
        );
      case 'produk':
        return (
          <ProdukView
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onRefreshProducts={refreshProducts}
          />
        );
      case 'riwayat':
        return (
          <RiwayatView
            orders={orders}
            settings={settings}
            onRefreshOrders={refreshOrders}
            onRefreshProducts={refreshProducts}
          />
        );
      case 'laporan':
        return <LaporanView orders={orders} products={products} />;
      case 'pelanggan':
        return (
          <PelangganView
            customers={customers}
            orders={orders}
            onAddCustomer={handleAddCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        );
      case 'pengaturan':
        return (
          <PengaturanView
            settings={settings}
            products={products}
            customers={customers}
            orders={orders}
            onSaveSettings={handleSaveSettings}
            onResetDatabase={handleResetDatabase}
            onSyncRestore={handleSyncRestore}
          />
        );
    }
  };

  // Lockscreen Interceptor
  if (settings.enableLockScreen && !userSession) {
    return <LockScreen settings={settings} onLoginSuccess={handleLogin} />;
  }

  // Nav metadata helper
  const navigationItems = [
    { id: 'kasir', label: 'Kasir Utama', icon: ShoppingCart, restricted: false },
    { id: 'produk', label: 'Produk & Stok', icon: Boxes, badge: lowStockAlertCount > 0 ? lowStockAlertCount : undefined, badgeColor: 'bg-amber-500', restricted: true },
    { id: 'riwayat', label: 'Riwayat Struk', icon: History, restricted: false },
    { id: 'laporan', label: 'Laporan Analitis', icon: TrendingUp, restricted: true },
    { id: 'pelanggan', label: 'Loyalty Pelanggan', icon: Users, restricted: true },
    { id: 'pengaturan', label: 'Pengaturan Toko', icon: Settings, restricted: true },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
      
      {/* 1. SIDEBAR NAVIGATION: Desktop-first Left Rail */}
      <nav className="hidden lg:flex flex-col w-64 bg-slate-900 text-white shrink-0 shadow-xl border-r border-slate-800">
        {/* Brand identity header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-left">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm">
              E
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-[9px] tracking-widest text-slate-400 uppercase">Point of Sale</span>
              <span className="font-black text-sm tracking-tight text-white line-clamp-1">{settings.storeName}</span>
            </div>
          </div>
        </div>

        {/* Navigation list items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isTabLocked = item.restricted && userSession?.role === 'KASIR' && !temporaryOwnerUnlockedTabs[item.id];

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none group ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/35'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                id={`sidebar-tab-${item.id}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4.5 w-4.5 transition group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span className="truncate">{item.label}</span>
                  {isTabLocked && (
                    <Lock className="h-3 w-3 text-amber-500/80 shrink-0 select-none" />
                  )}
                </div>
                {item.badge !== undefined && (
                  <span className={`h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white animate-pulse ${item.badgeColor || 'bg-red-500'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* PWA Promo Button inside scrolling sidebar */}
          {(showInstallBtn || (isIOSDevice && !isAppStandalone)) && (
            <div className="mt-4 p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl mx-1 text-left">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Aplikasi Kasir APK</span>
              <p className="text-[10px] text-slate-400 mb-2.5 font-medium leading-relaxed">
                {isIOSDevice 
                  ? "Instal di iPhone Anda untuk pengalaman kasir layar penuh." 
                  : "Pasang aplikasi Exora POS langsung ke HP atau Laptop Anda secara instan."}
              </p>
              {isIOSDevice ? (
                <div className="text-[9px] text-slate-300 font-bold bg-slate-900/65 p-2 rounded-lg border border-slate-800/50 leading-relaxed">
                  Tekan tombol <span className="text-white font-black">Share 📤</span> di Safari, lalu pilih <span className="text-emerald-400 font-black">"Tambah ke Layar Utama"</span>.
                </div>
              ) : (
                <button
                  onClick={triggerPWAInstall}
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer select-none"
                >
                  <Download className="h-3.5 w-3.5" />
                  Instal Aplikasi
                </button>
              )}
            </div>
          )}
        </div>

        {/* Operator status & Lock trigger */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${userSession?.role === 'OWNER' ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse`}></div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Operator</span>
                <span className="text-[11px] font-bold text-slate-200 line-clamp-1">{userSession?.name || 'Kasir'}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Kunci Layar POS"
              className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-red-400 transition cursor-pointer select-none"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[8px] text-slate-500 font-bold uppercase tracking-wider select-none">
            <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-emerald-500" /> Exora POS</span>
            <span>{settings.supabaseUrl ? 'Supabase cloud' : 'Offline Mode'}</span>
          </div>
        </div>
      </nav>

      {/* MOBILE HEADER BAR */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">E</div>
          <span className="font-extrabold tracking-tight text-xs truncate max-w-[180px] text-left">{settings.storeName}</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 px-2 border border-slate-700 rounded-md focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* MOBILE NAVIGATION SIDE DRAWER OVERLAY */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-35 backdrop-blur-xs flex justify-end" onClick={() => setIsMobileMenuOpen(false)}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-72 bg-slate-900 text-white h-full pt-16 px-4 flex flex-col gap-1 text-left shadow-2xl"
            >
              <div className="border-b border-slate-800 pb-3 mb-3 text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                Menu Navigator Kasir
              </div>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isTabLocked = item.restricted && userSession?.role === 'KASIR' && !temporaryOwnerUnlockedTabs[item.id];

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as ActiveTab);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold cursor-pointer select-none ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                      {isTabLocked && (
                        <Lock className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                    {item.badge !== undefined && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white bg-amber-500 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* PWA Promo for Mobile Drawer */}
              {(showInstallBtn || (isIOSDevice && !isAppStandalone)) && (
                <div className="mt-4 p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-left">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Aplikasi APK</span>
                  <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                    {isIOSDevice 
                      ? "Pasang di Home Screen iPhone Anda." 
                      : "Instal aplikasi Exora POS ke HP Anda secara langsung."}
                  </p>
                  {isIOSDevice ? (
                    <div className="text-[9px] text-slate-300 font-bold bg-slate-900/60 p-2 rounded-lg leading-relaxed">
                      Tekan tombol <span className="text-white font-black">Share 📤</span> di browser Safari, lalu pilih <span className="text-emerald-400 font-black">\"Tambah ke Layar Utama\"</span>.
                    </div>
                  ) : (
                    <button
                      onClick={triggerPWAInstall}
                      className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Instal Aplikasi Sekarang
                    </button>
                  )}
                </div>
              )}

              <div className="border-t border-slate-800/60 mt-auto mb-6 pt-3 flex flex-col gap-2">
                <div className="px-3.5 py-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Operator: <strong>{userSession?.name}</strong></span>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-xs font-bold text-red-400 hover:bg-red-900/10 cursor-pointer"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span>Kunci / Keluar Operator</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. MAIN APPLICATION CONTENT PORTION */}
      <main className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0 overflow-hidden relative text-left">
        {/* Dynamic Area Header (Desktop only) */}
        <header className="hidden lg:flex items-center justify-between px-6 py-4.5 bg-white border-b border-slate-150">
          <div className="text-left animate-fade-in">
            <h2 className="text-lg font-black text-slate-850 tracking-tight capitalize leading-none">
              {activeTab === 'kasir' ? 'Kasir Kas Registrasi' 
                : activeTab === 'produk' ? 'Inventaris & Ketersediaan Stok' 
                : activeTab === 'riwayat' ? 'Log Transaksi Penjualan' 
                : activeTab === 'laporan' ? 'Dashboard Kinerja Bisnis' 
                : activeTab === 'pelanggan' ? 'Keanggotaan CRM & Loyalty' 
                : 'Konfigurasi Sistem POS'}
            </h2>
            <p className="text-[10.5px] text-slate-400 mt-1 font-medium">
              {activeTab === 'kasir' ? 'Keluar-masuk penjualan kasir, tambah produk keranjang, proses pembayaran langsung.'
                : activeTab === 'produk' ? 'Atur harga jual, harga pokok/estimasi profit modal, ketersediaan produk.'
                : activeTab === 'riwayat' ? 'Daftar struk belanja tercetak, kueri memo transaksi, download/reprint struk belanja.'
                : activeTab === 'laporan' ? 'Visualisasi performa kas harian, profit, unit item terjual, top produk seller.'
                : activeTab === 'pelanggan' ? 'Kontak member aktif, WhatsApp list, jumlah poin reward, dan status tier.'
                : 'Atur identitas gerai, kode PIN keamanan operator, konfigurasi database cloud Supabase, reset pabrik.'}
            </p>
          </div>

          {/* Quick Info Bar */}
          <div className="flex items-center gap-4 text-xs font-medium">
            {lowStockAlertCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-3 py-1.5 rounded-lg border border-amber-250 animate-pulse select-none">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{lowStockAlertCount} Barang Menipis!</span>
              </div>
            )}
            <div className="flex flex-col text-right font-mono text-[10px] text-slate-400 leading-tight">
              <span className="font-bold text-slate-650">Operator: {userSession?.name || 'Kasir Aktif'}</span>
              <span>{settings.supabaseUrl ? 'Supabase Terkoneksi' : 'Lokal (Offline POS)'}</span>
            </div>
          </div>
        </header>

        {/* Scrollable View wrapper */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden bg-slate-50 relative">
          {renderContent()}
        </div>
      </main>

    </div>
  );
}
