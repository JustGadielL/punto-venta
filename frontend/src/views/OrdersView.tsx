import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Order, PrintedTicket } from '../types';
import { ClipboardList, Search, Edit2, ShoppingBag, Clock, Store, Bike, Utensils, Printer } from 'lucide-react';

interface OrdersViewProps {
  onSelectTableForPos: (tableId: number) => void;
  onSelectOrderForPos?: (orderId: number) => void;
  onOpenCheckout: (order: Order) => void;
  onShowTicket: (ticket: PrintedTicket | any) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onSelectTableForPos, onSelectOrderForPos, onOpenCheckout, onShowTicket }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const dataOpen = await api.getActiveOrders();
      const dataClosed = await api.getOrders('paid,refunded');
      setOrders([...dataOpen, ...dataClosed]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // Polling for updates
    return () => clearInterval(interval);
  }, []);

  const handleEditOrder = (order: Order) => {
    if (order.table_id) {
      onSelectTableForPos(order.table_id);
    } else {
      if (onSelectOrderForPos) {
        onSelectOrderForPos(order.id);
      }
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_number.toString().includes(searchTerm) || 
                          (o.customer_name && o.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (o.table_name && o.table_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (tab === 'open') return matchesSearch && o.status !== 'paid' && o.status !== 'cancelled' && o.status !== 'refunded';
    return matchesSearch && (o.status === 'paid' || o.status === 'refunded');
  });

  const getTypeIcon = (type: string) => {
    if (type === 'dine_in') return <Utensils className="w-4 h-4 text-sky-400" />;
    if (type === 'take_out' || type === 'takeaway') return <Store className="w-4 h-4 text-amber-400" />;
    if (type === 'delivery') return <Bike className="w-4 h-4 text-purple-400" />;
    return <Utensils className="w-4 h-4 text-slate-400" />;
  };

  const getTypeName = (type: string) => {
    if (type === 'dine_in') return 'Comedor';
    if (type === 'take_out' || type === 'takeaway') return 'Para llevar';
    if (type === 'delivery') return 'App';
    return type;
  };

  const getTypeLabel = (type: string) => {
    if (type === 'dine_in') return 'Comedor';
    if (type === 'takeaway') return 'Para Llevar';
    if (type === 'delivery') return 'Aplicación';
    return type;
  };

  const getElapsedTime = (created_at: string) => {
    const utcDate = new Date(created_at.replace(' ', 'T') + 'Z');
    const diffMs = new Date().getTime() - utcDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hr ${diffMins % 60} min`;
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between shadow-xl shrink-0 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-800 flex items-center justify-center text-white border border-orange-700 shadow-lg">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Pedidos</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button 
              onClick={() => setTab('open')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'open' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Abiertos
            </button>
            <button 
              onClick={() => setTab('closed')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'closed' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Cerrados
            </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar pedido..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-slate-950 border border-slate-800 rounded-2xl text-sm font-semibold text-white focus:outline-none focus:border-orange-500 shadow-inner"
            />
          </div>
        </div>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto pr-2">
        {loading && orders.length === 0 ? (
          <div className="text-center py-10 text-slate-400">Cargando...</div>
        ) : (
          <div className="flex flex-col gap-3 pb-28">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-500 font-bold">No hay pedidos en esta sección</div>
            ) : (
              filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => tab === 'open' && handleEditOrder(order)}
                  className={`bg-slate-900 border ${tab === 'open' ? 'border-orange-500/20 hover:border-orange-500/50 cursor-pointer hover:bg-slate-800' : 'border-slate-800'} rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all shadow-xl`}
                >
                  
                  {/* Left Side: Basic Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-5 w-full md:w-auto">
                    <div className="flex flex-col items-start w-24">
                      <span className="font-black text-2xl text-white">#{order.order_number}</span>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-lg text-xs font-bold text-slate-400">
                        {getTypeIcon(order.type)}
                        <span className="capitalize">{getTypeName(order.type)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col border-l border-slate-700 pl-6 space-y-1">
                      {order.table_name && (
                        <div className="text-sm flex items-center gap-2">
                          <span className="text-slate-500 font-semibold w-16">Mesa:</span> 
                          <span className="text-white font-bold">{order.table_name}</span>
                        </div>
                      )}
                      {order.customer_name && (
                        <div className="text-sm flex items-center gap-2">
                          <span className="text-slate-500 font-semibold w-16">Cliente:</span> 
                          <span className="text-white font-bold">{order.customer_name}</span>
                        </div>
                      )}
                      <div className="text-sm flex items-center gap-2">
                        <span className="text-slate-500 font-semibold w-16">Artículos:</span> 
                        <span className="text-slate-300">{order.item_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Time / Status */}
                  <div className="flex flex-col justify-center items-center md:items-start border-l-0 md:border-l border-slate-700 pl-0 md:pl-6 w-full md:w-48 shrink-0">
                    {tab === 'closed' && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mb-2 ${order.status === 'refunded' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                        {order.status === 'refunded' ? 'Reembolsado' : 'Pagado'}
                      </span>
                    )}
                    {tab === 'open' ? (
                      <div className="text-sm flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400">Tiempo:</span>
                        <span className="text-orange-400 font-bold">{getElapsedTime(order.created_at)}</span>
                      </div>
                    ) : (
                      <div className="text-sm flex flex-col">
                        <span className="text-slate-500 font-semibold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Cerrado</span> 
                        <span className="text-slate-400 font-medium text-xs mt-0.5">
                          {new Date((order.closed_at || order.created_at).replace(' ', 'T') + 'Z').toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Total & Actions */}
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0 border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                    <div className="font-black text-2xl text-emerald-400">${order.total.toFixed(2)}</div>
                    <div className="flex gap-2">
                      {tab === 'open' ? (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrder(order);
                            }} 
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors shadow" 
                            title="Editar Pedido"
                          >
                            <Edit2 className="w-5 h-5 text-slate-300" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCheckout(order);
                            }} 
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/50"
                          >
                            <ShoppingBag className="w-4 h-4" /> Cobrar
                          </button>
                        </>
                      ) : (
                        <button onClick={() => api.printOrderReceipt(order.id).then(onShowTicket)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold flex items-center gap-2 transition-colors shadow">
                          <Printer className="w-4 h-4" /> Ticket
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
