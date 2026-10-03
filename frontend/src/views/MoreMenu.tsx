import React, { useState } from 'react';
import { Settings, BookOpen, Receipt, Smartphone, ChevronRight, BarChart3, Copy, Check, ExternalLink } from 'lucide-react';
import { CatalogView } from './CatalogView';
import { CashView } from './CashView';
import { SettingsView } from './SettingsView';
import { ReportsView } from './ReportsView';
import { CashShift, Category, Product, PrintedTicket } from '../types';

const QrCodeDisplay = () => {
  const [copied, setCopied] = useState(false);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://punto-venta-red.vercel.app';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(appUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-700">
        <img src={qrUrl} alt="QR Acceso POS" className="w-56 h-56 rounded-lg" />
      </div>
      
      <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 max-w-sm">
        <span className="text-xs text-orange-400 font-mono font-bold truncate">{appUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title="Copiar URL"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

interface MoreMenuProps {
  currentSubView?: string;
  onSelectSubView: (subView: string) => void;
  activeShift: CashShift | null;
  categories: Category[];
  products: Product[];
  onRefreshCatalog: () => void;
  onRefreshShift: () => void;
  onShowTicket: (ticket: PrintedTicket | any) => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({
  currentSubView,
  onSelectSubView,
  activeShift,
  categories,
  products,
  onRefreshCatalog,
  onRefreshShift,
  onShowTicket
}) => {

  const renderContent = () => {
    switch (currentSubView) {
      case 'catalog':
        return <CatalogView categories={categories} products={products} onRefreshCatalog={onRefreshCatalog} />;
      case 'cash':
        return <CashView activeShift={activeShift} onRefreshShift={onRefreshShift} onShowTicket={onShowTicket} />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      case 'devices':
        return (
          <div className="p-6 md:p-8 h-full flex flex-col items-center justify-center bg-slate-900 overflow-y-auto pb-24">
            <h2 className="text-2xl font-bold mb-2 text-white">Vincular Dispositivo (Tablet o Celular)</h2>
            <p className="text-slate-400 mb-6 max-w-md text-center text-sm">
              Escanea este código QR con la cámara de cualquier tableta o teléfono para acceder directamente al Punto de Venta.
            </p>
            <QrCodeDisplay />
            <p className="text-slate-500 text-xs mt-6 text-center max-w-sm">
              Tip: En el navegador de tu tableta toca <b>"Agregar a la pantalla principal"</b> para usar el sistema a pantalla completa como una App nativa.
            </p>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <div className="text-slate-500 flex flex-col items-center">
              <Settings className="w-16 h-16 mb-4 opacity-20" />
              <p>Selecciona una opción del menú</p>
            </div>
          </div>
        );
    }
  };

  const menuItems = [
    { id: 'catalog', label: 'Artículos', icon: BookOpen },
    { id: 'cash', label: 'Informes de Caja', icon: Receipt },
    { id: 'reports', label: 'Informes de Ventas', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes de Impresora y Seguridad', icon: Settings },
    { id: 'devices', label: 'Dispositivos Móviles (QR)', icon: Smartphone },
  ];

  return (
    <div className="flex h-full bg-slate-950">
      {/* Sidebar Menu */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold">Más</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectSubView(item.id)}
              className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${
                currentSubView === item.id ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <item.icon className="w-6 h-6" />
                <span className="font-semibold">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950 custom-scrollbar">
        {renderContent()}
      </div>
    </div>
  );
};
