import React from 'react';
import { 
  ShoppingBag, 
  LayoutGrid, 
  Receipt, 
  ClipboardList, 
  Menu
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  activeOrdersCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  activeOrdersCount
}) => {
  const navItems = [
    { id: 'tables', label: 'Plano de distribución', icon: LayoutGrid, badge: null },
    { id: 'pos', label: 'Menú', icon: ShoppingBag, badge: null },
    { id: 'transactions', label: 'Transacciones', icon: Receipt, badge: null },
    { id: 'orders', label: 'Pedidos', icon: ClipboardList, badge: activeOrdersCount > 0 ? activeOrdersCount : null, badgeColor: 'bg-rose-500' },
    { id: 'more', label: 'Más', icon: Menu, badge: null },
  ];

  return (
    <nav className="bg-slate-900 border-t border-slate-800 sticky bottom-0 z-40 w-full select-none shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around max-w-7xl mx-auto px-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView.startsWith(item.id) || (currentView.startsWith('more:') && item.id === 'more');
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge !== null && (
                  <span className={`absolute -top-1 -right-2 px-1.5 min-w-[1.25rem] text-center py-0.5 rounded-full text-[10px] font-black text-white ${item.badgeColor || 'bg-blue-500'}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] md:text-xs tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              
              {/* Active Indicator Line */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-white rounded-b-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
