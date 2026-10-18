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
// "Más vendidos": perfumes que el administrador destaca en el inicio.
if (!db.prepare('PRAGMA table_info(perfumes)').all().some((c) => c.name === 'bestseller')) {
  db.exec('ALTER TABLE perfumes ADD COLUMN bestseller INTEGER NOT NULL DEFAULT 0');
}
// Precio de compra (costo) del perfume y su valor al momento de cada venta, para calcular ganancias.
if (!db.prepare('PRAGMA table_info(perfumes)').all().some((c) => c.name === 'cost')) {
  db.exec('ALTER TABLE perfumes ADD COLUMN cost REAL');
}
if (!db.prepare('PRAGMA table_info(order_items)').all().some((c) => c.name === 'unit_cost')) {
  db.exec('ALTER TABLE order_items ADD COLUMN unit_cost REAL');
}
// Precio de venta propio del administrador (pestaña Stock), independiente del precio del catálogo.
if (!db.prepare('PRAGMA table_info(perfumes)').all().some((c) => c.name === 'store_price')) {
  db.exec('ALTER TABLE perfumes ADD COLUMN store_price REAL');
}
// Ventas hechas fuera de la página (en tienda, por WhatsApp, etc.): bajan el stock, no usan comisiones.
db.exec(`
  CREATE TABLE IF NOT EXISTS manual_sales (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    perfume_id   INTEGER REFERENCES perfumes(id) ON DELETE SET NULL,
    perfume_name TEXT NOT NULL,
    brand        TEXT,
    quantity     INTEGER NOT NULL,
    unit_price   REAL NOT NULL,
    unit_cost    REAL,
    sold_at      TEXT NOT NULL,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_manual_sales_date ON manual_sales(sold_at);
`);
// Una venta (ticket) puede llevar varios perfumes: todas sus filas comparten el mismo "ticket".
if (!db.prepare('PRAGMA table_info(manual_sales)').all().some((c) => c.name === 'ticket')) {
  db.exec('ALTER TABLE manual_sales ADD COLUMN ticket TEXT');
}
// Compras de mercadería: suben el stock y guardan precio y fecha de compra.
db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket       TEXT NOT NULL,
    perfume_id   INTEGER REFERENCES perfumes(id) ON DELETE SET NULL,
    perfume_name TEXT NOT NULL,
    brand        TEXT,
    quantity     INTEGER NOT NULL,
    unit_cost    REAL NOT NULL,
    purchased_at TEXT NOT NULL,
    supplier     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_perfume ON purchases(perfume_id, purchased_at);
`);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(track_token)');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Primera vez: marcar como "más vendidos" Mandarin, 9 PM clásico y Hawas Ice si ya están en el catálogo.
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'bestsellers_seeded'").get()) {
  const picks = db.prepare('SELECT id, name, brand FROM perfumes').all().filter(({ name, brand }) => {
    const t = `${brand || ''} ${name}`.toLowerCase();
    return /mandarin/.test(t) || /hawas\s*ice/.test(t) ||
      (/\b9\s*pm\b/.test(t) && !/rebel|elixir|night|femme|intense|black|neon|for her/.test(t));
  });
  if (picks.length) {
    const mark = db.prepare('UPDATE perfumes SET bestseller = 1 WHERE id = ?');
    picks.forEach((p) => mark.run(p.id));
    db.prepare("INSERT INTO settings (key, value) VALUES ('bestsellers_seeded', '1')").run();
    console.log(`Más vendidos: ${picks.map((p) => p.name).join(', ')}`);
  }
}

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

// Restablecer el acceso del administrador si olvidó la contraseña.
// En Railway: agrega la variable ADMIN_RESET_PASSWORD (y si quieres ADMIN_RESET_EMAIL) y vuelve a desplegar.
// Se aplica una sola vez por cada valor nuevo, así que dejarla puesta no pisa cambios posteriores.
const resetPassword = process.env.ADMIN_RESET_PASSWORD;
if (resetPassword) {
  const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  const resetEmail = String(process.env.ADMIN_RESET_EMAIL || '').trim().toLowerCase();
  const stamp = require('node:crypto').createHash('sha256').update(`${resetEmail}\n${resetPassword}`).digest('hex');
  const done = db.prepare("SELECT value FROM settings WHERE key = 'admin_reset_applied'").get();
  if (!admin) {
    console.log('  ADMIN_RESET_PASSWORD: no hay cuenta de administrador.');
  } else if (resetPassword.length < 8) {
    console.log('  ADMIN_RESET_PASSWORD: la contraseña debe tener al menos 8 caracteres. No se cambió nada.');
  } else if (resetEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
    console.log('  ADMIN_RESET_EMAIL no es un correo válido. No se cambió nada.');
  } else if (resetEmail && db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(resetEmail, admin.id)) {
    console.log('  ADMIN_RESET_EMAIL ya lo usa otra cuenta. No se cambió nada.');
  } else if (done?.value === stamp) {
    console.log('  ADMIN_RESET_PASSWORD ya se aplicó antes. Puedes borrar esa variable en Railway.');
  } else {
    const email = resetEmail || admin.email;
    db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?').run(email, hashPassword(resetPassword), admin.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(admin.id);
    db.prepare("INSERT INTO settings (key, value) VALUES ('admin_reset_applied', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(stamp);
    console.log('');
    console.log('  ============================================');
    console.log('   ACCESO DE ADMINISTRADOR RESTABLECIDO');
    console.log(`   Usuario: ${email}`);
    console.log('   Contraseña: la que pusiste en ADMIN_RESET_PASSWORD');
    console.log('   Se cerraron todas las sesiones del administrador.');
    console.log('   Ahora borra la variable ADMIN_RESET_PASSWORD en Railway.');
    console.log('  ============================================');
    console.log('');
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
