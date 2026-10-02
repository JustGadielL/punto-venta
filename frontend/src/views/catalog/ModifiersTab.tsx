import React, { useState } from 'react';
import { Plus, Edit, Trash2, Settings2, Power, Search } from 'lucide-react';
import { api } from '../../services/api';
import { customAlert, customConfirm } from '../../utils/alert';

interface ModifiersTabProps {
  modifiers: any[];
  onRefresh: () => void;
}

export const ModifiersTab: React.FC<ModifiersTabProps> = ({ modifiers, onRefresh }) => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  
  // Group Modal
  const [groupModal, setGroupModal] = useState<{ isOpen: boolean; item?: any }>({ isOpen: false });
  const [gName, setGName] = useState('');
  const [gSelection, setGSelection] = useState('multiple');
  const [gRequired, setGRequired] = useState(false);

  // Option Modal
  const [optionModal, setOptionModal] = useState<{ isOpen: boolean; item?: any }>({ isOpen: false });
  const [oName, setOName] = useState('');
  const [oPrice, setOPrice] = useState('');

  const [oActive, setOActive] = useState(true);

  const selectedGroup = modifiers.find(m => m.id === selectedGroupId);

  // --- Group Handlers ---
  const handleOpenGroup = (item?: any) => {
    if (item) {
      setGName(item.name);
      setGSelection(item.selection_type);
      setGRequired(Boolean(item.is_required));
      setGroupModal({ isOpen: true, item });
    } else {
      setGName('');
      setGSelection('multiple');
      setGRequired(false);
      setGroupModal({ isOpen: true });
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { name: gName, selection_type: gSelection, is_required: gRequired ? 1 : 0 };
      if (groupModal.item) {
        await api.updateModifierGroup(groupModal.item.id, data);
      } else {
        await api.createModifierGroup(data);
      }
      setGroupModal({ isOpen: false });
      onRefresh();
    } catch (err: any) { customAlert(err.message || 'Error'); }
  };

  const handleDeleteGroup = async (id: number) => {
    if (await customConfirm('¿Estás seguro de que deseas eliminar este grupo de modificadores?')) {
      try {
        await api.deleteModifierGroup(id);
        if (selectedGroupId === id) setSelectedGroupId(null);
        onRefresh();
      } catch (err: any) { customAlert(err.message || 'Error al eliminar'); }
    }
  };

  // --- Option Handlers ---
  const handleOpenOption = (item?: any) => {
    if (item) {
      setOName(item.name);
      setOPrice(item.price_adjustment.toString());
      setOActive(item.is_active !== 0);
      setOptionModal({ isOpen: true, item });
    } else {
      setOName('');
      setOPrice('0');
      setOActive(true);
      setOptionModal({ isOpen: true });
    }
  };

  const handleToggleOptionActive = async (opt: any) => {
    try {
      // If is_active is missing or not 0, it means it's active. So we switch it to 0.
      const newActiveState = opt.is_active !== 0 ? 0 : 1;
      await api.updateModifierOption(opt.id, {
        name: opt.name,
        price_adjustment: opt.price_adjustment,
        is_active: newActiveState
      });
      onRefresh();
    } catch (err: any) { customAlert(err.message || 'Error'); }
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;
    try {
      const data = { name: oName, price_adjustment: parseFloat(oPrice), is_active: oActive ? 1 : 0 };
      if (optionModal.item) {
        await api.updateModifierOption(optionModal.item.id, data);
      } else {
        await api.createModifierOption(selectedGroupId, data);
      }
      setOptionModal({ isOpen: false });
      onRefresh();
    } catch (err: any) { customAlert(err.message || 'Error'); }
  };

  const handleDeleteOption = async (id: number) => {
    if (await customConfirm('¿Estás seguro de que deseas eliminar esta opción?')) {
      try {
        await api.deleteModifierOption(id);
        onRefresh();
      } catch (err: any) { customAlert(err.message || 'Error al eliminar'); }
    }
  };

  return (
    <div className="flex h-full animate-fade-in gap-4">
      {/* Groups List (Left internal) */}
      <div className="w-1/3 flex flex-col border-r border-slate-800 pr-4 h-full">
        <div className="flex justify-between items-center mb-4 gap-2">
          <div className="relative flex-1">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <button onClick={() => handleOpenGroup()} className="p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
          {modifiers
            .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
            .map(g => (
            <div 
              key={g.id} 
              onClick={() => setSelectedGroupId(g.id)}
              className={`p-3 rounded-2xl cursor-pointer border transition-all ${
                selectedGroupId === g.id
                  ? 'bg-orange-600/10 border-orange-600/50 text-orange-400'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{g.name}</div>
                  <div className="text-[10px] uppercase mt-1 opacity-70">
                    {g.selection_type === 'single' ? 'Unica Opción' : 'Múltiple'} • {g.is_required ? 'Requerido' : 'Opcional'}
                  </div>
                </div>
                {selectedGroupId === g.id && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleOpenGroup(g)} className="p-1 hover:text-white transition-colors"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteGroup(g.id)} className="p-1 hover:text-rose-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Options List (Right internal) */}
      <div className="w-2/3 flex flex-col h-full pl-2">
        {selectedGroup ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedGroup.name}</h3>
                <p className="text-xs text-slate-400">Opciones disponibles para este modificador</p>
              </div>
              <button onClick={() => handleOpenOption()} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1">
                <Plus className="w-4 h-4" /> Agregar Opción
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 gap-2 align-start">
              {selectedGroup.options?.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs">No hay opciones registradas.</div>
              )}
              {selectedGroup.options?.map((opt: any) => (
                <div key={opt.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-sm">{opt.name}</div>
                    <div className="text-xs text-emerald-400 font-bold">{opt.price_adjustment > 0 ? `+$${opt.price_adjustment.toFixed(2)}` : 'Sin cargo extra'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Toggle Pill */}
                    <div 
                      onClick={() => handleToggleOptionActive(opt)}
                      className={`w-10 h-5 border rounded-full flex items-center px-1 cursor-pointer transition-colors ${opt.is_active !== 0 ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-800 border-slate-700'}`}
                    >
                      <div className={`w-3 h-3 rounded-full transition-transform ${opt.is_active !== 0 ? 'bg-emerald-400 translate-x-5' : 'bg-slate-500 translate-x-0'}`}></div>
                    </div>
                    <div className="h-6 w-px bg-slate-800 mx-1"></div>
                    <button onClick={() => handleOpenOption(opt)} className="p-1.5 text-slate-400 hover:text-white transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteOption(opt.id)} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Settings2 className="w-12 h-12 mb-3 opacity-20" />
            <p>Selecciona un grupo de modificadores</p>
          </div>
        )}
      </div>

      {/* Group Modal */}
      {groupModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveGroup} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white">
              {groupModal.item ? 'Editar Grupo' : 'Nuevo Grupo'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre (ej. Salsas)</label>
              <input type="text" required value={gName} onChange={e => setGName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo de Selección</label>
              <select value={gSelection} onChange={e => setGSelection(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                <option value="multiple">Opción Múltiple</option>
                <option value="single">Una sola opción</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={gRequired} onChange={e => setGRequired(e.target.checked)} className="rounded text-orange-500 focus:ring-0 cursor-pointer" />
              <span className="text-xs font-bold text-slate-300">Es Obligatorio</span>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setGroupModal({ isOpen: false })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Option Modal */}
      {optionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveOption} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white">
              {optionModal.item ? 'Editar Opción' : 'Nueva Opción'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre (ej. BBQ)</label>
              <input type="text" required value={oName} onChange={e => setOName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Costo Extra ($) (0 si es gratis)</label>
              <input type="number" step="0.5" min="0" required value={oPrice} onChange={e => setOPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={oActive} onChange={e => setOActive(e.target.checked)} className="rounded text-orange-500 focus:ring-0 cursor-pointer" />
              <span className="text-xs font-bold text-slate-300">Opción Activa</span>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setOptionModal({ isOpen: false })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
