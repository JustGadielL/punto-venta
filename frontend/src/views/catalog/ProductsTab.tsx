import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Category, Product } from '../../types';
import { api } from '../../services/api';
import { customAlert, customConfirm } from '../../utils/alert';

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  onRefresh: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({ products, categories, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<number | 'all'>('all');
  
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [productModifiers, setProductModifiers] = useState<any[]>([]);

  React.useEffect(() => {
    api.getModifiers().then(setModifierGroups).catch(console.error);
    api.getProductModifiers().then(setProductModifiers).catch(console.error);
  }, []);

  const [modal, setModal] = useState<{ isOpen: boolean; item?: Product | null }>({ isOpen: false });
  const [pName, setPName] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCost, setPCost] = useState('');
  const [pCatId, setPCatId] = useState<number>(categories[0]?.id || 1);
  const [pIsActive, setPIsActive] = useState(true);
  const [pIsKitchen, setPIsKitchen] = useState(true);
  const [pSelectedModifiers, setPSelectedModifiers] = useState<number[]>([]);

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCatId === 'all' || p.category_id === selectedCatId;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleOpen = (item?: Product) => {
    if (item) {
      setPName(item.name);
      setPDescription(item.description || '');
      setPPrice(item.price.toString());
      setPCost(item.cost?.toString() || '');
      setPCatId(item.category_id);
      setPIsActive(Boolean(item.is_active));
      setPIsKitchen(Boolean(item.is_kitchen));
      
      const relatedGroups = productModifiers.filter(m => m.product_id === item.id).map(m => m.group_id);
      setPSelectedModifiers(relatedGroups);

      setModal({ isOpen: true, item });
    } else {
      setPName('');
      setPDescription('');
      setPPrice('');
      setPCost('');
      setPCatId(categories[0]?.id || 1);
      setPIsActive(true);
      setPIsKitchen(true);
      setPSelectedModifiers([]);
      setModal({ isOpen: true });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        category_id: pCatId,
        name: pName,
        description: pDescription,
        price: parseFloat(pPrice),
        cost: pCost ? parseFloat(pCost) : 0,
        is_active: pIsActive ? 1 : 0,
        is_kitchen: pIsKitchen ? 1 : 0
      };
      if (modal.item) {
        await api.updateProduct(modal.item.id, data);
        await api.updateProductModifiers(modal.item.id, pSelectedModifiers);
      } else {
        const newProd = await api.createProduct(data);
        await api.updateProductModifiers(newProd.id, pSelectedModifiers);
      }
      
      // Refresh mappings and products
      api.getProductModifiers().then(setProductModifiers).catch(console.error);
      setModal({ isOpen: false });
      onRefresh();
    } catch (err: any) { customAlert(err.message || 'Error al guardar'); }
  };

  const handleDelete = async (id: number) => {
    if (await customConfirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
        await api.deleteProduct(id);
        onRefresh();
      } catch (err: any) { customAlert(err.message || 'Error al eliminar'); }
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-black text-white">Artículos</h3>
        </div>
        <button
          onClick={() => handleOpen()}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" /> Nuevo Artículo
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800 p-2 rounded-2xl flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar artículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <select
          value={selectedCatId}
          onChange={e => setSelectedCatId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-orange-500"
        >
          <option value="all">Todas las Categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] sticky top-0 z-10">
            <tr>
              <th className="p-3 rounded-tl-xl">Producto</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Destino</th>
              <th className="p-3 text-right rounded-tr-xl">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/40 transition-colors cursor-pointer group" onClick={() => handleOpen(p)}>
                <td className="p-3">
                  <div className="font-bold text-white text-sm">{p.name} {!p.is_active && <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded ml-1 uppercase">Pausado</span>}</div>
                  {p.description && <div className="text-[10px] text-slate-500 line-clamp-1">{p.description}</div>}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${p.category_color || '#3b82f6'}20`, color: p.category_color || '#60a5fa' }}>
                    {p.category_name}
                  </span>
                </td>
                <td className="p-3 font-black text-emerald-400">
                  ${p.price.toFixed(2)}
                </td>
                <td className="p-3">
                  {p.is_kitchen ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Cocina
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      Barra
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleOpen(p); }} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg text-white">
              {modal.item ? 'Editar Artículo' : 'Nuevo Artículo'}
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
              <input type="text" required value={pName} onChange={e => setPName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descripción</label>
              <textarea rows={2} value={pDescription} onChange={e => setPDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Precio Venta ($)</label>
                <input type="number" step="0.5" min="0" required value={pPrice} onChange={e => setPPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold text-emerald-400 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Costo ($ Opcional)</label>
                <input type="number" step="0.5" min="0" value={pCost} onChange={e => setPCost(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base text-slate-300 focus:outline-none focus:border-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoría</label>
              <select value={pCatId} onChange={e => setPCatId(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {modifierGroups.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 border-t border-slate-800 pt-3">Modificadores Aplicables</label>
                <div className="grid grid-cols-2 gap-2">
                  {modifierGroups.map(mg => (
                    <label key={mg.id} className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 p-2 rounded-xl hover:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={pSelectedModifiers.includes(mg.id)}
                        onChange={(e) => {
                          if (e.target.checked) setPSelectedModifiers(prev => [...prev, mg.id]);
                          else setPSelectedModifiers(prev => prev.filter(id => id !== mg.id));
                        }}
                        className="rounded text-orange-500 focus:ring-0 bg-slate-900 border-slate-700" 
                      />
                      <span className="text-xs font-bold text-white line-clamp-1">{mg.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Destino de Comanda (Cocina vs Barra) */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Destino de Comanda (Impresión)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPIsKitchen(true)}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    pIsKitchen
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base"></span>
                  <span>Cocina (Comida)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPIsKitchen(false)}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    !pIsKitchen
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 ring-1 ring-purple-500/40 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base"></span>
                  <span>Barra (Bebidas)</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4 pt-2 border-t border-slate-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pIsActive} onChange={e => setPIsActive(e.target.checked)} className="rounded text-emerald-500 focus:ring-0" />
                <span className="text-slate-300">Artículo Activo para Venta</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setModal({ isOpen: false })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-orange-600 text-white rounded-xl text-xs font-black shadow-lg">Guardar Artículo</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
