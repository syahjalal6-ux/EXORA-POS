import { useState, useEffect } from 'react';
import { ShieldCheck, User, Eye, EyeOff, Store, Clock, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoreSettings, UserSession } from '../types';

interface LockScreenProps {
  settings: StoreSettings;
  onLoginSuccess: (session: UserSession) => void;
}

export default function LockScreen({ settings, onLoginSuccess }: LockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [shake, setShake] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ownerPin = settings.ownerPin || '1234';
  const kasirPin = settings.kasirPin || '0000';

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setErrorMsg('');
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleSubmit = (currentPin = pin) => {
    if (currentPin === ownerPin) {
      onLoginSuccess({
        role: 'OWNER',
        name: 'Pemilik Toko (Owner)',
        loggedInAt: new Date().toISOString()
      });
    } else if (currentPin === kasirPin) {
      onLoginSuccess({
        role: 'KASIR',
        name: 'Staff Kasir',
        loggedInAt: new Date().toISOString()
      });
    } else {
      // Trigger shake animation
      setShake(true);
      setErrorMsg('PIN salah! Silakan coba lagi.');
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  // Auto submit when PIN reaches length of owner or kasir pin (usually 4 digits)
  useEffect(() => {
    if (pin.length === 4) {
      // Auto submit 4 digit PIN
      const timer = setTimeout(() => {
        handleSubmit(pin);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  const numpadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'C', '0', '⌫'
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-slate-950 text-white font-sans overflow-hidden">
      
      {/* LEFT SIDE: Decorative Brand Banner */}
      <div className="flex-1 hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 relative overflow-hidden">
        {/* Background atmospheric shapes */}
        <div className="absolute -top-1/4 -left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl"></div>
        
        {/* Top bar */}
        <div className="flex items-center gap-3 z-10">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
            E
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-widest uppercase text-emerald-400">Exora POS</h1>
            <p className="text-xs text-slate-400 font-medium">{settings.storeName}</p>
          </div>
        </div>

        {/* Middle text */}
        <div className="z-10 max-w-md my-auto">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
            Sistem Multi-Kasir Terintegrasi
          </span>
          <h2 className="text-3xl font-black mt-4 tracking-tight leading-tight text-white">
            Kelola Transaksi Toko Lebih Aman & Terpantau
          </h2>
          <p className="text-slate-450 text-xs mt-3 leading-relaxed">
            Data penjualan otomatis disinkronkan ke Cloud Supabase secara real-time. Lindungi data keuangan Anda dari penghapusan browser dengan otorisasi hak akses bertingkat.
          </p>
        </div>

        {/* Bottom clock */}
        <div className="z-10 flex items-center justify-between border-t border-slate-800/60 pt-6">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span className="font-mono text-sm tracking-wider font-semibold">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* RIGHT SIDE: Numerical PIN pad login */}
      <div className="w-full md:w-[480px] bg-slate-900 border-l border-slate-800/50 flex flex-col justify-center items-center p-6 md:p-8 relative">
        {/* Mobile top logo */}
        <div className="md:hidden flex flex-col items-center gap-2 mb-8 mt-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-2xl shadow-xl">
            E
          </div>
          <h1 className="font-black text-lg tracking-tight">{settings.storeName}</h1>
        </div>

        <motion.div 
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xs flex flex-col items-center"
        >
          {/* Padlock / User icon indicator */}
          <div className="h-16 w-16 rounded-3xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-emerald-400 shadow-inner mb-4 relative">
            <Lock className="h-6 w-6 text-emerald-500" />
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-slate-950 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>

          <p className="text-sm font-bold text-slate-300">Masukkan PIN Operator</p>
          <p className="text-[10.5px] text-slate-500 mt-1">Default PIN: Owner <span className="font-bold text-emerald-500">1234</span> | Kasir <span className="font-bold text-emerald-500">0000</span></p>

          {/* Dots Indicator */}
          <div className="flex gap-4 h-6 items-center my-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <span 
                key={i} 
                className={`h-3 w-3 rounded-full transition-all duration-150 border ${
                  i < pin.length 
                    ? 'bg-emerald-500 border-emerald-400 scale-125 shadow-sm shadow-emerald-500/50' 
                    : 'bg-slate-800 border-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Animated error block */}
          <div className="h-5 text-center">
            {errorMsg && (
              <p className="text-red-400 text-xs font-semibold tracking-wide animate-bounce">
                {errorMsg}
              </p>
            )}
          </div>

          {/* PIN-Pad Buttons Grid */}
          <div className="grid grid-cols-3 gap-3 w-full mt-6">
            {numpadButtons.map((btn, index) => {
              const isSpecial = btn === 'C' || btn === '⌫';
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (btn === 'C') handleClear();
                    else if (btn === '⌫') handleBackspace();
                    else handleKeyPress(btn);
                  }}
                  className={`h-14 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs active:scale-95 transition cursor-pointer select-none border ${
                    isSpecial 
                      ? 'bg-slate-800/40 text-slate-400 border-slate-800/80 hover:bg-slate-850'
                      : 'bg-slate-800 text-white hover:bg-slate-705 border-slate-700/55'
                  }`}
                >
                  {btn}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* App Meta footer for mobile */}
        <div className="mt-8 text-center md:absolute md:bottom-6 text-[10px] text-slate-600 font-medium">
          Exora POS • Secure Lockscreen
        </div>

      </div>
    </div>
  );
}
