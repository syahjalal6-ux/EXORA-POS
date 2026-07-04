import { useState, useMemo } from 'react';
import { 
  Search, Calendar, Printer, Trash2, Tag, 
  ShoppingBag, HelpCircle, X, ChevronRight, Eye 
} from 'lucide-react';
import { Order, StoreSettings } from '../types';
import { formatCurrency, formatDateTime } from '../services/utils';

interface RiwayatViewProps {
  orders: Order[];
  settings: StoreSettings;
  onRefreshOrders: () => void;
  onRefreshProducts: () => void;
}

export default function RiwayatView({
  orders,
  settings,
  onRefreshOrders,
  onRefreshProducts,
}: RiwayatViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Semua');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = o.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (o.notes && o.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchMethod = selectedMethod === 'Semua' || o.paymentMethod === selectedMethod;
      return matchSearch && matchMethod;
    });
  }, [orders, searchQuery, selectedMethod]);

  // Aggregate stats (quick summary)
  const stats = useMemo(() => {
    const totalTransactions = filteredOrders.length;
    const totalAmount = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const averageBasket = totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0;
    
    // Payment method distribution
    const payments = {
      CASH: 0,
      QRIS: 0,
      CARD: 0,
    };
    filteredOrders.forEach((o) => {
      if (o.paymentMethod === 'CASH') payments.CASH += o.total;
      else if (o.paymentMethod === 'QRIS') payments.QRIS += o.total;
      else payments.CARD += o.total;
    });

    return {
      totalTransactions,
      totalAmount,
      averageBasket,
      payments,
    };
  }, [filteredOrders]);

  // Void/Cancel Transaction (Returns product stocks!)
  const handleVoidOrder = async (orderId: string, receiptNum: string) => {
    const confirmVoid = confirm(
      `Apakah Anda yakin ingin membatalkan transaksi ${receiptNum}?\nStok barang yang terjual akan dikembalikan ke inventaris.`
    );
    if (!confirmVoid) return;

    try {
      const { DB } = await import('../services/db');
      const products = DB.getProducts();
      const currentOrders = DB.getOrders();
      const orderToVoid = currentOrders.find((o) => o.id === orderId);

      if (orderToVoid) {
        // 1. Replenish stock
        orderToVoid.items.forEach((item) => {
          const pIndex = products.findIndex((p) => p.id === item.productId);
          if (pIndex !== -1) {
            products[pIndex].stock += item.quantity;
          }
        });
        DB.saveProducts(products);

        // 2. Reduce Customer Loyalty Points if applicable
        if (orderToVoid.customerId && orderToVoid.pointsEarnedValue) {
          const customers = DB.getCustomers();
          const cIndex = customers.findIndex((c) => c.id === orderToVoid.customerId);
          if (cIndex !== -1) {
            customers[cIndex].points = Math.max(0, customers[cIndex].points - orderToVoid.pointsEarnedValue);
            DB.saveCustomers(customers);
          }
        }

        // 3. Remove order
        const leftoverOrders = currentOrders.filter((o) => o.id !== orderId);
        DB.saveOrders(leftoverOrders);

        setSelectedOrder(null);
        onRefreshOrders();
        onRefreshProducts();
        alert('Transaksi berhasil dibatalkan dan stok dikembalikan.');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal membatalkan transaksi.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-5">
      {/* List content panel */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Statistics Blocks */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penjualan Terfilter</span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1">{formatCurrency(stats.totalAmount)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{stats.totalTransactions} Transaksi selesai</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rerata Keranjang (AOV)</span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1">{formatCurrency(stats.averageBasket)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Nilai transaksi rata-rata</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Distribusi Pembayaran</span>
            <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-slate-500 font-mono">
              <div className="flex justify-between">
                <span>Tunai:</span> <span className="font-bold">{formatCurrency(stats.payments.CASH)}</span>
              </div>
              <div className="flex justify-between">
                <span>Digital/QRIS:</span> <span className="font-bold">{formatCurrency(stats.payments.QRIS)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Top Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="history-receipt-search"
              type="text"
              placeholder="Cari struk, pelanggan, catatan..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-500 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Payment Method filter tabs */}
          <div className="flex gap-1.5 self-end sm:self-auto overflow-x-auto w-full sm:w-auto no-scrollbar">
            {['Semua', 'CASH', 'QRIS', 'DEBIT_CREDIT', 'E_WALLET'].map((m) => {
              const label = m === 'Semua' ? 'Semua Metode' : m === 'DEBIT_CREDIT' ? 'KARTU' : m === 'CASH' ? 'TUNAI' : m;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap cursor-pointer ${
                    selectedMethod === m
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders Table Log */}
        <div className="bg-white rounded-xl border border-slate-150 overflow-hidden flex-1 shadow-xs flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider select-none text-[10px]">
                  <th className="p-4 w-12 text-center">No</th>
                  <th className="p-4 text-left">Nomor Struk</th>
                  <th className="p-4">Waktu Transaksi</th>
                  <th className="p-4">Pelanggan</th>
                  <th className="p-4 text-center">Metode</th>
                  <th className="p-4 text-right">Total Tagihan</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-12 text-slate-400">
                      <div className="flex flex-col items-center">
                        <ShoppingBag className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-500">Belum ada transaksi</p>
                        <p className="text-[10px] text-slate-400 mt-1">Transaksi yang anda lakukan di kasir akan muncul disini.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, idx) => {
                    const isSelected = selectedOrder?.id === o.id;
                    return (
                      <tr 
                        key={o.id} 
                        className={`border-b border-slate-100 hover:bg-slate-50/50 transition cursor-pointer font-medium text-slate-700 ${
                          isSelected ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => setSelectedOrder(o)}
                        id={`history-row-${o.id}`}
                      >
                        <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 font-mono text-[13px]">{o.receiptNumber}</span>
                            {o.notes && (
                              <span className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">Memo: {o.notes}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-slate-500">{formatDateTime(o.timestamp)}</td>
                        <td className="p-4">
                          {o.customerName ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                              ★ {o.customerName}
                            </span>
                          ) : (
                            <span className="text-slate-400">Pelanggan Umum</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                            o.paymentMethod === 'CASH' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : o.paymentMethod === 'QRIS'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {o.paymentMethod}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black font-mono text-slate-800 text-sm">
                          {formatCurrency(o.total)}
                        </td>
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedOrder(o)}
                              className="p-1 px-2 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 hover:border-emerald-250 transition flex items-center gap-0.5 cursor-pointer text-[10px]"
                              title="Lihat Struk"
                              id={`history-view-btn-${o.id}`}
                            >
                              <Eye className="h-3 w-3" /> Detail
                            </button>
                            <button
                              onClick={() => handleVoidOrder(o.id, o.receiptNumber)}
                              className="p-1.5 border border-slate-200/80 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition cursor-pointer"
                              title="Batalkan Transaksi (Void)"
                              id={`history-void-btn-${o.id}`}
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
      </div>

      {/* DETAIL DRAWER: Printed invoice visual preview */}
      <div 
        className="w-full lg:w-80 bg-white border border-slate-150 rounded-xl shadow-xs overflow-hidden flex flex-col bg-slate-50/10 min-h-[300px]"
        id="history-receipt-drawer"
      >
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-sm">Struk Digital</span>
          {selectedOrder && (
            <button
              onClick={() => setSelectedOrder(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {selectedOrder ? (
          <div className="flex-1 flex flex-col justify-between p-4 bg-white/70 overflow-y-auto">
            
            {/* Embedded invoice sheet */}
            <div id="thermal-receipt-slip" className="bg-white border text-center border-slate-300 rounded-xl p-4 font-mono text-[10.5px] text-slate-800 shadow-xs relative">
              
              {/* Jagged top */}
              <div className="absolute top-0 inset-x-0 h-1 bg-repeat-x flex justify-between overflow-hidden opacity-10">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="h-2 w-2 bg-slate-850 rotate-45 transform -translate-y-1"></div>
                ))}
              </div>

              <h4 className="font-extrabold text-[11.5px] uppercase tracking-wider mb-0.5">{settings.storeName}</h4>
              <p className="text-[8.5px] text-slate-500 leading-tight mb-0.5">{settings.address}</p>
              <p className="text-[9px] text-slate-500">Telp: {settings.phone}</p>
              
              <div className="border-t border-dashed border-slate-300 my-2"></div>
              
              <div className="text-left flex flex-col gap-0.5 text-[9px] text-slate-605">
                <div className="flex justify-between">
                  <span>No: {selectedOrder.receiptNumber}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Tgl: {new Date(selectedOrder.timestamp).toLocaleString('id-ID')}</span>
                </div>
                {selectedOrder.customerName && (
                  <div className="flex justify-between font-bold text-slate-800 mt-0.5">
                    <span>Pelanggan: {selectedOrder.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium">
                  <span>Metode: {selectedOrder.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {/* Order items inside drawer */}
              <div className="flex flex-col gap-1.5 text-left text-[9.5px]">
                {selectedOrder.items.map((it, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-800 line-clamp-1">{it.productName}</span>
                      <span className="font-semibold text-slate-900 font-mono">{formatCurrency(it.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 pl-1 font-medium">
                      <span>{it.quantity} x {formatCurrency(it.price)}</span>
                      {it.discountPercentage > 0 && (
                        <span className="text-amber-600 font-bold">Disc {it.discountPercentage}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {/* Pricing breakdown */}
              <div className="flex flex-col gap-0.5 text-right text-[9.5px] pl-5 font-mono text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-600 font-semibold font-mono">
                    <span>Disc Global:</span>
                    <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>PPN ({settings.taxRate}%):</span>
                  <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 mt-1 pt-1 text-[11px]">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>

                {selectedOrder.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between text-[8.5px] text-slate-400 mt-1.5 font-medium">
                      <span>Tunai Diterima:</span>
                      <span>{formatCurrency(selectedOrder.cashAmountPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[8.5px] text-slate-400 font-medium">
                      <span>Kembali:</span>
                      <span>{formatCurrency(selectedOrder.changeAmount || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-dashed border-slate-300 my-2"></div>

              {selectedOrder.pointsEarnedValue && (
                <p className="text-[9px] font-bold text-emerald-800 mb-1 flex items-center justify-center gap-1.5">
                  ★ Poin Loyalty didapat: +{selectedOrder.pointsEarnedValue}
                </p>
              )}

              {selectedOrder.notes && (
                <div className="text-left bg-slate-50 p-1 border rounded text-[8.5px] text-slate-500 mb-1">
                  <span className="font-bold">Memo:</span> {selectedOrder.notes}
                </div>
              )}

              <p className="text-[9px] text-slate-500 font-semibold mt-3">{settings.receiptFooterMessage}</p>
            </div>

            {/* Reprint action trigger */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Ulang
              </button>
            </div>
            
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <HelpCircle className="h-8 w-8 text-slate-300 mb-1" />
            <p className="text-xs font-semibold">Pilih Transaksi</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Ketuk detail baris transaksi untuk menampilkan visual struk belanja lengkap di sini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
