import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Category } from '../../types';
import { api } from '../../services/api';
import { IconRenderer } from '../../components/IconRenderer';
import { customAlert, customConfirm } from '../../utils/alert';

interface CategoriesTabProps {
  categories: Category[];
  onRefresh: () => void;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({ categories, onRefresh }) => {
  const [modal, setModal] = useState<{ isOpen: boolean; item?: Category | null }>({ isOpen: false });
  const [search, setSearch] = useState('');
  const [cName, setCName] = useState('');
  const [cIcon, setCIcon] = useState('Utensils');
  const [cColor, setCColor] = useState('#f97316');

  const handleOpen = (item?: Category) => {
    if (item) {
      setCName(item.name);
      setCIcon(item.icon);
      setCColor(item.color);
      setModal({ isOpen: true, item });
    } else {
      setCName('');
      setCIcon('Utensils');
      setCColor('#f97316');
      setModal({ isOpen: true });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { name: cName, icon: cIcon, color: cColor };
      if (modal.item) {
        await api.updateCategory(modal.item.id, data);
      } else {
        await api.createCategory(data);
      }
      setModal({ isOpen: false });
      onRefresh();
    } catch (err: any) { customAlert(err.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    if (await customConfirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
      try {
        await api.deleteCategory(id);
        setModal({ isOpen: false });
        onRefresh();
      } catch (err: any) { customAlert(err.message || 'Error al eliminar'); }
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => handleOpen()}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/30 transition-all hover:scale-105 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nueva Categoría
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 gap-4 align-start">
        {categories
          .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
          .map(c => (
          <div 
            key={c.id} 
            onClick={() => handleOpen(c)}
            className="group relative bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 transition-all hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/10 active:scale-95 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: `${c.color || '#f97316'}20`, color: c.color || '#f97316' }}>
              <IconRenderer name={c.icon} className="w-6 h-6" />
            </div>
            <span className="font-bold text-white text-sm">{c.name}</span>

            <div className="absolute top-2 right-2 flex gap-1">
              <button onClick={() => handleOpen(c)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"><Edit className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white">
              {modal.item ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
              <input type="text" required value={cName} onChange={e => setCName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Icono</label>
              <select value={cIcon} onChange={e => setCIcon(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                <option value="Utensils">Utensils (Cubiertos)</option>
                <option value="Flame">Flame (Fuego / Parrilla)</option>
                <option value="Coffee">Coffee (Café / Bebidas)</option>
                <option value="Wine">Wine (Copa / Vinos / Cerveza)</option>
                <option value="Cake">Cake (Pastel / Postres)</option>
                <option value="Pizza">Pizza (Comida rápida)</option>
                <option value="Soup">Soup (Sopas / Caldos)</option>
                <option value="PlusCircle">PlusCircle (Extras)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Color Distintivo</label>
              <div className="flex gap-2">
                {['#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#eab308'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform ${cColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className={`flex mt-2 ${modal.item ? 'justify-between' : 'justify-end'}`}>
              {modal.item && (
                <button type="button" onClick={() => handleDelete(modal.item!.id)} className="px-4 py-2 bg-red-950 text-red-500 hover:bg-red-900 hover:text-red-400 rounded-xl text-xs font-bold transition-colors">
                  Eliminar Categoría
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal({ isOpen: false })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">Guardar</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
