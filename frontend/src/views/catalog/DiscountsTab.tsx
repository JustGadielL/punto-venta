import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { api } from '../../services/api';
import { customAlert, customConfirm } from '../../utils/alert';

interface DiscountsTabProps {
  discounts: any[];
  onRefresh: () => void;
}

export const DiscountsTab: React.FC<DiscountsTabProps> = ({ discounts, onRefresh }) => {
  const [modal, setModal] = useState<{ isOpen: boolean; item?: any }>({ isOpen: false });
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleOpen = (item?: any) => {
    if (item) {
      setName(item.name);
      setPercentage(item.percentage.toString());
      setIsActive(Boolean(item.is_active));
      setModal({ isOpen: true, item });
    } else {
      setName('');
      setPercentage('');
      setIsActive(true);
      setModal({ isOpen: true });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { name, percentage: parseFloat(percentage), is_active: isActive ? 1 : 0 };
      if (modal.item) {
        await api.updateDiscount(modal.item.id, data);
      } else {
        await api.createDiscount(data);
      }
      setModal({ isOpen: false });
      onRefresh();
    } catch (err: any) {
      customAlert(err.message || 'Error al guardar descuento');
    }
  };

  const handleDelete = async (id: number) => {
    if (await customConfirm('¿Estás seguro de que deseas eliminar este descuento?')) {
      try {
        await api.deleteDiscount(id);
        onRefresh();
      } catch (err: any) {
        customAlert(err.message || 'Error al eliminar');
      }
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-black text-white">Descuentos</h3>
          <p className="text-xs text-slate-400">Administra los descuentos aplicables a comandas</p>
        </div>
        <div className="relative flex-1 max-w-sm ml-4 mr-4">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => handleOpen()}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" /> Nuevo Descuento
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discounts
            .filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
            .map(d => (
            <div 
              key={d.id} 
              onClick={() => handleOpen(d)}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex justify-between items-center hover:border-orange-500 hover:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-lg"
            >
              <div>
                <h4 className="font-bold text-white flex items-center gap-2">
                  {d.name}
                  {!d.is_active && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">Inactivo</span>
                  )}
                </h4>
                <p className="text-2xl font-black text-emerald-400 mt-1">{d.percentage}%</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} 
                  className="p-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white">
              {modal.item ? 'Editar Descuento' : 'Nuevo Descuento'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Porcentaje (%)</label>
              <input type="number" step="0.1" min="0" max="100" required value={percentage} onChange={e => setPercentage(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-orange-500 focus:ring-0 cursor-pointer" />
              <span className="text-xs font-bold text-slate-300">Descuento Activo</span>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setModal({ isOpen: false })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
