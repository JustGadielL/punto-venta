import React, { useState } from 'react';
import { Product, ModifierGroup, ModifierOption } from '../types';
import { X, Check } from 'lucide-react';

interface ProductModifiersModalProps {
  product: Product;
  modifierGroups: ModifierGroup[];
  productModifierGroupIds: number[];
  onClose: () => void;
  onAddToCart: (product: Product, modifiers: any[], note: string, quantity: number, keepModalOpen?: boolean) => void;
}

export const ProductModifiersModal: React.FC<ProductModifiersModalProps> = ({
  product,
  modifierGroups,
  productModifierGroupIds,
  onClose,
  onAddToCart
}) => {
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, (ModifierOption & { qty: number })[]>>({});
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  const productGroups = modifierGroups.filter(g => productModifierGroupIds.includes(g.id));

  const setModifierQuantity = (group: ModifierGroup, option: ModifierOption, qty: number) => {
    setSelectedModifiers(prev => {
      const current = prev[group.id] || [];
      if (qty <= 0) {
        return { ...prev, [group.id]: current.filter(o => o.id !== option.id) };
      }
      const exists = current.find(o => o.id === option.id);
      if (exists) {
        return { ...prev, [group.id]: current.map(o => o.id === option.id ? { ...o, qty } : o) };
      } else {
        return { ...prev, [group.id]: [...current, { ...option, qty }] };
      }
    });
  };

  const toggleModifier = (group: ModifierGroup, option: ModifierOption) => {
    if (group.selection_type !== 'single') {
      const current = selectedModifiers[group.id] || [];
      const exists = current.find(o => o.id === option.id);
      setModifierQuantity(group, option, exists ? 0 : 1);
      return;
    }
    
    setSelectedModifiers(prev => {
      const current = prev[group.id] || [];
      const isCurrentlyActive = current.some(o => o.id === option.id);
      if (isCurrentlyActive) {
        return { ...prev, [group.id]: [] };
      }
      return { ...prev, [group.id]: [{ ...option, qty: 1 }] };
    });
  };

  const getOptionQty = (groupId: number, optionId: number) => {
    const opt = (selectedModifiers[groupId] || []).find(o => o.id === optionId);
    return opt ? opt.qty : 0;
  };

  const handleSave = (keepModalOpen = false) => {
    const flatModifiers: any[] = [];
    Object.values(selectedModifiers).forEach(options => {
      options.forEach(o => {
        for (let i = 0; i < o.qty; i++) {
          flatModifiers.push({
            modifier_option_id: o.id,
            modifier_name: o.name,
            price_adjustment: o.price_adjustment
          });
        }
      });
    });
    onAddToCart(product, flatModifiers, note, quantity, keepModalOpen);
  };

  const totalModifiersPrice = Object.values(selectedModifiers).flat().reduce((sum, o) => sum + (o.price_adjustment * o.qty), 0);
  const finalPrice = (product.price + totalModifiersPrice) * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-xl font-bold text-white">{product.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {productGroups.map(group => (
            <div key={group.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-200">{group.name}</h3>
                <span className="text-xs text-slate-400 bg-slate-950 px-2 py-1 rounded-md">
                  {group.selection_type === 'single' ? 'Elige 1' : 'Opcional, Múltiple'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {group.options.filter(opt => opt.is_active !== 0).map(opt => {
                  const qty = getOptionQty(group.id, opt.id);
                  if (group.selection_type === 'single') {
                    const active = qty > 0;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleModifier(group, opt)}
                        className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${
                          active ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-sm font-medium">{opt.name}</span>
                        {opt.price_adjustment > 0 && <span className="text-xs opacity-70">+${opt.price_adjustment}</span>}
                      </button>
                    );
                  } else {
                    return (
                      <div
                        key={opt.id}
                        className={`p-2 rounded-xl border transition-all flex flex-col justify-between items-center gap-2 ${
                          qty > 0 ? 'bg-orange-600/20 border-orange-500' : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className={`w-full flex justify-between items-center text-sm font-medium ${qty > 0 ? 'text-orange-400' : 'text-slate-300'}`}>
                          <span>{opt.name}</span>
                          {opt.price_adjustment > 0 && <span className="text-xs opacity-70">+${opt.price_adjustment}</span>}
                        </div>
                        <div className="w-full flex items-center justify-between gap-2 mt-1">
                          <button 
                            type="button"
                            onClick={() => setModifierQuantity(group, opt, qty - 1)} 
                            className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 active:scale-95 flex items-center justify-center transition-colors"
                          >-</button>
                          <span className={`font-bold ${qty > 0 ? 'text-white' : 'text-slate-500'}`}>{qty}</span>
                          <button 
                            type="button"
                            onClick={() => setModifierQuantity(group, opt, qty + 1)} 
                            className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 active:scale-95 flex items-center justify-center transition-colors"
                          >+</button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ))}

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h3 className="font-bold text-slate-200 mb-2">Nota adicional (visible para cocina)</h3>
            <textarea
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-orange-500 focus:outline-none"
              rows={2}
              placeholder="Ej. Sin cebolla..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold hover:bg-slate-700 active:scale-95"
            >-</button>
            <span className="text-xl font-bold w-6 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold hover:bg-slate-700 active:scale-95"
            >+</button>
          </div>
          <div className="flex-1 flex">
            <button 
              onClick={() => {
                handleSave(false);
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Check className="w-5 h-5" />
              <span>Finalizar • ${finalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
