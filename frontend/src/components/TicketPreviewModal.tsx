import React from 'react';
import { X, Printer, Copy, Check } from 'lucide-react';
import { PrintedTicket } from '../types';

interface TicketPreviewModalProps {
  ticket: PrintedTicket | { title?: string; content_plain?: string; content_html?: string; plainText?: string; htmlContent?: string; type?: string } | null;
  onClose: () => void;
  onPhysicalPrint?: () => void;
}

export const TicketPreviewModal: React.FC<TicketPreviewModalProps> = ({ ticket, onClose, onPhysicalPrint }) => {
  const [copied, setCopied] = React.useState(false);

  if (!ticket) return null;

  const handleCopyText = () => {
    const textToCopy = ticket?.content_plain || (ticket as any)?.plainText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBrowserPrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${ticket.title || 'Ticket'}</title>
            <style>
              body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; }
              @media print {
                @page { margin: 0; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${ticket.content_html || (ticket as any).htmlContent || ''}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-paper max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="font-bold text-slate-100 text-sm md:text-base truncate">{ticket.title || (ticket.type === 'kitchen_comanda' ? 'Comanda' : 'Ticket')}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-slate-950 flex justify-center flex-1 overflow-y-auto min-h-0">
          <div 
            className="w-full shadow-lg rounded"
            dangerouslySetInnerHTML={{ __html: ticket.content_html || (ticket as any).htmlContent || '' }}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex flex-wrap gap-2 justify-between items-center shrink-0">
          <button
            onClick={handleCopyText}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar Texto'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleBrowserPrint}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ticket
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs md:text-sm font-semibold transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
