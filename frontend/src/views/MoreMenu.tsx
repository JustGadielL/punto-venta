import React from 'react';
import { Settings, BookOpen, Receipt, Smartphone, ChevronRight, BarChart3 } from 'lucide-react';
import { CatalogView } from './CatalogView';
import { CashView } from './CashView';
import { SettingsView } from './SettingsView';
import { ReportsView } from './ReportsView';
import { CashShift, Category, Product, PrintedTicket } from '../types';
import { api } from '../services/api';

const QrCodeDisplay = () => {
  const [qr, setQr] = React.useState('');
  React.useEffect(() => {
    api.getNetworkInfo().then(info => setQr(info.qrCodeDataUrl)).catch(() => {});
  }, []);
  return qr ? <img src={qr} alt="QR Code" className="w-64 h-64" /> : <div>Cargando...</div>;
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
          <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-900">
            <h2 className="text-2xl font-bold mb-4">Vincular Dispositivo (Tablet)</h2>
            <p className="text-slate-400 mb-8 max-w-md text-center">Para usar el sistema en una Tablet, conéctala a la misma red WiFi y escanea este código QR.</p>
            <div className="bg-white p-4 rounded-xl">
              <QrCodeDisplay />
            </div>
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
