import React, { useEffect, useState } from 'react';
import { BarChart3, Calendar, DollarSign, ArrowRightLeft, CreditCard, Banknote, ShoppingBag, Smartphone, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export const ReportsView: React.FC = () => {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('day');
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [viewAll, setViewAll] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getSalesReport(period);
      setReportData(data);
      if (data && data.length > 0) {
        setSelectedRow(data[0]);
        setViewAll(false);
      } else {
        setSelectedRow(null);
        setViewAll(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const periods = [
    { id: 'day', label: 'Diario' },
    { id: 'week', label: 'Semanal' },
    { id: 'month', label: 'Mensual' },
    { id: 'year', label: 'Anual' }
  ];

  // Helper to format human-readable labels for each period
  const formatDisplayPeriod = (periodType: string, row: any) => {
    if (!row) return '';
    if (periodType === 'week') {
      return row.period_label || row.period;
    }
    if (periodType === 'month' && row.period) {
      const parts = row.period.split('-');
      if (parts.length === 2) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${months[mIdx] || parts[1]} ${parts[0]}`;
      }
      return row.period_label || row.period;
    }
    if (periodType === 'day') {
      return row.period_label || row.period;
    }
    return row.period_label || row.period;
  };

  // Metrics to display in cards: either specific selected row or accumulated overall
  const activeMetrics = viewAll
    ? {
        total_sales: reportData.reduce((acc, row) => acc + (row.total_sales || 0), 0),
        total_orders: reportData.reduce((acc, row) => acc + (row.total_orders || 0), 0),
        cash_sales: reportData.reduce((acc, row) => acc + (row.cash_sales || 0), 0),
        card_sales: reportData.reduce((acc, row) => acc + (row.card_sales || 0), 0),
        transfer_sales: reportData.reduce((acc, row) => acc + (row.transfer_sales || 0), 0),
        delivery_sales: reportData.reduce((acc, row) => acc + (row.delivery_sales || 0), 0),
      }
    : (selectedRow || {
        total_sales: 0,
        total_orders: 0,
        cash_sales: 0,
        card_sales: 0,
        transfer_sales: 0,
        delivery_sales: 0,
      });

  const periodSubtitle = () => {
    if (viewAll) return 'Acumulado Total (Todo el Historial)';
    if (!selectedRow) return 'Sin registros';
    const label = formatDisplayPeriod(period, selectedRow);
    if (period === 'day') return `Día: ${label}`;
    if (period === 'week') return `Semana: ${label}`;
    if (period === 'month') return `Mes: ${label}`;
    return `Año: ${label}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 p-4 md:p-6 overflow-hidden max-w-7xl mx-auto w-full">
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Informes de Ventas</h2>
            <p className="text-xs md:text-sm text-slate-400">Análisis interactivo e historial detallado</p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                period === p.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-102' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Cargando reporte de ventas...
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Active Period / Scope Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Resumen en tarjetas
                </span>
                <span className="text-sm md:text-base font-black text-white flex items-center gap-2 flex-wrap">
                  {periodSubtitle()}
                  {!viewAll && selectedRow && reportData.length > 0 && selectedRow.period === reportData[0].period && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      {period === 'day' ? 'Hoy / Más Reciente' : (period === 'week' ? 'Semana Actual' : (period === 'month' ? 'Mes Actual' : 'Año Actual'))}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Toggle between specific period and total accumulation */}
            {reportData.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (viewAll) {
                      setViewAll(false);
                      if (reportData.length > 0) setSelectedRow(reportData[0]);
                    } else {
                      setViewAll(true);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    viewAll
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{viewAll ? 'Viendo Acumulado Total' : 'Ver Acumulado Total'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 shrink-0">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg col-span-2 md:col-span-1 xl:col-span-1 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Total Ventas
              </span>
              <div className="text-2xl md:text-3xl font-black text-white">
                ${activeMetrics.total_sales.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <ShoppingBag className="w-4 h-4 text-orange-400" /> Órdenes
              </span>
              <div className="text-2xl md:text-3xl font-black text-white">
                {activeMetrics.total_orders}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-emerald-400" /> Efectivo
              </span>
              <div className="text-2xl md:text-3xl font-black text-emerald-400">
                ${activeMetrics.cash_sales.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-400" /> Tarjeta
              </span>
              <div className="text-2xl md:text-3xl font-black text-blue-400">
                ${activeMetrics.card_sales.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" /> Transferencia
              </span>
              <div className="text-2xl md:text-3xl font-black text-purple-400">
                ${activeMetrics.transfer_sales.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-cyan-400" /> App
              </span>
              <div className="text-2xl md:text-3xl font-black text-cyan-400">
                ${activeMetrics.delivery_sales.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Interactive Breakdown Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col min-h-[300px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Desglose por Período
                </h3>
                <p className="text-[11px] text-slate-400">
                  Haz clic en cualquier fila para seleccionarla y actualizar las tarjetas de arriba
                </p>
              </div>
              <div className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                {reportData.length} {reportData.length === 1 ? 'registro' : 'registros'}
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-slate-800/80 rounded-2xl">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3.5 border-b border-slate-800">
                      {period === 'day' ? 'Día / Fecha' : (period === 'week' ? 'Rango Semanal' : (period === 'month' ? 'Mes' : 'Año'))}
                    </th>
                    <th className="p-3.5 border-b border-slate-800 text-center">Órdenes</th>
                    <th className="p-3.5 border-b border-slate-800 text-right">Efectivo</th>
                    <th className="p-3.5 border-b border-slate-800 text-right">Tarjeta</th>
                    <th className="p-3.5 border-b border-slate-800 text-right">Transf.</th>
                    <th className="p-3.5 border-b border-slate-800 text-right">Aplicación</th>
                    <th className="p-3.5 border-b border-slate-800 text-right">Total Período</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {reportData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                        No hay ventas registradas en este período
                      </td>
                    </tr>
                  ) : (
                    reportData.map((row, idx) => {
                      const isSelected = !viewAll && selectedRow?.period === row.period;
                      const isCurrent = idx === 0;
                      const displayLabel = formatDisplayPeriod(period, row);

                      return (
                        <tr
                          key={row.period || idx}
                          onClick={() => {
                            setSelectedRow(row);
                            setViewAll(false);
                          }}
                          className={`cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-blue-600/15 border-l-4 border-l-blue-500 text-white shadow-sm'
                              : 'hover:bg-slate-900/90 text-slate-300'
                          }`}
                        >
                          <td className="p-3.5 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span className={isSelected ? 'text-blue-300 font-black' : 'text-slate-100'}>
                                {displayLabel}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Actual
                                </span>
                              )}
                              {isSelected && (
                                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white shadow-sm">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Activo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center text-slate-300 font-bold">{row.total_orders}</td>
                          <td className="p-3.5 text-right text-emerald-400 font-bold">${row.cash_sales.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-blue-400 font-bold">${row.card_sales.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-purple-400 font-bold">${row.transfer_sales.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-cyan-400 font-bold">${row.delivery_sales.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-white font-black text-base">${row.total_sales.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
