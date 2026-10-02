import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../services/api';

interface PinPadProps {
  onUnlock: () => void;
}

export const PinPad: React.FC<PinPadProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const settings = await api.getSettings();
      const validPin = settings.security_pin || '1234';
      if (pin === validPin) {
        onUnlock();
      } else {
        setError(true);
        setPin('');
      }
    } catch (e) {
      console.error(e);
      setError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 4 digits are entered
  React.useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100] select-none">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full">
        <Lock className="w-12 h-12 text-slate-400 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Ingresar PIN</h2>
        <p className="text-slate-400 text-sm mb-6 text-center">Ingresa tu PIN de acceso de 4 dígitos para continuar.</p>

        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-colors ${
                pin.length > i ? 'bg-orange-500' : 'bg-slate-800'
              } ${error ? 'bg-rose-500 animate-pulse' : ''}`} 
            />
          ))}
        </div>

        {error && <p className="text-rose-500 text-sm mb-4 font-bold">PIN incorrecto</p>}

        <div className="grid grid-cols-3 gap-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handlePress(num)}
              className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl text-2xl font-bold text-white transition-colors flex items-center justify-center shadow-lg"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-16 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 active:bg-slate-600 rounded-2xl text-sm font-bold text-slate-400 transition-colors flex items-center justify-center shadow-lg uppercase tracking-wider"
          >
            Borrar
          </button>
          <button
            onClick={() => handlePress('0')}
            className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl text-2xl font-bold text-white transition-colors flex items-center justify-center shadow-lg"
          >
            0
          </button>
          <div className="h-16" /> {/* Empty space */}
        </div>
      </div>
    </div>
  );
};
