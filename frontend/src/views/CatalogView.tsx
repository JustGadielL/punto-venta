import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Tag, 
  Settings2, 
  PercentCircle,
  PackageSearch
} from 'lucide-react';
import { Category, Product } from '../types';
import { api } from '../services/api';
import { ProductsTab } from './catalog/ProductsTab';
import { CategoriesTab } from './catalog/CategoriesTab';
import { ModifiersTab } from './catalog/ModifiersTab';
import { DiscountsTab } from './catalog/DiscountsTab';

interface CatalogViewProps {
  categories: Category[];
  products: Product[];
  onRefreshCatalog: () => void;
}

type TabType = 'products' | 'categories' | 'modifiers' | 'discounts';

export const CatalogView: React.FC<CatalogViewProps> = ({
  categories,
  products,
  onRefreshCatalog
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('products');

  const [discounts, setDiscounts] = useState<any[]>([]);
  const [modifiers, setModifiers] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'discounts') {
      api.getDiscounts().then(setDiscounts).catch(console.error);
    } else if (activeTab === 'modifiers') {
      api.getModifiers().then(setModifiers).catch(console.error);
    }
  }, [activeTab]);

  const refreshExtras = () => {
    if (activeTab === 'discounts') {
      api.getDiscounts().then(setDiscounts).catch(console.error);
    } else if (activeTab === 'modifiers') {
      api.getModifiers().then(setModifiers).catch(console.error);
    }
  };

  const menuItems = [
    { id: 'products', label: 'Artículos', icon: PackageSearch },
    { id: 'categories', label: 'Categorías', icon: Tag },
    { id: 'modifiers', label: 'Modificadores', icon: Settings2 },
    { id: 'discounts', label: 'Descuentos', icon: PercentCircle },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white border border-slate-700 shadow-lg">
            <BookOpen className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Catálogos</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* LEFT SIDEBAR: Menu */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeTab === item.id
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* RIGHT AREA: Content */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden flex flex-col shadow-xl">
          {activeTab === 'products' && (
            <ProductsTab 
              products={products} 
              categories={categories} 
              onRefresh={onRefreshCatalog} 
            />
          )}
          
          {activeTab === 'categories' && (
            <CategoriesTab 
              categories={categories} 
              onRefresh={onRefreshCatalog} 
            />
          )}
          
          {activeTab === 'modifiers' && (
            <ModifiersTab 
              modifiers={modifiers} 
              onRefresh={refreshExtras} 
            />
          )}
          
          {activeTab === 'discounts' && (
            <DiscountsTab 
              discounts={discounts} 
              onRefresh={refreshExtras} 
            />
          )}
        </div>
      </div>
    </div>
  );
};
