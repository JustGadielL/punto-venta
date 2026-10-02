/**
 * SCRIPT PARA MIGRAR / SINCRONIZAR DATOS DE SQLITE LOCAL A TURSO
 * 
 * Uso:
 *   node scripts/sync-to-turso.js
 * 
 * Requiere en .env o como variables:
 *   TURSO_DATABASE_URL=libsql://...
 *   TURSO_AUTH_TOKEN=...
 */

import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./backend/.env') });
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('❌ Error: Faltan las variables TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.');
  console.log('Agrégalas en tu archivo .env o en el comando:');
  console.log('  TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/sync-to-turso.js');
  process.exit(1);
}

console.log('====================================================');
console.log('🚀 MIGRANDO BASE DE DATOS LOCAL A TURSO');
console.log(`Destino: ${url}`);
console.log('====================================================\n');

import fs from 'fs';

const localDbPath = fs.existsSync('./data/pos_restaurant.db') ? './data/pos_restaurant.db' : './backend/data/pos_restaurant.db';
const localDb = new Database(localDbPath);
const turso = createClient({ url, authToken });

async function sync() {
  console.log('1. Creando tablas en Turso...');

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'Utensils',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS products (
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
    )`,
    `CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      active_order_id INTEGER,
      pos_x REAL DEFAULT 0,
      pos_y REAL DEFAULT 0,
      capacity INTEGER DEFAULT 4
    )`,
    `CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_name TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      initial_amount REAL NOT NULL,
      final_amount REAL,
      expected_cash REAL NOT NULL,
      actual_cash REAL,
      difference REAL,
      total_sales REAL DEFAULT 0,
      total_cash_sales REAL DEFAULT 0,
      total_card_sales REAL DEFAULT 0,
      total_transfer_sales REAL DEFAULT 0,
      total_delivery_sales REAL DEFAULT 0,
      total_in_movements REAL DEFAULT 0,
      total_out_movements REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'open'
    )`,
    `CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER NOT NULL,
      table_id INTEGER,
      table_name TEXT,
      type TEXT DEFAULT 'dine_in',
      customer_name TEXT,
      status TEXT DEFAULT 'pending',
      shift_id INTEGER,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tip_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      is_printed_kitchen INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      modifier_name TEXT NOT NULL,
      price_adjustment REAL DEFAULT 0,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shift_id INTEGER,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      amount_tendered REAL,
      change_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      percentage REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      selection_type TEXT DEFAULT 'multiple',
      is_required INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS modifier_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price_adjustment REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS product_modifiers (
      product_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      PRIMARY KEY (product_id, group_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS printed_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference_id INTEGER,
      title TEXT NOT NULL,
      content_plain TEXT NOT NULL,
      content_html TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const st of schemaStatements) {
    await turso.execute(st);
  }
  console.log('   ✅ Tablas creadas/verificadas en Turso.');

  // 2. Tablas del catálogo para transferir
  const catalogTables = [
    'categories',
    'products',
    'modifier_groups',
    'modifier_options',
    'product_modifiers',
    'discounts',
    'settings',
    'tables'
  ];

  console.log('\n2. Sincronizando catálogo a Turso...');
  for (const tbl of catalogTables) {
    const rows = localDb.prepare(`SELECT * FROM ${tbl}`).all();
    if (rows.length === 0) continue;

    console.log(`   Transferiendo ${rows.length} registros de ${tbl}...`);
    for (const r of rows) {
      const keys = Object.keys(r);
      const values = Object.values(r);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${tbl} (${keys.join(', ')}) VALUES (${placeholders})`;
      await turso.execute({ sql, args: values });
    }
  }

  console.log('\n🎉 ¡SINCRONIZACIÓN COMPLETADA CON ÉXITO!');
  console.log('Tu base de datos en Turso ya contiene todos los artículos, mesas y configuraciones.');
}

sync().catch(console.error);
