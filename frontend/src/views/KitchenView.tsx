import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Flame, RefreshCw, Printer, AlertTriangle, Utensils } from 'lucide-react';
import { Order } from '../types';
import { api } from '../services/api';
import { customAlert } from '../utils/alert';

interface KitchenViewProps {
  onShowTicket: (ticket: any) => void;
}

export const KitchenView: React.FC<KitchenViewProps> = ({ onShowTicket }) => {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  // Refresh clock every 10 seconds for live order timers
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadActiveOrders = async () => {
    try {
      setLoading(true);
      const orders = await api.getActiveOrders();
      // Only show orders that have pending or cooking items
      setActiveOrders(orders);
    } catch (err) {
      console.error('Error loading kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveOrders();
  }, []);

  const getElapsedTimeMinutes = (createdDateStr: string) => {
    const created = new Date(createdDateStr).getTime();
    const diffMs = now.getTime() - created;
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const handlePrintComanda = async (orderId: number) => {
    try {
      const res = await api.printKitchenComanda(orderId);
      onShowTicket(res);
    } catch (err: any) {
      customAlert(err.message || 'Error al imprimir comanda');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-600/30">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Pantalla de Cocina / KDS</h2>
            <p className="text-xs text-slate-400">
              {activeOrders.length} {activeOrders.length === 1 ? 'comanda activa' : 'comandas activas en preparación'}
            </p>
          </div>
        </div>

        <button
          onClick={loadActiveOrders}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center gap-2 transition-colors active:scale-95"
        >
          <RefreshCw className="w-4 h-4 text-orange-400" />
          Actualizar Pantalla
        </button>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeOrders.map(order => {
          const elapsed = getElapsedTimeMinutes(order.created_at);
          const isUrgent = elapsed >= 15;
          const isWarning = elapsed >= 10 && elapsed < 15;

          return (
            <div
              key={order.id}
              className={`bg-slate-900 border rounded-3xl p-5 flex flex-col justify-between shadow-xl transition-all ${
                isUrgent
                  ? 'border-rose-500/80 ring-2 ring-rose-500/30 bg-rose-950/10'
                  : isWarning
                  ? 'border-amber-500/80 bg-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              {/* Order Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">
                      #{order.order_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase ${
                      order.type === 'dine_in' 
                        ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                        : 'bg-purple-600/30 text-purple-400 border border-purple-500/30'
                    }`}>
                      {order.type === 'dine_in' ? (order.table_name || 'Comedor') : 'Para Llevar'}
                    </span>
                  </div>

                  {/* Timer */}
                  <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl ${
                    isUrgent
                      ? 'bg-rose-600 text-white animate-pulse'
                      : isWarning
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>hace {elapsed} min</span>
                  </div>
                </div>

                {order.customer_name && (
                  <div className="text-xs text-slate-300 mb-3 font-semibold">
                    Cliente: <span className="text-white">{order.customer_name}</span>
                  </div>
                )}

                {/* Items List */}
                <div className="my-3 flex flex-col gap-2.5">
                  {order.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-orange-600 text-white text-xs flex items-center justify-center font-black">
                            {it.quantity}x
                          </span>
                          {it.product_name}
                        </span>
                      </div>

                      {/* Notes in highlighted alert box */}
                      {it.notes && (
                        <div className="mt-1 bg-rose-950/60 border border-rose-800/80 text-rose-300 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                          <span>NOTA: {it.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="p-2.5 bg-amber-950/40 border border-amber-900/60 rounded-xl text-xs text-amber-300 font-semibold mb-3">
                    <b>Nota de orden:</b> {order.notes}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintComanda(order.id)}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Reimprimir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeOrders.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">¡Cocina al día!</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            No hay comandas pendientes en preparación. Las nuevas órdenes aparecerán aquí en tiempo real automáticamente.
          </p>
        </div>
      )}
    </div>
  );
};
