import { useState, FormEvent } from 'react';
import { 
  Settings, Store, Percent, Phone, RotateCcw, 
  MapPin, HelpCircle, ToggleLeft, Save, Sparkles, Receipt,
  KeyRound, Cloud, UploadCloud, DownloadCloud, Copy, Check, Lock, Loader2, Database
} from 'lucide-react';
import { StoreSettings, Product, Customer, Order } from '../types';
import { testSupabaseConnection, pushAllLocalToCloud, pullCloudToLocal } from '../services/supabase';

interface PengaturanViewProps {
  settings: StoreSettings;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  onSaveSettings: (settings: StoreSettings) => void;
  onResetDatabase: () => void;
  onSyncRestore: (products: Product[], customers: Customer[], orders: Order[]) => void;
}

export default function PengaturanView({
  settings,
  products,
  customers,
  orders,
  onSaveSettings,
  onResetDatabase,
  onSyncRestore,
}: PengaturanViewProps) {
  // Form Local States
  const [storeName, setStoreName] = useState(settings.storeName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [currency, setCurrency] = useState(settings.currency || 'Rp');
  const [receiptFooterMessage, setReceiptFooterMessage] = useState(settings.receiptFooterMessage);
  const [enableLoyalty, setEnableLoyalty] = useState(settings.enableLoyalty);
  const [pointsPerRupiah, setPointsPerRupiah] = useState(settings.pointsPerRupiah || 0.001);

  // Security & Role States
  const [ownerPin, setOwnerPin] = useState(settings.ownerPin || '1234');
  const [kasirPin, setKasirPin] = useState(settings.kasirPin || '0000');
  const [enableLockScreen, setEnableLockScreen] = useState(settings.enableLockScreen !== false);

  // Supabase Sync States
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey || '');
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ checked: boolean; success: boolean; message: string } | null>(null);
  
  const [syncingOut, setSyncingOut] = useState(false);
  const [syncingIn, setSyncingIn] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!storeName || !address || !phone) {
      alert('Nama toko, alamat, dan nomor telepon tidak boleh kosong.');
      return;
    }

    onSaveSettings({
      storeName: storeName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      taxRate: Number(taxRate),
      currency: currency.trim(),
      receiptFooterMessage: receiptFooterMessage.trim(),
      enableLoyalty,
      pointsPerRupiah: Number(pointsPerRupiah),
      ownerPin: ownerPin.trim(),
      kasirPin: kasirPin.trim(),
      enableLockScreen,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
    });

    alert('Kombinasi pengaturan toko berhasil disimpan!');
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      alert('Isi URL dan Anon Key Supabase terlebih dahulu.');
      return;
    }

    setCheckingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl.trim(), supabaseAnonKey.trim());
      setConnectionStatus({
        checked: true,
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setConnectionStatus({
        checked: true,
        success: false,
        message: err?.message || 'Gagal tersambung.'
      });
    } finally {
      setCheckingConnection(false);
    }
  };

  const handlePushToCloud = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      alert('Konfigurasi database cloud Supabase belum diisi.');
      return;
    }

    const conf = confirm(
      `Peringatan Cadangan Cloud:\n\nTindakan ini akan mengunggah seluruh data lokal Anda ke database cloud Supabase:\n- ${products.length} Produk\n- ${customers.length} Pelanggan\n- ${orders.length} Log Transaksi\n\nData lama di database cloud Anda akan ditimpa/diperbarui. Apakah Anda yakin?`
    );
    if (!conf) return;

    setSyncingOut(true);
    try {
      const activeSettings: StoreSettings = {
        storeName, address, phone, taxRate, currency, receiptFooterMessage, enableLoyalty, pointsPerRupiah,
        ownerPin, kasirPin, enableLockScreen, supabaseUrl, supabaseAnonKey
      };
      const res = await pushAllLocalToCloud(products, customers, orders, activeSettings);
      alert(res.message);
    } catch (err: any) {
      alert(`Gagal sync out: ${err?.message || err}`);
    } finally {
      setSyncingOut(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      alert('Konfigurasi database cloud Supabase belum diisi.');
      return;
    }

    const conf = confirm(
      '⚠️ PERINGATAN PEMULIHAN DATA:\n\nTindakan ini akan mengunduh seluruh data dari database cloud Supabase dan TIMPA (Menghapus) seluruh data lokal di browser/perangkat ini.\n\nGunakan ini hanya jika Anda baru memasang aplikasi di perangkat baru atau ingin memulihkan data.\n\nApakah Anda yakin ingin menimpa data lokal Anda?'
    );
    if (!conf) return;

    setSyncingIn(true);
    try {
      const activeSettings: StoreSettings = {
        storeName, address, phone, taxRate, currency, receiptFooterMessage, enableLoyalty, pointsPerRupiah,
        ownerPin, kasirPin, enableLockScreen, supabaseUrl, supabaseAnonKey
      };
      const res = await pullCloudToLocal(activeSettings);
      if (res.success && res.products && res.customers && res.orders) {
        onSyncRestore(res.products, res.customers, res.orders);
        alert('Sukses! Seluruh data lokal telah diperbarui dan digantikan dengan data cloud dari Supabase.');
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(`Gagal memulihkan database: ${err?.message || err}`);
    } finally {
      setSyncingIn(false);
    }
  };

  const handleCopySql = () => {
    const sqlText = `-- SALIN DAN TEMPEL DI SUPABASE SQL EDITOR:

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  category TEXT NOT NULL,
  image TEXT,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  cash_amount_paid NUMERIC,
  change_amount NUMERIC,
  customer_id TEXT,
  customer_name TEXT,
  points_earned_value INTEGER,
  notes TEXT
);`;

    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleReset = () => {
    const doubleCheck = confirm(
      '⚠️ PERINGATAN: Tindakan ini akan menghapus SELURUH data produk kustom, pelanggan, dan riwayat transaksi, kemudian mengembalikannya ke pengaturan pabrik.\n\nApakah anda yakin ingin melanjutkan?'
    );
    if (!doubleCheck) return;

    const finalCheck = confirm(
      'Konfirmasi Terakhir:\n\nSemua data transaksi penjualan akan hilang selamanya. Lanjutkan?'
    );
    if (finalCheck) {
      onResetDatabase();
      alert('Database berhasil di-reset ke pengaturan awal! Halaman akan dimuat ulang.');
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/20 max-w-2xl text-left overflow-y-auto pr-1">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-white border border-slate-150 rounded-xl p-5 shadow-xs">
        
        {/* SECTION 1: Profile & Identitas Toko */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <Store className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-slate-805 text-base">Profil & Identitas Toko</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Nama Toko *</label>
            <input
              id="settings-store-name"
              type="text"
              placeholder="Exora POS"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">No. Telp / Handphone *</label>
            <input
              id="settings-store-phone"
              type="text"
              placeholder="0812XXXXXXXX"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Alamat Lengkap Toko *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3.5 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <textarea
              id="settings-store-address"
              placeholder="Jl. Raya Perjuangan No. 12, Kelapa Gading..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
        </div>

        {/* SECTION 2: Sistem Finansial & Struk */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mt-2">
          <Receipt className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-slate-805 text-base">Sistem Finansial & Struk Penjualan</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-455 tracking-wide block mb-1">Tarif Pajak PPN (%)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">%</span>
              <input
                id="settings-tax-rate"
                type="number"
                min="0"
                max="50"
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono font-bold text-slate-700"
                value={taxRate}
                onChange={(e) => setTaxRate(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-455 tracking-wide block mb-1">Mata Uang / Simbol</label>
            <input
              id="settings-currency-symbol"
              type="text"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-bold"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={6}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Pesan Kaki Struk (Receipt Footer)</label>
          <input
            id="settings-receipt-footer"
            type="text"
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
            value={receiptFooterMessage}
            onChange={(e) => setReceiptFooterMessage(e.target.value)}
            maxLength={128}
          />
        </div>

        {/* SECTION 3: Multi-Kasir Hak Akses PIN */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mt-2">
          <KeyRound className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-slate-805 text-base">Hak Akses Multi-Kasir (Operator PIN)</h3>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="text-left text-xs">
              <span className="font-bold text-slate-850 block">Aktifkan Layar Kunci Operator PIN</span>
              <span className="text-slate-400 text-[10.5px]">Mewajibkan PIN login saat aplikasi POS pertama kali dibuka atau dikunci.</span>
            </div>
            <button
              type="button"
              onClick={() => setEnableLockScreen(!enableLockScreen)}
              className={`p-1 px-4 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                enableLockScreen 
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {enableLockScreen ? 'AKTIF' : 'NON-AKTIF'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">PIN Owner (Pemilik) *</label>
              <input
                type="text"
                maxLength={6}
                placeholder="1234"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono"
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                required
              />
              <p className="text-[9.5px] text-slate-400 mt-1">Digunakan untuk melihat Dashboard Laporan & membuka Kunci Blok Toko.</p>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">PIN Staff Kasir *</label>
              <input
                type="text"
                maxLength={6}
                placeholder="0000"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono"
                value={kasirPin}
                onChange={(e) => setKasirPin(e.target.value.replace(/\D/g, ''))}
                required
              />
              <p className="text-[9.5px] text-slate-400 mt-1">Membuka POS dengan akses terbatas (hanya scan transaksi & riwayat).</p>
            </div>
          </div>
        </div>

        {/* SECTION 4: Loyalty Points */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mt-2">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-slate-805 text-base">Sistem Loyalty Member</h3>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="text-left text-xs">
              <span className="font-bold text-slate-850 block">Aktifkan Koin Membership Poin</span>
              <span className="text-slate-400 text-[10.5px]">Pelanggan dapat mengumpulkan poin berdasarkan nilai transaksi kasir.</span>
            </div>
            <button
              id="settings-loyalty-toggle"
              type="button"
              onClick={() => setEnableLoyalty(!enableLoyalty)}
              className={`p-1 px-4 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                enableLoyalty 
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {enableLoyalty ? 'AKTIF' : 'NON-AKTIF'}
            </button>
          </div>

          {enableLoyalty && (
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Jumlah Poin Per Rp 1.000 Belanja</label>
              <input
                id="settings-points-multiplier"
                type="number"
                step="0.0001"
                min="0.0001"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono"
                value={pointsPerRupiah}
                onChange={(e) => setPointsPerRupiah(parseFloat(e.target.value) || 0.001)}
              />
            </div>
          )}
        </div>

        {/* SECTION 5: SINKRONISASI SUPABASE CLOUD */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mt-2">
          <Cloud className="h-5 w-5 text-emerald-600" />
          <h3 className="font-extrabold text-slate-805 text-base">Sinkronisasi Database Cloud (Supabase)</h3>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Menghubungkan POS dengan database cloud online Supabase untuk mengamankan data transaksi agar tidak hilang saat browser dibersihkan, dan memungkinkan pemilik memantau laporan analitis real-time dari HP di luar toko.
          </p>

          <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Supabase Project URL</label>
              <input
                type="url"
                placeholder="https://your-project-id.supabase.co"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wide block mb-1">Supabase API Anon Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={checkingConnection}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs rounded-lg transition text-slate-650 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {checkingConnection ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    <span>Cek Koneksi Database</span>
                  </>
                )}
              </button>

              {/* Upload & Download sync operations */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePushToCloud}
                  disabled={syncingOut}
                  className="px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Push (Upload Semua)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={syncingIn}
                  className="px-3 py-2 bg-blue-50 border border-blue-250 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <DownloadCloud className="h-3.5 w-3.5" />
                  <span>Pull (Tarik Semua)</span>
                </button>
              </div>
            </div>

            {/* Connection result view */}
            {connectionStatus && (
              <div className={`p-3 rounded-lg text-xs font-bold leading-relaxed ${
                connectionStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {connectionStatus.message}
              </div>
            )}
          </div>

          {/* Interactive SQL section */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] border border-slate-800 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>SQL Schema Editor (Jalankan ini ke Supabase)</span>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-205 rounded transition flex items-center gap-1 cursor-pointer font-sans"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Salin Script SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto max-h-[120px] text-slate-350 pr-2 leading-relaxed">
{`CREATE TABLE products (
  id text primary key,
  name text not null,
  sku text not null,
  price numeric not null,
  cost_price numeric not null,
  stock integer not null,
  min_stock integer not null,
  category text not null,
  image text,
  color text not null
);`}
            </pre>
          </div>
        </div>

        {/* Submit Save Profile button */}
        <div className="flex gap-3 mt-4 border-t border-slate-100 pt-4 justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-1.5"
            id="settings-save-btn"
          >
            <Save className="h-4 w-4" />
            Simpan Semua Konfigurasi
          </button>
        </div>

      </form>

      {/* Danger Zone */}
      <div className="mt-8 bg-red-50/40 border border-red-150 rounded-xl p-5 text-left flex flex-col gap-3 mb-8">
        <h3 className="font-extrabold text-red-800 text-sm flex items-center gap-1.5 select-none">
          ⚠️ Danger Zone (Area Sensitif)
        </h3>
        <p className="text-xs text-slate-600">
          Penghapusan cache database akan mengosongkan seluruh riwayat penjualan saat ini, daftar pelanggan baru, produk kustom yang barusan ditambahkan, dan mengembalikan file program POS ke kondisi setup awal yang bersih secara lokal di browser.
        </p>
        <button
          onClick={handleReset}
          type="button"
          className="bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer self-start shadow-xs flex items-center gap-1.5"
          id="settings-reset-db-btn"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Database POS
        </button>
      </div>

    </div>
  );
}
