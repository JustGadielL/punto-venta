import { Router } from 'express';
import { db } from '../db/database.js';
import { PrinterService } from '../printer/printerService.js';
import { notifyTicketPrinted } from '../socket/socketHandler.js';

const router = Router();

// Get printed tickets history
router.get('/printer/history', (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const history = PrinterService.getRecentTickets(Number(limit));
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Print/Reprint order receipt
router.post('/printer/print-order/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = PrinterService.printOrderReceipt(Number(id));
    notifyTicketPrinted(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Print/Reprint kitchen comanda
router.post('/printer/print-kitchen/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = PrinterService.printKitchenComanda(Number(id));
    notifyTicketPrinted(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Print/Reprint shift report
router.post('/printer/print-shift/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = PrinterService.printShiftReport(Number(id));
    notifyTicketPrinted(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test print
router.post('/printer/test', (req, res) => {
  try {
    const plainText = `
========================================
     *** PRUEBA DE IMPRESORA POS ***
========================================
Fecha: ${new Date().toLocaleString('es-MX')}
Estado: Sistema POS Conectado
Modo: Virtual / ESC-POS Listo
----------------------------------------
Impresora térmica funcionando con éxito.
========================================
`;
    const htmlContent = `
      <div style="font-family: monospace; max-width: 300px; padding: 16px; background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 6px; text-align: center;">
        <h3 style="color: #15803d; margin: 0 0 6px 0;">✔ IMPRESIÓN DE PRUEBA</h3>
        <p style="font-size: 12px; margin: 0 0 8px 0; color: #166534;">La conexión con el módulo de impresión térmica está activa y operativa.</p>
        <div style="font-size: 10px; color: #64748b;">${new Date().toLocaleString('es-MX')}</div>
      </div>
    `;

    const saved = db.prepare(`
      INSERT INTO printed_tickets (type, reference_id, title, content_plain, content_html)
      VALUES (?, ?, ?, ?, ?)
    `).run('test', 0, 'Ticket de Prueba', plainText, htmlContent);

    const result = {
      success: true,
      type: 'test',
      id: Number(saved.lastInsertRowid),
      plainText,
      htmlContent,
      message: 'Ticket de prueba generado'
    };

    notifyTicketPrinted(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
