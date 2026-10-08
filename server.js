'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, transaction } = require('./src/db');
const { hashPassword, verifyPassword, newToken } = require('./src/security');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const { UPLOAD_DIR, STORE_DIR } = require('./src/paths');
const SESSION_DAYS = 7;
const MAX_BODY = 6 * 1024 * 1024;

const ORDER_STATUSES = ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'];
const VENDOR_STATUSES = ['pending', 'approved', 'rejected'];
const PAYMENT_STATUSES = ['pendiente', 'pagado'];


/* ---------------------------------------------------------------- helpers */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'El archivo o la solicitud es demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function text(value, max = 500) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Los montos deben ser números positivos');
  return Math.round(n * 100) / 100;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, city: u.city, role: u.role, status: u.status };
}

/* ------------------------------------------------------------------ auth */

function getUser(req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token);
  return row || null;
}

function requireUser(ctx) {
  if (!ctx.user) throw new HttpError(401, 'Debes iniciar sesión');
  return ctx.user;
}

function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'Solo el administrador puede hacer esto');
  return user;
}

function requireMember(ctx) {
  const user = requireUser(ctx);
  if (user.role === 'admin') return user;
  if (user.status !== 'approved') throw new HttpError(403, 'Tu cuenta de vendedor aún no está aprobada');
  return user;
}

function requireVendor(ctx) {
  const user = requireMember(ctx);
  if (user.role !== 'vendor') throw new HttpError(403, 'Solo los vendedores pueden hacer pedidos');
  return user;
}

function sessionCookie(token, maxAge) {
  return `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

/* ---------------------------------------------------------------- router */

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$'
  );
  routes.push({ method, regex, keys, handler });
}

/* ------------------------------------------------------------- endpoints */

// ---- Cuentas

route('POST', '/api/register', async (ctx) => {
  const b = ctx.body;
  const name = text(b.name, 100);
  const email = text(b.email, 150).toLowerCase();
  const password = String(b.password || '');
  if (!name || !email || !password) throw new HttpError(400, 'Nombre, correo y contraseña son obligatorios');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo electrónico inválido');
  if (password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  }
  db.prepare(
    `INSERT INTO users (name, email, phone, city, message, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, 'vendor', 'pending')`
  ).run(name, email, text(b.phone, 40), text(b.city, 80), text(b.message, 1000), hashPassword(password));
  return { ok: true, message: 'Solicitud enviada. El administrador revisará tu registro.' };
});

route('POST', '/api/login', async (ctx) => {
  const email = text(ctx.body.email, 150).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(String(ctx.body.password || ''), user.password_hash)) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  if (user.role === 'vendor' && user.status === 'pending') {
    throw new HttpError(403, 'Tu solicitud de vendedor está pendiente de aprobación');
  }
  if (user.role === 'vendor' && user.status === 'rejected') {
    throw new HttpError(403, 'Tu solicitud de vendedor fue rechazada');
  }
  const token = newToken();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(
    token,
    user.id,
    `+${SESSION_DAYS} days`
  );
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
  ctx.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 86400));
  return { user: publicUser(user) };
});

route('POST', '/api/logout', async (ctx) => {
  const token = parseCookies(ctx.req).session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  ctx.setHeader('Set-Cookie', sessionCookie('', 0));
  return { ok: true };
});

route('GET', '/api/me', async (ctx) => ({ user: ctx.user ? publicUser(ctx.user) : null }));

route('POST', '/api/me/password', async (ctx) => {
  const user = requireUser(ctx);
  const current = String(ctx.body.current || '');
  const next = String(ctx.body.next || '');
  if (!verifyPassword(current, user.password_hash)) throw new HttpError(400, 'La contraseña actual no es correcta');
  if (next.length < 6) throw new HttpError(400, 'La nueva contraseña debe tener al menos 6 caracteres');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  return { ok: true };
});

// ---- Catálogo

const PUBLIC_FIELDS = 'id, name, brand, category, size_ml, description, image';

route('GET', '/api/catalog', async () => ({
  perfumes: db
    .prepare(`SELECT ${PUBLIC_FIELDS}, suggested_price AS price FROM perfumes WHERE active = 1 ORDER BY brand, name`)
    .all(),
}));

route('GET', '/api/vendor/perfumes', async (ctx) => {
  requireMember(ctx);
  return {
    perfumes: db
      .prepare(`SELECT ${PUBLIC_FIELDS}, suggested_price, commission FROM perfumes WHERE active = 1 ORDER BY brand, name`)
      .all(),
  };
});

// ---- Pedidos

function loadOrder(id) {
  const order = db
    .prepare(
      `SELECT o.*, u.name AS vendor_name, u.email AS vendor_email, u.phone AS vendor_phone
       FROM orders o LEFT JOIN users u ON u.id = o.vendor_id WHERE o.id = ?`
    )
    .get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  order.history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY id').all(id);
  return order;
}

// Crea un pedido. vendor = null para los pedidos directos de clientes (sin comisión).
function createOrder(b, vendor) {
  const clientName = text(b.client_name, 120);
  if (!clientName) throw new HttpError(400, vendor ? 'El nombre del cliente es obligatorio' : 'Escribe tu nombre');
  const phone = text(b.client_phone, 40);
  if (!vendor && !phone) throw new HttpError(400, 'Escribe tu número de celular para coordinar la entrega');
  if (!Array.isArray(b.items) || !b.items.length) throw new HttpError(400, 'El carrito está vacío');
  if (b.items.length > 50) throw new HttpError(400, 'Demasiados productos en un solo pedido');

  const getPerfume = db.prepare('SELECT * FROM perfumes WHERE id = ? AND active = 1');
  const items = b.items.map((it) => {
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) throw new HttpError(400, 'Cantidad inválida');
    const p = getPerfume.get(Number(it.perfume_id));
    if (!p) throw new HttpError(400, 'Uno de los perfumes ya no está disponible');
    return { p, qty, commission: vendor ? p.commission : 0 };
  });

  const total = items.reduce((sum, { p, qty }) => sum + p.suggested_price * qty, 0);
  const totalCommission = items.reduce((sum, { commission, qty }) => sum + commission * qty, 0);
  const token = vendor ? null : newToken();

  return transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (vendor_id, source, track_token, client_name, client_phone, client_address, notes, total, total_commission)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        vendor ? vendor.id : null,
        vendor ? 'vendedor' : 'cliente',
        token,
        clientName,
        phone,
        text(b.client_address, 250),
        text(b.notes, 1000),
        Math.round(total * 100) / 100,
        Math.round(totalCommission * 100) / 100
      );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, perfume_id, perfume_name, quantity, unit_price, unit_commission)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const { p, qty, commission } of items) {
      const label = [p.brand, p.name, p.size_ml ? `${p.size_ml} ml` : ''].filter(Boolean).join(' · ');
      insertItem.run(lastInsertRowid, p.id, label, qty, p.suggested_price, commission);
    }
    db.prepare(`INSERT INTO order_history (order_id, status, note) VALUES (?, 'pendiente', 'Pedido creado')`).run(
      lastInsertRowid
    );
    return lastInsertRowid;
  });
}

route('POST', '/api/orders', async (ctx) => {
  const vendor = requireVendor(ctx);
  return { order: loadOrder(createOrder(ctx.body, vendor)) };
});

// ---- Pedidos directos de clientes (sin cuenta)

function publicOrder(o) {
  return {
    id: o.id,
    token: o.track_token,
    client_name: o.client_name,
    client_phone: o.client_phone,
    client_address: o.client_address,
    notes: o.notes,
    status: o.status,
    admin_note: o.admin_note,
    payment_status: o.payment_status,
    has_proof: Boolean(o.payment_proof),
    total: o.total,
    created_at: o.created_at,
    items: o.items.map(({ perfume_name, quantity, unit_price }) => ({ perfume_name, quantity, unit_price })),
    history: o.history.map(({ status, note, created_at }) => ({ status, note, created_at })),
  };
}

function orderByToken(token) {
  const row = /^[a-f0-9]{64}$/.test(token) && db.prepare('SELECT id FROM orders WHERE track_token = ?').get(token);
  if (!row) throw new HttpError(404, 'Pedido no encontrado');
  return loadOrder(row.id);
}

route('POST', '/api/public/orders', async (ctx) => {
  const id = createOrder(ctx.body, null);
  return { order: publicOrder(loadOrder(id)) };
});

route('GET', '/api/public/orders/:token', async (ctx) => ({ order: publicOrder(orderByToken(ctx.params.token)) }));

route('POST', '/api/public/orders/:token/proof', async (ctx) => {
  const order = orderByToken(ctx.params.token);
  if (order.payment_status === 'pagado') throw new HttpError(400, 'Este pedido ya figura como pagado');
  const url = saveImage(ctx.body.data);
  transaction(() => {
    db.prepare(`UPDATE orders SET payment_proof = ?, updated_at = datetime('now') WHERE id = ?`).run(url, order.id);
    db.prepare(`INSERT INTO order_history (order_id, status, note) VALUES (?, ?, 'El cliente envió su comprobante de pago')`).run(
      order.id,
      order.status
    );
  });
  return { order: publicOrder(loadOrder(order.id)) };
});

route('PATCH', '/api/orders/:id/payment', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const status = text(ctx.body.payment_status, 20);
  if (!PAYMENT_STATUSES.includes(status)) throw new HttpError(400, 'Estado de pago inválido');
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  transaction(() => {
    db.prepare(`UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    db.prepare('INSERT INTO order_history (order_id, status, note) VALUES (?, ?, ?)').run(
      id,
      order.status,
      status === 'pagado' ? 'Pago confirmado' : 'Pago marcado como pendiente'
    );
  });
  return { order: loadOrder(id) };
});

// ---- Ajustes de la tienda (QR de pago, WhatsApp)

const SETTING_KEYS = ['payment_qr', 'whatsapp'];
const DEFAULT_SETTINGS = { payment_qr: '/img/qr-yape.jpg', whatsapp: '' };

function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    if (SETTING_KEYS.includes(row.key) && row.value) out[row.key] = row.value;
  }
  return out;
}

route('GET', '/api/settings', async () => ({ settings: getSettings() }));

route('PUT', '/api/admin/settings', async (ctx) => {
  requireAdmin(ctx);
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  if ('payment_qr' in ctx.body) upsert.run('payment_qr', text(ctx.body.payment_qr, 500));
  if ('whatsapp' in ctx.body) upsert.run('whatsapp', text(ctx.body.whatsapp, 30).replace(/[^\d]/g, ''));
  return { settings: getSettings() };
});

route('GET', '/api/orders', async (ctx) => {
  const user = requireMember(ctx);
  const where = [];
  const params = [];
  if (user.role === 'vendor') {
    where.push('o.vendor_id = ?');
    params.push(user.id);
  } else if (ctx.query.get('vendor')) {
    where.push('o.vendor_id = ?');
    params.push(Number(ctx.query.get('vendor')));
  }
  const status = ctx.query.get('status');
  if (status && ORDER_STATUSES.includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  const source = ctx.query.get('source');
  if (user.role === 'admin' && (source === 'cliente' || source === 'vendedor')) {
    where.push('o.source = ?');
    params.push(source);
  }
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS vendor_name,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS units
       FROM orders o LEFT JOIN users u ON u.id = o.vendor_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY o.id DESC LIMIT 500`
    )
    .all(...params);
  const getItems = db.prepare('SELECT perfume_name, quantity, unit_price, unit_commission FROM order_items WHERE order_id = ?');
  for (const o of orders) o.items = getItems.all(o.id);
  return { orders, statuses: ORDER_STATUSES };
});

route('GET', '/api/orders/:id', async (ctx) => {
  const user = requireMember(ctx);
  const order = loadOrder(Number(ctx.params.id));
  if (!order || (user.role === 'vendor' && order.vendor_id !== user.id)) throw new HttpError(404, 'Pedido no encontrado');
  return { order };
});

route('PATCH', '/api/orders/:id/status', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const status = text(ctx.body.status, 20);
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Estado inválido');
  if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(id)) throw new HttpError(404, 'Pedido no encontrado');
  const note = text(ctx.body.note, 500);
  transaction(() => {
    db.prepare(`UPDATE orders SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?`).run(
      status,
      note || null,
      id
    );
    db.prepare('INSERT INTO order_history (order_id, status, note) VALUES (?, ?, ?)').run(id, status, note || null);
  });
  return { order: loadOrder(id) };
});

route('POST', '/api/orders/:id/cancel', async (ctx) => {
  const vendor = requireVendor(ctx);
  const id = Number(ctx.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND vendor_id = ?').get(id, vendor.id);
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  if (order.status !== 'pendiente') throw new HttpError(400, 'Solo puedes cancelar pedidos pendientes');
  transaction(() => {
    db.prepare(`UPDATE orders SET status = 'cancelado', updated_at = datetime('now') WHERE id = ?`).run(id);
    db.prepare(`INSERT INTO order_history (order_id, status, note) VALUES (?, 'cancelado', 'Cancelado por el vendedor')`).run(id);
  });
  return { order: loadOrder(id) };
});

// ---- Ranking (solo cuentan los pedidos ENTREGADOS del mes)

function ranking(month) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.city,
              COUNT(o.id) AS orders,
              COALESCE(SUM((SELECT SUM(quantity) FROM order_items WHERE order_id = o.id)), 0) AS units,
              COALESCE(SUM(o.total), 0) AS sales,
              COALESCE(SUM(o.total_commission), 0) AS commission
       FROM users u
       JOIN orders o ON o.vendor_id = u.id
        AND o.status = 'entregado'
        AND strftime('%Y-%m', o.created_at, 'localtime') = ?
       WHERE u.role = 'vendor'
       GROUP BY u.id
       ORDER BY sales DESC, units DESC, orders DESC, u.name`
    )
    .all(month)
    .map((r, i) => ({ position: i + 1, ...r }));
}

route('GET', '/api/ranking', async (ctx) => {
  const user = requireMember(ctx);
  let month = ctx.query.get('month') || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) month = currentMonth();
  let rows = ranking(month);
  if (user.role !== 'admin') {
    // Los vendedores ven posiciones y unidades, pero no la comisión de los demás.
    rows = rows.map(({ commission, ...r }) => (r.id === user.id ? { ...r, commission, me: true } : r));
  }
  return { month, ranking: rows };
});

route('GET', '/api/vendor/stats', async (ctx) => {
  const vendor = requireVendor(ctx);
  const month = currentMonth();
  const stat = (extra, ...p) =>
    db
      .prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales, COALESCE(SUM(total_commission), 0) AS commission
         FROM orders WHERE vendor_id = ? ${extra}`
      )
      .get(vendor.id, ...p);
  const rank = ranking(month).find((r) => r.id === vendor.id);
  return {
    month,
    delivered: stat(`AND status = 'entregado' AND strftime('%Y-%m', created_at, 'localtime') = ?`, month),
    inProgress: stat(`AND status NOT IN ('entregado', 'cancelado')`),
    position: rank ? rank.position : null,
  };
});

// ---- Administración

route('GET', '/api/admin/summary', async (ctx) => {
  requireAdmin(ctx);
  const one = (sql, ...p) => Object.values(db.prepare(sql).get(...p))[0];
  return {
    pendingVendors: one(`SELECT COUNT(*) FROM users WHERE role = 'vendor' AND status = 'pending'`),
    approvedVendors: one(`SELECT COUNT(*) FROM users WHERE role = 'vendor' AND status = 'approved'`),
    activePerfumes: one('SELECT COUNT(*) FROM perfumes WHERE active = 1'),
    openOrders: one(`SELECT COUNT(*) FROM orders WHERE status NOT IN ('entregado', 'cancelado')`),
    openCustomerOrders: one(`SELECT COUNT(*) FROM orders WHERE source = 'cliente' AND status NOT IN ('entregado', 'cancelado')`),
    unpaidCustomerOrders: one(
      `SELECT COUNT(*) FROM orders WHERE source = 'cliente' AND payment_status = 'pendiente' AND status != 'cancelado'`
    ),
    monthSales: one(
      `SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'entregado' AND strftime('%Y-%m', created_at, 'localtime') = ?`,
      currentMonth()
    ),
  };
});

route('GET', '/api/admin/vendors', async (ctx) => {
  requireAdmin(ctx);
  const status = ctx.query.get('status');
  const filter = VENDOR_STATUSES.includes(status) ? 'AND u.status = ?' : '';
  const params = filter ? [status] : [];
  const vendors = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.city, u.message, u.status, u.created_at, u.reviewed_at,
              (SELECT COUNT(*) FROM orders WHERE vendor_id = u.id) AS orders
       FROM users u WHERE u.role = 'vendor' ${filter}
       ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, u.created_at DESC`
    )
    .all(...params);
  return { vendors };
});

route('PATCH', '/api/admin/vendors/:id', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const status = text(ctx.body.status, 20);
  if (!VENDOR_STATUSES.includes(status)) throw new HttpError(400, 'Estado inválido');
  const { changes } = db
    .prepare(`UPDATE users SET status = ?, reviewed_at = datetime('now') WHERE id = ? AND role = 'vendor'`)
    .run(status, id);
  if (!changes) throw new HttpError(404, 'Vendedor no encontrado');
  if (status !== 'approved') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return { ok: true };
});

route('DELETE', '/api/admin/vendors/:id', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const { changes } = db.prepare(`DELETE FROM users WHERE id = ? AND role = 'vendor'`).run(id);
  if (!changes) throw new HttpError(404, 'Vendedor no encontrado');
  return { ok: true };
});

function perfumeFields(b) {
  const name = text(b.name, 120);
  if (!name) throw new HttpError(400, 'El nombre del perfume es obligatorio');
  const size = b.size_ml === '' || b.size_ml == null ? null : Math.floor(Number(b.size_ml));
  return [
    name,
    text(b.brand, 80),
    text(b.category, 40),
    Number.isFinite(size) && size > 0 ? size : null,
    text(b.description, 2000),
    text(b.image, 500),
    money(b.suggested_price),
    money(b.commission),
    b.active === false || b.active === 0 || b.active === '0' ? 0 : 1,
  ];
}

route('GET', '/api/admin/perfumes', async (ctx) => {
  requireAdmin(ctx);
  return { perfumes: db.prepare('SELECT * FROM perfumes ORDER BY active DESC, brand, name').all() };
});

route('POST', '/api/admin/perfumes', async (ctx) => {
  requireAdmin(ctx);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO perfumes (name, brand, category, size_ml, description, image, suggested_price, commission, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...perfumeFields(ctx.body));
  return { perfume: db.prepare('SELECT * FROM perfumes WHERE id = ?').get(lastInsertRowid) };
});

route('PUT', '/api/admin/perfumes/:id', async (ctx) => {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const { changes } = db
    .prepare(
      `UPDATE perfumes SET name = ?, brand = ?, category = ?, size_ml = ?, description = ?, image = ?,
              suggested_price = ?, commission = ?, active = ? WHERE id = ?`
    )
    .run(...perfumeFields(ctx.body), id);
  if (!changes) throw new HttpError(404, 'Perfume no encontrado');
  return { perfume: db.prepare('SELECT * FROM perfumes WHERE id = ?').get(id) };
});

route('DELETE', '/api/admin/perfumes/:id', async (ctx) => {
  requireAdmin(ctx);
  const { changes } = db.prepare('DELETE FROM perfumes WHERE id = ?').run(Number(ctx.params.id));
  if (!changes) throw new HttpError(404, 'Perfume no encontrado');
  return { ok: true };
});

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function saveImage(dataUrl) {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match || !IMAGE_TYPES[match[1]]) throw new HttpError(400, 'Formato de imagen no soportado (JPG, PNG, WEBP o GIF)');
  const file = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${IMAGE_TYPES[match[1]]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(match[2], 'base64'));
  return `/uploads/${file}`;
}

route('POST', '/api/admin/upload', async (ctx) => {
  requireAdmin(ctx);
  return { url: saveImage(ctx.body.data) };
});

/* ---------------------------------------------------------- static files */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let base = PUBLIC_DIR;
  let rel = pathname;
  if (pathname.startsWith('/uploads/')) {
    base = UPLOAD_DIR;
    rel = pathname.slice('/uploads'.length);
  }
  const file = path.normalize(path.join(base, decodeURIComponent(rel)));
  if (!file.startsWith(base + path.sep)) return false;
  let target = file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) return false;
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    // La página, los estilos y el código se revisan siempre para que cada versión nueva se vea al instante.
    ...(['.html', '.js', '.css'].includes(ext) ? { 'Cache-Control': 'no-cache' } : {}),
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

/* ---------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método no permitido' });
    if (serveStatic(req, res, pathname)) return;
    if (!pathname.startsWith('/uploads/') && serveStatic(req, res, '/index.html')) return;
    res.writeHead(404);
    return res.end('No encontrado');
  }

  const extraHeaders = {};
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const ctx = {
        req,
        query: url.searchParams,
        params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])),
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {},
        user: getUser(req),
        setHeader: (k, v) => (extraHeaders[k] = v),
      };
      const data = await r.handler(ctx);
      return send(res, 200, data, extraHeaders);
    }
    send(res, 404, { error: 'Ruta no encontrada' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Error interno del servidor' });
  }
});

function openBrowser(url) {
  const { spawn } = require('node:child_process');
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch { /* sin navegador disponible */ }
}

const SITE_URL = `http://localhost:${PORT}`;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  La pagina ya esta encendida en otra ventana.');
    console.log(`  Abrela en el navegador: ${SITE_URL}`);
    console.log('');
    if (process.env.OPEN_BROWSER) openBrowser(SITE_URL);
    process.exitCode = 0;
    return;
  }
  throw err;
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ============================================');
  console.log('   DISTINTO SCZ esta encendida');
  console.log(`   Abre en tu navegador: ${SITE_URL}`);
  console.log('');
  console.log('   NO cierres esta ventana mientras uses la pagina.');
  console.log('   Para apagarla, cierra esta ventana.');
  console.log('');
  console.log(`   Tus datos se guardan en: ${STORE_DIR}`);
  console.log('  ============================================');
  console.log('');
  if (process.env.OPEN_BROWSER) openBrowser(SITE_URL);
});
