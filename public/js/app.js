'use strict';

/* =================================================================
   Configuración
   ================================================================= */
const CURRENCY = 'Bs ';
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
const PAYMENT_LABELS = { pendiente: 'Pago pendiente', pagado: 'Pagado' };
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

// Bs 1.234,50 (con punto de miles también desde 1.000).
function money(n) {
  const [int, dec] = Math.abs(Number(n) || 0).toFixed(2).split('.');
  return `${Number(n) < 0 ? '−' : ''}${CURRENCY}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

// "2026-10-15" -> "15/10/2026"
const fmtDay = (d) => String(d || '').split('-').reverse().join('/');

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
    : '<img class="placeholder-emblem" src="/img/emblem.png" alt="" aria-hidden="true">';
}

function badge(status, labels = STATUS_LABELS) {
  return `<span class="badge ${esc(status)}">${esc(labels[status] || status)}</span>`;
}

// "Pago en revisión": el cliente ya subió su comprobante y falta que la tienda lo confirme.
// Agrega al aviso si se pudo enviar el correo al cliente.
function emailNote(result) {
  if (result === 'sent') return ' · correo enviado al cliente';
  return '';
}
function emailWarning(result) {
  if (!result || ['sent', 'no-email', 'off'].includes(result)) return;
  setTimeout(() => toast(`No se pudo enviar el correo al cliente: ${result}`, true), 3300);
}

function payBadge(status, hasProof = false) {
  if (status === 'pendiente' && hasProof) return '<span class="badge pay-revision">Pago en revisión</span>';
  return `<span class="badge pay-${esc(status)}">${esc(PAYMENT_LABELS[status] || status)}</span>`;
}

// Enlace de WhatsApp; a los números bolivianos de 8 dígitos se les agrega el código 591.
function waLink(phone, message = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8) digits = '591' + digits;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

function readImageFile(file, maxMb = 4) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Elige una imagen'));
    if (file.size > maxMb * 1024 * 1024) return reject(new Error(`La imagen debe pesar menos de ${maxMb} MB`));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

let settingsCache = null;
async function getSettings() {
  if (!settingsCache) settingsCache = (await api('/api/settings')).settings;
  return settingsCache;
}

// Pedidos hechos desde este navegador (clientes sin cuenta).
const myOrders = {
  read() {
    try { return JSON.parse(localStorage.getItem('myOrders')) || []; } catch { return []; }
  },
  add(order) {
    const list = this.read().filter((o) => o.token !== order.token);
    list.unshift({ id: order.id, token: order.token });
    try { localStorage.setItem('myOrders', JSON.stringify(list.slice(0, 30))); } catch { /* sin almacenamiento */ }
  },
};

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
    const n = cart.count();
    html += link('#/carrito', 'Carrito', n ? ` <span class="badge count">${n}</span>` : '');
    if (myOrders.read().length) html += link('#/mis-pedidos', 'Mis pedidos');
  } else {
    const n = cart.count();
    html += link('#/carrito', 'Carrito', n ? ` <span class="badge count">${n}</span>` : '');
    html += link('#/admin', 'Administración');
    html += '<button class="link" data-action="logout">Salir</button>';
  }
  nav.innerHTML = html;
  renderTabbar(route);
}

// Barra de navegación inferior para celulares (estilo app).
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  panel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  out: '<path d="M15 4h4v16h-4M10 16l4-4-4-4M14 12H3"/>',
};
function renderTabbar(route) {
  const bar = $('#tabbar');
  const n = cart.count();
  const item = (href, icon, label, { badge: count = 0, action = '', match = [] } = {}) => {
    const active = route === href || match.some((m) => route.startsWith(m));
    const attrs = action ? `href="#" data-action="${action}"` : `href="${href}"`;
    return `<a ${attrs} class="tab-item ${active ? 'active' : ''}" ${icon === 'bag' ? 'data-cart-icon' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>
      ${count ? `<span class="tab-badge">${count}</span>` : ''}
      <span>${label}</span></a>`;
  };
  let html = item('#/', 'home', 'Inicio') + item('#/catalogo', 'grid', 'Catálogo');
  if (!state.user) {
    html += item('#/carrito', 'bag', 'Carrito', { badge: n });
    html += item('#/mis-pedidos', 'receipt', 'Pedidos', { match: ['#/pedido/'] });
  } else {
    html += item('#/carrito', 'bag', 'Carrito', { badge: n, match: ['#/pedido/'] });
    html += item('#/admin', 'panel', 'Admin');
    html += item('#/', 'out', 'Salir', { action: 'logout' });
  }
  bar.innerHTML = html;
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  $('#nav').classList.remove('open');
  toast('Sesión cerrada');
  location.hash = '#/';
  renderNav();
}

$('#tabbar').addEventListener('click', (e) => {
  const a = e.target.closest('[data-action="logout"]');
  if (!a) return;
  e.preventDefault();
  if (confirm('¿Cerrar sesión?')) logout();
});

$('#nav').addEventListener('click', async (e) => {
  if (e.target.closest('a')) $('#nav').classList.remove('open');
  if (e.target.dataset.action === 'logout') await logout();
});
$('#menuToggle').addEventListener('click', () => $('#nav').classList.toggle('open'));

const routes = {
  '#/': viewHome,
  '#/catalogo': viewCatalog,
  '#/carrito': viewShopCart,
  '#/mis-pedidos': viewMyOrders,
  '#/login': viewLogin,
  '#/admin': () => viewAdmin(state.tab.admin || 'resumen'),
};

async function router() {
  const route = location.hash.split('?')[0] || '#/';
  renderNav();
  window.scrollTo(0, 0);
  app.classList.remove('page-enter');
  void app.offsetWidth; // reinicia la animación de entrada
  app.classList.add('page-enter');
  // Modo "Próximamente": los visitantes ven la pantalla de lanzamiento (salvo para ingresar).
  const soon = settingsCache?.coming_soon === '1' && !state.user && route !== '#/login';
  document.body.classList.toggle('soon-mode', soon);
  if (soon) { viewComingSoon(); return; }
  const view = route.startsWith('#/pedido/') ? () => viewTrack(route.slice('#/pedido/'.length)) : routes[route] || viewHome;
  const done = showLoader(loaderTextFor(route));
  try {
    await view();
  } catch (err) {
    app.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  } finally {
    await done();
  }
}

window.addEventListener('hashchange', router);

/* =================================================================
   Vistas públicas
   ================================================================= */
async function viewHome() {
  const panelLink = state.user?.role === 'admin' ? '<a class="btn" href="#/admin">Ir a mi panel</a>' : '<a class="btn" href="#/mis-pedidos">Mis pedidos</a>';
  const mode = cardMode();
  const bf = bfActive();
  const marqueeItems = (bf
    ? ['Black Friday', '<span class="script">Tu fragancia, tu sello</span>', 'Perfumes originales', 'Descuentos especiales', 'Paga con QR', 'Santa Cruz']
    : ['Distinto SCZ', '<span class="script">Tu fragancia, tu sello</span>', 'Perfumes originales', 'Hombre', 'Mujer', 'Unisex', 'Santa Cruz'])
    .map((t) => (t.startsWith('<') ? t : `<span>${t}</span>`)).join('<span class="dot">◇</span>');
  const hero = bf ? `
    <section class="bf-hero">
      <div class="bf-glow" aria-hidden="true"></div>
      <div class="bf-hero-content">
        <div class="bf-kicker"><span class="bf-pill">Solo por tiempo limitado</span></div>
        <h1 class="bf-title"><span class="bf-word">BLACK</span><span class="bf-word outline">FRIDAY</span></h1>
        <div class="bf-sub">en <strong>Distinto SCZ</strong> · descuentos especiales en perfumes originales</div>
        ${countdownHTML(bfEnd(), `La oferta termina el ${fmtEnd(bfEnd())}`)}
        <div class="hero-actions">
          <a class="btn solid bf-cta" href="#/catalogo?ofertas">Ver ofertas</a>
          <a class="btn" href="#/catalogo">Todo el catálogo</a>
        </div>
      </div>
      <div class="bf-visual" aria-hidden="true">
        <div class="ring"></div><div class="ring dashed"></div><div class="ring pulse"></div><div class="ring pulse two"></div><div class="orbit"></div>
        <img src="/img/emblem.png" alt="">
        <div class="bf-stamp"><span>BLACK</span><span>FRIDAY</span></div>
      </div>
    </section>` : `
    <section class="hero brand-hero">
      <div class="hero-content">
        <div class="eyebrow">Perfumería · Santa Cruz</div>
        <h1 class="hero-name"><span class="word" style="animation-delay:.15s">DISTINTO</span> <span class="word" style="animation-delay:.35s">SCZ</span></h1>
        <div class="hero-tag"><span class="typed" id="typed"></span></div>
        <div class="hero-rule"></div>
        <p>Fragancias originales que hablan por ti. Elige tu perfume, haz tu pedido en línea y paga al instante con QR.</p>
        <div class="hero-actions">
          <a class="btn solid" href="#/catalogo">Comprar ahora</a>
          ${panelLink}
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="ring"></div>
        <div class="ring dashed"></div>
        <div class="ring pulse"></div>
        <div class="ring pulse two"></div>
        <div class="orbit"></div>
        <img src="/img/emblem.png" alt="">
      </div>
    </section>`;
  app.innerHTML = `
    ${hero}
    <div class="marquee ${bf ? 'bf-marquee' : ''}" aria-hidden="true"><div class="marquee-track">${marqueeItems}<span class="dot">◇</span>${marqueeItems}<span class="dot">◇</span></div></div>
    <section class="section bf-deals" id="deals" hidden>
      <div class="section-head">
        <div><div class="eyebrow bf-eyebrow">Black Friday</div><h2>Ofertas imperdibles</h2></div>
        <a class="btn sm" href="#/catalogo?ofertas">Ver todas</a>
      </div>
      <div id="dealsGrid"></div>
    </section>
    <section class="section bestsellers" id="bestsellers" hidden>
      <div class="section-head">
        <div><div class="eyebrow">Top ventas</div><h2>Los más vendidos</h2></div>
        <a class="btn sm" href="#/catalogo">Ver catálogo</a>
      </div>
      <div id="bestGrid"></div>
    </section>
    <div class="features">
      <div class="feature"><div class="num">01</div><h3>Elige</h3><p class="muted small">Explora el catálogo y agrega tus perfumes favoritos al carrito.</p></div>
      <div class="feature"><div class="num">02</div><h3>Pide</h3><p class="muted small">Deja tu nombre y celular. No necesitas crear una cuenta.</p></div>
      <div class="feature"><div class="num">03</div><h3>Paga con QR</h3><p class="muted small">Escanea nuestro QR, sube tu comprobante y sigue el estado de tu pedido en línea.</p></div>
    </div>
    <section class="section">
      <div class="section-head"><h2>Destacados</h2><a class="btn sm" href="#/catalogo">Ver todo</a></div>
      <div id="featured"></div>
    </section>`;
  if (bf) startCountdown();
  else typeWriter($('#typed'), 'Tu fragancia, tu sello');
  const { perfumes } = await api('/api/catalog');
  const deals = perfumes.filter((p) => p.discount_pct > 0 && !p.sold_out).sort((a, b) => b.discount_pct - a.discount_pct);
  if (deals.length) {
    $('#deals').hidden = false;
    $('#dealsGrid').innerHTML = `<div class="grid best-grid">${deals.slice(0, 8).map((p) => productCard(p, { mode })).join('')}</div>`;
  }
  const best = perfumes.filter((p) => p.bestseller);
  if (best.length) {
    $('#bestsellers').hidden = false;
    $('#bestGrid').innerHTML = `<div class="grid best-grid">${best.map((p) => productCard(p, { mode })).join('')}</div>`;
  }
  $('#featured').innerHTML = perfumes.length
    ? `<div class="grid carousel">${perfumes.slice(0, 8).map((p) => productCard(p, { mode })).join('')}</div>`
    : '<div class="empty">Pronto publicaremos nuestro catálogo.</div>';
}

// 20 -> "20", 12.5 -> "12,5"
const fmtPct = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
// Porcentaje entero que representa un descuento en Bs (mínimo 1%).
const pctOff = (off, price) => (off > 0 && price > 0 ? Math.max(1, Math.round((off / price) * 100)) : 0);

// Etiqueta y precio con descuento de una tarjeta de perfume.
function discountBadge(p) {
  if (!(p.discount_pct > 0)) return '';
  // Solo dice "Oferta": el porcentaje no se muestra al cliente.
  return '<span class="bf-badge single"><i>OFERTA</i></span>';
}
function priceHtml(p) {
  if (p.discount_pct > 0 && p.list_price > p.price) {
    return `<div class="product-price has-deal"><s class="old-price">${money(p.list_price)}</s><span class="deal-price">${money(p.price)}</span></div>`;
  }
  return `<div class="product-price">${money(p.price)}</div>`;
}

function typeWriter(el, textValue, delay = 900) {
  if (!el) return;
  if (reducedMotion) { el.textContent = textValue; return; }
  let i = 0;
  const tick = () => {
    if (!el.isConnected) return;
    el.textContent = textValue.slice(0, ++i);
    if (i < textValue.length) setTimeout(tick, 70);
  };
  setTimeout(tick, delay);
}

// Todos ven la tienda como cliente (el administrador también, para probarla y hacer pedidos de prueba).
function cardMode() {
  return 'shop';
}

function productCard(p, { mode = 'view' } = {}) {
  const soldOut = Boolean(p.sold_out);
  const addBlock = (label) => soldOut
    ? '<div class="product-actions"><button class="btn sm" disabled>Agotado</button></div>'
    : `
          <div class="product-actions">
            <div class="qty">
              <button type="button" data-qty="-1" aria-label="Menos">−</button>
              <input type="number" min="1" max="999" value="1" aria-label="Cantidad">
              <button type="button" data-qty="1" aria-label="Más">+</button>
            </div>
            <button class="btn sm solid" data-add="${p.id}">${label}</button>
          </div>`;
  return `
    <article class="product ${soldOut ? 'sold-out' : ''} ${p.discount_pct > 0 ? 'on-sale' : ''}" data-id="${p.id}">
      <div class="product-img">${productImage(p)}${soldOut ? '<span class="stock-badge out">Agotado</span>' : ''}${p.bestseller ? `<span class="best-badge">★ Más vendido</span>` : ''}${discountBadge(p)}</div>
      <div class="product-body">
        <div class="product-brand">${esc(p.brand || 'Perfume')}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-meta">${[p.category, p.size_ml ? `${p.size_ml} ml` : ''].filter(Boolean).map(esc).join(' · ')}</div>
        ${p.description ? `<div class="product-desc">${esc(p.description)}</div>` : ''}
        ${mode === 'vendor' ? `
          <div class="product-prices">
            <div><div class="lbl">Precio sugerido</div><div class="val">${money(p.suggested_price)}</div></div>
            <div><div class="lbl">Tu comisión</div><div class="val gold">${money(p.commission)}</div></div>
          </div>
          ${addBlock('Agregar')}`
        : `${priceHtml(p)}${mode === 'shop' ? addBlock('Al carrito') : ''}`}
      </div>
    </article>`;
}

// Botones de cantidad y "agregar al carrito" de cualquier tarjeta de perfume.
app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-qty], [data-add]');
  const card = btn && btn.closest('.product');
  if (!card) return;
  const input = $('.qty input', card);
  if (btn.dataset.qty) {
    input.value = Math.max(1, Math.min(999, (Number(input.value) || 1) + Number(btn.dataset.qty)));
    return;
  }
  const qty = Math.max(1, Math.min(999, Math.floor(Number(input.value)) || 1));
  const id = btn.dataset.add;
  // Se consulta al servidor si alcanza el stock (el número exacto solo lo ve el administrador).
  btn.disabled = true;
  hasStock(id, (cart.read()[id] || 0) + qty).then((ok) => {
    btn.disabled = false;
    if (!ok) return;
    addToCart(btn, card, input, id, qty);
  });
});

function addToCart(btn, card, input, id, qty) {
  cart.add(id, qty);
  // Pequeña animación en el ícono del carrito y en el botón.
  for (const el of [$('[data-cart-icon]'), btn]) {
    if (!el) continue;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  input.value = 1;
  const tab = state.user?.role === 'vendor' && $$('.tab')[1];
  if (tab) tab.textContent = `Carrito (${cart.count()})`;
  toast(`Agregado al carrito (${qty})`);
}

async function hasStock(id, quantity) {
  try {
    const { ok, message } = await api('/api/catalog/check', { method: 'POST', body: { perfume_id: Number(id), quantity } });
    if (!ok) toast(message, true);
    return ok;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

const brandOf = (p) => (p.brand || '').trim() || 'Otras marcas';

// Buscador + filtros por categoría y por marca.
function catalogFilters(perfumes, onChange) {
  const hasDeals = perfumes.some((p) => p.discount_pct > 0);
  const startDeals = hasDeals && location.hash.includes('ofertas');
  const categories = [...new Set(perfumes.map((p) => p.category).filter(Boolean))];
  const counts = {};
  perfumes.forEach((p) => { counts[brandOf(p)] = (counts[brandOf(p)] || 0) + 1; });
  const brands = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'es'));
  const html = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar por nombre o marca…">
      <div class="chips" data-group="cat">
        <button class="chip ${startDeals ? '' : 'active'}" data-val="">Todos</button>
        ${hasDeals ? `<button class="chip chip-deal ${startDeals ? 'active' : ''}" data-val="__ofertas">${bfActive() ? '🔥 Black Friday' : '🔥 Ofertas'}</button>` : ''}
        ${categories.map((c) => `<button class="chip" data-val="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </div>
    ${brands.length > 1 ? `
      <div class="brand-bar">
        <span class="brand-bar-label">Marcas</span>
        <div class="chips" data-group="brand">
          <button class="chip active" data-val="">Todas</button>
          ${brands.map((b) => `<button class="chip" data-val="${esc(b)}">${esc(b)} <span class="chip-count">${counts[b]}</span></button>`).join('')}
        </div>
      </div>` : ''}`;
  const bind = (root) => {
    const sel = { cat: startDeals ? '__ofertas' : '', brand: '' };
    const apply = () => {
      const q = $('#q', root).value.trim().toLowerCase();
      const list = perfumes.filter((p) =>
        (!sel.cat || (sel.cat === '__ofertas' ? p.discount_pct > 0 : p.category === sel.cat)) &&
        (!sel.brand || brandOf(p) === sel.brand) &&
        (!q || `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(q)));
      // Sin marca elegida ni búsqueda: el catálogo se muestra separado por marca.
      onChange(list, { grouped: !sel.brand && !q && sel.cat !== '__ofertas' && brands.length > 1 });
    };
    $('#q', root).addEventListener('input', apply);
    $$('[data-group]', root).forEach((group) => {
      $$('.chip', group).forEach((chip) => chip.addEventListener('click', () => {
        $$('.chip', group).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        sel[group.dataset.group] = chip.dataset.val;
        apply();
      }));
    });
    apply();
  };
  return { html, bind };
}

// Cuadrícula de perfumes; agrupada por marca cuando corresponde.
function productGrid(list, mode, { grouped } = {}) {
  if (!list.length) return '<div class="empty">No hay perfumes que coincidan con la búsqueda.</div>';
  if (!grouped) return `<div class="grid">${list.map((p) => productCard(p, { mode })).join('')}</div>`;
  const byBrand = {};
  list.forEach((p) => (byBrand[brandOf(p)] ||= []).push(p));
  return Object.keys(byBrand).sort((a, b) => a.localeCompare(b, 'es')).map((b) => `
    <section class="brand-section">
      <div class="brand-head"><h3>${esc(b)}</h3><span class="muted small">${byBrand[b].length} ${byBrand[b].length === 1 ? 'perfume' : 'perfumes'}</span></div>
      <div class="grid">${byBrand[b].map((p) => productCard(p, { mode })).join('')}</div>
    </section>`).join('');
}

async function viewCatalog() {
  app.innerHTML = `${bfStrip('Descuentos especiales en perfumes originales · toca <u>Black Friday</u> para ver solo las ofertas')}<div class="section-head"><div><div class="eyebrow">Colección</div><h2>Catálogo</h2></div></div><div id="catalog"></div>`;
  const { perfumes } = await api('/api/catalog');
  const root = $('#catalog');
  if (!perfumes.length) {
    root.innerHTML = '<div class="empty">Aún no hay perfumes en el catálogo.</div>';
    return;
  }
  const draw = (list, opts) => { $('#catalogGrid').innerHTML = productGrid(list, mode, opts); };
  const mode = cardMode();
  const filters = catalogFilters(perfumes, draw);
  root.innerHTML = `${filters.html}<div id="catalogGrid"></div>
    ${mode === 'shop' ? '<div class="center" style="margin-top:2rem"><a class="btn solid" href="#/carrito">Ir al carrito</a></div>'
      : ''}`;
  filters.bind(root);
}

/* ---- Ciudades y forma de entrega ---- */
const CITIES = ['Santa Cruz de la Sierra', 'Montero', 'Warnes', 'La Paz', 'El Alto', 'Cochabamba', 'Sucre', 'Oruro', 'Potosí', 'Tarija', 'Trinidad', 'Cobija'];
const OTHER = 'Otra';

// Lista de ciudades con la opción "Otra" (que muestra un campo para escribirla).
function citySelect(id, name, { exclude = [], required = true } = {}) {
  const opts = CITIES.filter((c) => !exclude.includes(c)).map((c) => `<option>${esc(c)}</option>`).join('');
  return `
    <select id="${id}" data-city-select ${required ? 'required' : ''}>
      <option value="">Elige una ciudad…</option>${opts}<option value="${OTHER}">Otra ciudad…</option>
    </select>
    <input type="hidden" name="${name}">
    <input class="city-other" data-city-other placeholder="Escribe tu ciudad" maxlength="80" hidden>`;
}

function deliveryFields(who) {
  const opt = (value, title, sub) => `
    <label class="delivery-opt"><input type="radio" name="delivery_method" value="${value}" required>
      <span><strong>${title}</strong><small>${sub}</small></span></label>`;
  return `
    <h3 style="margin-top:0.6rem">Entrega</h3>
    <div class="delivery-opts">
      ${opt('recojo', 'Recojo en tienda', 'Sin costo · Santa Cruz')}
      ${opt('domicilio', 'Envío a domicilio', 'Dentro de Santa Cruz')}
      ${opt('envio', 'Envío a otra ciudad', 'Por flota o encomienda')}
    </div>
    <div class="delivery-extra" data-for="domicilio" hidden>
      <div class="field"><label for="d-addr">Dirección de entrega *</label><input id="d-addr" name="client_address" maxlength="250" autocomplete="street-address" placeholder="Barrio, calle, número, referencia"></div>
      <p class="small muted" style="margin:0">El costo del envío se coordina por WhatsApp.</p>
    </div>
    <div class="delivery-extra" data-for="envio" hidden>
      <div class="field"><label for="d-city">Ciudad de destino *</label>${citySelect('d-city', 'delivery_city', { exclude: ['Santa Cruz de la Sierra', 'Montero', 'Warnes'] })}</div>
      <div class="field"><label for="d-rname">Nombre completo de quien recibe *</label><input id="d-rname" name="recipient_name" maxlength="120"></div>
      <div class="form-grid">
        <div class="field"><label for="d-rci">CI de quien recibe *</label><input id="d-rci" name="recipient_ci" maxlength="30" inputmode="numeric"></div>
        <div class="field"><label for="d-rphone">Celular de quien recibe *</label><input id="d-rphone" name="recipient_phone" type="tel" maxlength="40"></div>
      </div>
      <div class="field"><label for="d-addr2">Dirección o agencia de destino *</label><input id="d-addr2" name="client_address" maxlength="250" placeholder="Ej: Terminal de buses, agencia de encomiendas o dirección"></div>
      <p class="small muted" style="margin:0">El costo del envío ${who === 'vendor' ? 'lo paga el cliente y ' : ''}se coordina por WhatsApp.</p>
    </div>`;
}

// Muestra solo los campos de la opción de entrega elegida (y desactiva los demás para que no se envíen).
function syncDelivery(form) {
  const method = form.querySelector('[name="delivery_method"]:checked')?.value;
  form.querySelectorAll('.delivery-extra').forEach((box) => {
    const on = box.dataset.for === method;
    box.hidden = !on;
    box.querySelectorAll('input, select').forEach((el) => {
      el.disabled = !on;
      if (el.matches('[data-city-other], [type="hidden"], [type="radio"]')) return;
      el.required = on && !/opcional/i.test(el.previousElementSibling?.textContent || '');
    });
  });
  syncCities(form);
}

function syncCities(form) {
  form.querySelectorAll('[data-city-select]').forEach((sel) => {
    const other = sel.parentElement.querySelector('[data-city-other]');
    const hidden = sel.parentElement.querySelector('input[type="hidden"]');
    const isOther = sel.value === OTHER;
    other.hidden = !isOther;
    other.required = isOther && !sel.disabled;
    other.disabled = sel.disabled;
    hidden.disabled = sel.disabled;
    hidden.value = isOther ? other.value.trim() : sel.value;
  });
}

document.addEventListener('change', (e) => {
  const form = e.target.closest('form');
  if (!form) return;
  if (e.target.name === 'delivery_method') syncDelivery(form);
  else if (e.target.matches('[data-city-select]')) { syncCities(form); if (e.target.value === OTHER) e.target.parentElement.querySelector('[data-city-other]').focus(); }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-city-other]')) syncCities(e.target.closest('form'));
});

// Texto corto de la entrega para mostrar en los pedidos.
function deliveryHtml(o) {
  if (o.delivery_method === 'recojo') return '<div class="delivery-line"><span class="muted">Entrega:</span> <strong>Recojo en tienda</strong></div>';
  if (o.delivery_method === 'domicilio') return `<div class="delivery-line"><span class="muted">Entrega:</span> <strong>Envío a domicilio</strong> · ${esc(o.client_address || '')}</div>`;
  if (o.delivery_method === 'envio') {
    return `<div class="delivery-line"><span class="muted">Entrega:</span> <strong>Envío a ${esc(o.delivery_city)}</strong> · ${esc(o.client_address || '')}
      <div class="small muted">Recibe: ${esc(o.recipient_name)} · CI ${esc(o.recipient_ci)} · Cel. ${esc(o.recipient_phone)}</div></div>`;
  }
  return '';
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

function requireRole(role) {
  if (!state.user) { location.hash = '#/login'; return false; }
  if (role === 'admin' && state.user.role !== 'admin') { location.hash = '#/'; return false; }
  return true;
}



// Carrito de la tienda.
function renderCart(body, { perfumes, price, commission, formHtml, emptyHref, onSubmit }) {
  const byId = Object.fromEntries(perfumes.map((p) => [String(p.id), p]));
  const draw = () => {
    // Conserva lo que ya se escribió en el formulario al cambiar cantidades.
    const prev = $('#orderForm', body);
    const saved = prev ? $$('input, select, textarea', prev).map((el) => (el.type === 'radio' ? el.checked : el.value)) : null;
    const items = cart.read();
    // Quitar del carrito los perfumes que ya no están activos.
    const stale = Object.keys(items).filter((id) => !byId[id]);
    if (stale.length) { stale.forEach((id) => delete items[id]); cart.write(items); }
    const lines = Object.entries(items).map(([id, qty]) => ({ p: byId[id], qty }));
    const total = lines.reduce((sum, l) => sum + price(l.p) * l.qty, 0);
    const savings = lines.reduce((sum, l) => sum + (l.p.list_price > price(l.p) ? (l.p.list_price - price(l.p)) * l.qty : 0), 0);
    const totalCommission = commission ? lines.reduce((sum, l) => sum + commission(l.p) * l.qty, 0) : 0;
    const tab = state.user?.role === 'vendor' && $$('.tab')[1];
    if (tab) tab.textContent = `Carrito${cart.count() ? ` (${cart.count()})` : ''}`;

    if (!lines.length) {
      body.innerHTML = `<div class="empty">Tu carrito está vacío.<br><br><a class="btn sm" href="${emptyHref}">Ver el catálogo</a></div>`;
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
                <div class="small muted">${money(price(p))} c/u${p.discount_pct > 0 && p.list_price > price(p) ? ` <s>${money(p.list_price)}</s> <span class="bf-mini">Oferta</span>` : ''}${commission ? ` · comisión ${money(commission(p))} c/u` : ''}</div>
              </div>
              <div class="qty">
                <button type="button" data-step="-1" aria-label="Menos">−</button>
                <input type="number" min="1" max="999" value="${qty}" aria-label="Cantidad">
                <button type="button" data-step="1" aria-label="Más">+</button>
              </div>
              <button class="btn sm ghost danger" data-remove aria-label="Quitar">×</button>
            </div>`).join('')}
          <div style="margin-top:1rem">
            ${commission ? `<div class="cart-total"><span class="muted">Comisión total</span><span style="color:var(--gold)">${money(totalCommission)}</span></div>` : ''}
            ${savings > 0 ? `<div class="cart-total bf-savings"><span>${bfActive() ? 'Ahorras con Black Friday' : 'Ahorras'}</span><span>−${money(savings)}</span></div>` : ''}
            <div class="cart-total big"><span>Total</span><span>${money(total)}</span></div>
          </div>
        </div>
        <form class="card form" id="orderForm">
          ${formHtml}
          <button class="btn ghost" type="button" id="clearCart">Vaciar carrito</button>
        </form>
      </div>`;

    const form = $('#orderForm', body);
    if (saved) $$('input, select, textarea', form).forEach((el, i) => { if (el.type === 'radio') el.checked = saved[i]; else if (saved[i] !== undefined) el.value = saved[i]; });
    syncDelivery(form);

    // Al subir la cantidad se confirma que haya existencias.
    const setQty = async (id, next) => {
      if (next > (cart.read()[id] || 0) && !(await hasStock(id, next))) { draw(); return; }
      cart.set(id, next);
      draw();
    };
    $$('.cart-line', body).forEach((line) => {
      const id = line.dataset.id;
      const input = $('input', line);
      $$('[data-step]', line).forEach((b) => b.addEventListener('click', () => {
        const next = Math.max(1, Math.min(999, (Number(input.value) || 1) + Number(b.dataset.step)));
        setQty(id, next);
      }));
      input.addEventListener('change', () => setQty(id, Math.max(1, Math.min(999, Math.floor(Number(input.value)) || 1))));
      $('[data-remove]', line).addEventListener('click', () => { cart.set(id, 0); draw(); });
    });
    $('#clearCart').addEventListener('click', () => {
      if (confirm('¿Vaciar el carrito?')) { cart.clear(); draw(); }
    });
    $('#orderForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {
        ...formData(e.target),
        items: lines.map(({ p, qty }) => ({ perfume_id: p.id, quantity: qty })),
      };
      withBusy(e.submitter, () => onSubmit(payload));
    });
  };
  draw();
}


/* =================================================================
   Tienda: carrito del cliente, pago con QR y seguimiento
   ================================================================= */
async function viewShopCart() {
  if (state.user?.role === 'vendor') { location.hash = '#/panel/carrito'; return; }
  app.innerHTML = `${bfStrip('Tus descuentos ya están aplicados en el carrito')}<div class="section-head"><div><div class="eyebrow">Tu compra</div><h2>Carrito</h2></div></div><div id="cartBody"></div>`;
  const { perfumes } = await api('/api/catalog');
  renderCart($('#cartBody'), {
    perfumes,
    price: (p) => p.price,
    emptyHref: '#/catalogo',
    formHtml: `
      <h3>Tus datos</h3>
      <div class="field"><label for="c-name">Nombre completo *</label><input id="c-name" name="client_name" required maxlength="120" autocomplete="name"></div>
      <div class="field"><label for="c-phone">Celular / WhatsApp *</label><input id="c-phone" name="client_phone" type="tel" required autocomplete="tel" placeholder="Ej: 70012345"></div>
      <div class="field"><label for="c-email">Correo electrónico (opcional)</label><input id="c-email" name="client_email" type="email" autocomplete="email" inputmode="email" placeholder="tucorreo@gmail.com">
        <span class="small muted">Te enviaremos el estado de tu pedido cada vez que cambie.</span></div>
      ${deliveryFields('client')}
      <div class="field"><label for="c-notes">Notas</label><textarea id="c-notes" name="notes" placeholder="Ej: horario de entrega, referencia…"></textarea></div>
      <p class="small muted" style="margin:0">Al realizar el pedido te mostraremos nuestro <strong style="color:var(--fg)">QR de pago</strong>.</p>
      <button class="btn solid" type="submit">Realizar pedido</button>`,
    onSubmit: async (payload) => {
      const { order } = await api('/api/public/orders', { method: 'POST', body: payload });
      myOrders.add(order);
      cart.clear();
      location.hash = `#/pedido/${order.token}`;
    },
  });
}

async function viewTrack(token) {
  const [{ order }, settings] = await Promise.all([api(`/api/public/orders/${encodeURIComponent(token)}`), getSettings()]);
  const pending = order.payment_status !== 'pagado' && order.status !== 'cancelado';
  const qr = settings.payment_qr;
  const waMsg = `Hola Distinto SCZ, hice el pedido #${order.id} por ${money(order.total)}. Les envío mi comprobante de pago.`;
  const wa = settings.whatsapp ? waLink(settings.whatsapp, waMsg) : '';

  let payCard;
  if (order.status === 'cancelado') {
    payCard = '<div class="card pay-card center"><h3>Pedido cancelado</h3><p class="muted">Si tienes dudas, escríbenos.</p></div>';
  } else if (!pending) {
    payCard = '<div class="card pay-card center paid"><div class="paid-check">✓</div><h3>Pago confirmado</h3><p class="muted">¡Gracias! Estamos preparando tu pedido.</p></div>';
  } else if (order.has_proof) {
    // Ya pagó y subió el comprobante: no se muestra más el QR.
    payCard = `
      <div class="card pay-card center review">
        <div class="paid-check review-check">✓</div>
        <h3>Comprobante recibido</h3>
        <p class="muted" style="margin:0">Estamos verificando tu pago de <strong style="color:var(--fg)">${money(order.total)}</strong>.
          Te avisaremos cuando esté confirmado; puedes ver el estado aquí mismo.</p>
        <label class="link-btn" for="proofFile">¿Te equivocaste de imagen? Subir otro comprobante</label>
        <input type="file" id="proofFile" accept="image/png,image/jpeg,image/webp" hidden>
      </div>`;
  } else {
    payCard = `
      <div class="card pay-card">
        <div class="eyebrow">Paga con QR</div>
        <div class="pay-amount"><span class="muted small">Total a pagar</span><strong>${money(order.total)}</strong></div>
        <img class="qr-img" src="${esc(qr)}" alt="QR de pago de Distinto SCZ">
        <ol class="pay-steps">
          <li>Abre <strong>Yape</strong> o la app de tu banco.</li>
          <li>Escanea el QR. Si estás en el celular, <strong>descárgalo</strong> y súbelo desde tu galería.</li>
          <li>Paga <strong>${money(order.total)}</strong> y en el concepto escribe <strong>Pedido #${order.id}</strong>.</li>
          <li>Sube aquí la captura de tu comprobante.</li>
        </ol>
        <div class="btn-row">
          <a class="btn" href="${esc(qr)}" download="QR-Distinto-SCZ">Descargar QR</a>
          <label class="btn solid" for="proofFile">Subir comprobante</label>
          <input type="file" id="proofFile" accept="image/png,image/jpeg,image/webp" hidden>
          ${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}
        </div>
        ${order.has_proof ? '<p class="ok-note">✓ Recibimos tu comprobante. Lo revisaremos y confirmaremos tu pago.</p>' : ''}
      </div>`;
  }

  app.innerHTML = `
    ${bfStrip('Gracias por comprar en Black Friday · mira más ofertas')}
    <div class="section-head">
      <div>
        <div class="eyebrow">Pedido #${order.id} · ${fmtDate(order.created_at)}</div>
        <h2>${pending ? `¡Gracias, ${esc(order.client_name.split(' ')[0])}!` : `Pedido #${order.id}`}</h2>
        ${pending ? `<p class="muted" style="margin:0">${order.has_proof
          ? 'Recibimos tu pedido y tu comprobante. Estamos verificando el pago.'
          : 'Recibimos tu pedido. Solo falta el pago para empezar a prepararlo.'}</p>` : ''}
      </div>
      <div class="btn-row">${badge(order.status)} ${payBadge(order.payment_status, order.has_proof)}</div>
    </div>
    <div class="pay-layout">
      ${payCard}
      <div class="card">
        <h3>Estado del pedido</h3>
        ${progressBar(order.status)}
        <ul class="order-items" style="margin-top:1.2rem">
          ${order.items.map((it) => `<li><span>${it.quantity} × ${esc(it.perfume_name)}</span><span>${money(it.unit_price * it.quantity)}</span></li>`).join('')}
        </ul>
        <div class="cart-total big"><span>Total</span><span>${money(order.total)}</span></div>
        <p class="small muted">${[order.client_name, order.client_phone, order.client_email].filter(Boolean).map(esc).join(' · ')}</p>
        ${order.delivery_method ? deliveryHtml(order) : order.client_address ? `<p class="small muted">${esc(order.client_address)}</p>` : ''}
        ${order.admin_note ? `<p class="small"><span class="muted">Mensaje de la tienda:</span> ${esc(order.admin_note)}</p>` : ''}
        <h3 style="margin-top:1.5rem">Historial</h3>
        <ul class="timeline">
          ${order.history.map((h) => `<li>${badge(h.status)} <span class="muted">${fmtDate(h.created_at)}</span>${h.note ? `<div>${esc(h.note)}</div>` : ''}</li>`).join('')}
        </ul>
        <div class="track-link">
          <span class="small muted">Guarda este enlace para ver tu pedido cuando quieras:</span>
          <button class="btn sm" id="copyLink">Copiar enlace</button>
        </div>
      </div>
    </div>`;

  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Enlace copiado'); } catch { prompt('Copia este enlace:', location.href); }
  });
  const proof = $('#proofFile');
  if (proof) proof.addEventListener('change', () => withBusy(null, async () => {
    const data = await readImageFile(proof.files[0], 5);
    await api(`/api/public/orders/${encodeURIComponent(token)}/proof`, { method: 'POST', body: { data } });
    toast('Comprobante enviado. ¡Gracias!');
    viewTrack(token);
  }));
}

async function viewMyOrders() {
  app.innerHTML = `${bfStrip('¿Te falta algo? Aprovecha las ofertas antes de que terminen')}<div class="section-head"><div><div class="eyebrow">Tus compras</div><h2>Mis pedidos</h2></div></div><div id="myOrders"></div>`;
  const saved = myOrders.read();
  const results = await Promise.all(saved.map((o) => api(`/api/public/orders/${o.token}`).then((r) => r.order).catch(() => null)));
  const orders = results.filter(Boolean);
  $('#myOrders').innerHTML = orders.length
    ? `<div class="orders">${orders.map((o) => `
        <a class="order" href="#/pedido/${esc(o.token)}" style="display:block">
          <div class="order-head">
            <div><div class="title">Pedido #${o.id}</div><div class="small muted">${fmtDate(o.created_at)} · ${o.items.reduce((n, it) => n + it.quantity, 0)} producto(s)</div></div>
            <div class="btn-row">${badge(o.status)} ${payBadge(o.payment_status, o.has_proof)}</div>
          </div>
          <div class="order-foot"><span class="small muted">Total <strong style="color:var(--fg)">${money(o.total)}</strong></span><span class="btn sm">Ver pedido</span></div>
        </a>`).join('')}</div>`
    : '<div class="empty">Aún no hiciste pedidos desde este dispositivo.<br><br><a class="btn sm" href="#/catalogo">Ver el catálogo</a></div>';
}

function progressBar(status) {
  if (status === 'cancelado') return '';
  const idx = PROGRESS_STEPS.indexOf(status);
  return `<div class="progress">${PROGRESS_STEPS.map((s, i) =>
    `<div class="step ${i <= idx ? 'done' : ''}">${STATUS_LABELS[s]}</div>`).join('')}</div>`;
}

// Ventana que pide la contraseña del administrador antes de una acción delicada.
function confirmWithPassword({ title, message, button, action, extraHtml = '', collect = () => ({}) }) {
  const root = openModal(`
    <div class="eyebrow">Confirmar con tu contraseña</div>
    <h3>${esc(title)}</h3>
    ${message ? `<p class="muted small">${esc(message)}</p>` : ''}
    <form class="form" id="pwConfirm">
      ${extraHtml}
      <div class="field"><label for="pc-pass">Contraseña de administrador</label><input id="pc-pass" type="password" required autocomplete="current-password"></div>
      <div class="btn-row">
        <button class="btn solid danger-solid" type="submit">${esc(button)}</button>
        <button class="btn ghost" type="button" id="pcCancel">Cancelar</button>
      </div>
    </form>`);
  $('#pcCancel', root).addEventListener('click', closeModal);
  const form = $('#pwConfirm', root);
  setTimeout(() => (form.querySelector('[data-first]') || $('#pc-pass', root)).focus(), 50);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const extra = collect(form);
    if (extra === null) return;
    withBusy(e.submitter, async () => {
      await action($('#pc-pass', root).value, extra);
      closeModal();
    });
  });
}

// Devolución: el administrador elige cuántas unidades le devolvieron de cada perfume.
function returnModal({ title, lines, action }) {
  confirmWithPassword({
    title,
    message: 'Escribe SOLO lo que te devolvieron. Lo demás se queda como vendido. Las unidades devueltas vuelven a tu stock.',
    button: 'Confirmar devolución',
    extraHtml: `
      <div class="return-lines">
        ${lines.map((l, i) => `
          <div class="return-line">
            <div><strong>${esc(l.name)}</strong><div class="small muted">Vendidos: ${l.qty} · ${money(l.price)} c/u</div>
              <div class="small" data-keep="${i}"></div></div>
            <label class="return-qty"><span class="small muted">Devueltos</span>
              <span class="return-stepper">
                <button type="button" data-ret-step="-1" data-i="${i}" aria-label="Menos">−</button>
                <input type="number" min="0" max="${l.qty}" step="1" value="0" data-ret="${i}" aria-label="Unidades devueltas" ${i === 0 ? 'data-first' : ''}>
                <button type="button" data-ret-step="1" data-i="${i}" aria-label="Más">+</button>
              </span></label>
          </div>`).join('')}
      </div>
      <div class="return-total small">Se devuelve: <strong data-ret-total></strong><div class="muted" data-ret-keep></div></div>
      <div class="field"><label for="rt-note">Motivo (opcional)</label><input id="rt-note" maxlength="200" placeholder="Ej: no le gustó, venía dañado…"></div>`,
    collect: (form) => {
      const items = lines.map((l, i) => ({ id: l.id, quantity: Math.floor(Number($(`[data-ret="${i}"]`, form).value)) || 0 }))
        .filter((it) => it.quantity > 0);
      if (!items.length) { toast('Pon al menos 1 unidad devuelta', true); return null; }
      if (items.some((it) => it.quantity > lines.find((l) => l.id === it.id).qty)) { toast('No puedes devolver más de lo vendido', true); return null; }
      return { items, note: $('#rt-note', form).value };
    },
    action: (password, { items, note }) => action(items, password, note),
  });
  const form = $('#pwConfirm');
  const qtyOf = (i, l) => Math.min(l.qty, Math.max(0, Math.floor(Number($(`[data-ret="${i}"]`, form).value)) || 0));
  const sum = () => {
    let back = 0;
    let kept = 0;
    lines.forEach((l, i) => {
      const r = qtyOf(i, l);
      back += r * l.price;
      kept += (l.qty - r) * l.price;
      const el = $(`[data-keep="${i}"]`, form);
      el.textContent = r ? `Se queda vendido: ${l.qty - r}` : '';
      el.classList.toggle('return-on', r > 0);
    });
    $('[data-ret-total]', form).textContent = money(back);
    $('[data-ret-keep]', form).textContent = `La venta queda en ${money(kept)}`;
  };
  $$('[data-ret]', form).forEach((i) => i.addEventListener('input', sum));
  $$('[data-ret-step]', form).forEach((b) => b.addEventListener('click', () => {
    const input = $(`[data-ret="${b.dataset.i}"]`, form);
    const line = lines[Number(b.dataset.i)];
    input.value = Math.min(line.qty, Math.max(0, (Number(input.value) || 0) + Number(b.dataset.retStep)));
    sum();
  }));
  sum();
}

function orderCard(o, { admin = false, statuses = [] } = {}) {
  const direct = o.source === 'cliente';
  const who = direct
    ? '<span class="badge source">Cliente directo</span>'
    : admin ? `Vendedor: <strong style="color:var(--fg)">${esc(o.vendor_name || '—')}</strong>` : '';
  const phone = admin && o.client_phone
    ? `<a href="${esc(waLink(o.client_phone, `Hola ${o.client_name}, te escribimos de Distinto SCZ por tu pedido #${o.id}.`))}" target="_blank" rel="noopener" style="text-decoration:underline">${esc(o.client_phone)}</a>`
    : esc(o.client_phone || '');
  return `
    <article class="order" data-id="${o.id}">
      <div class="order-head">
        <div>
          <div class="title">${admin ? `<input type="checkbox" class="order-pick" data-pick="${o.id}" aria-label="Seleccionar pedido #${o.id}">` : ''}Pedido #${o.id} · ${esc(o.client_name)}</div>
          <div class="small muted">${fmtDate(o.created_at)}${who ? ` · ${who}` : ''}</div>
        </div>
        <div class="btn-row">${badge(o.status)} ${admin || direct ? payBadge(o.payment_status, Boolean(o.payment_proof)) : ''}</div>
      </div>
      <div class="order-body">
        ${progressBar(o.status)}
        <ul class="order-items">
          ${o.items.map((it) => `<li><span>${it.quantity} × ${esc(it.perfume_name)}</span><span>${money(it.unit_price * it.quantity)}</span></li>`).join('')}
        </ul>
        ${phone || o.client_email ? `<div class="small muted">${[phone, admin && o.client_email ? `<a href="mailto:${esc(o.client_email)}" style="text-decoration:underline">${esc(o.client_email)}</a>` : ''].filter(Boolean).join(' · ')}</div>` : ''}
        ${o.delivery_method ? deliveryHtml(o) : o.client_address ? `<div class="small muted">${esc(o.client_address)}</div>` : ''}
        ${o.notes ? `<div class="small"><span class="muted">Notas:</span> ${esc(o.notes)}</div>` : ''}
        ${o.admin_note ? `<div class="small"><span class="muted">Nota del administrador:</span> ${esc(o.admin_note)}</div>` : ''}
        ${admin && o.payment_proof ? `<div class="small"><a href="${esc(o.payment_proof)}" target="_blank" rel="noopener" class="btn sm">Ver comprobante de pago</a></div>` : ''}
      </div>
      <div class="order-foot">
        <div class="totals">
          <span class="small muted">Total <strong style="color:var(--fg)">${money(o.total)}</strong></span>
          ${direct ? '' : `<span class="small muted">Comisión <strong style="color:var(--gold)">${money(o.total_commission)}</strong></span>`}
        </div>
        <div class="btn-row">
          <button class="btn sm ghost" data-detail="${o.id}">Historial</button>
          ${admin && o.status !== 'cancelado' ? `<button class="btn sm ghost" data-return-order="${o.id}">↩ Devolución</button>` : ''}
          ${admin ? `<button class="btn sm ghost danger" data-delete-order="${o.id}">Eliminar</button>` : ''}
          ${admin ? `
            ${o.payment_status === 'pagado'
              ? `<button class="btn sm ghost" data-pay="${o.id}" data-pay-to="pendiente">Marcar no pagado</button>`
              : `<button class="btn sm ok" data-pay="${o.id}" data-pay-to="pagado">Confirmar pago</button>`}
            <select data-status="${o.id}" aria-label="Cambiar estado" style="width:auto;padding:0.4rem 0.6rem">
              ${statuses.map((st) => `<option value="${st}" ${st === o.status ? 'selected' : ''}>${STATUS_LABELS[st]}</option>`).join('')}
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
    <p class="small muted">${order.source === 'cliente'
      ? `Cliente directo · ${esc(order.client_phone || '')}`
      : `Vendedor: ${esc(order.vendor_name || '—')}${order.vendor_phone ? ' · ' + esc(order.vendor_phone) : ''}`}</p>
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


/* =================================================================
   Panel del administrador
   ================================================================= */
async function viewAdmin(tab) {
  if (!requireRole('admin')) return;
  state.tab.admin = tab;
  const done = showLoader('Cargando…', 500);
  try {
    await renderAdmin(tab);
  } finally {
    await done();
  }
}

async function renderAdmin(tab) {
  const summary = await api('/api/admin/summary');
  const tabs = [
    ['resumen', 'Resumen'],
    ['catalogo', 'Catálogo'],
    ['stock', 'Stock'],
    ['pedidos', `Pedidos${summary.openOrders ? ` (${summary.openOrders})` : ''}`],
    ['cuenta', 'Pagos y cuenta'],
  ];
  app.innerHTML = `
    <div class="panel-head"><div><div class="eyebrow">Administración</div><h2 style="margin:0">Panel de control</h2></div></div>
    <nav class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
    <div id="tabBody"></div>`;
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => viewAdmin(b.dataset.tab)));
  const body = $('#tabBody');
  const views = { resumen: adminSummary, catalogo: adminPerfumes, stock: adminStock, pedidos: adminOrders, cuenta: adminAccount };
  await (views[tab] || views.resumen)(body, summary);
}

function adminSummary(body, s) {
  const soon = settingsCache?.coming_soon === '1';
  body.innerHTML = `
    <div class="card launch-card ${soon ? 'is-soon' : 'is-open'}">
      <div>
        <div class="eyebrow" style="margin:0">Estado de la tienda</div>
        <h3 style="margin:0.3rem 0">${soon ? '🔒 Modo "Próximamente"' : '🟢 Abierta al público'}</h3>
        <p class="small muted" style="margin:0">${soon
          ? 'Los visitantes ven una pantalla de "Muy pronto". Tú sigues entrando y trabajando normalmente. No se reciben pedidos.'
          : 'Cualquier persona puede ver el catálogo y hacer pedidos.'}</p>
      </div>
      <button class="btn ${soon ? 'solid' : ''}" id="launchToggle">${soon ? 'Abrir la tienda al público' : 'Poner en "Próximamente"'}</button>
    </div>
    <form class="card bf-card ${settingsCache?.black_friday === '1' ? 'is-on' : ''}" id="bfForm">
      <div>
        <div class="eyebrow" style="margin:0">Campaña</div>
        <h3 style="margin:0.3rem 0">🖤 Black Friday ${settingsCache?.black_friday === '1' ? (bfActive() ? '· <span class="bf-red">Activo</span>' : '· terminó') : '· apagado'}</h3>
        <p class="small muted" style="margin:0">Cambia la página al diseño Black Friday con cuenta regresiva y la sección de ofertas. Los descuentos se ponen en cada perfume (Catálogo → Descuento %).</p>
      </div>
      <div class="bf-controls">
        <label class="checkbox"><input type="checkbox" name="black_friday" ${settingsCache?.black_friday === '1' ? 'checked' : ''}> Diseño Black Friday encendido</label>
        <div class="field" style="margin:0"><label for="bf-end">Termina el</label><input type="datetime-local" id="bf-end" name="black_friday_end" value="${esc(settingsCache?.black_friday_end || '2026-11-30T23:59')}"></div>
        <button class="btn solid" type="submit">Guardar</button>
      </div>
    </form>
    <div class="stats">
      <div class="stat"><div class="lbl">Perfumes publicados</div><div class="val">${s.activePerfumes}</div></div>
      <div class="stat"><div class="lbl">Pedidos en curso</div><div class="val">${s.openOrders}</div></div>
      <div class="stat"><div class="lbl">Pedidos de clientes en curso</div><div class="val">${s.openCustomerOrders}</div></div>
      <div class="stat"><div class="lbl">Pagos por confirmar</div><div class="val">${s.unpaidCustomerOrders}</div></div>
      <div class="stat"><div class="lbl">Ventas entregadas · mes</div><div class="val">${money(s.monthSales)}</div></div>
    </div>
    ${s.lowStock?.length ? `
      <div class="card stock-alert">
        <h3 style="margin-top:0">⚠ Stock bajo</h3>
        <ul class="order-items">
          ${s.lowStock.map((p) => `<li><span>${esc([p.brand, p.name, p.size_ml ? `${p.size_ml} ml` : ''].filter(Boolean).join(' · '))}</span><span class="stock-badge ${p.stock <= 0 ? 'out' : ''}">${p.stock <= 0 ? 'Agotado' : `Quedan ${p.stock}`}</span></li>`).join('')}
        </ul>
        <button class="btn sm" data-go="catalogo">Reponer stock</button>
      </div>` : ''}
    <div class="btn-row">
      <button class="btn" data-go="catalogo">Agregar perfume</button>
      <button class="btn" data-go="pedidos">Gestionar pedidos</button>
    </div>`;
  $$('[data-go]', body).forEach((b) => b.addEventListener('click', () => viewAdmin(b.dataset.go)));
  $('#bfForm', body).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    withBusy(e.submitter, async () => {
      settingsCache = (await api('/api/admin/settings', { method: 'PUT', body: { black_friday: f.black_friday.checked, black_friday_end: f.black_friday_end.value } })).settings;
      applyBlackFriday();
      toast(f.black_friday.checked ? 'Black Friday encendido 🖤' : 'Black Friday apagado');
      viewAdmin('resumen');
    });
  });
  $('#launchToggle', body).addEventListener('click', (e) => {
    const goSoon = !soon;
    if (!confirm(goSoon
      ? '¿Poner la tienda en modo "Próximamente"? Los visitantes no podrán ver el catálogo ni hacer pedidos.'
      : '¿Abrir la tienda al público? Todos podrán ver el catálogo y hacer pedidos.')) return;
    withBusy(e.currentTarget, async () => {
      settingsCache = (await api('/api/admin/settings', { method: 'PUT', body: { coming_soon: goSoon } })).settings;
      toast(goSoon ? 'Tienda en modo "Próximamente"' : '¡Tienda abierta al público! 🎉');
      viewAdmin('resumen');
    });
  });
}


// Búsqueda del catálogo del administrador (se conserva al guardar cambios).
let catalogQuery = '';

// Vuelve a cargar la tabla del catálogo sin moverse de donde estabas.
async function reloadCatalog(flashId) {
  const body = $('#tabBody');
  if (state.tab.admin !== 'catalogo' || !body) return viewAdmin('catalogo');
  const y = window.scrollY;
  await adminPerfumes(body);
  window.scrollTo(0, y);
  const row = flashId && $(`[data-row-id="${flashId}"]`, body);
  if (row) { row.classList.remove('row-flash'); void row.offsetWidth; row.classList.add('row-flash'); }
}

async function adminPerfumes(body) {
  const { perfumes } = await api('/api/admin/perfumes');
  body.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <h2>Catálogo</h2>
      <button class="btn solid" id="newPerfume">+ Agregar perfume</button>
    </div>
    ${perfumes.length ? `
      <div class="catalog-search">
        <input type="search" id="catSearch" placeholder="Buscar por nombre, marca o categoría…" value="${esc(catalogQuery)}" aria-label="Buscar perfume">
        <span class="small muted" id="catCount"></span>
      </div>
      <div class="empty" id="catNone" hidden>Ningún perfume coincide con la búsqueda.</div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th></th><th>Perfume</th><th>Categoría</th><th class="num">Precio</th><th class="num">Descuento</th><th class="num">Stock</th><th>Estado</th><th class="num">Acciones</th></tr></thead>
        <tbody>
          ${perfumes.map((p) => `
            <tr data-row-id="${p.id}" data-search="${esc(`${p.name} ${p.brand || ''} ${p.category || ''}`.toLowerCase())}">
              <td class="cell-thumb">${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : '<div class="thumb"></div>'}</td>
              <td class="cell-title"><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.brand || '')}${p.size_ml ? ` · ${p.size_ml} ml` : ''}</div>
                <button type="button" class="best-toggle ${p.bestseller ? 'on' : ''}" data-best="${p.id}" title="Mostrar en «Los más vendidos» del inicio">${p.bestseller ? '★ Más vendido' : '☆ Marcar como más vendido'}</button></td>
              <td class="muted" data-label="Categoría">${esc(p.category || '—')}</td>
              <td class="num" data-label="Precio">${money(p.suggested_price)}</td>
              <td class="num" data-label="Descuento (Bs)"><div class="disc-ctl"><span>Bs</span><input type="number" min="0" step="0.01" value="${p.discount_bs > 0 ? p.discount_bs : ''}" placeholder="0" data-disc="${p.id}" aria-label="Descuento en Bs"></div>
                ${p.discount_bs > 0 ? `<div class="small bf-red">${money(p.suggested_price - p.discount_bs)} · -${pctOff(p.discount_bs, p.suggested_price)}%</div>` : ''}</td>
              <td class="num" data-label="Stock">${stockControl(p)}
                <select class="avail-select avail-${esc(p.availability || 'auto')}" data-avail="${p.id}" aria-label="Disponibilidad">
                  <option value="auto" ${(p.availability || 'auto') === 'auto' ? 'selected' : ''}>Según stock</option>
                  <option value="available" ${p.availability === 'available' ? 'selected' : ''}>Disponible (por llegar)</option>
                  <option value="soldout" ${p.availability === 'soldout' ? 'selected' : ''}>Agotado</option>
                </select></td>
              <td data-label="Estado">${p.active ? '<span class="badge approved">Publicado</span>' : '<span class="badge">Oculto</span>'}</td>
              <td class="num cell-actions"><div class="btn-row" style="justify-content:flex-end">
                <button class="btn sm" data-edit="${p.id}">Editar</button>
                <button class="btn sm ghost danger" data-del="${p.id}">Eliminar</button>
              </div></td>
            </tr>`).join('')}
        </tbody>
      </table></div>`
      : '<div class="empty">Aún no hay perfumes. Agrega el primero para armar tu catálogo.</div>'}`;
  $('#newPerfume').addEventListener('click', () => perfumeForm());
  // Buscador: filtra las filas mientras escribes.
  const search = $('#catSearch', body);
  const applySearch = () => {
    catalogQuery = search.value;
    const words = catalogQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    $$('[data-row-id]', body).forEach((tr) => {
      const ok = words.every((w) => tr.dataset.search.includes(w));
      tr.hidden = !ok;
      if (ok) shown++;
    });
    $('#catCount', body).textContent = words.length ? `${shown} de ${perfumes.length}` : `${perfumes.length} perfumes`;
    $('#catNone', body).hidden = shown > 0;
    $('.table-wrap', body).hidden = shown === 0;
  };
  if (search) { search.addEventListener('input', applySearch); applySearch(); }
  $$('[data-best]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, async () => {
    const on = !b.classList.contains('on');
    await api(`/api/admin/perfumes/${b.dataset.best}/bestseller`, { method: 'PATCH', body: { bestseller: on } });
    toast(on ? 'Agregado a «Los más vendidos»' : 'Quitado de «Los más vendidos»');
    reloadCatalog(b.dataset.best);
  })));
  // Disponibilidad directa desde la tabla.
  $$('[data-avail]', body).forEach((sel) => sel.addEventListener('change', () => withBusy(null, async () => {
    await api(`/api/admin/perfumes/${sel.dataset.avail}/availability`, { method: 'PATCH', body: { availability: sel.value } });
    toast({ auto: 'Disponibilidad según stock', available: 'Marcado como disponible', soldout: 'Marcado como agotado' }[sel.value]);
    reloadCatalog(sel.dataset.avail);
  })));
  // Descuento directo desde la tabla.
  $$('[data-disc]', body).forEach((input) => input.addEventListener('change', () => withBusy(null, async () => {
    await api(`/api/admin/perfumes/${input.dataset.disc}/discount`, { method: 'PATCH', body: { discount_bs: input.value } });
    toast(Number(input.value) > 0 ? `Descuento de ${money(input.value)} aplicado` : 'Descuento quitado');
    reloadCatalog(input.dataset.disc);
  })));
  // Botones − / + del inventario y edición directa del número.
  $$('[data-stock-id]', body).forEach((box) => {
    const id = box.dataset.stockId;
    const save = (payload, btn) => withBusy(btn, async () => {
      await api(`/api/admin/perfumes/${id}/stock`, { method: 'PATCH', body: payload });
      reloadCatalog(id);
    });
    $$('[data-stock-add]', box).forEach((b) => b.addEventListener('click', () => save({ add: Number(b.dataset.stockAdd) }, b)));
    $('input', box).addEventListener('change', (e) => save({ stock: e.target.value }, null));
  });
  $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => perfumeForm(perfumes.find((p) => p.id === Number(b.dataset.edit)))));
  $$('[data-del]', body).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Eliminar este perfume del catálogo? Los pedidos existentes se conservan.')) return;
    withBusy(b, async () => {
      await api(`/api/admin/perfumes/${b.dataset.del}`, { method: 'DELETE' });
      toast('Perfume eliminado');
      reloadCatalog();
    });
  }));
}

function stockControl(p) {
  const state = p.stock == null ? '' : p.stock <= 0 ? 'out' : p.stock <= 3 ? 'low' : '';
  return `
    <div class="stock-ctl ${state}" data-stock-id="${p.id}">
      <button type="button" class="btn sm ghost" data-stock-add="-1" aria-label="Restar una unidad" ${p.stock == null || p.stock <= 0 ? 'disabled' : ''}>−</button>
      <input type="number" min="0" value="${p.stock ?? ''}" placeholder="∞" aria-label="Unidades en stock" title="Vacío = sin control de stock">
      <button type="button" class="btn sm ghost" data-stock-add="1" aria-label="Sumar una unidad">+</button>
    </div>`;
}

/* ---- Stock: inventario con precio de compra y reportes en Excel ---- */
async function adminStock(body) {
  const { perfumes, sales, purchases } = await api('/api/admin/inventory');
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1));
  const myPrice = (p) => p.store_price ?? p.suggested_price;
  const byId = Object.fromEntries(perfumes.map((p) => [p.id, p]));
  const totals = perfumes.reduce((t, p) => {
    if (p.stock != null) {
      t.units += p.stock;
      t.sale += p.stock * myPrice(p);
      // Lo que queda en stock se valora con el precio de su lote; lo que no tiene lote, con el precio de compra.
      const inLots = (p.lots || []).reduce((n, l) => n + l.remaining, 0);
      const lotCost = (p.lots || []).reduce((n, l) => n + l.remaining * l.unit_cost, 0);
      const rest = Math.max(0, p.stock - inLots);
      if (p.cost != null || !rest) {
        const cost = lotCost + rest * (p.cost || 0);
        t.cost += cost;
        t.profit += Math.max(0, p.stock) * myPrice(p) - cost;
      }
    }
    if (p.cost == null) t.noCost++;
    return t;
  }, { units: 0, cost: 0, sale: 0, profit: 0, noCost: 0 });

  body.innerHTML = `
    <div class="card report-card">
      <div>
        <div class="eyebrow" style="margin:0">Reporte en Excel</div>
        <h3 style="margin:0.3rem 0">Ventas, costos y ganancias por fecha</h3>
        <p class="small muted" style="margin:0">Incluye ventas de la página y ventas fuera de la página: resumen, ventas por perfume, detalle de cada venta e inventario actual. No cuenta los pedidos cancelados.</p>
      </div>
      <form class="report-form" id="reportForm">
        <div class="field"><label for="rp-from">Desde</label><input type="date" id="rp-from" name="from" value="${monthStart}" required></div>
        <div class="field"><label for="rp-to">Hasta</label><input type="date" id="rp-to" name="to" value="${iso(today)}" required></div>
        <div class="chips report-presets">
          <button type="button" class="chip" data-range="today">Hoy</button>
          <button type="button" class="chip" data-range="week">7 días</button>
          <button type="button" class="chip active" data-range="month">Este mes</button>
          <button type="button" class="chip" data-range="last">Mes pasado</button>
        </div>
        <button class="btn solid" type="submit">⬇ Descargar Excel</button>
      </form>
    </div>

    <div class="ops-grid">
      ${opCard({
        id: 'saleForm', kind: 'sale', eyebrow: 'Venta fuera de la página', title: 'Registrar una venta',
        help: 'Para lo que vendes en persona, por WhatsApp, etc. Puedes poner varios perfumes. Baja tu stock y entra en el reporte; no cambia el precio de la página ni las comisiones.',
        priceLabel: 'Precio venta c/u', dateName: 'sold_at', extra: '<div class="field"><label>Nota (opcional)</label><input name="note" maxlength="200" placeholder="Ej: cliente, en tienda, feria…"></div>',
        button: 'Registrar venta', perfumes, today: iso(today),
        history: [], historyTitle: '', priceKey: 'unit_price', delAttr: 'data-del-sale',
      })}
      ${opCard({
        id: 'buyForm', kind: 'buy', eyebrow: 'Compra de mercadería', title: 'Ingresar stock comprado',
        help: 'Registra lo que compraste: suma al stock y guarda el precio y la fecha de compra (salen en el Excel).',
        priceLabel: 'Precio compra c/u', dateName: 'purchased_at', extra: '<div class="field"><label>Proveedor (opcional)</label><input name="supplier" maxlength="120" placeholder="Ej: distribuidor, importadora…"></div>',
        button: 'Ingresar compra', perfumes, today: iso(today),
        history: purchases, historyTitle: 'Últimas compras', priceKey: 'unit_cost', delAttr: 'data-del-buy',
      })}
    </div>

    <div class="card sales-history" id="salesHistory">
      <div class="sh-head">
        <div>
          <div class="eyebrow" style="margin:0">Todas las ventas</div>
          <h3 style="margin:0.3rem 0">Ventas registradas</h3>
          <p class="small muted" style="margin:0">Ventas de la página y fuera de la página (sin cancelados). Filtra por fechas, canal o perfume.</p>
        </div>
      </div>
      <div class="sh-filters">
        <div class="field" style="margin:0"><label for="sh-from">Desde</label><input type="date" id="sh-from" value="${monthStart}"></div>
        <div class="field" style="margin:0"><label for="sh-to">Hasta</label><input type="date" id="sh-to" value="${iso(today)}"></div>
        <div class="field sh-search" style="margin:0"><label for="sh-q">Buscar</label><input type="search" id="sh-q" placeholder="Perfume, cliente o nota (ej: scandal)"></div>
      </div>
      <div class="chips">
        <button type="button" class="chip" data-sh-range="today">Hoy</button>
        <button type="button" class="chip" data-sh-range="week">7 días</button>
        <button type="button" class="chip active" data-sh-range="month">Este mes</button>
        <button type="button" class="chip" data-sh-range="last">Mes pasado</button>
        <button type="button" class="chip" data-sh-range="all">Todo</button>
      </div>
      <div class="chips">
        <button type="button" class="chip active" data-sh-channel="">Todas</button>
        <button type="button" class="chip" data-sh-channel="web">Página</button>
        <button type="button" class="chip" data-sh-channel="manual">Fuera de la página</button>
      </div>
      <div id="shStats"></div>
      <div id="shList" class="small muted">Cargando…</div>
    </div>

    <details class="card activity-card" id="activityCard">
      <summary><span class="eyebrow" style="margin:0">Registro de movimientos</span> <span class="small muted">· todo lo que se vendió, devolvió, compró o borró</span></summary>
      <div id="activityList" class="small muted" style="margin-top:1rem">Cargando…</div>
    </details>

    <div class="stats">
      <div class="stat"><div class="lbl">Unidades en stock</div><div class="val">${totals.units}</div></div>
      <div class="stat"><div class="lbl">Invertido en stock (compra)</div><div class="val">${money(totals.cost)}</div></div>
      <div class="stat"><div class="lbl">Valor a mi precio de venta</div><div class="val">${money(totals.sale)}</div></div>
      <div class="stat"><div class="lbl">Ganancia si vendes todo</div><div class="val">${money(totals.profit)}</div></div>
    </div>
    ${totals.noCost ? `<p class="small muted">⚠ ${totals.noCost} ${totals.noCost === 1 ? 'perfume no tiene' : 'perfumes no tienen'} precio de compra. Complétalo para calcular bien las ganancias.</p>` : ''}

    <div class="section-head" style="margin-top:1.5rem"><h2>Inventario</h2><input type="search" id="stockSearch" placeholder="Buscar perfume…" style="max-width:260px"></div>
    ${perfumes.length ? `
      <div class="table-wrap"><table class="stack stock-table">
        <thead><tr><th>Perfume</th><th class="num">Stock</th><th class="num">Precio compra</th><th class="num">Mi precio venta</th><th class="num">Ganancia c/u</th><th class="num">Precio en la página</th><th class="num">Vendidos</th></tr></thead>
        <tbody>
          ${perfumes.map((p) => `
            <tr data-row="${p.id}" data-search="${esc(`${p.brand || ''} ${p.name}`.toLowerCase())}">
              <td class="cell-title"><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.brand || '')}${p.size_ml ? ` · ${p.size_ml} ml` : ''}${p.active ? '' : ' · Oculto'}</div>${p.last_purchase ? `<div class="small muted">Última compra: ${fmtDay(p.last_purchase)}</div>` : ''}
                ${p.lots?.length ? `<div class="lots">${p.lots.map((l) => `<span class="lot" title="Comprado el ${fmtDay(l.purchased_at)}">${l.remaining} a ${money(l.unit_cost)} <em>· gana ${money(myPrice(p) - l.unit_cost)}</em></span>`).join('')}</div>` : ''}</td>
              <td class="num" data-label="Stock"><input class="inv-input" type="number" min="0" step="1" data-field="stock" value="${p.stock ?? ''}" placeholder="∞"></td>
              <td class="num" data-label="Precio compra"><input class="inv-input" type="number" min="0" step="0.01" data-field="cost" value="${p.cost ?? ''}" placeholder="—"></td>
              <td class="num" data-label="Mi precio venta"><input class="inv-input" type="number" min="0" step="0.01" data-field="store_price" value="${p.store_price ?? ''}" placeholder="${p.suggested_price}"></td>
              <td class="num" data-label="Ganancia c/u" data-profit>${profitCell(p.cost, myPrice(p))}</td>
              <td class="num muted" data-label="Precio en la página">${money(p.suggested_price)}</td>
              <td class="num muted" data-label="Vendidos" title="En la página · fuera de la página">${p.sold_web} · ${p.sold_outside}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="small muted">Los cambios se guardan solos al salir de cada casilla. <strong>Mi precio venta</strong> es tu precio propio: no cambia el precio de la página (si lo dejas vacío se usa el de la página). Ganancia c/u = mi precio de venta − precio de compra (el último). Debajo de cada perfume ves sus <strong>lotes</strong>: cuántas unidades quedan de cada compra, a qué precio y cuánto ganas con cada una. Al vender se usan primero las unidades del lote más antiguo y la ganancia se calcula con el precio real de ese lote. "Vendidos" = en la página · fuera de la página.</p>`
      : '<div class="empty">Aún no hay perfumes. Agrégalos en la pestaña Catálogo.</div>'}`;

  // Guardar cada casilla al cambiarla.
  $$('.inv-input', body).forEach((input) => input.addEventListener('change', async () => {
    const row = input.closest('tr');
    try {
      const { perfume } = await api(`/api/admin/perfumes/${row.dataset.row}/inventory`, { method: 'PATCH', body: { [input.dataset.field]: input.value } });
      $('[data-profit]', row).innerHTML = profitCell(perfume.cost, perfume.store_price ?? perfume.suggested_price);
      input.classList.add('saved');
      setTimeout(() => input.classList.remove('saved'), 900);
    } catch (err) {
      toast(err.message, true);
    }
  }));
  $('#stockSearch', body)?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('[data-row]', body).forEach((tr) => { tr.hidden = q && !tr.dataset.search.includes(q); });
  });

  // Formularios de venta y compra con varios perfumes.
  bindOpForm($('#saleForm', body), {
    defaultPrice: (p) => myPrice(p), url: '/api/admin/manual-sales', priceKey: 'unit_price', done: 'Venta registrada', reload: () => adminStock(body),
  }, byId);
  bindOpForm($('#buyForm', body), {
    defaultPrice: (p) => p.cost ?? '', url: '/api/admin/purchases', priceKey: 'unit_cost', done: 'Compra ingresada al stock', reload: () => adminStock(body),
  }, byId);
  const delOp = (attr, url, question, done) => $$(`[${attr}]`, body).forEach((b) => b.addEventListener('click', () => {
    if (!confirm(question)) return;
    withBusy(b, async () => {
      await api(`${url}/${b.getAttribute(attr)}`, { method: 'DELETE' });
      toast(done);
      adminStock(body);
    });
  }));
  // Todas las ventas registradas, con filtro de fechas, canal y búsqueda.
  const shFrom = $('#sh-from', body);
  const shTo = $('#sh-to', body);
  const shQ = $('#sh-q', body);
  let shChannel = '';
  let shData = [];
  const drawSales = () => {
    const list = shData.filter((x) => !shChannel || x.kind === shChannel);
    const box = $('#shList', body);
    const sum = (f) => list.reduce((n, x) => n + x.lines.reduce((t, l) => t + f(l), 0), 0);
    const total = sum((l) => l.qty * l.price);
    const units = sum((l) => l.qty);
    const known = list.flatMap((x) => x.lines).filter((l) => l.cost != null);
    const profit = known.reduce((n, l) => n + l.qty * (l.price - l.cost), 0);
    $('#shStats', body).innerHTML = `
      <div class="sh-stats">
        <div><span>Ventas</span><strong>${list.length}</strong></div>
        <div><span>Unidades</span><strong>${units}</strong></div>
        <div><span>Total vendido</span><strong>${money(total)}</strong></div>
        <div><span>Ganancia${known.length < list.flatMap((x) => x.lines).length ? ' *' : ''}</span><strong>${money(profit)}</strong></div>
      </div>
      ${known.length < list.flatMap((x) => x.lines).length ? '<p class="small muted" style="margin:0 0 0.6rem">* Sin contar los perfumes que no tienen precio de compra.</p>' : ''}`;
    if (!list.length) { box.innerHTML = '<div class="empty" style="padding:1.5rem">No hay ventas con ese filtro.</div>'; return; }
    box.innerHTML = `
      <ul class="op-history sales-list">
        ${list.map((x, i) => `<li>
          <div>
            <strong>${fmtDay(x.date)}</strong>${x.time ? ` <span class="muted">${x.time}</span>` : ''}
            <span class="sh-chan ${x.kind}">${esc(x.channel)}</span>
            <span class="muted">· ${esc(x.ref)}</span>${x.who ? ` · <span class="muted">${esc(x.who)}</span>` : ''}
            ${x.kind === 'web' ? `<span class="badge ${x.paid ? 'approved' : ''}" style="margin-left:0.3rem">${x.paid ? 'Pagado' : 'Pago pendiente'}</span>` : ''}
            <div class="small muted">${x.lines.map((l) => `${l.qty} × ${esc(l.name)} · ${money(l.price)}`).join('<br>')}</div>
          </div>
          <div class="op-hist-right"><strong>${money(x.lines.reduce((n, l) => n + l.qty * l.price, 0))}</strong>
            <button type="button" class="btn sm ghost" data-sh-ret="${i}">↩ Devolución</button></div>
        </li>`).join('')}
      </ul>`;
    $$('[data-sh-ret]', box).forEach((b) => b.addEventListener('click', () => {
      const x = list[Number(b.dataset.shRet)];
      returnModal({
        title: `Devolución · ${x.ref} del ${fmtDay(x.date)}`,
        lines: x.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, price: l.price })),
        action: async (items, password, note) => {
          if (x.kind === 'web') {
            await api(`/api/orders/${x.id}/return`, { method: 'POST', body: { items: items.map((it) => ({ item_id: it.id, quantity: it.quantity })), password, note } });
          } else {
            await api('/api/admin/manual-sales/return', { method: 'POST', body: { items, password } });
          }
          toast('Devolución registrada: las unidades volvieron al stock');
          adminStock(body);
        },
      });
    }));
  };
  const loadSales = async () => {
    const qs = new URLSearchParams();
    if (shFrom.value) qs.set('from', shFrom.value);
    if (shTo.value) qs.set('to', shTo.value);
    if (shQ.value.trim()) qs.set('q', shQ.value.trim());
    shData = (await api(`/api/admin/sales?${qs}`)).sales;
    drawSales();
  };
  $$('[data-sh-range]', body).forEach((chip) => chip.addEventListener('click', () => {
    const d = new Date();
    let from = new Date(d), to = new Date(d);
    const r = chip.dataset.shRange;
    if (r === 'week') from.setDate(d.getDate() - 6);
    if (r === 'month') from = new Date(d.getFullYear(), d.getMonth(), 1);
    if (r === 'last') { from = new Date(d.getFullYear(), d.getMonth() - 1, 1); to = new Date(d.getFullYear(), d.getMonth(), 0); }
    shFrom.value = r === 'all' ? '' : iso(from);
    shTo.value = r === 'all' ? '' : iso(to);
    $$('[data-sh-range]', body).forEach((c) => c.classList.toggle('active', c === chip));
    loadSales();
  }));
  $$('[data-sh-channel]', body).forEach((chip) => chip.addEventListener('click', () => {
    shChannel = chip.dataset.shChannel;
    $$('[data-sh-channel]', body).forEach((c) => c.classList.toggle('active', c === chip));
    drawSales();
  }));
  [shFrom, shTo].forEach((el) => el.addEventListener('change', () => {
    $$('[data-sh-range]', body).forEach((c) => c.classList.remove('active'));
    loadSales();
  }));
  let shTimer;
  shQ.addEventListener('input', () => { clearTimeout(shTimer); shTimer = setTimeout(loadSales, 300); });
  loadSales();

  // Registro de movimientos (se carga al abrirlo).
  $('#activityCard', body).addEventListener('toggle', async (e) => {
    if (!e.target.open) return;
    const { activity } = await api('/api/admin/activity');
    $('#activityList', body).innerHTML = activity.length
      ? `<ul class="activity-list">${activity.map((a) => `<li><span class="act-when">${fmtDay(a.at.slice(0, 10))} ${a.at.slice(11, 16)}</span>
          <span class="act-tag act-${esc(a.action.split(' ')[0])}${a.action.includes('borrad') ? ' act-del' : ''}">${esc(a.action)}</span>
          <span class="act-detail">${esc(a.detail)}</span>${a.amount != null ? `<strong class="act-amount">${money(a.amount)}</strong>` : ''}</li>`).join('')}</ul>`
      : 'Aún no hay movimientos registrados (empiezan a guardarse desde esta versión).';
  });
  delOp('data-del-buy', '/api/admin/purchases', '¿Borrar esta compra completa? Esas unidades se restan del stock.', 'Compra borrada');

  // Rangos rápidos de fechas.
  const form = $('#reportForm', body);
  $$('[data-range]', body).forEach((chip) => chip.addEventListener('click', () => {
    const d = new Date();
    let from = new Date(d), to = new Date(d);
    if (chip.dataset.range === 'week') from.setDate(d.getDate() - 6);
    if (chip.dataset.range === 'month') from = new Date(d.getFullYear(), d.getMonth(), 1);
    if (chip.dataset.range === 'last') { from = new Date(d.getFullYear(), d.getMonth() - 1, 1); to = new Date(d.getFullYear(), d.getMonth(), 0); }
    form.from.value = iso(from);
    form.to.value = iso(to);
    $$('[data-range]', body).forEach((c) => c.classList.toggle('active', c === chip));
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.from.value > form.to.value) { toast('La fecha "Desde" debe ser antes de "Hasta"', true); return; }
    withBusy(e.submitter, async () => {
      const res = await fetch(`/api/admin/report?from=${form.from.value}&to=${form.to.value}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo generar el reporte');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `reporte-distinto-${form.from.value}-a-${form.to.value}.xlsx`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Reporte descargado');
    });
  });
}

// Tarjeta de venta o compra con filas de perfumes (se pueden agregar varias).
function opCard({ id, kind, eyebrow, title, help, priceLabel, dateName, extra, button, perfumes, today, history, historyTitle, priceKey, delAttr }) {
  if (!perfumes.length) return '';
  const options = perfumes.map((p) => `<option value="${p.id}">${esc([p.brand, p.name, p.size_ml ? `${p.size_ml} ml` : ''].filter(Boolean).join(' · '))}${p.stock != null ? ` (stock: ${p.stock})` : ''}</option>`).join('');
  return `
    <div class="card op-card op-${kind}">
      <div>
        <div class="eyebrow" style="margin:0">${eyebrow}</div>
        <h3 style="margin:0.3rem 0">${title}</h3>
        <p class="small muted" style="margin:0">${help}</p>
      </div>
      <form class="op-form" id="${id}">
        <template data-line-tpl>
          <div class="op-line">
            <select data-l="perfume_id" required aria-label="Perfume"><option value="">Elige un perfume…</option>${options}</select>
            <input data-l="quantity" type="number" min="1" step="1" value="1" required aria-label="Cantidad" placeholder="Cant.">
            <input data-l="${priceKey}" type="number" min="0" step="0.01" required aria-label="${priceLabel}" placeholder="${priceLabel}">
            <span class="op-sub muted small" data-sub></span>
            <button type="button" class="btn sm ghost danger" data-remove-line aria-label="Quitar">×</button>
          </div>
        </template>
        <div class="op-head small muted"><span>Perfume</span><span>Cant.</span><span>${priceLabel} (Bs)</span><span>Subtotal</span><span></span></div>
        <div class="op-lines" data-lines></div>
        <button type="button" class="btn sm" data-add-line>+ Agregar otro perfume</button>
        <div class="op-foot">
          <div class="field"><label>Fecha</label><input type="date" name="${dateName}" value="${today}" required></div>
          ${extra}
          <div class="op-total"><span class="muted small">Total</span><strong data-total>${money(0)}</strong></div>
          <button class="btn solid" type="submit">${button}</button>
        </div>
      </form>
      ${history.length ? `
        <details class="sale-history">
          <summary class="small">${historyTitle} (${history.length})</summary>
          <ul class="op-history">
            ${history.map((h) => `<li>
              <div><strong>${fmtDay(h.date)}</strong>${h.note ? ` · <span class="muted">${esc(h.note)}</span>` : ''}
                <div class="small muted">${h.lines.map((l) => `${l.quantity} × ${esc(l.perfume_name)} · ${money(l[priceKey])}`).join('<br>')}</div></div>
              <div class="op-hist-right"><strong>${money(h.lines.reduce((n, l) => n + l.quantity * l[priceKey], 0))}</strong>
                <button type="button" class="btn sm ghost${kind === 'sale' ? '' : ' danger'}" ${delAttr}="${h.id}" aria-label="${kind === 'sale' ? 'Devolución' : 'Borrar'}">${kind === 'sale' ? '↩ Devolución' : '×'}</button></div>
            </li>`).join('')}
          </ul>
        </details>` : ''}
    </div>`;
}

function bindOpForm(form, { defaultPrice, url, priceKey, done, reload }, byId) {
  if (!form) return;
  const box = $('[data-lines]', form);
  const tpl = $('[data-line-tpl]', form);
  const refresh = () => {
    let total = 0;
    $$('.op-line', box).forEach((line) => {
      const sub = (Number($('[data-l="quantity"]', line).value) || 0) * (Number($(`[data-l="${priceKey}"]`, line).value) || 0);
      total += sub;
      $('[data-sub]', line).textContent = sub ? money(sub) : '';
    });
    $('[data-total]', form).textContent = money(total);
    $$('[data-remove-line]', box).forEach((b) => { b.disabled = $$('.op-line', box).length === 1; });
  };
  const addLine = () => {
    box.append(tpl.content.cloneNode(true));
    const line = box.lastElementChild;
    $('[data-l="perfume_id"]', line).addEventListener('change', (e) => {
      const p = byId[e.target.value];
      $(`[data-l="${priceKey}"]`, line).value = p ? defaultPrice(p) : '';
      refresh();
    });
    $$('input', line).forEach((i) => i.addEventListener('input', refresh));
    $('[data-remove-line]', line).addEventListener('click', () => { line.remove(); refresh(); });
    refresh();
  };
  $('[data-add-line]', form).addEventListener('click', addLine);
  addLine();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const items = $$('.op-line', box).map((line) => Object.fromEntries($$('[data-l]', line).map((el) => [el.dataset.l, el.value])));
    const ids = items.map((it) => it.perfume_id);
    if (new Set(ids).size !== ids.length) { toast('Ese perfume ya está en otra fila: súmalo en la cantidad', true); return; }
    const btn = e.submitter;
    btn.disabled = true;
    api(url, { method: 'POST', body: { ...formData(form), items } })
      .then((res) => {
        const lines = items.map((it) => {
          const p = byId[it.perfume_id];
          return `<li><span>${it.quantity} × ${esc(p ? [p.brand, p.name].filter(Boolean).join(' · ') : '')}</span><span>${money(Number(it[priceKey]) || 0)} c/u</span></li>`;
        }).join('');
        openModal(`
          <div class="op-result ok">
            <div class="paid-check">✓</div>
            <h3>${esc(done)}</h3>
            <p class="small muted">Fecha: <strong style="color:var(--fg)">${fmtDay(form.querySelector('input[type="date"]').value)}</strong></p>
            <ul class="order-items">${lines}</ul>
            ${res.warnings?.length ? `<div class="op-warn">⚠ ${res.warnings.map(esc).join('<br>⚠ ')}</div>` : ''}
            <button class="btn solid" type="button" id="opOk">Listo</button>
          </div>`);
        $('#opOk').addEventListener('click', closeModal);
        reload();
      })
      .catch((err) => {
        openModal(`
          <div class="op-result bad">
            <div class="paid-check">!</div>
            <h3>No se guardó</h3>
            <p>${esc(err.message)}</p>
            <p class="small muted">Lo que escribiste sigue en el formulario: corrígelo y vuelve a intentar.</p>
            <button class="btn solid" type="button" id="opOk">Entendido</button>
          </div>`);
        $('#opOk').addEventListener('click', closeModal);
      })
      .finally(() => { btn.disabled = false; });
  });
}

function profitCell(cost, price) {
  if (cost == null) return '<span class="muted">—</span>';
  const profit = price - cost;
  return `<strong class="${profit < 0 ? 'neg' : ''}">${money(profit)}</strong>`;
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
        <div class="field"><label for="p-price">Precio de venta (Bs) *</label><input id="p-price" name="suggested_price" type="number" min="0" step="0.01" required value="${esc(p.suggested_price ?? '')}"></div>
        <div class="field"><label for="p-disc">Descuento (Bs)</label><input id="p-disc" name="discount_bs" type="number" min="0" step="0.01" value="${p.discount_bs > 0 ? esc(p.discount_bs) : ''}" placeholder="Ej: 50">
          <span class="small muted" id="p-final"></span></div>
        <input type="hidden" name="commission" value="${esc(p.commission ?? 0)}">
        <div class="field"><label for="p-cost">Precio de compra (Bs)</label><input id="p-cost" name="cost" type="number" min="0" step="0.01" value="${esc(p.cost ?? '')}" placeholder="Solo lo ves tú"></div>
        <div class="field"><label for="p-stock">Unidades en stock</label><input id="p-stock" name="stock" type="number" min="0" step="1" value="${esc(p.stock ?? '')}" placeholder="Ej: 10">
          <span class="small muted">Baja sola con cada pedido. Déjalo vacío si no quieres controlar el stock.</span></div>
        <div class="field full"><label for="p-desc">Descripción / notas olfativas</label><textarea id="p-desc" name="description">${esc(p.description || '')}</textarea></div>
        <div class="field full">
          <label for="p-img">Imagen (URL o sube un archivo)</label>
          <input id="p-img" name="image" placeholder="https://…" value="${esc(p.image || '')}">
          <input type="file" id="p-file" accept="image/png,image/jpeg,image/webp,image/gif">
          <img class="img-preview" id="p-preview" ${p.image ? `src="${esc(p.image)}"` : 'hidden'} alt="Vista previa">
        </div>
        <label class="checkbox field full"><input type="checkbox" name="active" ${p.active === 0 ? '' : 'checked'}> Publicado (visible en el catálogo)</label>
        <label class="checkbox field full"><input type="checkbox" name="bestseller" ${p.bestseller ? 'checked' : ''}> ★ Mostrar en «Los más vendidos» del inicio</label>
        <div class="field full"><label for="p-avail">Disponibilidad</label>
          <select id="p-avail" name="availability">
            <option value="auto" ${(p.availability || 'auto') === 'auto' ? 'selected' : ''}>Según stock (se agota sola al llegar a 0)</option>
            <option value="available" ${p.availability === 'available' ? 'selected' : ''}>Disponible aunque no haya stock (por llegar)</option>
            <option value="soldout" ${p.availability === 'soldout' ? 'selected' : ''}>Agotado (no se puede pedir)</option>
          </select></div>
      </div>
      <div class="btn-row">
        <button class="btn solid" type="submit">${editing ? 'Guardar cambios' : 'Agregar perfume'}</button>
        <button class="btn ghost" type="button" id="cancelPerfume">Cancelar</button>
      </div>
    </form>`);

  // Vista previa del precio con descuento.
  const showFinal = () => {
    const price = Number($('#p-price', root).value) || 0;
    const off = Math.max(0, Number($('#p-disc', root).value) || 0);
    $('#p-final', root).innerHTML = !off || !price
      ? 'Monto que se resta al precio. Déjalo vacío o en 0 si no tiene descuento.'
      : off >= price
        ? '<span class="bf-red">El descuento debe ser menor que el precio.</span>'
        : `Precio final: <strong class="bf-red">${money(price - off)}</strong> · en el catálogo sale la etiqueta <strong class="bf-red">OFERTA</strong> con el precio anterior tachado`;
  };
  $('#p-price', root).addEventListener('input', showFinal);
  $('#p-disc', root).addEventListener('input', showFinal);
  showFinal();
  const imgInput = $('#p-img', root);
  const preview = $('#p-preview', root);
  imgInput.addEventListener('input', () => {
    preview.hidden = !imgInput.value;
    if (imgInput.value) preview.src = imgInput.value;
  });
  $('#p-file', root).addEventListener('change', (e) => {
    withBusy(null, async () => {
      const data = await readImageFile(e.target.files[0]);
      const { url } = await api('/api/admin/upload', { method: 'POST', body: { data } });
      imgInput.value = url;
      preview.src = url;
      preview.hidden = false;
      toast('Imagen subida');
    });
  });
  $('#cancelPerfume', root).addEventListener('click', closeModal);
  $('#perfumeForm', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const data = formData(e.target);
    data.active = e.target.active.checked;
    data.bestseller = e.target.bestseller.checked;
    withBusy(e.submitter, async () => {
      const { perfume } = await api(editing ? `/api/admin/perfumes/${p.id}` : '/api/admin/perfumes', { method: editing ? 'PUT' : 'POST', body: data });
      closeModal();
      toast(editing ? 'Perfume actualizado' : 'Perfume agregado');
      reloadCatalog(perfume.id);
    });
  });
}

async function adminOrders(body, _s, filter = '', source = '') {
  const qs = new URLSearchParams();
  if (filter) qs.set('status', filter);
  if (source) qs.set('source', source);
  const { orders, statuses } = await api(`/api/orders?${qs}`);
  const reload = () => {
    // Actualiza también el contador de la pestaña "Pedidos (n)".
    api('/api/admin/summary').then((sum) => {
      const tab = $('[data-tab="pedidos"]');
      if (tab) tab.textContent = `Pedidos${sum.openOrders ? ` (${sum.openOrders})` : ''}`;
    }).catch(() => {});
    return adminOrders(body, null, filter, source);
  };
  body.innerHTML = `
    ${orderFilterBar(statuses, filter)}
    ${orders.length ? `
      <div class="bulk-bar">
        <label class="checkbox"><input type="checkbox" id="pickAll"> Seleccionar todos los de esta lista</label>
        <button class="btn sm danger" id="deletePicked" disabled>Eliminar seleccionados</button>
      </div>
      <div class="orders">${orders.map((o) => orderCard(o, { admin: true, statuses })).join('')}</div>`
      : '<div class="empty">No hay pedidos en esta lista.</div>'}`;
  const picks = $$('[data-pick]', body);
  const picked = () => picks.filter((c) => c.checked).map((c) => Number(c.dataset.pick));
  const refreshBulk = () => {
    const n = picked().length;
    const btn = $('#deletePicked', body);
    if (!btn) return;
    btn.disabled = !n;
    btn.textContent = n ? `Eliminar seleccionados (${n})` : 'Eliminar seleccionados';
    $('#pickAll', body).checked = n > 0 && n === picks.length;
  };
  picks.forEach((c) => c.addEventListener('change', refreshBulk));
  $('#pickAll', body)?.addEventListener('change', (e) => { picks.forEach((c) => { c.checked = e.target.checked; }); refreshBulk(); });
  $('#deletePicked', body)?.addEventListener('click', () => {
    const ids = picked();
    if (!ids.length) return;
    confirmWithPassword({
      title: `Eliminar ${ids.length} pedido(s)`,
      message: 'Se borran por completo y no se puede deshacer. Si no fueron entregados, las unidades vuelven al stock.',
      button: 'Eliminar',
      action: async (password) => {
        const { deleted } = await api('/api/admin/orders/delete', { method: 'POST', body: { ids, password } });
        toast(`${deleted} pedido(s) eliminado(s)`);
        reload();
      },
    });
  });
  $$('[data-delete-order]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.deleteOrder;
    confirmWithPassword({
      title: `Eliminar el pedido #${id}`,
      message: 'Se borra por completo y no se puede deshacer. Si te devolvieron solo algunos perfumes, usa "Devolución".',
      button: 'Eliminar',
      action: async (password) => {
        await api(`/api/orders/${id}`, { method: 'DELETE', body: { password } });
        toast(`Pedido #${id} eliminado`);
        reload();
      },
    });
  }));
  $$('[data-return-order]', body).forEach((b) => b.addEventListener('click', () => {
    const o = orders.find((x) => x.id === Number(b.dataset.returnOrder));
    returnModal({
      title: `Devolución · Pedido #${o.id}`,
      lines: o.items.map((it) => ({ id: it.id, name: it.perfume_name, qty: it.quantity, price: it.unit_price })),
      action: async (items, password, note) => {
        const { full } = await api(`/api/orders/${o.id}/return`, { method: 'POST', body: { items: items.map((it) => ({ item_id: it.id, quantity: it.quantity })), password, note } });
        toast(full ? `Pedido #${o.id} devuelto completo (quedó cancelado)` : `Devolución registrada en el pedido #${o.id}`);
        reload();
      },
    });
  }));
  $$('[data-source]', body).forEach((c) => c.addEventListener('click', () => adminOrders(body, null, filter, c.dataset.source)));
  $$('[data-filter]', body).forEach((c) => c.addEventListener('click', () => adminOrders(body, null, c.dataset.filter, source)));
  $$('[data-detail]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, () => showOrderHistory(b.dataset.detail))));
  $$('[data-pay]', body).forEach((b) => b.addEventListener('click', () => withBusy(b, async () => {
    const { email } = await api(`/api/orders/${b.dataset.pay}/payment`, { method: 'PATCH', body: { payment_status: b.dataset.payTo } });
    toast(b.dataset.payTo === 'pagado' ? `Pago del pedido #${b.dataset.pay} confirmado${emailNote(email)}` : 'Pago marcado como pendiente');
    emailWarning(email);
    reload();
  })));
  $$('[data-save-status]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.saveStatus;
    const status = $(`[data-status="${id}"]`, body).value;
    const root = openModal(`
      <div class="eyebrow">Pedido #${esc(id)}</div>
      <h3>Cambiar estado a ${badge(status)}</h3>
      <form class="form" id="statusForm">
        <div class="field"><label for="s-note">Nota (la verá el cliente, opcional)</label><textarea id="s-note" name="note" placeholder="Ej: sale hoy por la tarde, número de guía…"></textarea></div>
        <div class="btn-row"><button class="btn solid" type="submit">Confirmar</button><button class="btn ghost" type="button" id="cancelStatus">Cancelar</button></div>
      </form>`);
    $('#cancelStatus', root).addEventListener('click', closeModal);
    $('#statusForm', root).addEventListener('submit', (e) => {
      e.preventDefault();
      withBusy(e.submitter, async () => {
        const { email } = await api(`/api/orders/${id}/status`, { method: 'PATCH', body: { status, note: e.target.note.value } });
        closeModal();
        toast(`Pedido #${id}: ${STATUS_LABELS[status]}${emailNote(email)}`);
        emailWarning(email);
        reload();
      });
    });
  }));
}

// Tarjeta "Ver en el celular": enlace público (COMPARTIR.bat) y direcciones de la red local.
async function renderShareCard(card) {
  if (!card.isConnected) return;
  let share;
  try { share = await api('/api/admin/share'); } catch { return; }
  const linkRow = (url) => `
    <div class="share-link">
      <code>${esc(url)}</code>
      <div class="btn-row">
        <button class="btn sm" data-copy="${esc(url)}">Copiar</button>
        <a class="btn sm" href="${esc(`https://wa.me/?text=${encodeURIComponent(`Distinto SCZ: ${url}`)}`)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
      </div>
    </div>`;
  let publicPart;
  if (share.public) {
    publicPart = `
      <p class="small muted" style="margin:0">Ábrelo en cualquier celular, con Wi-Fi o datos móviles. Puedes mandárselo a tus clientes.
        Funciona mientras la ventana negra esté abierta y cambia cada vez que abres <strong style="color:var(--fg)">COMPARTIR.bat</strong>.</p>
      ${linkRow(share.public)}`;
  } else if (share.sharing) {
    publicPart = '<p class="muted" style="margin:0">Creando el enlace público… espera unos segundos.</p>';
    setTimeout(() => renderShareCard(card), 3000);
  } else {
    publicPart = `
      <p class="small muted" style="margin:0">Para abrir la página desde cualquier celular (aunque no esté en tu Wi-Fi), cierra la ventana negra
        y enciende la página con <strong style="color:var(--fg)">COMPARTIR.bat</strong> en lugar de INICIAR.bat. Aquí aparecerá el enlace.</p>`;
  }
  card.innerHTML = `
    <div class="eyebrow" style="margin:0">Ver en el celular</div>
    <h3 style="margin:0">Enlace público</h3>
    ${publicPart}
    ${share.lan.length ? `
      <details class="share-lan">
        <summary class="small muted">Dirección en tu red Wi-Fi (solo funciona si el celular está en la misma red)</summary>
        ${share.lan.map(linkRow).join('')}
      </details>` : ''}`;
  $$('[data-copy]', card).forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Enlace copiado'); } catch { prompt('Copia este enlace:', b.dataset.copy); }
  }));
}

// Código que el administrador pega en script.google.com (envía los correos desde su Gmail).
function appsScriptCode(key) {
  return `const CLAVE = '${key}';

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.clave !== CLAVE) return responder({ ok: false, error: 'clave' });
  MailApp.sendEmail({ to: d.to, subject: d.subject, body: d.subject, htmlBody: d.html, name: d.name || 'Distinto SCZ' });
  return responder({ ok: true });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function probar() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Distinto SCZ', 'El script de correos funciona.');
}`;
}

// Configuración del correo de la tienda para avisar a los clientes.
async function renderMailCard(form, modeOverride) {
  const { mail } = await api('/api/admin/mail');
  const mode = modeOverride || mail.mail_mode;
  const code = appsScriptCode(mail.script_key);
  form.innerHTML = `
    <div class="eyebrow" style="margin:0">Avisos por correo</div>
    <h3 style="margin:0">Correos a tus clientes ${mail.enabled ? '<span class="badge approved">Activo</span>' : '<span class="badge">Apagado</span>'}</h3>
    <p class="small muted" style="margin:0">Si el cliente deja su correo, le llega un aviso al hacer el pedido, cuando confirmas el pago y cada vez que cambias el estado.</p>
    <div class="chips">
      <button type="button" class="chip ${mode === 'script' ? 'active' : ''}" data-mode="script">Con Google Apps Script (recomendado)</button>
      <button type="button" class="chip ${mode === 'smtp' ? 'active' : ''}" data-mode="smtp">Con contraseña de aplicación</button>
    </div>
    <input type="hidden" name="mail_mode" value="${mode}">
    ${mode === 'script' ? `
      <ol class="setup-steps small">
        <li>En Chrome, con la sesión de <strong>distintoscz@gmail.com</strong>, abre
          <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> (se crea un proyecto nuevo).</li>
        <li>Borra todo lo que aparece y pega este código:
          <pre class="code-box" id="scriptCode">${esc(code)}</pre>
          <button type="button" class="btn sm" id="copyCode">Copiar código</button></li>
        <li>Presiona el ícono de <strong>guardar</strong> 💾. Arriba, en la lista de funciones, elige <strong>probar</strong> y presiona <strong>▶ Ejecutar</strong>.
          Google pedirá permiso: <em>Revisar permisos</em> → elige la cuenta → <em>Configuración avanzada</em> → <em>Ir a … (no seguro)</em> → <em>Permitir</em>.
          Es tu propio script, por eso Google lo marca como "no verificado".</li>
        <li>Arriba a la derecha: <strong>Implementar → Nueva implementación</strong>. En el engranaje ⚙ elige <strong>Aplicación web</strong>.
          En <em>Ejecutar como</em>: <strong>Yo</strong>. En <em>Quién tiene acceso</em>: <strong>Cualquier usuario</strong>. Presiona <strong>Implementar</strong>.</li>
        <li>Copia la <strong>URL de la aplicación web</strong> (termina en <code>/exec</code>) y pégala aquí:</li>
      </ol>
      <div class="field"><label for="m-script">URL de la aplicación web</label>
        <input id="m-script" name="script_url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(mail.script_url)}"></div>
      <div class="field"><label for="m-name">Nombre que verá el cliente</label><input id="m-name" name="smtp_name" value="${esc(mail.smtp_name)}"></div>`
    : `
      <details class="mail-help">
        <summary class="small">Cómo obtener la contraseña de aplicación de Gmail</summary>
        <ol class="small muted">
          <li>Activa la <strong style="color:var(--fg)">Verificación en 2 pasos</strong> en tu cuenta de Google.</li>
          <li>Abre <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" style="text-decoration:underline">myaccount.google.com/apppasswords</a>, escribe <em>Distinto SCZ</em> y presiona <strong style="color:var(--fg)">Crear</strong>.</li>
          <li>Copia la contraseña de 16 letras y pégala aquí. Si Google dice que la opción no está disponible, usa el método con Google Apps Script.</li>
        </ol>
      </details>
      <div class="form-grid">
        <div class="field"><label for="m-user">Gmail de la tienda</label><input id="m-user" name="smtp_user" type="email" placeholder="tienda@gmail.com" value="${esc(mail.smtp_user)}"></div>
        <div class="field"><label for="m-pass">Contraseña de aplicación</label><input id="m-pass" name="smtp_pass" type="password" autocomplete="new-password" placeholder="${mail.has_password ? '•••• guardada (escribe para cambiarla)' : 'xxxx xxxx xxxx xxxx'}"></div>
        <div class="field full"><label for="m-name">Nombre que verá el cliente</label><input id="m-name" name="smtp_name" value="${esc(mail.smtp_name)}"></div>
      </div>
      <details class="mail-help">
        <summary class="small">Opciones avanzadas</summary>
        <div class="form-grid" style="margin-top:0.8rem">
          <div class="field"><label for="m-host">Servidor SMTP</label><input id="m-host" name="smtp_host" value="${esc(mail.smtp_host)}"></div>
          <div class="field"><label for="m-port">Puerto</label><input id="m-port" name="smtp_port" type="number" value="${esc(mail.smtp_port)}"></div>
        </div>
      </details>`}
    <details class="mail-help">
      <summary class="small">Dirección pública de la página (opcional)</summary>
      <div class="field" style="margin-top:0.8rem"><label for="m-site">Para el botón "Ver mi pedido" del correo</label>
        <input id="m-site" name="site_url" placeholder="Si usas COMPARTIR.bat, se usa ese enlace automáticamente" value="${esc(mail.site_url)}"></div>
    </details>
    <div class="btn-row">
      <button class="btn solid" type="submit">Guardar</button>
      ${mail.enabled ? '<button class="btn ghost danger" type="button" id="mailOff">Desactivar</button>' : ''}
    </div>
    <div class="mail-test">
      <input id="m-test" type="email" placeholder="Correo para la prueba" value="${esc(mail.smtp_user || '')}">
      <button class="btn" type="button" id="mailTest" ${mail.enabled ? '' : 'disabled'}>Enviar prueba</button>
    </div>`;
  $$('[data-mode]', form).forEach((b) => b.addEventListener('click', () => renderMailCard(form, b.dataset.mode)));
  $('#copyCode', form)?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); toast('Código copiado'); } catch { prompt('Copia este código:', code); }
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    withBusy(e.submitter, async () => {
      await api('/api/admin/mail', { method: 'PUT', body: formData(form) });
      toast('Correo guardado');
      renderMailCard(form);
    });
  };
  $('#mailOff', form)?.addEventListener('click', (e) => {
    if (!confirm('¿Desactivar los avisos por correo?')) return;
    withBusy(e.currentTarget, async () => {
      await api('/api/admin/mail', { method: 'PUT', body: { ...formData(form), clear: true } });
      toast('Avisos por correo desactivados');
      renderMailCard(form);
    });
  });
  $('#mailTest', form).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    toast('Enviando correo de prueba…');
    await api('/api/admin/mail/test', { method: 'POST', body: { to: $('#m-test', form).value } });
    toast('Correo de prueba enviado. Revisa tu bandeja (y la carpeta de spam).');
  }));
}

async function adminAccount(body) {
  settingsCache = null;
  const settings = await getSettings();
  body.innerHTML = `
    <div class="card share-card" id="shareCard"></div>
    <form class="card form mail-card" id="mailForm"></form>
    <div class="account-grid">
      <form class="card form" id="storeForm">
        <h3>Pagos de la tienda</h3>
        <p class="small muted" style="margin:0">Este QR se muestra a los clientes al realizar su pedido.</p>
        <img class="qr-img small-qr" id="qrPreview" src="${esc(settings.payment_qr)}" alt="QR de pago actual">
        <div class="field"><label for="qrFile">Cambiar QR de pago</label><input type="file" id="qrFile" accept="image/png,image/jpeg,image/webp"></div>
        <div class="field"><label for="waNum">WhatsApp de la tienda (opcional)</label><input id="waNum" name="whatsapp" type="tel" placeholder="Ej: 70012345" value="${esc(settings.whatsapp)}"></div>
        <p class="small muted" style="margin:0">Si lo llenas, los clientes verán un botón para enviarte su comprobante por WhatsApp.</p>
        <button class="btn solid" type="submit">Guardar</button>
      </form>
      <form class="card form" id="passForm">
        <h3>Usuario y contraseña</h3>
        <p class="small muted">Usuario actual: <strong style="color:var(--fg)">${esc(state.user.email)}</strong>.
          Al guardar se cierra tu sesión en <strong style="color:var(--fg)">todos</strong> los dispositivos y vuelves a entrar con los datos nuevos.</p>
        <div class="field"><label for="a-email">Nuevo usuario (correo)</label><input id="a-email" name="email" type="email" autocomplete="username" value="${esc(state.user.email)}"></div>
        <div class="field"><label for="a-new">Nueva contraseña (mínimo 8)</label><input id="a-new" name="next" type="password" minlength="8" autocomplete="new-password" placeholder="Déjala vacía para no cambiarla"></div>
        <div class="field"><label for="a-new2">Repite la nueva contraseña</label><input id="a-new2" name="confirm" type="password" minlength="8" autocomplete="new-password"></div>
        <div class="field"><label for="a-cur">Contraseña actual *</label><input id="a-cur" name="current" type="password" required autocomplete="current-password"></div>
        <button class="btn solid" type="submit">Guardar y cerrar todas las sesiones</button>
        <button class="btn ghost" type="button" id="logoutAll">Solo cerrar sesión en todos los dispositivos</button>
      </form>
    </div>`;
  renderShareCard($('#shareCard'));
  renderMailCard($('#mailForm'));
  let newQr = null;
  $('#qrFile').addEventListener('change', (e) => withBusy(null, async () => {
    const data = await readImageFile(e.target.files[0]);
    const { url } = await api('/api/admin/upload', { method: 'POST', body: { data } });
    newQr = url;
    $('#qrPreview').src = url;
    toast('QR cargado. Presiona Guardar para usarlo.');
  }));
  $('#storeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(e.submitter, async () => {
      const payload = { whatsapp: $('#waNum').value };
      if (newQr) payload.payment_qr = newQr;
      settingsCache = (await api('/api/admin/settings', { method: 'PUT', body: payload })).settings;
      newQr = null;
      toast('Ajustes guardados');
    });
  });
  const backToLogin = (message) => {
    state.user = null;
    toast(message);
    location.hash = '#/login';
    renderNav();
  };
  $('#passForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!confirm('Se cerrará tu sesión en todos los dispositivos (también en este). ¿Continuar?')) return;
    withBusy(e.submitter, async () => {
      const { email } = await api('/api/me/credentials', { method: 'POST', body: formData(e.target) });
      backToLogin(`Listo. Entra con tu usuario ${email} y la contraseña nueva.`);
    });
  });
  $('#logoutAll').addEventListener('click', (e) => {
    if (!confirm('¿Cerrar tu sesión en todos los dispositivos (también en este)?')) return;
    withBusy(e.currentTarget, async () => {
      await api('/api/me/logout-all', { method: 'POST' });
      backToLogin('Sesión cerrada en todos los dispositivos');
    });
  });
}

/* =================================================================
   Efectos dinámicos
   ================================================================= */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Las tablas no se animan: con muchas filas son más altas que la pantalla.
const REVEAL_SELECTOR = '.product, .feature, .stat, .order, .section-head, .podium-place, .card, .cta, .empty, .cart-line';

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
      const val = entry.target.matches('.stat') && $('.val', entry.target);
      if (val) countUp(val);
    }
  }, { threshold: 0, rootMargin: '0px 0px -30px 0px' })
  : null;

function prepareReveal(root) {
  if (!revealObserver || reducedMotion) return;
  const items = root.matches?.(REVEAL_SELECTOR) ? [root] : [];
  items.push(...$$(REVEAL_SELECTOR, root));
  for (const el of items) {
    if (el.classList.contains('reveal') || el.closest('.modal')) continue;
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    el.style.setProperty('--d', `${Math.min(siblings.indexOf(el), 8) * 70}ms`);
    el.classList.add('reveal');
    revealObserver.observe(el);
  }
}

// Botón de "ojo" para ver u ocultar lo que se escribe en cualquier campo de contraseña.
const EYE_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_SHUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.1 6.1C3.6 7.8 2 12 2 12s3.6 7 10 7a10.4 10.4 0 0 0 4.9-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function addPasswordToggles(root) {
  const inputs = root.matches?.('input[type="password"]') ? [root] : $$('input[type="password"]', root);
  for (const input of inputs) {
    if (input.dataset.eye) continue;
    input.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.replaceWith(wrap);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    btn.setAttribute('aria-label', 'Mostrar contraseña');
    btn.innerHTML = EYE_OPEN;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_SHUT : EYE_OPEN;
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      btn.classList.toggle('on', show);
      input.focus();
    });
    wrap.append(input, btn);
  }
}

new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      prepareReveal(node);
      addPasswordToggles(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// Anima los números de las tarjetas de estadísticas desde 0.
function countUp(el) {
  const original = el.textContent.trim();
  const isMoney = original.startsWith(CURRENCY);
  const prefix = isMoney ? CURRENCY : original.startsWith('#') ? '#' : '';
  const raw = original.slice(prefix.length);
  const target = isMoney ? Number(raw.replace(/\./g, '').replace(',', '.')) : Number(raw);
  if (!Number.isFinite(target) || target === 0) return;
  const start = performance.now();
  const duration = 1100;
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, (now - start) / duration);
    const v = target * (1 - Math.pow(1 - t, 3));
    el.textContent = t < 1 ? (isMoney ? money(v) : prefix + Math.round(v)) : original;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Barra de progreso de scroll y header compacto.
const scrollBar = $('#scrollProgress');
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  $('#topbar').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ---- Pantallas de carga (logo con barra luminosa) ---- */
// Pantalla de carga: devuelve una función para cerrarla (se ve al menos 'min' ms).
// Si hay varias cargas a la vez, la pantalla se cierra cuando termina la última.
let loaderCount = 0;
function showLoader(textValue = 'Cargando…', min = 700) {
  const el = $('#loader');
  if (!el || reducedMotion) return async () => {};
  $('#loaderText').textContent = textValue;
  loaderCount++;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  const started = Date.now();
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    const wait = Math.max(0, min - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount) return;
    el.classList.remove('show');
    setTimeout(() => { if (!loaderCount) el.hidden = true; }, 450);
  };
}

// Texto de la pantalla de carga según la página.
function loaderTextFor(route) {
  if (route.startsWith('#/catalogo')) return 'Preparando la colección…';
  if (route.startsWith('#/carrito')) return 'Preparando tu carrito…';
  if (route.startsWith('#/mis-pedidos')) return 'Buscando tus pedidos…';
  if (route.startsWith('#/pedido/')) return 'Cargando tu pedido…';
  if (route.startsWith('#/admin')) return 'Abriendo el panel…';
  return 'Cargando…';
}

// Intro con el logo y la barra de carga: una vez por sesión del navegador.
(function intro() {
  const el = $('#intro');
  let seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; sessionStorage.setItem('introSeen', '1'); } catch { /* sin almacenamiento */ }
  if (seen || reducedMotion) { el.remove(); return; }
  setTimeout(() => { el.classList.add('done'); setTimeout(() => el.remove(), 900); }, 2600);
})();

/* =================================================================
   Inicio
   ================================================================= */
$('#year').textContent = new Date().getFullYear();

(async function init() {
  // Si se abrió index.html con doble clic, el servidor no está encendido y nada funciona.
  if (location.protocol === 'file:') {
    $('#intro')?.remove();
    app.innerHTML = `
      <div class="form-wrap card center">
        <div class="eyebrow">Falta un paso</div>
        <h2>Así no se abre la página</h2>
        <p class="muted">Abriste el archivo <strong>index.html</strong> directamente, por eso no puedes ingresar.</p>
        <p>Cierra esta pestaña, vuelve a la carpeta principal de la página y dale doble clic a
          <strong>INICIAR.bat</strong> (Windows) o <strong>iniciar.command</strong> (Mac).
          La página se abrirá sola en <strong>http://localhost:3000</strong>.</p>
      </div>`;
    return;
  }
  try {
    const [{ user }] = await Promise.all([api('/api/me'), getSettings()]);
    state.user = user;
  } catch { /* sin sesión */ }
  // El botón flotante usa el número de WhatsApp configurado en Pagos y cuenta.
  if (settingsCache?.whatsapp) $('#waFloat').href = waLink(settingsCache.whatsapp, 'Hola Distinto SCZ, quiero información sobre sus perfumes.');
  applyBlackFriday();
  router();
})();

/* ---- Cuenta regresiva para el lanzamiento (hora de Bolivia, UTC-4) ---- */
/* ---- Black Friday ---- */
// Activo si el administrador lo encendió y aún no llegó la fecha de fin (hora de Bolivia).
function bfEnd() {
  return new Date(`${settingsCache?.black_friday_end || '2026-11-30T23:59'}:00-04:00`);
}
function bfActive() {
  return settingsCache?.black_friday === '1' && Date.now() < bfEnd();
}
function fmtEnd(d) {
  return d.toLocaleString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/La_Paz' });
}
// Barra superior y colores de Black Friday en toda la página.
function applyBlackFriday() {
  const on = bfActive();
  document.body.classList.toggle('bf-mode', on);
  const bar = $('#bfBar');
  if (!bar) return;
  bar.hidden = !on;
  if (!on) return;
  const item = '<span>BLACK FRIDAY</span><span class="dot">✦</span><span>Descuentos en perfumes originales</span><span class="dot">✦</span><span>Paga con QR</span><span class="dot">✦</span><span>Envíos a toda Bolivia</span><span class="dot">✦</span>';
  bar.innerHTML = `<a href="#/catalogo?ofertas" class="bf-bar-track">${item.repeat(4)}</a>`;
}

// Franja Black Friday para las demás páginas (catálogo, carrito, pedidos).
function bfStrip(message) {
  if (!bfActive()) return '';
  return `
    <a class="bf-strip" href="#/catalogo?ofertas">
      <span class="bf-strip-title"><b>BLACK</b> FRIDAY</span>
      <span class="bf-strip-msg">${message}</span>
      <span class="bf-strip-left">Termina en <strong data-bf-left>${bfLeftText()}</strong></span>
    </a>`;
}
function bfLeftText() {
  const sec = Math.max(0, Math.floor((bfEnd() - Date.now()) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor(sec / 60) % 60;
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
setInterval(() => {
  $$('[data-bf-left]').forEach((el) => { el.textContent = bfLeftText(); });
  if (document.body.classList.contains('bf-mode') && !bfActive()) applyBlackFriday();
}, 30000);

/* ---- Cuenta regresiva ---- */
let countdownTimer = null;

function countdownHTML(target, title) {
  if (!target || Date.now() >= target) return '';
  const unit = (key, label) => `<div class="cd-unit"><span class="cd-num" data-cd="${key}">00</span><span class="cd-label">${label}</span></div>`;
  return `
    <div class="countdown" id="countdown" data-target="${target.getTime()}">
      <div class="cd-title">${title}</div>
      <div class="cd-units">${unit('d', 'Días')}<span class="cd-sep">:</span>${unit('h', 'Horas')}<span class="cd-sep">:</span>${unit('m', 'Minutos')}<span class="cd-sep">:</span>${unit('s', 'Segundos')}</div>
    </div>`;
}

function startCountdown(doneText = '¡La oferta terminó!') {
  clearInterval(countdownTimer);
  const box = document.getElementById('countdown');
  if (!box) return;
  const target = Number(box.dataset.target);
  const tick = () => {
    if (!document.body.contains(box)) { clearInterval(countdownTimer); return; }
    const left = Math.max(0, target - Date.now());
    if (!left) {
      clearInterval(countdownTimer);
      box.innerHTML = `<div class="cd-title">${doneText}</div>`;
      return;
    }
    const sec = Math.floor(left / 1000);
    const parts = { d: Math.floor(sec / 86400), h: Math.floor(sec / 3600) % 24, m: Math.floor(sec / 60) % 60, s: sec % 60 };
    for (const [k, v] of Object.entries(parts)) {
      const el = box.querySelector(`[data-cd="${k}"]`);
      const txt = String(v).padStart(2, '0');
      if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    }
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function viewComingSoon() {
  const wa = settingsCache?.whatsapp ? waLink(settingsCache.whatsapp, 'Hola Distinto SCZ, quiero saber cuándo abren la tienda.') : '';
  app.innerHTML = `
    <section class="soon">
      <div class="hero-visual soon-visual" aria-hidden="true">
        <div class="ring"></div><div class="ring dashed"></div><div class="ring pulse"></div><div class="ring pulse two"></div><div class="orbit"></div>
        <img src="/img/emblem.png" alt="">
      </div>
      <div class="eyebrow">Muy pronto</div>
      <h1 class="hero-name">DISTINTO SCZ</h1>
      <div class="hero-tag"><span class="typed" id="typed"></span></div>
      <p class="muted">Estamos preparando una nueva experiencia en fragancias originales.<br>Muy pronto podrás hacer tus pedidos aquí.</p>
      ${wa ? `<a class="btn solid" href="${esc(wa)}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>` : ''}
      <a class="soon-login" href="#/login">Acceso</a>
    </section>`;
  typeWriter($('#typed'), 'Tu fragancia, tu sello', 600);
}
