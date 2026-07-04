import { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { StoreSettings } from '../types';

interface OwnerVerifyGateProps {
  settings: StoreSettings;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function OwnerVerifyGate({ settings, onSuccess, onCancel }: OwnerVerifyGateProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);

  const ownerPin = settings.ownerPin || '1234';

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setErrorMsg('');
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === ownerPin) {
        onSuccess();
      } else {
        setShake(true);
        setErrorMsg('PIN Owner Salah!');
        setPin('');
        setTimeout(() => setShake(false), 500);
      }
    }
  }, [pin]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Batal', '0', '⌫'];

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-xl p-6 text-center"
      >
        <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <h3 className="font-extrabold text-slate-805 text-base">Otorisasi Owner Diperlukan</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed px-4">
          Halaman ini terkunci untuk Staff Kasir. Masukkan PIN Owner untuk mengakses halaman ini sementara.
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-4 justify-center my-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <span 
              key={i} 
              className={`h-3.5 w-3.5 rounded-full transition-all duration-150 border-2 ${
                i < pin.length 
                  ? 'bg-amber-500 border-amber-400 scale-110 shadow-sm' 
                  : 'bg-slate-100 border-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        <div className="h-4 text-center text-xs font-bold text-red-500 mb-4">
          {errorMsg}
        </div>

        {/* Compact PIN Board */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {keys.map((k, i) => {
            const isBack = k === '⌫';
            const isCancel = k === 'Batal';
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (isCancel) onCancel();
                  else if (isBack) handleBackspace();
                  else handleKeyPress(k);
                }}
                className={`py-3.5 rounded-xl font-bold text-xs cursor-pointer select-none transition border active:scale-95 ${
                  isCancel 
                    ? 'bg-slate-100 text-slate-500 border-slate-150 hover:bg-slate-200'
                    : isBack 
                    ? 'bg-slate-100 text-slate-500 border-slate-150 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-800 border-slate-150 hover:bg-slate-100/80 font-mono text-sm'
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
