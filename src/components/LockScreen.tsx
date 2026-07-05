import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, User, Lock, AlertCircle } from 'lucide-react';

const LockScreen = ({ onUnlock }: { onUnlock: (role: 'owner' | 'cashier') => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = () => {
    // Default PINs (Hardcoded for demo, should be managed securely in real app)
    if (pin === '1234') {
      onUnlock('owner');
    } else if (pin === '0000') {
      onUnlock('cashier');
    } else {
      setError(true);
      setTimeout(() => setPin(''), 500);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        
        {/* Left Side: Time & Date */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-white text-center md:text-left space-y-4"
        >
          <div className="flex items-center justify-center md:justify-start gap-3 text-emerald-400 mb-2">
            <Clock size={32} />
            <span className="text-lg font-medium tracking-wide">Exora POS</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
            {formatTime(currentTime)}
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 font-light">
            {formatDate(currentTime)}
          </p>
          <div className="pt-8 text-slate-500 text-sm">
            <p>Sistem Point of Sale Terintegrasi</p>
            <p>Aman & Terpercaya</p>
          </div>
        </motion.div>

        {/* Right Side: PIN Pad */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Keamanan Sistem</h2>
            <p className="text-slate-400">Silakan masukkan PIN akses Anda</p>
          </div>

          {/* PIN Display */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((index) => (
              <motion.div
                key={index}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: pin.length > index ? 1 : 0.8, 
                  opacity: pin.length > index ? 1 : 0.5,
                  backgroundColor: error ? '#ef4444' : (pin.length > index ? '#10b981' : '#334155')
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-4 h-4 rounded-full"
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 text-red-400 mb-6 text-sm"
              >
                <AlertCircle size={16} />
                <span>PIN salah. Silakan coba lagi.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <motion.button
                key={num}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNumberClick(num.toString())}
                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl font-medium transition-colors flex items-center justify-center"
              >
                {num}
              </motion.button>
            ))}
            <div className="flex items-center justify-center">
              <span className="text-slate-600 text-xs">Secure Login</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNumberClick('0')}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-2xl font-medium transition-colors flex items-center justify-center"
            >
              0
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackspace}
              className="h-16 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={pin.length !== 4}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <User size={20} />
            Masuk Sistem
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default LockScreen;
