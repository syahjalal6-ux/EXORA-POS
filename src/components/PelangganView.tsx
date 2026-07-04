import { useState, useMemo, FormEvent } from 'react';
import { 
  Users, Search, UserPlus, Phone, Mail, Trash2, Calendar, 
  Award, Star, X, Sparkles, TrendingUp, NotebookTabs
} from 'lucide-react';
import { Customer, Order } from '../types';
import { formatDateTime, getInitials } from '../services/utils';

interface PelangganViewProps {
  customers: Customer[];
  orders: Order[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'points' | 'createdAt'>) => void;
  onDeleteCustomer: (id: string) => void;
}

export default function PelangganView({
  customers,
  orders,
  onAddCustomer,
  onDeleteCustomer,
}: PelangganViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // 1. Filtered customers lists
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.phone.includes(searchQuery) ||
                          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [customers, searchQuery]);

  // 2. Statistical parameters
  const stats = useMemo(() => {
    const totalCount = customers.length;
    const totalPoints = customers.reduce((sum, c) => sum + c.points, 0);
    
    // Find customer with high points (Top Customer)
    let topLoyaltyCustomer: Customer | null = null;
    if (customers.length > 0) {
      topLoyaltyCustomer = [...customers].sort((a, b) => b.points - a.points)[0];
    }

    return {
      totalCount,
      totalPoints,
      topLoyaltyCustomer,
    };
  }, [customers]);

  // Save new customer
  const handleSaveCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      alert('Nama dan No Telepon tidak boleh kosong.');
      return;
    }

    onAddCustomer({
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || undefined,
    });

    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setIsModalOpen(false);
  };

  // Delete customer
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pelanggan "${name}" dari sistem loyalty?`)) {
      onDeleteCustomer(id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/20">
      
      {/* Upper overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Total Customers */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">DATABASE PELANGGAN</span>
            <span className="text-lg font-black font-mono text-slate-800 block mt-0.5">{stats.totalCount} Orang</span>
          </div>
        </div>

        {/* Total Loyalty point values */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-indigo-500 fill-indigo-500 animate-pulse" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">TOTAL DISTRIBUSI POIN</span>
            <span className="text-lg font-black font-mono text-slate-800 block mt-0.5">{stats.totalPoints} Poin</span>
          </div>
        </div>

        {/* Top VIP customer card */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">PELANGGAN TERPASIF (VIP)</span>
            <span className="text-sm font-extrabold text-slate-850 truncate block mt-0.5">
              {stats.topLoyaltyCustomer ? stats.topLoyaltyCustomer.name : 'Belum Ada'}
            </span>
            {stats.topLoyaltyCustomer && (
              <span className="text-[10px] font-bold text-amber-600 block mt-0.5 font-mono">{stats.topLoyaltyCustomer.points} Poin</span>
            )}
          </div>
        </div>
      </div>

      {/* Action controls / search */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-xs mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="customer-search-input"
              type="text"
              placeholder="Cari berdasarkan nama, telepon, email..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-500 bg-white focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer max-w-max"
            id="register-customer-btn"
          >
            <UserPlus className="h-4 w-4" />
            Daftarkan Pelanggan
          </button>
        </div>
      </div>

      {/* Database tabular listings */}
      <div className="bg-white rounded-xl border border-slate-150 overflow-hidden flex-1 shadow-xs flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider select-none text-[9.5px]">
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4">Customer Profil</th>
                <th className="p-4">No. Handphone (WhatsApp)</th>
                <th className="p-4">Alamat Email</th>
                <th className="p-4">Poin Loyalitas</th>
                <th className="p-4">Tanggal Registrasi</th>
                <th className="p-4 text-center">Aksi / Kontrol</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12 text-slate-400">
                    <div className="flex flex-col items-center">
                      <NotebookTabs className="h-8 w-8 text-slate-350 mb-2" />
                      <p className="font-semibold text-slate-500 font-mono text-sm">Tidak ada pelanggan terdaftar</p>
                      <p className="text-[10px] mt-1 text-slate-400">Daftarkan pelanggan baru untuk melacak poin belanja loyalty.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  return (
                    <tr 
                      key={c.id} 
                      className="border-b border-slate-100 hover:bg-slate-50/40 transition font-medium text-slate-700"
                      id={`customer-row-${c.id}`}
                    >
                      <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-800 font-black flex items-center justify-center font-mono border border-emerald-100">
                            {getInitials(c.name)}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <span className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.phone}
                        </span>
                      </td>
                      <td className="p-4 font-mono">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-slate-350 italic">Tidak ada email</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-800 font-bold font-mono text-xs rounded border border-yellow-200">
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          {c.points} Poin
                        </div>
                      </td>
                      <td className="p-4 text-slate-500">{formatDateTime(c.createdAt)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition"
                          title="Hapus Pelanggan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-left border border-slate-200">
            
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-850 text-base">Registrasi Pelanggan Baru</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 flex flex-col gap-4 text-slate-705">
              {/* Customer Name */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wide block mb-1">Nama Lengkap *</label>
                <input
                  id="form-customer-name"
                  type="text"
                  placeholder="Contoh: Muhammad Ali"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={48}
                  required
                />
              </div>

              {/* Customer Phone (WA) */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wide block mb-1">Nomor Handphone / WA *</label>
                <input
                  id="form-customer-phone"
                  type="tel"
                  placeholder="Contoh: 0812XXXXXXXX"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value.replace(/[^0-9]/g, ''))} // digit filter
                  maxLength={16}
                  required
                />
              </div>

              {/* Customer Email */}
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wide block mb-1">Alamat Email (Opsional)</label>
                <input
                  id="form-customer-email"
                  type="email"
                  placeholder="Contoh: ali@gmail.com"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  maxLength={64}
                />
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
                  className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-xs hover:shadow-md transition cursor-pointer"
                  id="save-customer-modal-btn"
                >
                  Daftarkan Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
