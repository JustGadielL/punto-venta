import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Order, PrintedTicket } from '../types';
import { Receipt, Search, RotateCcw, Printer, X } from 'lucide-react';
import { formatDateTime } from '../utils/dateUtils';
import { customAlert, customConfirm } from '../utils/alert';

interface TransactionsViewProps {
  onShowTicket: (ticket: PrintedTicket | any) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onShowTicket }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'refunded'>('all');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrders('paid,refunded');
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingDetail(true);
    try {
      const fullOrder = await api.getOrder(order.id);
      setSelectedOrder(fullOrder);
    } catch (err) {
      console.error('Error fetching order detail', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const translatePaymentMethod = (method: string) => {
    switch(method) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      case 'delivery': return 'Aplicación';
      default: return method;
    }
  };

  const handlePrint = async (orderId: number) => {
    try {
      const res = await api.printOrderReceipt(orderId);
      if (res) onShowTicket(res);
    } catch (e) {
      customAlert('Error al imprimir');
    }
  };

  const handleRefund = async (orderId: number) => {
    if (await customConfirm('¿Estás seguro de que deseas reembolsar esta transacción? Esto registrará un movimiento de egreso en caja.')) {
      try {
        await api.refundOrder(orderId);
        customAlert('Reembolso exitoso');
        setSelectedOrder(null);
        loadOrders();
      } catch (err: any) {
        customAlert(err.message || 'Error al reembolsar');
      }
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_number.toString().includes(searchTerm) || 
      (o.customer_name && o.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.table_name && o.table_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && o.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-800 flex items-center justify-center text-white border border-emerald-700 shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Transacciones</h2>
          </div>
        </div>
        
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar # de orden o cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-semibold text-white w-64 focus:outline-none focus:border-emerald-500 shadow-inner"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* LEFT SIDEBAR: List */}
        <div className="w-full md:w-1/3 shrink-0 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase">Transacciones</h3>
          </div>

          {/* Status Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3 text-xs font-bold shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ventas ({orders.filter(o => o.status === 'paid').length})
            </button>
            <button
              onClick={() => setStatusFilter('refunded')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'refunded' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Reembolsos ({orders.filter(o => o.status === 'refunded').length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
            {loading ? (
              <div className="text-center py-10 text-slate-500 text-sm font-semibold">Cargando...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm font-semibold">No hay transacciones</div>
            ) : (
              filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => handleSelectOrder(order)}
                  className={`p-3.5 rounded-2xl flex flex-col gap-1.5 border cursor-pointer transition-all active:scale-95 ${
                    selectedOrder?.id === order.id 
                      ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-400 shadow-md' 
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-black text-lg">#{order.order_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      order.status === 'refunded' 
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {order.status === 'refunded' ? 'Reembolsado' : 'Cobrado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-[11px] text-slate-400">
                      <div>{formatDateTime(order.closed_at || order.created_at)}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-slate-300">{translatePaymentMethod(order.payment_method || '')}</span>
                        {order.table_name ? (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-sky-300 rounded font-bold text-[10px]">
                            {order.table_name}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded font-bold text-[10px]">
                            {order.type === 'take_out' ? 'Para llevar' : (order.type === 'pickup' ? 'Recoger' : (order.type === 'delivery' ? 'App' : 'Mostrador'))}
                          </span>
                        )}
                        {order.customer_name && <span>• {order.customer_name}</span>}
                      </div>
                    </div>
                    <span className={`font-black text-base ${order.status === 'refunded' ? 'text-rose-400 line-through' : 'text-emerald-400'}`}>
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT AREA: Detail */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden">
          {selectedOrder ? (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-white">Orden #{selectedOrder.order_number}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      selectedOrder.status === 'refunded'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {selectedOrder.status === 'refunded' ? 'Reembolsado' : 'Cobrado'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {formatDateTime(selectedOrder.closed_at || selectedOrder.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePrint(selectedOrder.id)} 
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Copia
                  </button>
                  {selectedOrder.status !== 'refunded' && (
                    <button 
                      onClick={() => handleRefund(selectedOrder.id)} 
                      className="px-4 py-2 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/60 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Reembolsar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 flex flex-col gap-4">
                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Cliente / Mesa</div>
                    <div className="font-semibold text-slate-200 text-sm">
                      {selectedOrder.table_name ? (
                        <span className="text-sky-400 font-bold">{selectedOrder.table_name}</span>
                      ) : (
                        <span className="text-amber-400 font-bold">
                          {selectedOrder.type === 'take_out' ? 'Para Llevar' : (selectedOrder.type === 'pickup' ? 'Recoger' : (selectedOrder.type === 'delivery' ? 'App' : 'Mostrador'))}
                        </span>
                      )}
                      {selectedOrder.customer_name && <span className="text-slate-400 font-normal"> • {selectedOrder.customer_name}</span>}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Método de Pago</div>
                    <div className="font-semibold text-slate-300 text-sm capitalize">
                      {translatePaymentMethod(selectedOrder.payment_method || '')}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="relative min-h-[100px]">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Detalle de Productos</h4>
                  {loadingDetail ? (
                     <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold bg-slate-900/50 backdrop-blur-sm z-10 rounded-xl">Cargando productos...</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedOrder.items?.length ? selectedOrder.items.map((it, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                                {it.quantity}x
                              </span>
                              {it.product_name}
                            </div>
                            {it.notes && (
                              <div className="text-[10px] text-amber-500 pl-9 mt-0.5">{it.notes}</div>
                            )}
                          </div>
                          <div className="font-black text-sm text-emerald-400">
                            ${(it.unit_price * it.quantity).toFixed(2)}
                          </div>
                        </div>
                      )) : (
                        <div className="text-slate-500 text-center py-4">No hay productos en esta orden</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center bg-slate-950 p-5 rounded-2xl shadow-inner">
                <span className="text-sm font-bold text-slate-400">Total Transacción:</span>
                <span className={`text-3xl font-black ${selectedOrder.status === 'refunded' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedOrder.status === 'refunded' ? `-$${selectedOrder.total.toFixed(2)} (Reembolsado)` : `$${selectedOrder.total.toFixed(2)}`}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Receipt className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-semibold">Selecciona una transacción para ver su detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
