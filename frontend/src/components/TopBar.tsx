import React from 'react';
import { Maximize, Minimize, Wifi, WifiOff, Lock, Unlock } from 'lucide-react';
import { CashShift } from '../types';

interface TopBarProps {
  isConnected: boolean;
  activeShift: CashShift | null;
  onOpenCashModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ isConnected, activeShift, onOpenCashModal }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between select-none">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <div className="flex items-center gap-2 text-xs">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">En línea</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-rose-400" />
                <span className="text-rose-400 font-semibold">Desconectado</span>
              </>
            )}
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{new Date().toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Right Tools: Cash Shift Badge & Fullscreen */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCashModal}
          className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
            activeShift
              ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/50 border-rose-800/80 text-rose-300'
          }`}
        >
          {activeShift ? (
            <>
              <Unlock className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Caja Abierta:</span>
              <span className="font-extrabold">${(activeShift.expected_cash || activeShift.initial_amount || 0).toFixed(2)}</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-rose-400" />
              <span>Abrir Caja</span>
            </>
          )}
        </button>

        <button
          onClick={toggleFullscreen}
          title="Pantalla Completa"
          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
