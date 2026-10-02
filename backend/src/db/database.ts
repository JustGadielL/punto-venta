import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pos_restaurant.db');
export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high concurrency & integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'Utensils',
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      is_kitchen INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- Restaurant tables
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available', -- 'available', 'occupied', 'billing'
      active_order_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cash shifts (Aperturas y Cortes de Caja)
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_name TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      initial_amount REAL NOT NULL,
      final_amount REAL,
      expected_cash REAL,
      actual_cash REAL,
      difference REAL,
      total_sales REAL DEFAULT 0,
      total_cash_sales REAL DEFAULT 0,
      total_card_sales REAL DEFAULT 0,
      total_transfer_sales REAL DEFAULT 0,
      total_delivery_sales REAL DEFAULT 0,
      total_in_movements REAL DEFAULT 0,
      total_out_movements REAL DEFAULT 0,
      total_tips REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'open' -- 'open', 'closed'
    );

    -- Cash movements (Entradas y Salidas de efectivo)
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'in', 'out'
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER NOT NULL,
      table_id INTEGER,
      table_name TEXT,
      type TEXT DEFAULT 'dine_in', -- 'dine_in', 'take_out', 'delivery'
      customer_name TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'in_preparation', 'ready', 'paid', 'cancelled'
      shift_id INTEGER,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tip_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_method TEXT, -- 'cash', 'card', 'transfer', 'mixed'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL
    );

    -- Order items (Detalle de productos en la comanda/orden)
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      is_printed_kitchen INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending', -- 'pending', 'cooking', 'served', 'cancelled'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Payments detail
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL, -- 'cash', 'card', 'transfer'
      amount_tendered REAL,
      change_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id)
    );

    -- System settings (Key-Value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Discounts
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      percentage REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Modifier Groups (e.g. Salsas, Temperatura)
    CREATE TABLE IF NOT EXISTS modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      selection_type TEXT DEFAULT 'multiple', -- 'single' or 'multiple'
      is_required INTEGER DEFAULT 0
    );

    -- Modifier Options (e.g. Ajo Parmesano, BBQ, Bien cocido)
    CREATE TABLE IF NOT EXISTS modifier_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price_adjustment REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    );
    
    -- Link Products to Modifier Groups
    CREATE TABLE IF NOT EXISTS product_modifier_groups (
      product_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      PRIMARY KEY (product_id, group_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    );

    -- Link Order Items to Modifier Options
    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      modifier_option_id INTEGER NOT NULL,
      modifier_name TEXT NOT NULL,
      price_adjustment REAL DEFAULT 0,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_option_id) REFERENCES modifier_options(id)
    );

    -- Ticket history / Virtual prints
    CREATE TABLE IF NOT EXISTS printed_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'order_receipt', 'kitchen_comanda', 'cash_shift'
      reference_id INTEGER,
      title TEXT NOT NULL,
      content_plain TEXT NOT NULL,
      content_html TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Try to add is_active if it doesn't exist (SQLite doesn't have ADD COLUMN IF NOT EXISTS)
  try {
    db.prepare("ALTER TABLE modifier_options ADD COLUMN is_active INTEGER DEFAULT 1").run();
  } catch (e) {
    // Column already exists, ignore
  }

  seedInitialData();
}

function seedInitialData() {
  // Check if settings exist
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const defaultSettings: Record<string, string> = {
      restaurant_name: 'Taquería & Restaurante Los Amigos',
      address: 'Av. Revolución #123, Col. Centro',
      phone: '(55) 1234-5678',
      tax_id: 'XAXX010101000',
      currency: '$',
      tax_rate: '0', // 0% by default, configurable
      ticket_footer: '¡Gracias por su preferencia! Vuelva pronto.',
      paper_width: '80mm', // '80mm' or '58mm'
      printer_type: 'mock', // 'mock', 'usb', 'network'
      printer_ip: '192.168.1.200',
      auto_print_on_checkout: '1',
      auto_print_kitchen_comanda: '1',
      security_pin: '1234'
    };

    const insertMany = db.transaction(() => {
      for (const [k, v] of Object.entries(defaultSettings)) {
        insertSetting.run(k, v);
      }
    });
    insertMany();
  }

  // Check if categories exist
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)');
    const insertProd = db.prepare('INSERT INTO products (category_id, name, description, price, cost, is_active, is_kitchen, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertModGroup = db.prepare('INSERT INTO modifier_groups (name, selection_type, is_required) VALUES (?, ?, ?)');
    const insertModOpt = db.prepare('INSERT INTO modifier_options (group_id, name, price_adjustment) VALUES (?, ?, ?)');
    const insertProdMod = db.prepare('INSERT INTO product_modifier_groups (product_id, group_id) VALUES (?, ?)');

    const seedMenu = db.transaction(() => {
      const c1 = insertCat.run('Entradas', 'Utensils', '#f97316', 1).lastInsertRowid;
      const c2 = insertCat.run('Alitas y Boneless', 'Flame', '#ef4444', 2).lastInsertRowid;
      const c3 = insertCat.run('Hamburguesas', 'Burger', '#3b82f6', 3).lastInsertRowid;
      const c4 = insertCat.run('Extras', 'PlusCircle', '#8b5cf6', 4).lastInsertRowid;
      const c5 = insertCat.run('Hot Dogs', 'HotDog', '#ec4899', 5).lastInsertRowid;
      const c6 = insertCat.run('Postres', 'Cake', '#10b981', 6).lastInsertRowid;
      const c7 = insertCat.run('Cócteles sin alcohol', 'Coffee', '#14b8a6', 7).lastInsertRowid;
      const c8 = insertCat.run('Malteadas', 'Cup', '#f43f5e', 8).lastInsertRowid;
      const c9 = insertCat.run('Otros', 'MoreHorizontal', '#64748b', 9).lastInsertRowid;
      const c10 = insertCat.run('Promociones', 'Tag', '#eab308', 10).lastInsertRowid;

      // Seed Modifier Groups
      const mgTemp = insertModGroup.run('Temperatura', 'single', 1).lastInsertRowid;
      insertModOpt.run(mgTemp, 'Poco cocido', 0);
      insertModOpt.run(mgTemp, 'Medio cocido', 0);
      insertModOpt.run(mgTemp, 'A punto', 0);
      insertModOpt.run(mgTemp, 'Muy cocido', 0);

      const mgSalsas = insertModGroup.run('Salsas', 'multiple', 0).lastInsertRowid;
      insertModOpt.run(mgSalsas, 'Ajo Parmesano', 0);
      insertModOpt.run(mgSalsas, 'BBQ', 0);
      insertModOpt.run(mgSalsas, 'Buffalo', 0);
      insertModOpt.run(mgSalsas, 'Chipotle', 0);
      insertModOpt.run(mgSalsas, 'Mango Habanero', 0);

      // Entradas
      const p1 = insertProd.run(c1, 'Papas Gajo', 'Papas gajo crujientes', 85.00, 30.00, 1, 1, 1).lastInsertRowid;
      const p2 = insertProd.run(c1, 'Dedos de Queso', 'Dedos de queso empanizados', 110.00, 45.00, 1, 1, 2).lastInsertRowid;

      // Alitas y Boneless
      const p3 = insertProd.run(c2, 'Alitas 10 pz', 'Alitas de pollo', 220.00, 75.00, 1, 1, 1).lastInsertRowid;
      insertProdMod.run(p3, mgSalsas); // Attach Salsas to Alitas
      
      const p4 = insertProd.run(c2, 'Boneless 5 pz', 'Boneless de pechuga', 120.00, 50.00, 1, 1, 2).lastInsertRowid;
      insertProdMod.run(p4, mgSalsas); // Attach Salsas to Boneless

      // Hamburguesas
      const p5 = insertProd.run(c3, 'Hamburguesa Clásica', 'Carne 100% res', 135.00, 50.00, 1, 1, 1).lastInsertRowid;
      insertProdMod.run(p5, mgTemp); // Attach Temperatura to Hamburguesas

      // Malteadas
      insertProd.run(c8, 'Malteada de Fresa', 'Fresa natural', 65.00, 20.00, 1, 0, 1);
    });
    seedMenu();
  }

  // Check if discounts exist
  const discountCount = db.prepare('SELECT COUNT(*) as count FROM discounts').get() as { count: number };
  if (discountCount.count === 0) {
    db.prepare('INSERT INTO discounts (name, percentage, is_active) VALUES (?, ?, ?)').run('Familia', 10, 1);
    db.prepare('INSERT INTO discounts (name, percentage, is_active) VALUES (?, ?, ?)').run('Empleado', 20, 1);
  }

  // Check if tables exist
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number };
  if (tableCount.count === 0) {
    const insertTable = db.prepare('INSERT INTO tables (number, name, capacity, status) VALUES (?, ?, ?, ?)');
    const seedTables = db.transaction(() => {
      for (let i = 1; i <= 10; i++) {
        const capacity = i <= 4 ? 2 : (i <= 8 ? 4 : 6);
        insertTable.run(i, `Mesa ${i}`, capacity, 'available');
      }
    });
    seedTables();
  }

  // Create an initial open cash shift if none exists so testing is instant
  const shiftCount = db.prepare('SELECT COUNT(*) as count FROM cash_shifts').get() as { count: number };
  if (shiftCount.count === 0) {
    db.prepare(`
      INSERT INTO cash_shifts (cashier_name, initial_amount, status, notes)
      VALUES (?, ?, 'open', ?)
    `).run('Cajero Principal', 500.00, 'Turno inicial de apertura');
  }

  // Migration: Ensure table_name exists in orders
  try {
    db.exec('ALTER TABLE orders ADD COLUMN table_name TEXT');
  } catch (e) {}
  try {
    db.prepare(`
      UPDATE orders 
      SET table_name = (SELECT name FROM tables WHERE tables.id = orders.table_id) 
      WHERE table_id IS NOT NULL AND (table_name IS NULL OR table_name = '')
    `).run();
  } catch (e) {}

  // Migration: Recalculate total_delivery_sales in cash_shifts for orders paid with app or delivery
  try {
    db.prepare(`
      UPDATE cash_shifts
      SET total_delivery_sales = (
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE orders.shift_id = cash_shifts.id
          AND orders.status = 'paid'
          AND orders.payment_method IN ('delivery', 'app')
      )
      WHERE EXISTS (
        SELECT 1 FROM orders
        WHERE orders.shift_id = cash_shifts.id
          AND orders.status = 'paid'
          AND orders.payment_method IN ('delivery', 'app')
      )
    `).run();
  } catch (e) {}
}
