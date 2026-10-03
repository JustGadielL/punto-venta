import React, { useState, useEffect } from 'react';
import { Printer, RefreshCw, Copy, Check, FileText, ChefHat, Wine, Receipt, Sparkles } from 'lucide-react';
import { PrintedTicket } from '../types';
import { api } from '../services/api';
import { customAlert } from '../utils/alert';

interface PrinterViewProps {
  onShowTicket: (ticket: any) => void;
}

export const PrinterView: React.FC<PrinterViewProps> = ({ onShowTicket }) => {
  const [tickets, setTickets] = useState<PrintedTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<PrintedTicket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getPrintedTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      const res = await api.testPrint();
      onShowTicket(res);
      loadTickets();
    } catch (err: any) {
      customAlert(err.message || 'Error en prueba de impresión');
    }
  };

  const handleBrowserPrint = () => {
    if (!selectedTicket) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${selectedTicket.title}</title>
            <style>
              body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; }
              @media print {
                @page { margin: 0; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${selectedTicket.content_html}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleCopy = () => {
    if (selectedTicket?.content_plain) {
      navigator.clipboard.writeText(selectedTicket.content_plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-orange-400 border border-slate-700 shadow-lg">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Centro de Impresión & Tickets Térmicos</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulador visual de ticketera ESC/POS y registro de tickets emitidos
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={loadTickets}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>

          <button
            onClick={handleTestPrint}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4" />
            Imprimir Ticket de Prueba
          </button>
        </div>
      </div>

      {/* Main Grid: Ticket List (Left) & Ticket Render Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Tickets List */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col max-h-[75vh] overflow-hidden">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">
            Historial de Impresiones Recientes ({tickets.length})
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {tickets.map(t => {
              const isSelected = selectedTicket?.id === t.id;
              const typeIcon = t.type === 'kitchen_comanda' 
                ? <FileText className="w-4 h-4 text-amber-400" />
                : (t.type === 'bar_comanda' 
                    ? <FileText className="w-4 h-4 text-purple-400" />
                    : (t.type === 'cash_shift' ? <Receipt className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-emerald-400" />));

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 rounded-2xl border cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-900">
                        {typeIcon}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white line-clamp-1">{t.title}</h4>
                        <span className="text-[10px] text-slate-400">
                          {new Date(t.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      #{t.id}
                    </span>
                  </div>
                </div>
              );
            })}

            {tickets.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500 text-xs">
                No hay tickets emitidos aún
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Thermal Paper Preview Simulation */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center">
          <div className="w-full flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
            <div>
              <span className="text-xs font-bold text-orange-400 uppercase">Simulador de Ticket Térmico</span>
              <h3 className="text-base font-black text-white">
                {selectedTicket ? selectedTicket.title : 'Selecciona un ticket'}
              </h3>
            </div>

            {selectedTicket && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={handleBrowserPrint}
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>
            )}
          </div>

          {/* Ticket Visualizer Container */}
          {selectedTicket ? (
            <div className="w-full flex justify-center py-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 overflow-y-auto max-h-[60vh]">
              <div 
                className="shadow-2xl rounded-sm transform transition-transform"
                dangerouslySetInnerHTML={{ __html: selectedTicket.content_html }}
              />
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 text-xs">
              Selecciona un ticket del historial izquierdo para previsualizarlo
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
