import { Router } from 'express';
import { db } from '../db/database.js';
import { notifyOrderUpdated, notifyTableUpdated, notifyShiftUpdated, notifyTicketPrinted, notifyKitchenNewComanda } from '../socket/socketHandler.js';
import { PrinterService } from '../printer/printerService.js';

const router = Router();

// Helper to recalculate order totals
function recalculateOrder(orderId: number) {
  const items = db.prepare("SELECT unit_price, quantity FROM order_items WHERE order_id = ? AND status != 'cancelled'").all(orderId) as any[];
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const order = db.prepare('SELECT tax_rate, discount_amount, tip_amount FROM orders WHERE id = ?').get(orderId) as any;
  const taxRate = order?.tax_rate || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const discountAmount = order?.discount_amount || 0;
  const tipAmount = order?.tip_amount || 0;
  const total = Math.max(0, subtotal + taxAmount + tipAmount - discountAmount);

  db.prepare(`
    UPDATE orders
    SET subtotal = ?,
        tax_amount = ?,
        total = ?
    WHERE id = ?
  `).run(subtotal, taxAmount, total, orderId);

  return total;
}

// Get next order number for today
function getNextOrderNumber(): number {
  const lastOrder = db.prepare(`
    SELECT order_number 
    FROM orders 
    WHERE date(created_at, 'localtime') = date('now', 'localtime') 
    ORDER BY id DESC LIMIT 1
  `).get() as { order_number: number } | undefined;

  return (lastOrder?.order_number || 0) + 1;
}

// --- Active Orders ---
router.get('/orders/active', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT 
        o.*,
        COALESCE(o.table_name, t.name) as table_name,
        t.number as table_number,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND status != 'cancelled') as item_count
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.status IN ('pending', 'in_preparation', 'ready')
      ORDER BY o.id DESC
    `).all();

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- All Orders / History ---
router.get('/orders', (req, res) => {
  try {
    const { status, shift_id, limit = 50 } = req.query;
    let query = `
      SELECT 
        o.*,
        COALESCE(o.table_name, t.name) as table_name,
        t.number as table_number,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push('o.status = ?');
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        const placeholders = statuses.map(() => '?').join(',');
        conditions.push(`o.status IN (${placeholders})`);
        params.push(...statuses);
      }
    }
    if (shift_id) {
      conditions.push('o.shift_id = ?');
      params.push(shift_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY o.id DESC LIMIT ?';
    params.push(Number(limit));

    const orders = db.prepare(query).all(...params);
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Single Order with Items & Payments ---
router.get('/orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare(`
      SELECT o.*, COALESCE(o.table_name, t.name) as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(id) as any;

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const items = db.prepare(`
      SELECT oi.*, p.image_url, p.is_kitchen
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `).all(id) as any[];

    // Fetch modifiers for items
    for (const item of items) {
      item.modifiers = db.prepare('SELECT * FROM order_item_modifiers WHERE order_item_id = ?').all(item.id);
    }

    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(id);

    res.json({ ...order, items, payments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Create Order ---
router.post('/orders', (req, res) => {
  try {
    const { table_id, type = 'dine_in', customer_name, notes, items, discount_amount = 0, tip_amount = 0 } = req.body;

    // Check active cash shift
    const activeShift = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    const shiftId = activeShift ? activeShift.id : null;

    const orderNumber = getNextOrderNumber();

    let tableName: string | null = null;
    if (table_id) {
      const tableRow = db.prepare('SELECT name FROM tables WHERE id = ?').get(table_id) as any;
      if (tableRow) tableName = tableRow.name;
    }

    const insertOrderTx = db.transaction(() => {
      // 1. Insert order
      const orderStmt = db.prepare(`
        INSERT INTO orders (order_number, table_id, table_name, type, customer_name, status, shift_id, discount_amount, tip_amount, notes)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `);
      const orderResult = orderStmt.run(orderNumber, table_id || null, tableName, type, customer_name || '', shiftId, discount_amount, tip_amount, notes || '');
      const orderId = Number(orderResult.lastInsertRowid);

      // 2. Insert items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const itemStmt = db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const modifierStmt = db.prepare(`
          INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, modifier_name, price_adjustment)
          VALUES (?, ?, ?, ?)
        `);

        for (const it of items) {
          const itemRes = itemStmt.run(orderId, it.product_id, it.product_name, Number(it.unit_price), Number(it.quantity), it.notes || '');
          const itemId = itemRes.lastInsertRowid;
          
          if (it.modifiers && Array.isArray(it.modifiers)) {
            for (const mod of it.modifiers) {
              modifierStmt.run(itemId, mod.modifier_option_id, mod.modifier_name, Number(mod.price_adjustment || 0));
            }
          }
        }
      }

      // 3. Recalculate totals
      recalculateOrder(orderId);

      // 4. Update table status if dine_in
      if (table_id && type === 'dine_in') {
        db.prepare(`
          UPDATE tables 
          SET status = 'occupied', active_order_id = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(orderId, table_id);
      }

      return orderId;
    });

    const orderId = insertOrderTx();

    const createdOrder = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(orderId) as any;

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    notifyOrderUpdated({ ...(createdOrder || {}), items: orderItems });
    if (table_id) {
      const updatedTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
      notifyTableUpdated(updatedTable);
    }

    res.status(201).json({ ...(createdOrder || {}), items: orderItems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Update Items in Order (Comanda Update) ---
router.put('/orders/:id/items', (req, res) => {
  try {
    const { id } = req.params;
    const { items, discount_amount, tip_amount, customer_name, notes } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status === 'paid' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'No se puede modificar una orden finalizada' });
    }

    const updateTx = db.transaction(() => {
      const newTableId = req.body.table_id !== undefined ? req.body.table_id : order.table_id;
      let newTableName: string | null = order.table_name;
      if (req.body.table_id !== undefined) {
        if (newTableId) {
          const tRow = db.prepare('SELECT name FROM tables WHERE id = ?').get(newTableId) as any;
          newTableName = tRow ? tRow.name : null;
        } else {
          newTableName = null;
        }
      }

      if (discount_amount !== undefined || tip_amount !== undefined || customer_name !== undefined || notes !== undefined || req.body.type !== undefined || req.body.table_id !== undefined) {
        db.prepare(`
          UPDATE orders
          SET discount_amount = COALESCE(?, discount_amount),
              tip_amount = COALESCE(?, tip_amount),
              customer_name = COALESCE(?, customer_name),
              notes = COALESCE(?, notes),
              type = COALESCE(?, type),
              table_id = ?,
              table_name = ?
          WHERE id = ?
        `).run(discount_amount, tip_amount, customer_name, notes, req.body.type, newTableId, newTableName, id);

        // If table changed, update tables status
        if (order.table_id !== newTableId) {
          if (order.table_id) {
            db.prepare("UPDATE tables SET status = 'available', active_order_id = NULL WHERE id = ?").run(order.table_id);
          }
          if (newTableId) {
            db.prepare("UPDATE tables SET status = 'occupied', active_order_id = ? WHERE id = ?").run(id, newTableId);
          }
        }
      }

      if (items && Array.isArray(items)) {
        // Delete non-printed items and replace, or replace all if requested
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);

        const itemStmt = db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, notes, is_printed_kitchen, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const modifierStmt = db.prepare(`
          INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, modifier_name, price_adjustment)
          VALUES (?, ?, ?, ?)
        `);

        for (const it of items) {
          const itemRes = itemStmt.run(
            id,
            it.product_id,
            it.product_name,
            Number(it.unit_price),
            Number(it.quantity),
            it.notes || '',
            it.is_printed_kitchen ? 1 : 0,
            it.status || 'pending'
          );
          
          const itemId = itemRes.lastInsertRowid;
          if (it.modifiers && Array.isArray(it.modifiers)) {
            for (const mod of it.modifiers) {
              modifierStmt.run(itemId, mod.modifier_option_id, mod.modifier_name, Number(mod.price_adjustment || 0));
            }
          }
        }
      }

      recalculateOrder(Number(id));
    });

    updateTx();

    const updatedOrder = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(id) as any;

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    notifyOrderUpdated({ ...(updatedOrder || {}), items: orderItems });
    
    if (req.body.table_id !== undefined && req.body.table_id !== order.table_id) {
      if (order.table_id) {
        notifyTableUpdated(db.prepare('SELECT * FROM tables WHERE id = ?').get(order.table_id));
      }
      if (req.body.table_id) {
        notifyTableUpdated(db.prepare('SELECT * FROM tables WHERE id = ?').get(req.body.table_id));
      }
    }
    
    res.json({ ...(updatedOrder || {}), items: orderItems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Send Comanda to Kitchen ---
router.post('/orders/:id/send-kitchen', (req, res) => {
  try {
    const { id } = req.params;
    const printResult = PrinterService.printKitchenComanda(Number(id));

    const updatedOrder = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(id) as any;

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    notifyOrderUpdated({ ...(updatedOrder || {}), items: orderItems });
    notifyKitchenNewComanda({ order: updatedOrder, items: orderItems, ticket: printResult });
    notifyTicketPrinted(printResult);

    res.json({ success: true, printResult, order: { ...(updatedOrder || {}), items: orderItems } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Request Bill (Pedir Cuenta) ---
router.post('/orders/:id/request-bill', (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'billing' WHERE id = ?").run(order.table_id);
      const updatedTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(order.table_id);
      notifyTableUpdated(updatedTable);
    }

    let ticket = null;
    try {
      // Import PrinterService if not already in file, or just use it if it's there
      // Wait, is PrinterService imported? It might not be in orders.routes.ts. Let's check imports.
      // Wait, in orders.routes.ts line 433, it uses PrinterService.printOrderReceipt! So it is imported!
      ticket = PrinterService.printOrderReceipt(Number(id));
      notifyTicketPrinted(ticket);
    } catch (printErr) {
      console.error('Error printing pre-bill:', printErr);
    }

    res.json({ success: true, message: 'Cuenta solicitada', ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Checkout / Cobrar Orden ---
router.post('/orders/:id/checkout', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method = 'cash', amount_tendered, payments: customPayments, tip_amount = 0, discount_amount = 0 } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status === 'paid') return res.status(400).json({ error: 'Esta orden ya fue cobrada' });

    const activeShift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any;
    if (!activeShift) {
      return res.status(400).json({ error: 'No hay ningún turno de caja abierto. Por favor realiza la apertura de caja primero.' });
    }

    const checkoutTx = db.transaction(() => {
      // 1. Update tip / discount and recalculate
      if (tip_amount !== undefined || discount_amount !== undefined) {
        db.prepare('UPDATE orders SET tip_amount = ?, discount_amount = ? WHERE id = ?')
          .run(Number(tip_amount || 0), Number(discount_amount || 0), id);
      }
      const finalTotal = recalculateOrder(Number(id));

      // 2. Handle Payments
      const tendered = amount_tendered !== undefined ? Number(amount_tendered) : finalTotal;
      const change = Math.max(0, tendered - finalTotal);

      db.prepare('DELETE FROM payments WHERE order_id = ?').run(id);

      let totalCash = 0;
      let totalCard = 0;
      let totalTransfer = 0;
      let totalDelivery = 0;

      if (customPayments && Array.isArray(customPayments) && customPayments.length > 0) {
        const pStmt = db.prepare(`
          INSERT INTO payments (order_id, shift_id, amount, method, amount_tendered, change_amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const p of customPayments) {
          const pAmount = Number(p.amount);
          pStmt.run(id, activeShift.id, pAmount, p.method, p.amount_tendered || pAmount, p.change_amount || 0);
          if (p.method === 'cash') totalCash += pAmount;
          else if (p.method === 'card') totalCard += pAmount;
          else if (p.method === 'transfer') totalTransfer += pAmount;
          else if (p.method === 'delivery' || p.method === 'app') totalDelivery += pAmount;
        }
      } else {
        // Single payment method
        db.prepare(`
          INSERT INTO payments (order_id, shift_id, amount, method, amount_tendered, change_amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, activeShift.id, finalTotal, payment_method, tendered, change);

        if (payment_method === 'cash') totalCash = finalTotal;
        else if (payment_method === 'card') totalCard = finalTotal;
        else if (payment_method === 'transfer') totalTransfer = finalTotal;
        else if (payment_method === 'delivery' || payment_method === 'app') totalDelivery = finalTotal;
      }

      // 3. Mark order as paid
      db.prepare(`
        UPDATE orders
        SET status = 'paid',
            shift_id = ?,
            payment_method = ?,
            closed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(activeShift.id, payment_method, id);

      // 4. Update Shift accumulated sales
      db.prepare(`
        UPDATE cash_shifts
        SET total_sales = total_sales + ?,
            total_cash_sales = total_cash_sales + ?,
            total_card_sales = total_card_sales + ?,
            total_transfer_sales = total_transfer_sales + ?,
            total_delivery_sales = total_delivery_sales + ?,
            total_tips = total_tips + ?
        WHERE id = ?
      `).run(finalTotal, totalCash, totalCard, totalTransfer, totalDelivery, order.tip_amount || 0, activeShift.id);

      // 5. Free Table if assigned
      if (order.table_id) {
        db.prepare(`
          UPDATE tables
          SET status = 'available',
              active_order_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(order.table_id);
      }
    });

    checkoutTx();

    // Generate Customer Sale Ticket
    const ticketResult = PrinterService.printOrderReceipt(Number(id));

    // Fetch updated data to broadcast
    const updatedOrder = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(id) as any;

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    const updatedShift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(activeShift.id);

    notifyOrderUpdated({ ...(updatedOrder || {}), items: orderItems });
    notifyShiftUpdated(updatedShift);
    notifyTicketPrinted(ticketResult);

    if (order.table_id) {
      const updatedTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(order.table_id);
      notifyTableUpdated(updatedTable);
    }

    res.json({
      success: true,
      message: 'Cobro completado exitosamente',
      order: { ...(updatedOrder || {}), items: orderItems },
      ticket: ticketResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cancel Order ---
router.post('/orders/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelado por usuario' } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status === 'paid') return res.status(400).json({ error: 'No se puede cancelar una orden ya cobrada' });

    db.prepare("UPDATE orders SET status = 'cancelled', notes = notes || ' [Cancelado: ' || ? || ']' WHERE id = ?").run(reason, id);
    db.prepare("UPDATE order_items SET status = 'cancelled' WHERE order_id = ?").run(id);

    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'available', active_order_id = NULL WHERE id = ?").run(order.table_id);
      const updatedTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(order.table_id);
      notifyTableUpdated(updatedTable);
    }

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    notifyOrderUpdated(updatedOrder);

    res.json({ success: true, message: 'Orden cancelada' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Refund Order ---
router.post('/orders/:id/refund', (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status !== 'paid') return res.status(400).json({ error: 'Sólo se pueden reembolsar órdenes cobradas' });

    const activeShift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any;
    if (!activeShift) {
      return res.status(400).json({ error: 'No hay turno abierto para registrar el reembolso.' });
    }

    const refundTx = db.transaction(() => {
      // Create cash movement for refund
      db.prepare(`
        INSERT INTO cash_movements (shift_id, type, amount, reason)
        VALUES (?, 'expense', ?, ?)
      `).run(activeShift.id, order.total, `Reembolso de orden #${order.order_number}`);

      // Change order status
      db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(id);

      // Adjust shift totals
      const method = order.payment_method;
      let totalCash = method === 'cash' ? order.total : 0;
      let totalCard = method === 'card' ? order.total : 0;
      let totalTransfer = method === 'transfer' ? order.total : 0;
      let totalDelivery = (method === 'delivery' || method === 'app') ? order.total : 0;

      // Note: we just log a generic expense for refunds right now, but technically we should adjust the total_sales, but keeping the expense is better for audit trail.
      // Actually we should decrement the sales to make it accurate, let's decrement sales.
      db.prepare(`
        UPDATE cash_shifts
        SET total_sales = total_sales - ?,
            total_cash_sales = total_cash_sales - ?,
            total_card_sales = total_card_sales - ?,
            total_transfer_sales = total_transfer_sales - ?,
            total_delivery_sales = total_delivery_sales - ?,
            total_tips = total_tips - ?
        WHERE id = ?
      `).run(order.total, totalCash, totalCard, totalTransfer, totalDelivery, order.tip_amount || 0, activeShift.id);
    });

    refundTx();

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    notifyOrderUpdated(updatedOrder);

    const updatedShift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(activeShift.id);
    notifyShiftUpdated(updatedShift);

    res.json({ success: true, message: 'Orden reembolsada' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
