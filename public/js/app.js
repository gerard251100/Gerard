'use strict';

/* =================================================================
   Configuración
   ================================================================= */
const CURRENCY = '$';
const STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
const PROGRESS_STEPS = ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado'];
const VENDOR_STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const CATEGORIES = ['Hombre', 'Mujer', 'Unisex'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* =================================================================
   Utilidades
   ================================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function money(n) {
  return CURRENCY + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function api(path, options = {}) {
  const opts = { method: 'GET', headers: {}, credentials: 'same-origin', ...options };
  if (opts.body && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.user) {
      state.user = null;
      renderNav();
    }
    throw new Error(data.error || 'Ocurrió un error');
  }
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
  return $('#modalBody');
}

function closeModal() {
  $('#modal').hidden = true;
  $('#modalBody').innerHTML = '';
  document.body.style.overflow = '';
}

$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function withBusy(button, fn) {
  if (button) button.disabled = true;
  try {
    return await fn();
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function productImage(p) {
  return p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
    : '<div class="placeholder-bottle" aria-hidden="true"></div>';
}

function badge(status, labels = STATUS_LABELS) {
  return `<span class="badge ${esc(status)}">${esc(labels[status] || status)}</span>`;
}

/* =================================================================
   Estado
   ================================================================= */
const state = {
  user: null,
  tab: {},
};

const cart = {
  key() { return state.user ? `cart_${state.user.id}` : 'cart_guest'; },
  read() {
    try { return JSON.parse(localStorage.getItem(this.key())) || {}; } catch { return {}; }
  },
  write(items) {
    try { localStorage.setItem(this.key(), JSON.stringify(items)); } catch { /* sin almacenamiento */ }
    renderNav();
  },
  add(id, qty) {
    const items = this.read();
    items[id] = Math.min(999, (items[id] || 0) + qty);
    this.write(items);
  },
  set(id, qty) {
    const items = this.read();
    if (qty > 0) items[id] = Math.min(999, qty); else delete items[id];
    this.write(items);
  },
  clear() { this.write({}); },
  count() { return Object.values(this.read()).reduce((a, b) => a + b, 0); },
};

/* =================================================================
   Navegación
   ================================================================= */
function renderNav() {
  const nav = $('#nav');
  const route = location.hash.split('?')[0] || '#/';
  const link = (href, label, extra = '') =>
    `<a href="${href}" class="${route === href ? 'active' : ''}">${label}${extra}</a>`;
  let html = link('#/', 'Inicio') + link('#/catalogo', 'Catálogo');
  if (!state.user) {
    html += link('#/registro', 'Sé vendedor') + link('#/login', 'Ingresar');
  } else if (state.user.role === 'admin') {
    html += link('#/admin', 'Administración');
    html += '<button class="link" data-action="logout">Salir</button>';
  } else {
    const n = cart.count();
    html += link('#/panel', 'Mi panel');
    html += link('#/panel/carrito', 'Carrito', n ? ` <span class="badge count">${n}</span>` : '');
    html += '<button class="link" data-action="logout">Salir</button>';
  }
  nav.innerHTML = html;
}

$('#nav').addEventListener('click', async (e) => {
  if (e.target.closest('a')) $('#nav').classList.remove('open');
  if (e.target.dataset.action === 'logout') {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    $('#nav').classList.remove('open');
    toast('Sesión cerrada');
    location.hash = '#/';
    renderNav();
  }
});
$('#menuToggle').addEventListener('click', () => $('#nav').classList.toggle('open'));

const routes = {
  '#/': viewHome,
  '#/catalogo': viewCatalog,
  '#/registro': viewRegister,
  '#/login': viewLogin,
  '#/panel': () => viewVendor('catalogo'),
  '#/panel/carrito': () => viewVendor('carrito'),
  '#/panel/pedidos': () => viewVendor('pedidos'),
  '#/panel/ranking': () => viewVendor('ranking'),
  '#/admin': () => viewAdmin(state.tab.admin || 'resumen'),
};

async function router() {
  const route = location.hash.split('?')[0] || '#/';
  renderNav();
  window.scrollTo(0, 0);
  const view = routes[route] || viewHome;
  try {
    await view();
  } catch (err) {
    app.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', router);

/* =================================================================
   Vistas públicas
   ================================================================= */
async function viewHome() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <div class="eyebrow">Alta perfumería</div>
        <h1>El arte de la<br>fragancia</h1>
        <p>Descubre nuestro catálogo de perfumes originales. ¿Quieres generar ingresos? Únete a nuestro equipo de vendedores y gana comisión por cada venta.</p>
        <div class="hero-actions">
          <a class="btn solid" href="#/catalogo">Ver catálogo</a>
          ${state.user ? `<a class="btn" href="${state.user.role === 'admin' ? '#/admin' : '#/panel'}">Ir a mi panel</a>` : '<a class="btn" href="#/registro">Quiero ser vendedor</a>'}
        </div>
      </div>
    </section>
    <div class="features">
      <div class="feature"><div class="num">01</div><h3>Regístrate</h3><p class="muted small">Envía tu solicitud para ser vendedor. Te avisaremos cuando sea aprobada.</p></div>
      <div class="feature"><div class="num">02</div><h3>Vende</h3><p class="muted small">Consulta precios sugeridos y tu comisión por cada perfume. Arma pedidos para tus clientes.</p></div>
      <div class="feature"><div class="num">03</div><h3>Gana</h3><p class="muted small">Sigue el estado de tus pedidos. Cada mes premiamos a los 3 mejores vendedores.</p></div>
    </div>
    <section class="section">
      <div class="section-head"><h2>Destacados</h2><a class="btn sm" href="#/catalogo">Ver todo</a></div>
      <div id="featured"></div>
    </section>`;
  const { perfumes } = await api('/api/catalog');
  $('#featured').innerHTML = perfumes.length
    ? `<div class="grid">${perfumes.slice(0, 8).map((p) => productCard(p)).join('')}</div>`
    : '<div class="empty">Pronto publicaremos nuestro catálogo.</div>';
}

function productCard(p, { vendor = false } = {}) {
  return `
    <article class="product" data-id="${p.id}">
      <div class="product-img">${productImage(p)}</div>
      <div class="product-body">
        <div class="product-brand">${esc(p.brand || 'Perfume')}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-meta">${[p.category, p.size_ml ? `${p.size_ml} ml` : ''].filter(Boolean).map(esc).join(' · ')}</div>
        ${p.description ? `<div class="product-desc">${esc(p.description)}</div>` : ''}
        ${vendor ? `
          <div class="product-prices">
            <div><div class="lbl">Precio sugerido</div><div class="val">${money(p.suggested_price)}</div></div>
            <div><div class="lbl">Tu comisión</div><div class="val gold">${money(p.commission)}</div></div>
          </div>
          <div class="product-actions">
            <div class="qty">
              <button type="button" data-qty="-1" aria-label="Menos">−</button>
              <input type="number" min="1" max="999" value="1" aria-label="Cantidad">
              <button type="button" data-qty="1" aria-label="Más">+</button>
            </div>
            <button class="btn sm solid" data-add="${p.id}">Agregar</button>
          </div>` : ''}
      </div>
    </article>`;
}

function catalogFilters(perfumes, onChange) {
  const categories = [...new Set(perfumes.map((p) => p.category).filter(Boolean))];
  const html = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar por nombre o marca…">
      <div class="chips">
        <button class="chip active" data-cat="">Todos</button>
        ${categories.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </div>`;
  const bind = (root) => {
    let cat = '';
    const apply = () => {
      const q = $('#q', root).value.trim().toLowerCase();
      onChange(perfumes.filter((p) =>
        (!cat || p.category === cat) &&
        (!q || `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(q))));
    };
    $('#q', root).addEventListener('input', apply);
    $$('.chip', root).forEach((chip) => chip.addEventListener('click', () => {
      $$('.chip', root).forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      cat = chip.dataset.cat;
      apply();
    }));
  };
  return { html, bind };
}

async function viewCatalog() {
  app.innerHTML = '<div class="section-head"><div><div class="eyebrow">Colección</div><h2>Catálogo</h2></div></div><div id="catalog"></div>';
  const { perfumes } = await api('/api/catalog');
  const root = $('#catalog');
  if (!perfumes.length) {
    root.innerHTML = '<div class="empty">Aún no hay perfumes en el catálogo.</div>';
    return;
  }
  const draw = (list) => {
    $('#catalogGrid').innerHTML = list.length
      ? `<div class="grid">${list.map((p) => productCard(p)).join('')}</div>`
      : '<div class="empty">No hay perfumes que coincidan con la búsqueda.</div>';
  };
  const filters = catalogFilters(perfumes, draw);
  root.innerHTML = `${filters.html}<div id="catalogGrid"></div>
    ${state.user ? '' : '<p class="center muted small" style="margin-top:2rem">¿Eres vendedor? <a href="#/login" style="text-decoration:underline">Ingresa</a> para ver precios y comisiones.</p>'}`;
  filters.bind(root);
  draw(perfumes);
}

function viewRegister() {
  if (state.user) { location.hash = state.user.role === 'admin' ? '#/admin' : '#/panel'; return; }
  app.innerHTML = `
    <div class="form-wrap">
      <div class="eyebrow center">Únete al equipo</div>
      <h2 class="center">Registro de vendedores</h2>
      <p class="center muted">Completa el formulario. El administrador revisará tu solicitud y, una vez aprobada, podrás ingresar a tu panel.</p>
      <form class="card form" id="registerForm">
        <div class="form-grid">
          <div class="field full"><label for="r-name">Nombre completo *</label><input id="r-name" name="name" required maxlength="100" autocomplete="name"></div>
          <div class="field"><label for="r-email">Correo *</label><input id="r-email" name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label for="r-phone">Teléfono / WhatsApp</label><input id="r-phone" name="phone" type="tel" autocomplete="tel"></div>
          <div class="field"><label for="r-city">Ciudad</label><input id="r-city" name="city"></div>
          <div class="field"><label for="r-pass">Contraseña *</label><input id="r-pass" name="password" type="password" required minlength="6" autocomplete="new-password"></div>
          <div class="field full"><label for="r-msg">¿Por qué quieres ser vendedor?</label><textarea id="r-msg" name="message" maxlength="1000"></textarea></div>
        </div>
        <button class="btn solid" type="submit">Enviar solicitud</button>
        <p class="center small muted">¿Ya tienes cuenta? <a href="#/login" style="text-decoration:underline">Ingresa aquí</a></p>
      </form>
    </div>`;
  $('#registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.submitter;
    withBusy(btn, async () => {
      const { message } = await api('/api/register', { method: 'POST', body: formData(e.target) });
      app.innerHTML = `
        <div class="form-wrap card center">
          <div class="eyebrow">Solicitud recibida</div>
          <h2>¡Gracias!</h2>
          <p class="muted">${esc(message)} Cuando tu cuenta sea aprobada podrás ingresar con tu correo y contraseña.</p>
          <a class="btn" href="#/">Volver al inicio</a>
        </div>`;
    });
  });
}

function viewLogin() {
  if (state.user) { location.hash = state.user.role === 'admin' ? '#/admin' : '#/panel'; return; }
  app.innerHTML = `
    <div class="form-wrap" style="max-width:440px">
      <div class="eyebrow center">Bienvenido</div>
      <h2 class="center">Ingresar</h2>
      <form class="card form" id="loginForm">
        <div class="field"><label for="l-email">Correo</label><input id="l-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="l-pass">Contraseña</label><input id="l-pass" name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn solid" type="submit">Ingresar</button>
        <p class="center small muted">¿Quieres vender con nosotros? <a href="#/registro" style="text-decoration:underline">Regístrate</a></p>
      </form>
    </div>`;
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(e.submitter, async () => {
      const { user } = await api('/api/login', { method: 'POST', body: formData(e.target) });
      state.user = user;
      toast(`Hola, ${user.name}`);
      location.hash = user.role === 'admin' ? '#/admin' : '#/panel';
    });
  });
}

/* =================================================================
   Panel del vendedor
   ================================================================= */
function requireRole(role) {
  if (!state.user) { location.hash = '#/login'; return false; }
  if (role === 'admin' && state.user.role !== 'admin') { location.hash = '#/panel'; return false; }
  if (role === 'vendor' && state.user.role !== 'vendor') { location.hash = '#/admin'; return false; }
  return true;
}

async function viewVendor(tab) {
  if (!requireRole('vendor')) return;
  const tabs = [
    ['catalogo', 'Precios y comisiones', '#/panel'],
    ['carrito', `Carrito${cart.count() ? ` (${cart.count()})` : ''}`, '#/panel/carrito'],
    ['pedidos', 'Mis pedidos', '#/panel/pedidos'],
    ['ranking', 'Ranking', '#/panel/ranking'],
  ];
  app.innerHTML = `
    <div class="panel-head">
      <div><div class="eyebrow">Panel de vendedor</div><h2 style="margin:0">Hola, ${esc(state.user.name)}</h2></div>
    </div>
    <div id="vendorStats"></div>
    <nav class="tabs">${tabs.map(([k, label, href]) => `<a class="tab ${k === tab ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>
    <div id="tabBody"></div>`;

  api('/api/vendor/stats').then((s) => {
    $('#vendorStats').innerHTML = `
      <div class="stats">
        <div class="stat"><div class="lbl">Ventas entregadas · ${esc(monthLabel(s.month))}</div><div class="val">${money(s.delivered.sales)}</div></div>
        <div class="stat"><div class="lbl">Comisión ganada · mes</div><div class="val" style="color:var(--gold)">${money(s.delivered.commission)}</div></div>
        <div class="stat"><div class="lbl">Pedidos en curso</div><div class="val">${s.inProgress.orders}</div></div>
        <div class="stat"><div class="lbl">Posición en ranking</div><div class="val">${s.position ? '#' + s.position : '—'}</div></div>
      </div>`;
  }).catch(() => {});

  const body = $('#tabBody');
  if (tab === 'catalogo') return vendorCatalog(body);
  if (tab === 'carrito') return vendorCart(body);
  if (tab === 'pedidos') return vendorOrders(body);
  if (tab === 'ranking') return rankingView(body);
}

async function vendorCatalog(body) {
  const { perfumes } = await api('/api/vendor/perfumes');
  if (!perfumes.length) {
    body.innerHTML = '<div class="empty">El administrador aún no ha publicado perfumes.</div>';
    return;
  }
  const draw = (list) => {
    $('#vGrid').innerHTML = list.length
      ? `<div class="grid">${list.map((p) => productCard(p, { vendor: true })).join('')}</div>`
      : '<div class="empty">No hay perfumes que coincidan con la búsqueda.</div>';
  };
  const filters = catalogFilters(perfumes, draw);
  body.innerHTML = `${filters.html}<div id="vGrid"></div>`;
  filters.bind(body);
  draw(perfumes);

  body.addEventListener('click', (e) => {
    const card = e.target.closest('.product');
    if (!card) return;
    const input = $('.qty input', card);
    if (e.target.dataset.qty) {
      input.value = Math.max(1, Math.min(999, (Number(input.value) || 1) + Number(e.target.dataset.qty)));
    }
    if (e.target.dataset.add) {
      const qty = Math.max(1, Math.min(999, Math.floor(Number(input.value)) || 1));
      cart.add(e.target.dataset.add, qty);
      input.value = 1;
      const tab = $$('.tab')[1];
      if (tab) tab.textContent = `Carrito (${cart.count()})`;
      toast(`Agregado al carrito (${qty})`);
    }
  });
}

async function vendorCart(body) {
  const { perfumes } = await api('/api/vendor/perfumes');
  const byId = Object.fromEntries(perfumes.map((p) => [String(p.id), p]));
  const draw = () => {
    const items = cart.read();
    // Quitar del carrito los perfumes que ya no están activos.
    const stale = Object.keys(items).filter((id) => !byId[id]);
    if (stale.length) { stale.forEach((id) => delete items[id]); cart.write(items); }
    const lines = Object.entries(items).map(([id, qty]) => ({ p: byId[id], qty }));
    const total = lines.reduce((s, l) => s + l.p.suggested_price * l.qty, 0);
    const commission = lines.reduce((s, l) => s + l.p.commission * l.qty, 0);
    const tab = $$('.tab')[1];
    if (tab) tab.textContent = `Carrito${cart.count() ? ` (${cart.count()})` : ''}`;

    if (!lines.length) {
      body.innerHTML = '<div class="empty">Tu carrito está vacío.<br><br><a class="btn sm" href="#/panel">Ir al catálogo</a></div>';
      return;
    }
    body.innerHTML = `
      <div class="cart-layout">
        <div class="card">
          <h3>Productos</h3>
          ${lines.map(({ p, qty }) => `
            <div class="cart-line" data-id="${p.id}">
              <div>
                <div class="product-brand">${esc(p.brand || '')}</div>
                <div style="font-family:var(--serif);font-size:1.2rem">${esc(p.name)}${p.size_ml ? ` <span class="muted small">${p.size_ml} ml</span>` : ''}</div>
                <div class="small muted">${money(p.suggested_price)} c/u · comisión ${money(p.commission)} c/u</div>
              </div>
              <div class="qty">
                <button type="button" data-step="-1" aria-label="Menos">−</button>
                <input type="number" min="1" max="999" value="${qty}" aria-label="Cantidad">
                <button type="button" data-step="1" aria-label="Más">+</button>
              </div>
              <button class="btn sm ghost danger" data-remove aria-label="Quitar">×</button>
            </div>`).join('')}
          <div style="margin-top:1rem">
            <div class="cart-total"><span class="muted">Comisión total</span><span style="color:var(--gold)">${money(commission)}</span></div>
            <div class="cart-total big"><span>Total</span><span>${money(total)}</span></div>
          </div>
        </div>
        <form class="card form" id="orderForm">
          <h3>Datos del cliente</h3>
          <div class="field"><label for="c-name">Nombre del cliente *</label><input id="c-name" name="client_name" required maxlength="120"></div>
          <div class="field"><label for="c-phone">Teléfono</label><input id="c-phone" name="client_phone" type="tel"></div>
          <div class="field"><label for="c-addr">Dirección de entrega</label><input id="c-addr" name="client_address"></div>
          <div class="field"><label for="c-notes">Notas</label><textarea id="c-notes" name="notes"></textarea></div>
          <button class="btn solid" type="submit">Enviar pedido</button>
          <button class="btn ghost" type="button" id="clearCart">Vaciar carrito</button>
        </form>
      </div>`;

    $$('.cart-line', body).forEach((line) => {
      const id = line.dataset.id;
      const input = $('input', line);
      $$('[data-step]', line).forEach((b) => b.addEventListener('click', () => {
        cart.set(id, Math.max(1, (Number(input.value) || 1) + Number(b.dataset.step)));
        draw();
      }));
      input.addEventListener('change', () => { cart.set(id, Math.max(1, Math.floor(Number(input.value)) || 1)); draw(); });
      $('[data-remove]', line).addEventListener('click', () => { cart.set(id, 0); draw(); });
    });
    $('#clearCart').addEventListener('click', () => {
      if (confirm('¿Vaciar el carrito?')) { cart.clear(); draw(); }
    });
    $('#orderForm').addEventListener('submit', (e) => {
      e.preventDefault();
      withBusy(e.submitter, async () => {
        const payload = {
          ...formData(e.target),
          items: lines.map(({ p, qty }) => ({ perfume_id: p.id, quantity: qty })),
        };
        const { order } = await api('/api/orders', { method: 'POST', body: payload });
        cart.clear();
        toast(`Pedido #${order.id} enviado`);
        location.hash = '#/panel/pedidos';
      });
    });
  };
  draw();
}

function progressBar(status) {
  if (status === 'cancelado') return '';
  const idx = PROGRESS_STEPS.indexOf(status);
  return `<div class="progress">${PROGRESS_STEPS.map((s, i) =>
    `<div class="step ${i <= idx ? 'done' : ''}">${STATUS_LABELS[s]}</div>`).join('')}</div>`;
}

function orderCard(o, { admin = false, statuses = [] } = {}) {
  return `
    <article class="order" data-id="${o.id}">
      <div class="order-head">
        <div>
          <div class="title">Pedido #${o.id} · ${esc(o.client_name)}</div>
          <div class="small muted">${fmtDate(o.created_at)}${admin ? ` · Vendedor: <strong style="color:var(--fg)">${esc(o.vendor_name)}</strong>` : ''}</div>
        </div>
        ${badge(o.status)}
      </div>
      <div class="order-body">
        ${progressBar(o.status)}
        <ul class="order-items">
          ${o.items.map((it) => `<li><span>${it.quantity} × ${esc(it.perfume_name)}</span><span>${money(it.unit_price * it.quantity)}</span></li>`).join('')}
        </ul>
        ${o.client_phone || o.client_address ? `<div class="small muted">${[o.client_phone, o.client_address].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        ${o.notes ? `<div class="small"><span class="muted">Notas:</span> ${esc(o.notes)}</div>` : ''}
        ${o.admin_note ? `<div class="small"><span class="muted">Nota del administrador:</span> ${esc(o.admin_note)}</div>` : ''}
      </div>
      <div class="order-foot">
        <div class="totals">
          <span class="small muted">Total <strong style="color:var(--fg)">${money(o.total)}</strong></span>
          <span class="small muted">Comisión <strong style="color:var(--gold)">${money(o.total_commission)}</strong></span>
        </div>
        <div class="btn-row">
          <button class="btn sm ghost" data-detail="${o.id}">Historial</button>
          ${admin ? `
            <select data-status="${o.id}" aria-label="Cambiar estado" style="width:auto;padding:0.4rem 0.6rem">
              ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
            </select>
            <button class="btn sm solid" data-save-status="${o.id}">Actualizar estado</button>` : ''}
          ${!admin && o.status === 'pendiente' ? `<button class="btn sm danger" data-cancel="${o.id}">Cancelar</button>` : ''}
        </div>
      </div>
    </article>`;
}

async function showOrderHistory(id) {
  const { order } = await api(`/api/orders/${id}`);
  openModal(`
    <div class="eyebrow">Pedido #${order.id}</div>
    <h3>${esc(order.client_name)}</h3>
    <p class="small muted">Vendedor: ${esc(order.vendor_name)}${order.vendor_phone ? ' · ' + esc(order.vendor_phone) : ''}</p>
    ${progressBar(order.status)}
    <h3 style="margin-top:1.5rem">Historial</h3>
    <ul class="timeline">
      ${order.history.map((h) => `<li>${badge(h.status)} <span class="muted">${fmtDate(h.created_at)}</span>${h.note ? `<div>${esc(h.note)}</div>` : ''}</li>`).join('')}
    </ul>`);
}

function orderFilterBar(statuses, current) {
  return `<div class="chips" style="margin-bottom:1.2rem">
    <button class="chip ${!current ? 'active' : ''}" data-filter="">Todos</button>
    ${statuses.map((s) => `<button class="chip ${s === current ? 'active' : ''}" data-filter="${s}">${STATUS_LABELS[s]}</button>`).join('')}
  </div>`;
}

async function vendorOrders(body, filter = '') {
  const { orders, statuses } = await api(`/api/orders${filter ? `?status=${filter}` : ''}`);
  body.innerHTML = `
    ${orderFilterBar(statuses, filter)}
    ${orders.length ? `<div class="orders">${orders.map((o) => orderCard(o)).join('')}</div>`
      : '<div class="empty">No tienes pedidos todavía.<br><br><a class="btn sm" href="#/panel">Armar un pedido</a></div>'}`;
  $$('[data-filter]', body).forEach((c) => c.addEventListener('click', () => vendorOrders(body, c.dataset.filter)));
  $$('[data-detail]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, () => showOrderHistory(b.dataset.detail))));
  $$('[data-cancel]', body).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    withBusy(b, async () => {
      await api(`/api/orders/${b.dataset.cancel}/cancel`, { method: 'POST' });
      toast('Pedido cancelado');
      vendorOrders(body, filter);
    });
  }));
}

/* =================================================================
   Ranking (vendedor y administrador)
   ================================================================= */
async function rankingView(body, month = currentMonth()) {
  const isAdmin = state.user.role === 'admin';
  const { ranking } = await api(`/api/ranking?month=${month}`);
  const top = [ranking[1], ranking[0], ranking[2]];
  const places = ['second', 'first', 'third'];
  const medals = ['2', '1', '3'];
  body.innerHTML = `
    <div class="section-head">
      <div>
        <div class="eyebrow">Premio mensual a los 3 mejores</div>
        <h2 style="text-transform:capitalize">Ranking · ${esc(monthLabel(month))}</h2>
      </div>
      <div class="btn-row">
        <button class="btn sm" data-month="${shiftMonth(month, -1)}">← Anterior</button>
        <button class="btn sm" data-month="${shiftMonth(month, 1)}" ${month >= currentMonth() ? 'disabled' : ''}>Siguiente →</button>
      </div>
    </div>
    <div class="podium">
      ${top.map((r, i) => `
        <div class="podium-place ${places[i]}">
          <div class="medal">${medals[i]}°</div>
          <div class="who">${r ? esc(r.name) : '—'}</div>
          <div class="small muted">${r ? `${money(r.sales)} · ${r.units} uds.` : 'Sin ventas'}</div>
          <div class="prize" style="margin-top:0.6rem">Premio ${medals[i]}° lugar</div>
        </div>`).join('')}
    </div>
    ${ranking.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Vendedor</th><th>Ciudad</th><th class="num">Pedidos</th><th class="num">Unidades</th><th class="num">Ventas</th>${isAdmin ? '<th class="num">Comisión</th>' : ''}</tr></thead>
        <tbody>
          ${ranking.map((r) => `
            <tr class="${r.me ? 'me' : ''}">
              <td>${r.position}</td>
              <td>${esc(r.name)}${r.me ? ' <span class="badge">Tú</span>' : ''}</td>
              <td class="muted">${esc(r.city || '')}</td>
              <td class="num">${r.orders}</td>
              <td class="num">${r.units}</td>
              <td class="num">${money(r.sales)}</td>
              ${isAdmin ? `<td class="num" style="color:var(--gold)">${money(r.commission)}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table></div>`
      : '<div class="empty">Aún no hay pedidos entregados en este mes.</div>'}
    <p class="small muted" style="margin-top:1rem">El ranking se calcula con el monto de los pedidos <strong>entregados</strong> creados durante el mes.</p>`;
  $$('[data-month]', body).forEach((b) => b.addEventListener('click', () => rankingView(body, b.dataset.month)));
}

/* =================================================================
   Panel del administrador
   ================================================================= */
async function viewAdmin(tab) {
  if (!requireRole('admin')) return;
  state.tab.admin = tab;
  const summary = await api('/api/admin/summary');
  const tabs = [
    ['resumen', 'Resumen'],
    ['solicitudes', `Vendedores${summary.pendingVendors ? ` (${summary.pendingVendors})` : ''}`],
    ['catalogo', 'Catálogo'],
    ['pedidos', `Pedidos${summary.openOrders ? ` (${summary.openOrders})` : ''}`],
    ['ranking', 'Ranking'],
    ['cuenta', 'Cuenta'],
  ];
  app.innerHTML = `
    <div class="panel-head"><div><div class="eyebrow">Administración</div><h2 style="margin:0">Panel de control</h2></div></div>
    <nav class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
    <div id="tabBody"></div>`;
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => viewAdmin(b.dataset.tab)));
  const body = $('#tabBody');
  const views = { resumen: adminSummary, solicitudes: adminVendors, catalogo: adminPerfumes, pedidos: adminOrders, ranking: (b) => rankingView(b), cuenta: adminAccount };
  await views[tab](body, summary);
}

function adminSummary(body, s) {
  body.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="lbl">Solicitudes pendientes</div><div class="val">${s.pendingVendors}</div></div>
      <div class="stat"><div class="lbl">Vendedores activos</div><div class="val">${s.approvedVendors}</div></div>
      <div class="stat"><div class="lbl">Perfumes publicados</div><div class="val">${s.activePerfumes}</div></div>
      <div class="stat"><div class="lbl">Pedidos en curso</div><div class="val">${s.openOrders}</div></div>
      <div class="stat"><div class="lbl">Ventas entregadas · mes</div><div class="val">${money(s.monthSales)}</div></div>
    </div>
    <div class="btn-row">
      <button class="btn" data-go="solicitudes">Revisar solicitudes</button>
      <button class="btn" data-go="catalogo">Agregar perfume</button>
      <button class="btn" data-go="pedidos">Gestionar pedidos</button>
      <button class="btn" data-go="ranking">Ver ranking</button>
    </div>`;
  $$('[data-go]', body).forEach((b) => b.addEventListener('click', () => viewAdmin(b.dataset.go)));
}

async function adminVendors(body, _s, filter = '') {
  const { vendors } = await api(`/api/admin/vendors${filter ? `?status=${filter}` : ''}`);
  body.innerHTML = `
    <div class="chips" style="margin-bottom:1.2rem">
      ${[['', 'Todos'], ['pending', 'Pendientes'], ['approved', 'Aprobados'], ['rejected', 'Rechazados']]
        .map(([k, l]) => `<button class="chip ${k === filter ? 'active' : ''}" data-filter="${k}">${l}</button>`).join('')}
    </div>
    ${vendors.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Vendedor</th><th>Contacto</th><th>Mensaje</th><th>Registro</th><th>Estado</th><th class="num">Acciones</th></tr></thead>
        <tbody>
          ${vendors.map((v) => `
            <tr>
              <td><strong>${esc(v.name)}</strong><div class="small muted">${esc(v.city || '')}</div></td>
              <td class="small">${esc(v.email)}<div class="muted">${esc(v.phone || '')}</div></td>
              <td class="small muted" style="max-width:260px">${esc(v.message || '—')}</td>
              <td class="small muted">${fmtDate(v.created_at)}</td>
              <td>${badge(v.status, VENDOR_STATUS_LABELS)}<div class="small muted">${v.orders} pedidos</div></td>
              <td class="num">
                <div class="btn-row" style="justify-content:flex-end">
                  ${v.status !== 'approved' ? `<button class="btn sm ok" data-set="approved" data-id="${v.id}">Aceptar</button>` : ''}
                  ${v.status !== 'rejected' ? `<button class="btn sm danger" data-set="rejected" data-id="${v.id}">${v.status === 'approved' ? 'Suspender' : 'Rechazar'}</button>` : ''}
                  ${v.status === 'rejected' ? `<button class="btn sm ghost danger" data-delete="${v.id}">Eliminar</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>`
      : '<div class="empty">No hay vendedores en esta lista.</div>'}`;
  $$('[data-filter]', body).forEach((c) => c.addEventListener('click', () => adminVendors(body, null, c.dataset.filter)));
  $$('[data-set]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, async () => {
    await api(`/api/admin/vendors/${b.dataset.id}`, { method: 'PATCH', body: { status: b.dataset.set } });
    toast(b.dataset.set === 'approved' ? 'Vendedor aceptado' : 'Vendedor actualizado');
    await viewAdmin('solicitudes');
  })));
  $$('[data-delete]', body).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Eliminar este vendedor y todos sus pedidos? Esta acción no se puede deshacer.')) return;
    withBusy(b, async () => {
      await api(`/api/admin/vendors/${b.dataset.delete}`, { method: 'DELETE' });
      toast('Vendedor eliminado');
      await viewAdmin('solicitudes');
    });
  }));
}

async function adminPerfumes(body) {
  const { perfumes } = await api('/api/admin/perfumes');
  body.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <h2>Catálogo</h2>
      <button class="btn solid" id="newPerfume">+ Agregar perfume</button>
    </div>
    ${perfumes.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Perfume</th><th>Categoría</th><th class="num">Precio sugerido</th><th class="num">Comisión</th><th>Estado</th><th class="num">Acciones</th></tr></thead>
        <tbody>
          ${perfumes.map((p) => `
            <tr>
              <td>${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : '<div class="thumb"></div>'}</td>
              <td><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.brand || '')}${p.size_ml ? ` · ${p.size_ml} ml` : ''}</div></td>
              <td class="muted">${esc(p.category || '—')}</td>
              <td class="num">${money(p.suggested_price)}</td>
              <td class="num" style="color:var(--gold)">${money(p.commission)}</td>
              <td>${p.active ? '<span class="badge approved">Publicado</span>' : '<span class="badge">Oculto</span>'}</td>
              <td class="num"><div class="btn-row" style="justify-content:flex-end">
                <button class="btn sm" data-edit="${p.id}">Editar</button>
                <button class="btn sm ghost danger" data-del="${p.id}">Eliminar</button>
              </div></td>
            </tr>`).join('')}
        </tbody>
      </table></div>`
      : '<div class="empty">Aún no hay perfumes. Agrega el primero para armar tu catálogo.</div>'}`;
  $('#newPerfume').addEventListener('click', () => perfumeForm());
  $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => perfumeForm(perfumes.find((p) => p.id === Number(b.dataset.edit)))));
  $$('[data-del]', body).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Eliminar este perfume del catálogo? Los pedidos existentes se conservan.')) return;
    withBusy(b, async () => {
      await api(`/api/admin/perfumes/${b.dataset.del}`, { method: 'DELETE' });
      toast('Perfume eliminado');
      viewAdmin('catalogo');
    });
  }));
}

function perfumeForm(p = {}) {
  const editing = Boolean(p.id);
  const root = openModal(`
    <div class="eyebrow">${editing ? 'Editar' : 'Nuevo'} perfume</div>
    <h3>${editing ? esc(p.name) : 'Agregar al catálogo'}</h3>
    <form class="form" id="perfumeForm">
      <div class="form-grid">
        <div class="field"><label for="p-name">Nombre *</label><input id="p-name" name="name" required value="${esc(p.name || '')}"></div>
        <div class="field"><label for="p-brand">Marca</label><input id="p-brand" name="brand" value="${esc(p.brand || '')}"></div>
        <div class="field"><label for="p-cat">Categoría</label>
          <select id="p-cat" name="category">
            <option value="">—</option>
            ${CATEGORIES.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="p-size">Tamaño (ml)</label><input id="p-size" name="size_ml" type="number" min="1" value="${esc(p.size_ml || '')}"></div>
        <div class="field"><label for="p-price">Precio sugerido de venta *</label><input id="p-price" name="suggested_price" type="number" min="0" step="0.01" required value="${esc(p.suggested_price ?? '')}"></div>
        <div class="field"><label for="p-comm">Comisión del vendedor *</label><input id="p-comm" name="commission" type="number" min="0" step="0.01" required value="${esc(p.commission ?? '')}"></div>
        <div class="field full"><label for="p-desc">Descripción / notas olfativas</label><textarea id="p-desc" name="description">${esc(p.description || '')}</textarea></div>
        <div class="field full">
          <label for="p-img">Imagen (URL o sube un archivo)</label>
          <input id="p-img" name="image" placeholder="https://…" value="${esc(p.image || '')}">
          <input type="file" id="p-file" accept="image/png,image/jpeg,image/webp,image/gif">
          <img class="img-preview" id="p-preview" ${p.image ? `src="${esc(p.image)}"` : 'hidden'} alt="Vista previa">
        </div>
        <label class="checkbox field full"><input type="checkbox" name="active" ${p.active === 0 ? '' : 'checked'}> Publicado (visible en el catálogo)</label>
      </div>
      <div class="btn-row">
        <button class="btn solid" type="submit">${editing ? 'Guardar cambios' : 'Agregar perfume'}</button>
        <button class="btn ghost" type="button" id="cancelPerfume">Cancelar</button>
      </div>
    </form>`);

  const imgInput = $('#p-img', root);
  const preview = $('#p-preview', root);
  imgInput.addEventListener('input', () => {
    preview.hidden = !imgInput.value;
    if (imgInput.value) preview.src = imgInput.value;
  });
  $('#p-file', root).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast('La imagen debe pesar menos de 4 MB', true); return; }
    const reader = new FileReader();
    reader.onload = () => withBusy(null, async () => {
      const { url } = await api('/api/admin/upload', { method: 'POST', body: { data: reader.result } });
      imgInput.value = url;
      preview.src = url;
      preview.hidden = false;
      toast('Imagen subida');
    });
    reader.readAsDataURL(file);
  });
  $('#cancelPerfume', root).addEventListener('click', closeModal);
  $('#perfumeForm', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const data = formData(e.target);
    data.active = e.target.active.checked;
    withBusy(e.submitter, async () => {
      await api(editing ? `/api/admin/perfumes/${p.id}` : '/api/admin/perfumes', { method: editing ? 'PUT' : 'POST', body: data });
      closeModal();
      toast(editing ? 'Perfume actualizado' : 'Perfume agregado');
      viewAdmin('catalogo');
    });
  });
}

async function adminOrders(body, _s, filter = '') {
  const { orders, statuses } = await api(`/api/orders${filter ? `?status=${filter}` : ''}`);
  body.innerHTML = `
    ${orderFilterBar(statuses, filter)}
    ${orders.length ? `<div class="orders">${orders.map((o) => orderCard(o, { admin: true, statuses })).join('')}</div>`
      : '<div class="empty">No hay pedidos en esta lista.</div>'}`;
  $$('[data-filter]', body).forEach((c) => c.addEventListener('click', () => adminOrders(body, null, c.dataset.filter)));
  $$('[data-detail]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, () => showOrderHistory(b.dataset.detail))));
  $$('[data-save-status]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.saveStatus;
    const status = $(`[data-status="${id}"]`, body).value;
    const root = openModal(`
      <div class="eyebrow">Pedido #${esc(id)}</div>
      <h3>Cambiar estado a ${badge(status)}</h3>
      <form class="form" id="statusForm">
        <div class="field"><label for="s-note">Nota para el vendedor (opcional)</label><textarea id="s-note" name="note" placeholder="Ej: enviado por courier, número de guía…"></textarea></div>
        <div class="btn-row"><button class="btn solid" type="submit">Confirmar</button><button class="btn ghost" type="button" id="cancelStatus">Cancelar</button></div>
      </form>`);
    $('#cancelStatus', root).addEventListener('click', closeModal);
    $('#statusForm', root).addEventListener('submit', (e) => {
      e.preventDefault();
      withBusy(e.submitter, async () => {
        await api(`/api/orders/${id}/status`, { method: 'PATCH', body: { status, note: e.target.note.value } });
        closeModal();
        toast(`Pedido #${id}: ${STATUS_LABELS[status]}`);
        adminOrders(body, null, filter);
      });
    });
  }));
}

function adminAccount(body) {
  body.innerHTML = `
    <div class="form-wrap" style="margin:0;max-width:480px">
      <form class="card form" id="passForm">
        <h3>Cambiar contraseña</h3>
        <p class="small muted">Sesión iniciada como ${esc(state.user.email)}</p>
        <div class="field"><label for="a-cur">Contraseña actual</label><input id="a-cur" name="current" type="password" required autocomplete="current-password"></div>
        <div class="field"><label for="a-new">Nueva contraseña</label><input id="a-new" name="next" type="password" required minlength="6" autocomplete="new-password"></div>
        <button class="btn solid" type="submit">Guardar</button>
      </form>
    </div>`;
  $('#passForm').addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(e.submitter, async () => {
      await api('/api/me/password', { method: 'POST', body: formData(e.target) });
      e.target.reset();
      toast('Contraseña actualizada');
    });
  });
}

/* =================================================================
   Inicio
   ================================================================= */
$('#year').textContent = new Date().getFullYear();

(async function init() {
  try {
    const { user } = await api('/api/me');
    state.user = user;
  } catch { /* sin sesión */ }
  router();
})();
