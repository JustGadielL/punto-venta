import { Router } from 'express';
import { db } from '../db/database.js';
import { NetworkService } from '../services/networkService.js';

const router = Router();

// Get Network info & Tablet QR code
router.get('/system/network-info', async (req, res) => {
  try {
    const frontendPort = Number(process.env.FRONTEND_PORT) || 5173;
    const backendPort = Number(process.env.PORT) || 4000;
    const info = await NetworkService.getNetworkAccessInfo(frontendPort, backendPort);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get System Settings
router.get('/system/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update System Settings
router.put('/system/settings', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Configuraciones inválidas' });
    }

    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        upsertStmt.run(key, String(value));
      }
    });

    updateTx();

    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Full Database Backup (JSON)
router.get('/system/backup', (req, res) => {
  try {
    const backupData = {
      version: 1,
      createdAt: new Date().toISOString(),
      categories: db.prepare('SELECT * FROM categories').all(),
      products: db.prepare('SELECT * FROM products').all(),
      modifier_groups: db.prepare('SELECT * FROM modifier_groups').all(),
      modifier_options: db.prepare('SELECT * FROM modifier_options').all(),
      product_modifier_groups: db.prepare('SELECT * FROM product_modifier_groups').all(),
      tables: db.prepare('SELECT * FROM tables').all(),
      discounts: db.prepare('SELECT * FROM discounts').all(),
      settings: db.prepare('SELECT * FROM settings').all(),
      cash_shifts: db.prepare('SELECT * FROM cash_shifts').all(),
      cash_movements: db.prepare('SELECT * FROM cash_movements').all(),
      orders: db.prepare('SELECT * FROM orders').all(),
      order_items: db.prepare('SELECT * FROM order_items').all(),
      order_item_modifiers: db.prepare('SELECT * FROM order_item_modifiers').all(),
      payments: db.prepare('SELECT * FROM payments').all(),
    };

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="respaldo_pos_${dateStr}.json"`);
    res.json(backupData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import and Restore Full Database Backup
router.post('/system/restore', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'Archivo de respaldo inválido' });
    }

    const restoreTx = db.transaction(() => {
      // Temporarily disable foreign keys during bulk restore
      db.pragma('foreign_keys = OFF');

      // Clear existing records
      const tablesToClear = [
        'order_item_modifiers', 'order_items', 'payments', 'orders',
        'cash_movements', 'cash_shifts',
        'product_modifier_groups', 'modifier_options', 'modifier_groups',
        'products', 'categories', 'tables', 'discounts'
      ];
      for (const tbl of tablesToClear) {
        db.prepare(`DELETE FROM ${tbl}`).run();
        try {
          db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tbl);
        } catch (e) {}
      }

      // 1. Categories
      if (Array.isArray(backup.categories)) {
        const stmt = db.prepare('INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)');
        for (const c of backup.categories) {
          stmt.run(c.id, c.name, c.icon || 'Utensils', c.color || '#3b82f6', c.sort_order || 0);
        }
      }

      // 2. Products
      if (Array.isArray(backup.products)) {
        const stmt = db.prepare('INSERT INTO products (id, category_id, name, description, price, cost, image_url, is_active, is_kitchen, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const p of backup.products) {
          stmt.run(p.id, p.category_id, p.name, p.description || '', p.price, p.cost || 0, p.image_url || null, p.is_active ?? 1, p.is_kitchen ?? 1, p.sort_order || 0);
        }
      }

      // 3. Modifier Groups
      if (Array.isArray(backup.modifier_groups)) {
        const stmt = db.prepare('INSERT INTO modifier_groups (id, name, selection_type, is_required) VALUES (?, ?, ?, ?)');
        for (const mg of backup.modifier_groups) {
          stmt.run(mg.id, mg.name, mg.selection_type || 'multiple', mg.is_required || 0);
        }
      }

      // 4. Modifier Options
      if (Array.isArray(backup.modifier_options)) {
        const stmt = db.prepare('INSERT INTO modifier_options (id, group_id, name, price_adjustment, is_active) VALUES (?, ?, ?, ?, ?)');
        for (const mo of backup.modifier_options) {
          stmt.run(mo.id, mo.group_id, mo.name, mo.price_adjustment || 0, mo.is_active ?? 1);
        }
      }

      // 5. Product Modifier Groups
      if (Array.isArray(backup.product_modifier_groups)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id) VALUES (?, ?)');
        for (const pmg of backup.product_modifier_groups) {
          stmt.run(pmg.product_id, pmg.group_id);
        }
      }

      // 6. Tables
      if (Array.isArray(backup.tables)) {
        const stmt = db.prepare('INSERT INTO tables (id, number, name, capacity, status, active_order_id) VALUES (?, ?, ?, ?, ?, ?)');
        for (const t of backup.tables) {
          stmt.run(t.id, t.number, t.name, t.capacity || 4, t.status || 'available', t.active_order_id || null);
        }
      }

      // 7. Discounts
      if (Array.isArray(backup.discounts)) {
        const stmt = db.prepare('INSERT INTO discounts (id, name, percentage, is_active) VALUES (?, ?, ?, ?)');
        for (const d of backup.discounts) {
          stmt.run(d.id, d.name, d.percentage, d.is_active ?? 1);
        }
      }

      // 8. Settings
      if (Array.isArray(backup.settings)) {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const s of backup.settings) {
          stmt.run(s.key, s.value);
        }
      }

      // 9. Shifts & Movements
      if (Array.isArray(backup.cash_shifts)) {
        const stmt = db.prepare('INSERT INTO cash_shifts (id, cashier_name, opened_at, closed_at, initial_amount, total_sales, total_cash_sales, total_card_sales, total_transfer_sales, total_delivery_sales, total_in_movements, total_out_movements, expected_cash, actual_cash, difference, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const s of backup.cash_shifts) {
          stmt.run(s.id, s.cashier_name, s.opened_at, s.closed_at, s.initial_amount || 0, s.total_sales || 0, s.total_cash_sales || 0, s.total_card_sales || 0, s.total_transfer_sales || 0, s.total_delivery_sales || 0, s.total_in_movements || 0, s.total_out_movements || 0, s.expected_cash || 0, s.actual_cash, s.difference, s.status || 'closed', s.notes || '');
        }
      }

      if (Array.isArray(backup.cash_movements)) {
        const stmt = db.prepare('INSERT INTO cash_movements (id, shift_id, type, amount, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        for (const m of backup.cash_movements) {
          stmt.run(m.id, m.shift_id, m.type, m.amount, m.reason, m.created_at);
        }
      }

      // 10. Orders, Items, Modifiers, Payments
      if (Array.isArray(backup.orders)) {
        const stmt = db.prepare('INSERT INTO orders (id, order_number, table_id, table_name, type, customer_name, status, subtotal, tax_rate, tax_amount, discount_amount, tip_amount, total, payment_method, notes, shift_id, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const o of backup.orders) {
          stmt.run(o.id, o.order_number, o.table_id, o.table_name || '', o.type || 'dine_in', o.customer_name || '', o.status || 'paid', o.subtotal || 0, o.tax_rate || 0, o.tax_amount || 0, o.discount_amount || 0, o.tip_amount || 0, o.total || 0, o.payment_method, o.notes || '', o.shift_id, o.created_at, o.closed_at);
        }
      }

      if (Array.isArray(backup.order_items)) {
        const stmt = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, notes, status, is_kitchen, is_printed_kitchen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const oi of backup.order_items) {
          stmt.run(oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.notes || '', oi.status || 'delivered', oi.is_kitchen ?? 1, oi.is_printed_kitchen ?? 1);
        }
      }

      if (Array.isArray(backup.order_item_modifiers)) {
        const stmt = db.prepare('INSERT INTO order_item_modifiers (id, order_item_id, modifier_option_id, modifier_name, price_adjustment) VALUES (?, ?, ?, ?, ?)');
        for (const oim of backup.order_item_modifiers) {
          stmt.run(oim.id, oim.order_item_id, oim.modifier_option_id, oim.modifier_name, oim.price_adjustment || 0);
        }
      }

      if (Array.isArray(backup.payments)) {
        const stmt = db.prepare('INSERT INTO payments (id, order_id, method, amount, amount_tendered, change_amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const p of backup.payments) {
          stmt.run(p.id, p.order_id, p.method, p.amount, p.amount_tendered, p.change_amount, p.reference, p.created_at);
        }
      }

      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');
    });

    restoreTx();
    res.json({ success: true, message: '¡Copia de seguridad restaurada con éxito!' });
  } catch (err: any) {
    db.pragma('foreign_keys = ON');
    console.error('Error restaurando backup:', err);
    res.status(500).json({ error: err.message || 'Error al restaurar respaldo' });
  }
});

export default router;
