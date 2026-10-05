import React, { useState } from 'react';
import { 
  UtensilsCrossed, 
  Plus, 
  Clock, 
  DollarSign, 
  Receipt, 
  ChefHat, 
  CreditCard, 
  User, 
  CheckCircle,
  X,
  AlertTriangle
} from 'lucide-react';
import { Table, Order } from '../types';
import { api } from '../services/api';
import { customAlert } from '../utils/alert';

interface TablesViewProps {
  tables: Table[];
  onSelectTableForPos: (tableId: number) => void;
  onSelectOrderForPos?: (orderId: number) => void;
  onOpenCheckout: (order: Order) => void;
  onShowTicket: (ticket: any) => void;
}

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  onSelectTableForPos,
  onSelectOrderForPos,
  onOpenCheckout,
  onShowTicket
}) => {
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'billing'>('all');
  const [activeTableDetail, setActiveTableDetail] = useState<{ table: Table; order: Order | null } | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(false);
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableName, setNewTableName] = useState<string>('');
  //const [newTableCapacity, setNewTableCapacity] = useState<number>(4);

  const filteredTables = tables.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const handleTableClick = async (table: Table) => {
    if (table.status === 'available' || !table.active_order_id) {
      // Direct to POS to create new order for this table
      onSelectTableForPos(table.id);
    } else {
      // Open Table Detail Modal
      setLoadingOrder(true);
      try {
        const order = await api.getOrder(table.active_order_id);
        setActiveTableDetail({ table, order });
      } catch (err) {
        console.error('Error fetching table order:', err);
        setActiveTableDetail({ table, order: null });
      } finally {
        setLoadingOrder(false);
      }
    }
  };

  const handleRequestBill = async (tableId: number, orderId: number) => {
    try {
      const res = await api.requestBill(orderId);
      if (activeTableDetail) {
        setActiveTableDetail({
          ...activeTableDetail,
          table: { ...activeTableDetail.table, status: 'billing' }
        });
      }
      if (res.ticket) {
        onShowTicket(res.ticket);
      }
    } catch (err: any) {
      customAlert(err.message || 'Error al solicitar cuenta');
    }
  };

  const handleSendKitchenFromModal = async (orderId: number) => {
    try {
      const res = await api.sendKitchenComanda(orderId);
      if (res.printResult) onShowTicket(res.printResult);
      if (activeTableDetail && activeTableDetail.order) {
        const updatedOrder = await api.getOrder(orderId);
        setActiveTableDetail({ ...activeTableDetail, order: updatedOrder });
      }
    } catch (err: any) {
      customAlert(err.message || 'Error al enviar comanda');
    }
  };

  // const handleCreateNewTable = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!newTableNumber || !newTableName) return;
  //   try {
  //     await api.createTable({
  //       number: Number(newTableNumber),
  //       name: newTableName,
  //       capacity: newTableCapacity
  //     });
  //     setShowAddTableModal(false);
  //     setNewTableNumber('');
  //     setNewTableName('');
  //   } catch (err: any) {
  //     alert(err.message || 'Error al crear mesa');
  //   }
  // };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-5 h-full overflow-y-auto pb-28">
      {/* Header & Status Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-orange-500" />
            Mesas 
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            Todas ({tables.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              filter === 'available'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Libres ({tables.filter(t => t.status === 'available').length})
          </button>
          <button
            onClick={() => setFilter('occupied')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              filter === 'occupied'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-orange-950/40 border border-orange-900/60 text-orange-400 hover:bg-orange-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
            Ocupadas ({tables.filter(t => t.status === 'occupied').length})
          </button>
          <button
            onClick={() => setFilter('billing')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              filter === 'billing'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-extrabold'
                : 'bg-amber-950/40 border border-amber-900/60 text-amber-300 hover:bg-amber-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Por Pagar ({tables.filter(t => t.status === 'billing').length})
          </button>

          {/* <button
            onClick={() => {
              setNewTableNumber(String(tables.length + 1));
              setNewTableName(`Mesa ${tables.length + 1}`);
              setShowAddTableModal(true);
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Mesa
          </button> */}
        </div>
      </div>

      {/* Floor Plan / Tables Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-inner min-h-[500px] relative overflow-hidden grid grid-cols-12 grid-rows-12 gap-2">
        {/* Floor Pattern Background (subtle) */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        {tables.map(table => {
          const isVisible = filteredTables.some(t => t.id === table.id);
          const isOccupied = table.status === 'occupied';
          const isBilling = table.status === 'billing';
          const isAvailable = table.status === 'available';

          // Determine shape based on capacity
          let shapeClass = "w-full h-full min-h-[5rem] min-w-[5rem] max-w-[8rem] max-h-[8rem] mx-auto rounded-3xl"; 
          let chairClass = "";
          if (table.name === 'Mesa 6') {
            shapeClass = "w-full h-full min-h-[8rem] min-w-[6rem] max-w-[8rem] max-h-[12rem] mx-auto rounded-3xl"; // taller
          }

          // Custom Grid positioning for known tables
          const getGridStyle = (name: string): React.CSSProperties => {
            switch (name) {
              case 'Afuera 1': return { gridColumn: '4 / 6', gridRow: '1 / 3' };
              case 'Afuera 2': return { gridColumn: '6 / 8', gridRow: '1 / 3' };
              case 'Mesa 2': return { gridColumn: '3 / 5', gridRow: '4 / 6' };
              case 'Mesa 5': return { gridColumn: '7 / 9', gridRow: '4 / 6' };
              case 'Mesa 3': return { gridColumn: '5 / 7', gridRow: '7 / 9' };
              case 'Mesa 1': return { gridColumn: '3 / 5', gridRow: '10 / 12' };
              case 'Mesa 4': return { gridColumn: '7 / 9', gridRow: '10 / 12' };
              case 'Mesa 6': return { gridColumn: '9 / 11', gridRow: '6 / 10' };
              default: return {};
            }
          };

          const gridStyle = getGridStyle(table.name);

          // Determine colors
          let colorClass = "";
          let badgeClass = "";
          if (isBilling) {
            colorClass = "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] border-amber-300";
            badgeClass = "bg-amber-950 text-amber-400";
          } else if (isOccupied) {
            colorClass = "bg-orange-600 shadow-[0_0_20px_rgba(234,88,12,0.4)] border-orange-400";
            badgeClass = "bg-orange-950 text-orange-200";
          } else {
            colorClass = "bg-emerald-600 shadow-xl border-emerald-400 hover:scale-105";
            badgeClass = "bg-emerald-950 text-emerald-300";
          }

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              style={gridStyle}
              className={`relative flex flex-col justify-center items-center border-4 cursor-pointer select-none transition-all duration-300 active:scale-95 ${shapeClass} ${colorClass} group ${!isVisible ? 'opacity-0 pointer-events-none' : ''}`}
            >
              {/* Outer stroke effect for physical table look */}
              <div className="absolute inset-2 border-2 border-white/20 rounded-[inherit] pointer-events-none"></div>

              {/* Table Name */}
              <h3 className="text-sm md:text-lg font-black text-white drop-shadow-md z-10 text-center">{table.name}</h3>

              {/* Status Badge */}
              <div className={`mt-1 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm z-10 ${badgeClass}`}>
                {isBilling ? 'Cobrando' : (isOccupied ? 'Ocupada' : 'Libre')}
              </div>

              {/* Quick Info (if occupied) */}
              {(isOccupied || isBilling) && (
                <div className="absolute -top-3 -right-3 bg-slate-900 border-2 border-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-xl shadow-xl flex items-center gap-1 z-20">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {table.order_total ? `$${table.order_total.toFixed(0)}` : '0'}
                </div>
              )}

              {/* "Chairs" simulation - dots around the table */}
              <div className="absolute -inset-3 border-2 border-dashed border-slate-700/30 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          );
        })}
      </div>

      {/* Table Detail & Actions Modal */}
      {activeTableDetail && activeTableDetail.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-orange-400">Detalle de Comanda</span>
                <h3 className="text-xl font-black text-white">
                  {activeTableDetail.table.name} • Orden #{activeTableDetail.order.order_number}
                </h3>
              </div>
              <button
                onClick={() => setActiveTableDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Ordered Items List */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3">
              <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <span>Platillos en comanda ({activeTableDetail.order.items?.length || 0})</span>
                <span>Subtotal</span>
              </div>

              <div className="flex flex-col gap-2">
                {activeTableDetail.order.items?.map((it, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-orange-600/30 text-orange-400 text-xs">
                          {it.quantity}x
                        </span>
                        {it.product_name}
                      </div>
                      {it.notes && (
                        <div className="text-xs text-amber-300 pl-8 mt-0.5">↳ {it.notes}</div>
                      )}
                    </div>
                    <div className="font-black text-sm text-emerald-400">
                      ${(it.unit_price * it.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center bg-slate-950 p-4 rounded-2xl">
                <span className="text-sm font-bold text-slate-300">Total Acumulado:</span>
                <span className="text-2xl font-black text-emerald-400">
                  ${(activeTableDetail.order.total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 grid grid-cols-3 gap-2">
              {/* Add more items in POS */}
              <button
                type="button"
                onClick={() => {
                  if (onSelectOrderForPos && activeTableDetail.order) {
                    onSelectOrderForPos(activeTableDetail.order.id);
                  } else {
                    onSelectTableForPos(activeTableDetail.table.id);
                  }
                  setActiveTableDetail(null);
                }}
                className="py-3 px-2 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4 text-orange-400" />
                Agregar Platillos
              </button>

              {/* Request Bill */}
              <button
                type="button"
                onClick={() => handleRequestBill(activeTableDetail.table.id, activeTableDetail.order!.id)}
                className="py-3 px-2 bg-amber-950/70 hover:bg-amber-900 border border-amber-800/70 text-amber-300 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Pedir Cuenta
              </button>

              {/* Proceed to Checkout */}
              <button
                type="button"
                onClick={() => {
                  const orderToPay = activeTableDetail.order!;
                  setActiveTableDetail(null);
                  onOpenCheckout(orderToPay);
                }}
                className="py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
              >
                <CreditCard className="w-4 h-4" />
                Cobrar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Table Modal */}
      {/* {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateNewTable} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-400" />
              Nueva Mesa para Restaurante
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Número de Mesa</label>
              <input
                type="number"
                required
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre / Identificador</label>
              <input
                type="text"
                required
                placeholder="Ej: Mesa 11, Terraza 1, Barra..."
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Capacidad (Personas)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={newTableCapacity}
                onChange={e => setNewTableCapacity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold"
              >
                Crear Mesa
              </button>
            </div>
          </form>
        </div>
      )} */}
    </div>
  );
};
