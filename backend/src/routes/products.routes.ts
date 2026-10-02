import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// --- Categories ---
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', (req, res) => {
  try {
    const { name, icon, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const stmt = db.prepare('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, icon || 'Utensils', color || '#3b82f6', sort_order || 0);

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, sort_order } = req.body;

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          color = COALESCE(?, color),
          sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(name, icon, color, sort_order, id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as { count: number };
    
    if (countQuery.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar la categoría porque tiene productos asociados. Reasigna o elimina los productos primero.' });
    }
    
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ message: 'Categoría eliminada' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Products ---
router.get('/products', (req, res) => {
  try {
    const { category_id, active_only } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      JOIN categories c ON p.category_id = c.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    if (active_only === 'true') {
      conditions.push('p.is_active = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.sort_order ASC, p.name ASC';

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all product modifier mappings
router.get('/products/modifiers/mappings', (req, res) => {
  try {
    const mappings = db.prepare('SELECT * FROM product_modifier_groups').all();
    res.json(mappings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update product modifiers
router.put('/products/:id/modifiers', (req, res) => {
  try {
    const { id } = req.params;
    const { group_ids } = req.body;
    db.prepare('DELETE FROM product_modifier_groups WHERE product_id = ?').run(id);
    const insert = db.prepare('INSERT INTO product_modifier_groups (product_id, group_id) VALUES (?, ?)');
    for (const groupId of group_ids) {
      insert.run(id, groupId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', (req, res) => {
  try {
    const { category_id, name, description, price, cost, image_url, is_active, is_kitchen, sort_order } = req.body;
    if (!category_id || !name || price === undefined) {
      return res.status(400).json({ error: 'Categoría, nombre y precio son requeridos' });
    }

    const stmt = db.prepare(`
      INSERT INTO products (category_id, name, description, price, cost, image_url, is_active, is_kitchen, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      category_id,
      name,
      description || '',
      Number(price),
      cost !== undefined ? Number(cost) : 0,
      image_url || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      is_kitchen !== undefined ? (is_kitchen ? 1 : 0) : 1,
      sort_order || 0
    );

    const created = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, price, cost, image_url, is_active, is_kitchen, sort_order } = req.body;

    db.prepare(`
      UPDATE products
      SET category_id = COALESCE(?, category_id),
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          cost = COALESCE(?, cost),
          image_url = COALESCE(?, image_url),
          is_active = COALESCE(?, is_active),
          is_kitchen = COALESCE(?, is_kitchen),
          sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(
      category_id,
      name,
      description,
      price !== undefined ? Number(price) : null,
      cost !== undefined ? Number(cost) : null,
      image_url,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      is_kitchen !== undefined ? (is_kitchen ? 1 : 0) : null,
      sort_order,
      id
    );

    const updated = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ message: 'Producto eliminado' });
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      // Soft delete if it's referenced in past orders
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
      return res.json({ message: 'El producto está en comandas previas. Ha sido desactivado en lugar de borrarse.', softDeleted: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- Modifiers ---
router.get('/modifiers', (req, res) => {
  try {
    const groups = db.prepare('SELECT * FROM modifier_groups').all() as any[];
    const options = db.prepare('SELECT * FROM modifier_options').all() as any[];
    
    // Attach options to groups
    const result = groups.map(g => ({
      ...g,
      options: options.filter(o => o.group_id === g.id)
    }));
    
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/product-modifiers', (req, res) => {
  try {
    const mappings = db.prepare('SELECT * FROM product_modifier_groups').all();
    res.json(mappings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
