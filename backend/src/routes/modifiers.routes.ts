import { Router } from 'express';
import { db } from '../db/database';
import { notifyCatalogUpdated } from '../socket/socketHandler';

const router = Router();

// ==========================
// MODIFIER GROUPS
// ==========================

// Get all modifier groups with their options
router.get('/modifiers', (req, res) => {
  try {
    const groups = db.prepare('SELECT * FROM modifier_groups ORDER BY name').all() as any[];
    
    // Fetch options for each group
    for (const g of groups) {
      g.options = db.prepare('SELECT * FROM modifier_options WHERE group_id = ? ORDER BY name').all(g.id);
    }
    
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create modifier group
router.post('/modifiers', (req, res) => {
  try {
    const { name, selection_type = 'multiple', is_required = 0 } = req.body;
    const info = db.prepare('INSERT INTO modifier_groups (name, selection_type, is_required) VALUES (?, ?, ?)').run(name, selection_type, is_required ? 1 : 0);
    res.json({ id: info.lastInsertRowid, name, selection_type, is_required });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update modifier group
router.put('/modifiers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, selection_type, is_required } = req.body;
    db.prepare('UPDATE modifier_groups SET name = ?, selection_type = ?, is_required = ? WHERE id = ?').run(name, selection_type, is_required ? 1 : 0, id);
    notifyCatalogUpdated();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete modifier group
router.delete('/modifiers/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(id);
    notifyCatalogUpdated();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// MODIFIER OPTIONS
// ==========================

// Create option
router.post('/modifiers/:groupId/options', (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, price_adjustment = 0, is_active = 1 } = req.body;
    const info = db.prepare('INSERT INTO modifier_options (group_id, name, price_adjustment, is_active) VALUES (?, ?, ?, ?)').run(groupId, name, price_adjustment, is_active ? 1 : 0);
    res.json({ id: info.lastInsertRowid, group_id: Number(groupId), name, price_adjustment, is_active: is_active ? 1 : 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update option
router.put('/modifiers/options/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, price_adjustment, is_active } = req.body;
    
    // Check if is_active is provided, if not, do not update it to maintain backward compatibility
    if (is_active !== undefined) {
      db.prepare('UPDATE modifier_options SET name = ?, price_adjustment = ?, is_active = ? WHERE id = ?').run(name, price_adjustment, is_active ? 1 : 0, id);
    } else {
      db.prepare('UPDATE modifier_options SET name = ?, price_adjustment = ? WHERE id = ?').run(name, price_adjustment, id);
    }
    notifyCatalogUpdated();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/modifiers/options/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM modifier_options WHERE id = ?').run(id);
    notifyCatalogUpdated();
    res.json({ success: true, message: 'Opción eliminada' });
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      // Soft delete if it's referenced in past orders
      db.prepare('UPDATE modifier_options SET is_active = 0 WHERE id = ?').run(req.params.id);
      notifyCatalogUpdated();
      return res.json({ success: true, message: 'La opción está en comandas previas. Ha sido desactivada en lugar de borrarse.', softDeleted: true });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
