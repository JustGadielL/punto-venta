import { Router } from 'express';
import { db } from '../db/database.js';
import { notifyTableUpdated } from '../socket/socketHandler.js';

const router = Router();

router.get('/tables', (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT 
        t.*,
        o.id as order_id,
        o.order_number,
        o.total as order_total,
        o.customer_name,
        o.status as order_status,
        o.created_at as order_created_at,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM tables t
      LEFT JOIN orders o ON t.active_order_id = o.id
      ORDER BY t.number ASC
    `).all();

    res.json(tables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tables', (req, res) => {
  try {
    const { number, name, capacity } = req.body;
    if (!number || !name) return res.status(400).json({ error: 'Número y nombre son obligatorios' });

    const stmt = db.prepare('INSERT INTO tables (number, name, capacity, status) VALUES (?, ?, ?, ?)');
    const result = stmt.run(number, name, capacity || 4, 'available');

    const created = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid);
    notifyTableUpdated(created);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tables/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { number, name, capacity, status } = req.body;

    db.prepare(`
      UPDATE tables
      SET number = COALESCE(?, number),
          name = COALESCE(?, name),
          capacity = COALESCE(?, capacity),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(number, name, capacity, status, id);

    const updated = db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
    notifyTableUpdated(updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tables/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tables WHERE id = ?').run(id);
    res.json({ message: 'Mesa eliminada' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
