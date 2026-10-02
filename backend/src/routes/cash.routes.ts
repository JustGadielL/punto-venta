import { Router } from 'express';
import { db } from '../db/database.js';
import { notifyShiftUpdated, notifyTicketPrinted } from '../socket/socketHandler.js';
import { PrinterService } from '../printer/printerService.js';

const router = Router();

// --- Get Current Active Shift Summary ---
router.get('/cash/current-shift', (req, res) => {
  try {
    const shift = db.prepare(`
      SELECT * FROM cash_shifts 
      WHERE status = 'open' 
      ORDER BY id DESC LIMIT 1
    `).get() as any;

    if (!shift) {
      return res.json({ active: false, shift: null });
    }

    // Calculate real-time stats
    const movements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC').all(shift.id) as any[];
    const inTotal = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const outTotal = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);

    const ordersCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE shift_id = ? AND status = 'paid'").get(shift.id) as { count: number };

    const expectedCash = shift.initial_amount + shift.total_cash_sales + inTotal - outTotal;

    res.json({
      active: true,
      shift: {
        ...shift,
        total_in_movements: inTotal,
        total_out_movements: outTotal,
        expected_cash: expectedCash,
        paid_orders_count: ordersCount.count,
        movements
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Open Shift (Apertura de Caja) ---
router.post('/cash/open', (req, res) => {
  try {
    const { cashier_name, initial_amount = 0, notes } = req.body;
    if (!cashier_name) return res.status(400).json({ error: 'El nombre del cajero es requerido' });

    // Check if there is already an open shift
    const existing = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open' LIMIT 1").get();
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un turno de caja abierto actualmente' });
    }

    const stmt = db.prepare(`
      INSERT INTO cash_shifts (cashier_name, initial_amount, notes, status)
      VALUES (?, ?, ?, 'open')
    `);
    const result = stmt.run(cashier_name, Number(initial_amount), notes || '');

    const created = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(result.lastInsertRowid);
    notifyShiftUpdated(created);

    res.status(201).json({
      success: true,
      message: 'Caja abierta exitosamente',
      shift: created
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cash Movement (Entrada / Salida de Efectivo) ---
router.post('/cash/movement', (req, res) => {
  try {
    const { type, amount, reason } = req.body;
    if (!type || !amount || !reason) {
      return res.status(400).json({ error: 'Tipo (in/out), monto y motivo son obligatorios' });
    }

    const activeShift = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!activeShift) {
      return res.status(400).json({ error: 'No hay turno de caja abierto' });
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO cash_movements (shift_id, type, amount, reason)
        VALUES (?, ?, ?, ?)
      `).run(activeShift.id, type, numAmount, reason);

      if (type === 'in') {
        db.prepare('UPDATE cash_shifts SET total_in_movements = total_in_movements + ? WHERE id = ?').run(numAmount, activeShift.id);
      } else {
        db.prepare('UPDATE cash_shifts SET total_out_movements = total_out_movements + ? WHERE id = ?').run(numAmount, activeShift.id);
      }
    });

    insertTx();

    const updatedShift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(activeShift.id);
    notifyShiftUpdated(updatedShift);

    res.status(201).json({ success: true, message: 'Movimiento registrado', shift: updatedShift });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Close Shift / Corte de Caja Z ---
router.post('/cash/close', (req, res) => {
  try {
    const { actual_cash, notes } = req.body;
    if (actual_cash === undefined || actual_cash === null) {
      return res.status(400).json({ error: 'El monto de efectivo contado en caja es obligatorio' });
    }

    const activeShift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any;
    if (!activeShift) {
      return res.status(400).json({ error: 'No hay ningún turno abierto para cerrar' });
    }

    const countedCash = Number(actual_cash);
    const expectedCash = activeShift.initial_amount + activeShift.total_cash_sales + activeShift.total_in_movements - activeShift.total_out_movements;
    const difference = countedCash - expectedCash; // positive = surplus/sobrante, negative = shortage/faltante

    const closeTx = db.transaction(() => {
      db.prepare(`
        UPDATE cash_shifts
        SET status = 'closed',
            closed_at = CURRENT_TIMESTAMP,
            expected_cash = ?,
            actual_cash = ?,
            final_amount = ?,
            difference = ?,
            notes = CASE WHEN ? != '' THEN COALESCE(notes || ' | ', '') || ? ELSE notes END
        WHERE id = ?
      `).run(expectedCash, countedCash, countedCash, difference, notes || '', notes || '', activeShift.id);
    });

    closeTx();

    // Generate and print Corte Report
    const ticketResult = PrinterService.printShiftReport(activeShift.id);

    const closedShift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(activeShift.id);

    notifyShiftUpdated(closedShift);
    notifyTicketPrinted(ticketResult);

    res.json({
      success: true,
      message: 'Turno de caja cerrado exitosamente',
      shift: closedShift,
      ticket: ticketResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Shifts History ---
router.get('/cash/shifts', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const shifts = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM orders WHERE shift_id = s.id AND status = 'paid') as orders_count
      FROM cash_shifts s 
      ORDER BY s.id DESC LIMIT ?
    `).all(Number(limit));
    res.json(shifts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Single Shift Report Detail ---
router.get('/cash/shifts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const shift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(id) as any;
    if (!shift) return res.status(404).json({ error: 'Turno no encontrado' });

    const movements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id ASC').all(id);
    const orders = db.prepare(`
      SELECT o.*, t.name as table_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.shift_id = ? AND o.status = 'paid'
      ORDER BY o.id ASC
    `).all(id);

    res.json({ shift, movements, orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});;

export default router;
