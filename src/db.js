'use strict';

const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./security');
const { DB_FILE } = require('./paths');

const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,
    city          TEXT,
    message       TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'vendor')),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS perfumes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    brand           TEXT,
    category        TEXT,
    size_ml         INTEGER,
    description     TEXT,
    image           TEXT,
    suggested_price REAL NOT NULL DEFAULT 0,
    commission      REAL NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_name      TEXT NOT NULL,
    client_phone     TEXT,
    client_address   TEXT,
    notes            TEXT,
    status           TEXT NOT NULL DEFAULT 'pendiente',
    admin_note       TEXT,
    total            REAL NOT NULL DEFAULT 0,
    total_commission REAL NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    perfume_id      INTEGER REFERENCES perfumes(id) ON DELETE SET NULL,
    perfume_name    TEXT NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      REAL NOT NULL,
    unit_commission REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status     TEXT NOT NULL,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

// Migración: pedidos directos de clientes (sin vendedor), pago y seguimiento.
const orderCols = db.prepare('PRAGMA table_info(orders)').all();
const vendorCol = orderCols.find((c) => c.name === 'vendor_id');
if (vendorCol && vendorCol.notnull) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`
    BEGIN;
    CREATE TABLE orders_new (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      client_name      TEXT NOT NULL,
      client_phone     TEXT,
      client_address   TEXT,
      notes            TEXT,
      status           TEXT NOT NULL DEFAULT 'pendiente',
      admin_note       TEXT,
      total            REAL NOT NULL DEFAULT 0,
      total_commission REAL NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO orders_new SELECT id, vendor_id, client_name, client_phone, client_address, notes, status,
      admin_note, total, total_commission, created_at, updated_at FROM orders;
    DROP TABLE orders;
    ALTER TABLE orders_new RENAME TO orders;
    CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    COMMIT;
  `);
  db.exec('PRAGMA foreign_keys = ON');
}
const haveCols = new Set(db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name));
const addCol = (name, def) => { if (!haveCols.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${def}`); };
addCol('source', "TEXT NOT NULL DEFAULT 'vendedor'");
addCol('payment_status', "TEXT NOT NULL DEFAULT 'pendiente'");
addCol('payment_proof', 'TEXT');
addCol('track_token', 'TEXT');
addCol('client_email', 'TEXT');
addCol('delivery_method', 'TEXT'); // recojo | domicilio | envio
addCol('delivery_city', 'TEXT');
addCol('recipient_name', 'TEXT');
addCol('recipient_ci', 'TEXT');
addCol('recipient_phone', 'TEXT');
addCol('stock_taken', 'INTEGER NOT NULL DEFAULT 0'); // 1 = las unidades ya se descontaron del inventario
// Inventario: unidades disponibles (vacío = sin control de stock).
if (!db.prepare('PRAGMA table_info(perfumes)').all().some((c) => c.name === 'stock')) {
  db.exec('ALTER TABLE perfumes ADD COLUMN stock INTEGER');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(track_token)');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Create the administrator account on first start.
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@perfumeria.com').toLowerCase();
if (!db.prepare("SELECT id FROM users WHERE role = 'admin'").get()) {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'approved')"
  ).run('Administrador', adminEmail, hashPassword(password));
  console.log(`Cuenta de administrador creada: ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  Contraseña por defecto: admin123  (cámbiala desde el panel de administración)');
  }
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, transaction };
