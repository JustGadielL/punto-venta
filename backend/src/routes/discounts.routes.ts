import { Router } from 'express';
import { db } from '../db/database';

const router = Router();

// Get all discounts
router.get('/discounts', (req, res) => {
  try {
    const discounts = db.prepare('SELECT * FROM discounts ORDER BY name').all();
    res.json(discounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create discount
router.post('/discounts', (req, res) => {
  try {
    const { name, percentage, is_active = 1 } = req.body;
    const info = db.prepare('INSERT INTO discounts (name, percentage, is_active) VALUES (?, ?, ?)').run(name, percentage, is_active);
    res.json({ id: info.lastInsertRowid, name, percentage, is_active });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update discount
router.put('/discounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, percentage, is_active } = req.body;
    db.prepare('UPDATE discounts SET name = ?, percentage = ?, is_active = ? WHERE id = ?').run(name, percentage, is_active, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete discount
router.delete('/discounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM discounts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
