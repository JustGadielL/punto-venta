import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock, 
  Unlock, 
  Plus, 
  Clock, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  CreditCard, 
  ArrowRightLeft,
  Calculator,
  X,
  Smartphone
} from 'lucide-react';
import { CashShift, CashMovement, PrintedTicket } from '../types';
import { parseLocalDate, formatTime, formatDate, formatDateTime } from '../utils/dateUtils';
import { api } from '../services/api';
import { customAlert, customConfirm } from '../utils/alert';

interface CashViewProps {
  activeShift: CashShift | null;
  onRefreshShift: () => void;
  onShowTicket: (ticket: any) => void;
}

export const CashView: React.FC<CashViewProps> = ({
  activeShift,
  onRefreshShift,
  onShowTicket
}) => {
  // Modals state
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [showMovementModal, setShowMovementModal] = useState<'in' | 'out' | null>(null);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState<any | null>(null);

  // Default to manual input instead of breakdown calculator
  const [useBreakdown, setUseBreakdown] = useState<boolean>(false);
  const [denominations, setDenominations] = useState<Record<number, number>>({});
  const [manualCountedCash, setManualCountedCash] = useState<string>('');

  // Open Shift form
  const [cashierName, setCashierName] = useState<string>('Cajero Principal');
  const [initialAmount, setInitialAmount] = useState<string>('0');
  const [openNotes, setOpenNotes] = useState<string>('');

  // Movement form
  const [movAmount, setMovAmount] = useState<string>('');
  const [movReason, setMovReason] = useState<string>('');

  // Close shift count breakdown (bills & coins)
  const [closeNotes, setCloseNotes] = useState<string>('');

  // Shifts history
  const [historyList, setHistoryList] = useState<CashShift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    loadHistory();
  }, [activeShift]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await api.getShiftHistory();
      setHistoryList(data);
    } catch (err) {
      console.error('Error loading shift history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Calculate counted cash from breakdown
  const breakdownTotal = Object.entries(denominations).reduce(
    (sum, [denom, count]) => sum + (Number(denom) * (count || 0)), 
    0
  );

  const countedCash = useBreakdown 
    ? breakdownTotal 
    : (parseFloat(manualCountedCash) || 0);

  const expectedCash = activeShift ? (activeShift.expected_cash || (
    activeShift.initial_amount + 
    activeShift.total_cash_sales + 
    (activeShift.total_in_movements || 0) - 
    (activeShift.total_out_movements || 0)
  )) : 0;

  const difference = countedCash - expectedCash;

  // Handlers
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.openShift({
        cashier_name: cashierName,
        initial_amount: parseFloat(initialAmount) || 0,
        notes: openNotes
      });
      setShowOpenModal(false);
      onRefreshShift();
    } catch (err: any) {
      customAlert(err.message || 'Error al abrir caja');
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMovementModal || !movAmount || !movReason) return;
    try {
      await api.createCashMovement({
        type: showMovementModal,
        amount: parseFloat(movAmount),
        reason: movReason
      });
      setShowMovementModal(null);
      setMovAmount('');
      setMovReason('');
      onRefreshShift();
    } catch (err: any) {
      customAlert(err.message || 'Error al registrar movimiento');
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (!await customConfirm('¿Estás seguro de que deseas realizar el CORTE DE CAJA (Cierre Z)? Esta acción cerrará el turno actual.')) {
      return;
    }

    try {
      const res = await api.closeShift({
        actual_cash: countedCash,
        notes: closeNotes
      });
      setShowCloseModal(false);
      onRefreshShift();
      if (res.ticket) {
        onShowTicket(res.ticket);
      }
    } catch (err: any) {
      customAlert(err.message || 'Error al cerrar caja');
    }
  };


  const handleViewPastShift = async (shiftId: number) => {
    try {
      const detail = await api.getShiftDetail(shiftId);
      setShowHistoryDetail(detail);
    } catch (err: any) {
      customAlert(err.message || 'Error al cargar detalle del turno');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 pb-24 flex flex-col gap-6">
      {/* Top Banner / Shift Status */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl ${
            activeShift
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
          }`}>
            {activeShift ? <Unlock className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white">
                {activeShift ? `Turno de Caja #${activeShift.id}` : 'Caja Cerrada'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                activeShift ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
              }`}>
                {activeShift ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {activeShift
                ? `Cajero: ${activeShift.cashier_name} • Apertura: ${formatTime(activeShift.opened_at)}`
                : 'Debes realizar la apertura de caja para comenzar a cobrar órdenes'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
          {activeShift ? (
            <>
              <button
                onClick={() => setShowMovementModal('in')}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                + Ingreso
              </button>
              <button
                onClick={() => setShowMovementModal('out')}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                - Egreso / Gasto
              </button>
              <button
                onClick={() => {
                  setManualCountedCash(expectedCash.toFixed(2));
                  setShowCloseModal(true);
                }}
                className="flex-1 lg:flex-none px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <Receipt className="w-4 h-4" />
                Cerrar Caja (Corte)
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Unlock className="w-5 h-5" />
              Realizar Apertura de Caja
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      {activeShift && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Fondo Inicial */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Fondo Inicial</span>
            <div className="text-xl font-black text-white mt-1">
              ${activeShift.initial_amount.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Efectivo base</span>
          </div>

          {/* Ventas Efectivo */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Ventas Efectivo
            </span>
            <div className="text-xl font-black text-emerald-400 mt-1">
              +${activeShift.total_cash_sales.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Cobrado en caja</span>
          </div>

          {/* Ventas Tarjeta */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-blue-400 uppercase flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Ventas Tarjeta
            </span>
            <div className="text-xl font-black text-blue-400 mt-1">
              +${activeShift.total_card_sales.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Terminal bancaria</span>
          </div>

          {/* Ventas Transferencia */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-purple-400 uppercase flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              Transferencias
            </span>
            <div className="text-xl font-black text-purple-400 mt-1">
              +${activeShift.total_transfer_sales.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">SPEI / Banco</span>
          </div>

          {/* Ventas App */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-cyan-400 uppercase flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              Ventas App
            </span>
            <div className="text-xl font-black text-cyan-400 mt-1">
              +${(activeShift.total_delivery_sales || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Pedidos por App</span>
          </div>

          {/* Propinas */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-yellow-400 uppercase flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Propinas
            </span>
            <div className="text-xl font-black text-yellow-400 mt-1">
              +${(activeShift.total_tips || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Incluidas en ventas</span>
          </div>

          {/* Entradas / Salidas Extra */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase">Movimientos</span>
            <div className="text-sm font-bold text-slate-200 mt-1">
              <div className="text-emerald-400">+${(activeShift.total_in_movements || 0).toFixed(2)}</div>
              <div className="text-rose-400">-${(activeShift.total_out_movements || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* TOTAL EFECTIVO ESPERADO */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 rounded-2xl flex flex-col justify-between text-white shadow-lg shadow-emerald-600/20 col-span-2 sm:col-span-1 lg:col-span-1">
            <span className="text-[11px] font-black uppercase text-emerald-100">Efectivo en Caja</span>
            <div className="text-2xl font-black mt-1">
              ${expectedCash.toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-100 mt-1">Monto esperado</span>
          </div>
        </div>
      )}

      {/* Movements Table for Current Shift */}
      {activeShift && activeShift.movements && activeShift.movements.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            Movimientos Manuales del Turno Actual
          </h3>
          <div className="divide-y divide-slate-800">
            {activeShift.movements.map(m => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    m.type === 'in' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                  }`}>
                    {m.type === 'in' ? '+' : '-'}
                  </span>
                  <div>
                    <span className="font-bold text-white">{m.reason}</span>
                    <span className="text-slate-500 ml-2">{formatTime(m.created_at)}</span>
                  </div>
                </div>
                <span className={`font-black text-sm ${m.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.type === 'in' ? '+' : '-'}${m.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts History */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-orange-400" />
          Historial de Cortes de Caja Anteriores
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">Turno</th>
                <th className="p-3">Cajero</th>
                <th className="p-3">Apertura / Cierre</th>
                <th className="p-3">Total Ventas</th>
                <th className="p-3">Efectivo Real</th>
                <th className="p-3">Diferencia</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {historyList.map(shift => (
                <tr 
                  key={shift.id} 
                  className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => handleViewPastShift(shift.id)}
                >
                  <td className="p-3 text-white font-medium">#{shift.id}</td>
                  <td className="p-3 text-slate-300">{shift.cashier_name}</td>
                  <td className="p-3 text-slate-300">
                    <div>{formatDate(shift.opened_at)}</div>
                    <div className="text-xs text-slate-500">
                      {formatTime(shift.opened_at)} → {shift.closed_at ? formatTime(shift.closed_at) : 'Activo'}
                    </div>
                  </td>
                  <td className="p-3 font-bold text-emerald-400">${shift.total_sales.toFixed(2)}</td>
                  <td className="p-3 font-bold">${(shift.actual_cash || shift.expected_cash || 0).toFixed(2)}</td>
                  <td className="p-3">
                    {shift.difference !== null ? (
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        shift.difference === 0 
                          ? 'bg-emerald-950 text-emerald-400' 
                          : (shift.difference > 0 ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400')
                      }`}>
                        {shift.difference === 0 ? 'Cuadrada' : (shift.difference > 0 ? `+${shift.difference.toFixed(2)}` : `${shift.difference.toFixed(2)}`)}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPastShift(shift.id);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Apertura de Caja */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleOpenShift} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-400" />
              Apertura de Turno de Caja
            </h3>
            <p className="text-xs text-slate-400">
              Registra el cajero responsable y el fondo de efectivo inicial en la gaveta.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Cajero</label>
              <input
                type="text"
                required
                value={cashierName}
                onChange={e => setCashierName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fondo Inicial ($)</label>
              <input
                type="number"
                step="10"
                min="0"
                required
                value={initialAmount}
                onChange={e => setInitialAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xl text-emerald-400 font-black focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Observaciones (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Turno matutino..."
                value={openNotes}
                onChange={e => setOpenNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30"
              >
                Confirmar Apertura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Entrada / Salida de Efectivo */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateMovement} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              {showMovementModal === 'in' ? (
                <>
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  Registrar Entrada Extra de Efectivo
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-5 h-5 text-rose-400" />
                  Registrar Retiro / Gasto de Caja
                </>
              )}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={movAmount}
                onChange={e => setMovAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xl font-black text-white focus:outline-none focus:border-orange-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Motivo / Concepto</label>
              <input
                type="text"
                required
                placeholder={showMovementModal === 'in' ? 'Ej: Aportación de cambio' : 'Ej: Pago de hielo, limones, basura...'}
                value={movReason}
                onChange={e => setMovReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowMovementModal(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg ${
                  showMovementModal === 'in'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                }`}
              >
                Guardar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Cierre de Turno Z (Arqueo de Efectivo con Desglose) */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-orange-400 uppercase">Cierre de Turno (Corte)</span>
                <h3 className="text-xl font-black text-white">Arqueo y Conteo de Efectivo</h3>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Cash breakdown */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase">Desglose de Billetes y Monedas</span>
                  <button
                    type="button"
                    onClick={() => setUseBreakdown(!useBreakdown)}
                    className="text-xs text-orange-400 hover:underline font-semibold"
                  >
                    {useBreakdown ? 'Ingresar monto manual' : 'Usar calculadora'}
                  </button>
                </div>

                {useBreakdown ? (
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {[1000, 500, 200, 100, 50, 20, 10, 5, 2, 1].map(d => (
                      <div key={d} className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <span className="text-xs font-bold text-slate-300 w-12">${d}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={denominations[d] || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setDenominations({ ...denominations, [d]: val });
                          }}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg text-right px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto Total Contado ($)</label>
                    <input
                      type="number"
                      step="0.50"
                      value={manualCountedCash}
                      onChange={e => setManualCountedCash(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Comparative Totals */}
              <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col gap-3">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-xs text-slate-400 font-bold uppercase mb-2 block">Desglose de Efectivo Esperado</span>
                    <div className="flex flex-col gap-1 text-sm font-medium text-slate-300">
                      <div className="flex justify-between">
                        <span>Fondo Inicial:</span>
                        <span>${activeShift.initial_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>+ Ventas Efectivo:</span>
                        <span>${activeShift.total_cash_sales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>+ Entradas:</span>
                        <span>${(activeShift.total_in_movements || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>- Salidas:</span>
                        <span>${(activeShift.total_out_movements || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-800 text-lg font-black text-white">
                        <span>Total Esperado:</span>
                        <span>${expectedCash.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-xs text-slate-400 font-bold uppercase">Efectivo Contado Real</span>
                    <div className="text-3xl font-black text-emerald-400 mt-1">
                      ${countedCash.toFixed(2)}
                    </div>
                  </div>

                  {/* Difference Badge */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    difference === 0
                      ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                      : (difference > 0 ? 'bg-amber-950/40 border-amber-800/80 text-amber-300' : 'bg-rose-950/40 border-rose-800/80 text-rose-300')
                  }`}>
                    <div>
                      <span className="text-xs uppercase font-bold">Diferencia:</span>
                      <div className="text-lg font-black">
                        {difference === 0 ? '¡Caja Cuadrada ($0.00)!' : (difference > 0 ? `Sobrante: +$${difference.toFixed(2)}` : `Faltante: -$${Math.abs(difference).toFixed(2)}`)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notas de Cierre</label>
                  <input
                    type="text"
                    placeholder="Observaciones finales..."
                    value={closeNotes}
                    onChange={e => setCloseNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
              >
                Imprimir Corte y Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detalle de Turno Histórico */}
      {showHistoryDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex flex-col">
                  <h3 className="font-black text-lg text-white">
                    Resumen de Turno #{showHistoryDetail.shift.id}
                  </h3>
                  <span className="text-slate-400 text-xs mt-1">Cajero: {showHistoryDetail.shift.cashier_name}</span>
                </div>
                <button onClick={() => setShowHistoryDetail(null)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-sm text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-around">
                <span><span className="font-bold text-slate-300">Apertura:</span> {formatDateTime(showHistoryDetail.shift.opened_at)}</span>
                {showHistoryDetail.shift.closed_at && (
                  <span><span className="font-bold text-slate-300">Cierre:</span> {formatDateTime(showHistoryDetail.shift.closed_at)}</span>
                )}
              </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div><span className="font-bold text-slate-400">Ventas Totales:</span> <span className="text-white">${showHistoryDetail.shift.total_sales.toFixed(2)}</span></div>
              <div><span className="font-bold text-slate-400">Efectivo:</span> <span className="text-emerald-400">${showHistoryDetail.shift.total_cash_sales.toFixed(2)}</span></div>
              <div><span className="font-bold text-slate-400">Tarjeta/Transf:</span> <span className="text-blue-400">${(showHistoryDetail.shift.total_card_sales + showHistoryDetail.shift.total_transfer_sales).toFixed(2)}</span></div>
              <div><span className="font-bold text-slate-400">Ventas por App:</span> <span className="text-cyan-400">${(showHistoryDetail.shift.total_delivery_sales || 0).toFixed(2)}</span></div>
              <div><span className="font-bold text-slate-400">Fondo Inicial:</span> <span className="text-white">${showHistoryDetail.shift.initial_amount.toFixed(2)}</span></div>
              <div><span className="font-bold text-slate-400">Dif. de Caja:</span> <span className={`font-bold ${showHistoryDetail.shift.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${showHistoryDetail.shift.difference?.toFixed(2) || '0.00'}</span></div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={async () => {
                  try {
                    const res = await api.printShiftReport(showHistoryDetail.shift.id);
                    onShowTicket(res);
                  } catch (e) {}
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ticket de Corte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
