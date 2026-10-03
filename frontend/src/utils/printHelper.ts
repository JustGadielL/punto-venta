/**
 * Helper para impresión térmica directa
 */

export function printTicketHtml(htmlContent: string, title: string = 'Ticket') {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return false;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>${title}</title>
        <style>
          * {
            box-sizing: border-box;
            color: #000000 !important;
            border-color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            text-shadow: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace;
            font-size: 16px !important;
            line-height: 1.35 !important;
          }
          .ticket-comanda, .ticket-receipt, .ticket-corte, div[style*="max-width: 360px"], div[style*="max-width: 340px"] {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4px 2px !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          div[style*="font-size: 15px"], div[style*="font-size: 14px"] {
            font-size: 17px !important;
            font-weight: 900 !important;
          }
          div[style*="font-size: 13px"], div[style*="font-size: 12px"] {
            font-size: 15px !important;
          }
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
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
  return true;
}

export function isAutoPrintEnabled(): boolean {
  return localStorage.getItem('pos_auto_print') === 'true';
}

export function setAutoPrintEnabled(enabled: boolean) {
  localStorage.setItem('pos_auto_print', enabled ? 'true' : 'false');
}
