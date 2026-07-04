import { useMemo } from 'react';
import { 
  TrendingUp, ShoppingBag, Box, DollarSign, 
  AlertTriangle, Award, ShieldAlert, PieChart as PieIcon,
  Download, FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell 
} from 'recharts';
import { Order, Product } from '../types';
import { formatCurrency } from '../services/utils';

interface LaporanViewProps {
  orders: Order[];
  products: Product[];
}

export default function LaporanView({ orders, products }: LaporanViewProps) {
  
  // 1. Core financial metrics compilation
  const metrics = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let itemsCount = 0;

    orders.forEach((o) => {
      revenue += o.total;
      o.items.forEach((item) => {
        itemsCount += item.quantity;
        cost += (item.costPrice || 0) * item.quantity;
      });
    });

    const profit = Math.max(0, revenue - cost);
    const transCount = orders.length;
    const averageOrderValue = transCount > 0 ? Math.round(revenue / transCount) : 0;

    return {
      revenue,
      profit,
      itemsCount,
      transCount,
      averageOrderValue,
    };
  }, [orders]);

  // 2. Critical Stock Shortages (Under Low-Stock limits)
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= (p.minStock || 5));
  }, [products]);

  // 3. Top-selling products listing (Ranked)
  const topProducts = useMemo(() => {
    const counts: { [id: string]: { name: string; sku: string; qty: number; value: number } } = {};

    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!counts[item.productId]) {
          counts[item.productId] = {
            name: item.productName,
            sku: '',
            qty: 0,
            value: 0,
          };
        }
        counts[item.productId].qty += item.quantity;
        counts[item.productId].value += item.subtotal;
      });
    });

    // Populate SKU from current products list
    Object.keys(counts).forEach((id) => {
      const p = products.find((prod) => prod.id === id);
      if (p) counts[id].sku = p.sku;
    });

    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5); // top 5
  }, [orders, products]);

  // 4. Charting Data Pipeline: Daily Revenue (Last 7 days)
  const dailyChartData = useMemo(() => {
    if (orders.length === 0) return [];

    const map: { [dateStr: string]: { date: string; revenue: number; transactions: number } } = {};
    
    // Generate dates for the last 7 calendar days to ensure complete representation
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const localKey = `${yr}-${mo}-${dy}`;
      
      map[localKey] = {
        date: dateStr,
        revenue: 0,
        transactions: 0,
      };
    }

    orders.forEach((o) => {
      const d = new Date(o.timestamp);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const key = `${yr}-${mo}-${dy}`;
      
      if (map[key]) {
        map[key].revenue += o.total;
        map[key].transactions += 1;
      }
    });

    return Object.keys(map)
      .sort()
      .map((key) => ({
        name: map[key].date,
        'Pendapatan (Rp)': map[key].revenue,
        'Transaksi': map[key].transactions,
      }));
  }, [orders]);

  // 5. Charting Data Pipeline: Category revenue contributions
  const categoryChartData = useMemo(() => {
    const contributions: { [cat: string]: number } = {};

    orders.forEach((o) => {
      o.items.forEach((item) => {
        // Fetch category
        const p = products.find((prod) => prod.id === item.productId);
        const cat = p ? p.category : 'Lainnya';
        contributions[cat] = (contributions[cat] || 0) + item.subtotal;
      });
    });

    const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    return Object.keys(contributions).map((cat, idx) => ({
      name: cat,
      'Penjualan (Rp)': contributions[cat],
      color: COLORS[idx % COLORS.length],
    }));
  }, [orders, products]);

  // 6. Charting Data Pipeline: Monthly Profit Trend (Last 12 Months)
  const monthlyProfitData = useMemo(() => {
    if (orders.length === 0) return [];

    const map: { [monthKey: string]: { monthName: string; revenue: number; cost: number } } = {};
    const monthsLocale = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const label = `${monthsLocale[monthIdx]} ${String(year).slice(-2)}`;
      map[monthKey] = {
        monthName: label,
        revenue: 0,
        cost: 0,
      };
    }

    orders.forEach((o) => {
      const d = new Date(o.timestamp);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dateParts = `${yr}-${mo}`;
      
      if (map[dateParts]) {
        let orderCost = 0;
        o.items.forEach((item) => {
          orderCost += (item.costPrice || 0) * item.quantity;
        });
        map[dateParts].revenue += o.total;
        map[dateParts].cost += orderCost;
      }
    });

    return Object.keys(map)
      .sort()
      .map((key) => {
        const item = map[key];
        const profit = Math.max(0, item.revenue - item.cost);
        return {
          name: item.monthName,
          'Pendapatan': item.revenue,
          'Profit': profit,
        };
      });
  }, [orders]);

  // Export Transactions data to CSV
  const handleExportCSV = () => {
    if (orders.length === 0) return;

    // CSV Headers
    const headers = [
      'No. Struk',
      'Waktu',
      'Nama Pelanggan',
      'Metode Pembayaran',
      'Jumlah Item',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'Pajak (Rp)',
      'Total Akhir (Rp)',
      'Daftar Barang'
    ];

    // CSV Rows
    const rows = orders.map((o) => {
      const dateStr = new Date(o.timestamp).toLocaleString('id-ID');
      const itemsDetail = o.items
        .map((it) => `${it.productName} (${it.quantity}x)`)
        .join('; ');
      
      const totalItems = o.items.reduce((acc, current) => acc + current.quantity, 0);

      return [
        o.receiptNumber,
        `"${dateStr}"`,
        `"${o.customerName || 'Cust Biasa'}"`,
        o.paymentMethod,
        totalItems,
        o.subtotal,
        o.discountAmount || 0,
        o.taxAmount,
        o.total,
        `"${itemsDetail}"`
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(','))
    ].join('\n');

    // Create custom download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (orders.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white border border-slate-100 rounded-2xl p-10 text-center shadow-xs">
        <TrendingUp className="h-12 w-12 text-slate-300 mb-2 animate-bounce" />
        <h3 className="text-base font-bold text-slate-700">Tidak ada data untuk laporan</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Laporan kinerjanya akan terhitung setelah Anda memproses sekurangnya satu penjualan baru di menu <strong>Kasir</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      
      {/* EXPORT ACTION TOOLBAR */}
      <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-left">
          <h3 className="font-extrabold text-slate-805 text-sm">Unduh & Ekspor Laporan</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Ekspor semua log transaksi mentah ke dalam berkas standar tabel .csv format.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Ekspor Lap. Penjualan (.CSV)</span>
        </button>
      </div>

      {/* 1. TOPMETRIC BLOCKS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="text-left min-w-0">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">PENDAPATAN KOTOR</span>
            <span className="text-sm md:text-base font-black font-mono text-slate-800 tracking-tight leading-tight block mt-0.5">
              {formatCurrency(metrics.revenue)}
            </span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-left min-w-0">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">LABA KOTOR (EST.)</span>
            <span className="text-sm md:text-base font-black font-mono text-slate-800 tracking-tight leading-tight block mt-0.5">
              {formatCurrency(metrics.profit)}
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="text-left min-w-0">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">TOTAL TRANSAKSI</span>
            <span className="text-sm md:text-base font-black font-mono text-slate-800 tracking-tight leading-tight block mt-0.5">
              {metrics.transCount} Transaksi
            </span>
          </div>
        </div>

        {/* Items Sold */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Box className="h-5 w-5" />
          </div>
          <div className="text-left min-w-0">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">BARANG TERJUAL</span>
            <span className="text-sm md:text-base font-black font-mono text-slate-800 tracking-tight leading-tight block mt-0.5">
              {metrics.itemsCount} Unit Item
            </span>
          </div>
        </div>
      </div>

      {/* 2. ANAYTICAL GRAPHICS AND CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* BAR CHART: Daily Sales progression (Colspan 2) */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex flex-col lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-4 text-left">
            <ShoppingBag className="h-4.5 w-4.5 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-sm">Grafik Batang Penjualan Harian (7 Hari Terakhir)</h4>
          </div>
          <div className="h-64 w-full text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis 
                  stroke="#94a3b8" 
                  tickFormatter={(val) => `Rp ${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : val >= 1000 ? `${Math.round(val / 1000)}Rb` : val}`}
                />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Pendapatan']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}
                />
                <Bar dataKey="Pendapatan (Rp)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BAR CHART: Category Revenue Contributions */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex flex-col">
          <div className="flex items-center gap-1.5 mb-4 text-left">
            <PieIcon className="h-4.5 w-4.5 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">Penjualan per Kategori</h4>
          </div>
          <div className="h-64 w-full text-xs font-mono">
            {categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">Tidak ada kategori tercatat</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Total Penjualan']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="Penjualan (Rp)" radius={[6, 6, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 MONTHLY PROFIT AND FINANCIAL HEALTH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AREA GRAPH: Monthly Profit Trend (Colspan 2) */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex flex-col lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-4 text-left">
            <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">Tren Profit Bulanan (12 Bulan Terakhir)</h4>
          </div>
          <div className="h-64 w-full text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyProfitData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis 
                  stroke="#94a3b8" 
                  tickFormatter={(val) => `Rp ${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : val >= 1000 ? `${Math.round(val / 1000)}Rb` : val}`}
                />
                <Tooltip 
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" name="Profit" dataKey="Profit" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                <Area type="monotone" name="Pendapatan" dataKey="Pendapatan" stroke="#10B981" strokeWidth={1.5} fillOpacity={0.05} fill="none" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FINANCIAL RATIOS AND INSIGHTS WIDGET */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs flex flex-col text-left">
          <div className="flex items-center gap-1.5 mb-4">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-sm">Rasio Kesehatan Finansial</h4>
          </div>
          <div className="flex-1 flex flex-col gap-4 justify-center">
            {/* Profit Margin */}
            <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide block">Rasio Margin Laba</span>
                <span className="text-xl font-black text-indigo-700 font-mono mt-1 block">
                  {metrics.revenue > 0 ? `${((metrics.profit / metrics.revenue) * 100).toFixed(1)}%` : '0.0%'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 pb-0.5 leading-relaxed font-semibold">
                Persentase dari setiap Rupiah yang menjadi keuntungan bersih setelah dikurangi modal pokok barang.
              </p>
            </div>

            {/* Average Order Value (AOV) */}
            <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide block">Rata-Rata per Transaksi (AOV)</span>
                <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                  {formatCurrency(metrics.averageOrderValue)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 pb-0.5 leading-relaxed font-semibold">
                Rata-rata volume belanjaan yang dihabiskan oleh pelanggan per struk belanja di toko.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. LOWER SPLITS: Top Products, Stock warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* RANK LIST: Top Sales Products */}
        <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-4 flex flex-col text-left">
          <div className="flex items-center gap-2 mb-3.5">
            <Award className="h-4.5 w-4.5 text-amber-500" />
            <h4 className="font-extrabold text-slate-800 text-sm">Produk Terlaris (Top 5)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase tracking-widest text-[9.5px]">
                  <th className="p-2.5 w-10 text-center">Rank</th>
                  <th className="p-2.5 text-left">Nama Produk</th>
                  <th className="p-2.5 text-center">Jml Terjual</th>
                  <th className="p-2.5 text-right">Nilai Rupiah</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">Belum ada volume produk terlaris</td>
                  </tr>
                ) : (
                  topProducts.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/40 font-medium">
                      <td className="p-3 text-center">
                        <span className={`inline-flex h-5 w-5 rounded-full items-center justify-center font-bold font-mono text-[10px] ${
                          idx === 0 ? 'bg-amber-100 text-amber-800' 
                          : idx === 1 ? 'bg-slate-205 text-slate-800'
                          : idx === 2 ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-700">{p.name}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-850">{p.qty} pcs</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ALERTS PANEL: Low stock alert */}
        <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-4 flex flex-col text-left">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-red-500 animate-pulse" />
              <h4 className="font-extrabold text-slate-800 text-sm">Peringatan Ketersediaan Stok</h4>
            </div>
            <span className="text-[10px] bg-red-105 border border-red-200 text-red-700 font-bold px-2 py-0.5 rounded-full">
              {lowStockProducts.length} Produk Butuh Restock
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[190px] flex flex-col gap-2.5">
            {lowStockProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
                <p className="font-semibold text-emerald-700">✓ Stok Aman!</p>
                <p className="text-[10px] text-slate-400 mt-1">Seluruh produk ketersediaannya di atas batas minimal alert.</p>
              </div>
            ) : (
              lowStockProducts.map((p) => {
                const isOut = p.stock <= 0;
                return (
                  <div 
                    key={p.id} 
                    className={`flex items-center justify-between p-3.5 rounded-lg border text-xs font-semibold ${
                      isOut 
                        ? 'bg-red-50/55 border-red-150 text-red-800' 
                        : 'bg-amber-50/40 border-amber-150 text-amber-800'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-[9.5px] text-slate-500 font-mono tracking-wide mt-0.5">SKU: {p.sku} — Batas minimum: {p.minStock || 5}</span>
                    </div>
                    <div className="text-right">
                      {isOut ? (
                        <span className="text-[10px] bg-red-650 text-white font-bold px-2.5 py-1 rounded-md tracking-wider">HABIS</span>
                      ) : (
                        <span className="font-mono text-sm font-black whitespace-nowrap">
                          REKT: {p.stock} Unit
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
