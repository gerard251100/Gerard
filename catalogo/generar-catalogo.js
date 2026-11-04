'use strict';
/*
 * Genera el catálogo interactivo de gorras en PDF: catalogo/Catalogo-Gorras.pdf
 *
 *   node catalogo/generar-catalogo.js
 *
 * Para cambiar gorras, colores, fotos o el número de WhatsApp, edita los datos de abajo
 * y vuelve a ejecutar el comando. Las fotos van en catalogo/fotos/ (por ejemplo "01.jpg").
 * Necesita Playwright (npm i playwright).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const WHATSAPP = '59163626511';
const PRECIO = 350;
const PRECIO_OTRAS = 600;

// [nombre, estilo, etiqueta, foto, descripción, colores: [nombre, copa, visera]]
const GORRAS = [
  ['Clásica Negra', 'Béisbol', 'Más vendida', '', 'La gorra que combina con todo. Negro total, visera curva y logo bordado.', [['Negro', '#111111', '#111111'], ['Gris oscuro', '#3a3a3a', '#222222']]],
  ['Trucker Malla Blanca', 'Trucker', 'Nueva', '', 'Frente acolchado y malla atrás para que no te dé calor.', [['Blanco/Negro', '#f2f2f2', '#111111'], ['Negro/Blanco', '#111111', '#f2f2f2']]],
  ['Snapback Urbana', 'Snapback', '', '', 'Visera plana y broche atrás. Estilo urbano de verdad.', [['Negro/Rojo', '#111111', '#c81e1e'], ['Azul marino', '#1b2a4a', '#1b2a4a']]],
  ['Dad Hat Beige', 'Dad hat', '', '', 'Tela suave, perfil bajo y hebilla metálica. Cómoda para todos los días.', [['Beige', '#d8c7a5', '#d8c7a5'], ['Café', '#6b4a2f', '#6b4a2f']]],
  ['Trucker Camuflaje', 'Trucker', '', '', 'Estampado camuflado con malla. Para el que no pasa desapercibido.', [['Verde militar', '#4b5a33', '#2c3420'], ['Arena', '#a08a5c', '#6e5d3b']]],
  ['Béisbol Azul Marino', 'Béisbol', '', '', 'Azul profundo, visera curva y ajuste trasero. Elegante y deportiva.', [['Azul marino', '#1b2a4a', '#1b2a4a'], ['Celeste', '#7fb2e5', '#7fb2e5']]],
  ['Snapback Roja', 'Snapback', 'Más vendida', '', 'Rojo intenso que se nota de lejos. Visera plana y broche ajustable.', [['Rojo', '#c81e1e', '#c81e1e'], ['Rojo/Negro', '#c81e1e', '#111111']]],
  ['Plana Premium', 'Plana', '', '', 'Visera totalmente plana y copa alta. Para un look más atrevido.', [['Negro/Dorado', '#111111', '#c9a227'], ['Blanco', '#f2f2f2', '#f2f2f2']]],
  ['Dad Hat Rosa', 'Dad hat', 'Nueva', '', 'Tono rosa suave, perfil bajo. Ideal para regalar.', [['Rosa', '#e8a6b8', '#e8a6b8'], ['Lila', '#b8a3d9', '#b8a3d9']]],
  ['Trucker Verde', 'Trucker', '', '', 'Frente verde con malla. Fresca y con estilo.', [['Verde', '#2f6b3a', '#2f6b3a'], ['Verde oliva', '#5c6b2f', '#5c6b2f']]],
  ['Béisbol Blanca', 'Béisbol', '', '', 'Blanco limpio, el básico que no puede faltar.', [['Blanco', '#f2f2f2', '#f2f2f2'], ['Hueso', '#e9e1cf', '#e9e1cf']]],
  ['Snapback Gris', 'Snapback', '', '', 'Gris con visera negra. Combina con cualquier outfit.', [['Gris/Negro', '#8a8a8a', '#111111'], ['Gris claro', '#bdbdbd', '#bdbdbd']]],
  ['Dad Hat Negra', 'Dad hat', '', '', 'Perfil bajo en negro, tela lavada. Sencilla y con clase.', [['Negro', '#111111', '#111111'], ['Verde botella', '#1f3d2b', '#1f3d2b']]],
  ['Plana Azul Rey', 'Plana', '', '', 'Azul rey vibrante con visera plana. Llamativa y juvenil.', [['Azul rey', '#1d4ed8', '#1d4ed8'], ['Azul/Blanco', '#1d4ed8', '#f2f2f2']]],
  ['Trucker Naranja', 'Trucker', '', '', 'Naranja con malla. Para el que le gusta resaltar.', [['Naranja', '#e8711c', '#e8711c'], ['Mostaza', '#c9a227', '#c9a227']]],
  ['Béisbol Vino', 'Béisbol', '', '', 'Color vino elegante y visera curva.', [['Vino', '#6b1f2a', '#6b1f2a'], ['Vino/Negro', '#6b1f2a', '#111111']]],
  ['Snapback Bicolor', 'Snapback', '', '', 'Copa negra y visera blanca. Contraste que nunca falla.', [['Negro/Blanco', '#111111', '#f2f2f2'], ['Blanco/Negro', '#f2f2f2', '#111111']]],
  ['Dad Hat Verde Oliva', 'Dad hat', '', '', 'Verde oliva con hebilla metálica. Estilo relajado.', [['Verde oliva', '#5c6b2f', '#5c6b2f'], ['Caqui', '#b5a179', '#b5a179']]],
].map(([nombre, estilo, etiqueta, foto, desc, colores], i) => ({ id: i + 1, nombre, estilo, etiqueta, foto, desc, colores }));

const DETALLES = {
  'Béisbol': ['Visera curva', 'Ajuste trasero', 'Logo bordado'],
  'Trucker': ['Frente acolchado', 'Malla trasera respirable', 'Broche ajustable'],
  'Snapback': ['Visera plana', 'Broche snapback', 'Copa estructurada'],
  'Dad hat': ['Perfil bajo', 'Tela suave', 'Hebilla metálica'],
  'Plana': ['Visera plana', 'Copa alta', 'Broche ajustable'],
};

/* ------------------------------------------------------------------ */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wa = (t) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t)}`;
const ROOT = __dirname;
const logo = (() => {
  const f = path.join(ROOT, '..', 'public', 'img', 'emblem.png');
  return fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : '';
})();

function photo(g) {
  if (!g.foto) return null;
  const f = path.join(ROOT, 'fotos', g.foto);
  if (!fs.existsSync(f)) { console.warn(`  Falta la foto ${g.foto} (${g.nombre}); se usa el dibujo.`); return null; }
  const ext = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
let uidN = 0;
function capSVG(g, ci = 0) {
  const [, crown, visor] = g.colores[ci];
  const flat = g.estilo === 'Snapback' || g.estilo === 'Plana';
  const top = g.estilo === 'Dad hat' ? 92 : g.estilo === 'Plana' ? 62 : 74;
  const u = `u${++uidN}`;
  const light = parseInt(crown.slice(1), 16) > 0x999999;
  const mesh = g.estilo === 'Trucker'
    ? `<pattern id="m${u}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${shade(crown, -40)}"/><circle cx="3" cy="3" r="1.4" fill="${shade(crown, -80)}"/></pattern>
       <path d="M128 ${top + 6} C 160 ${top + 6}, 176 ${top + 40}, 176 ${top + 86} L 128 ${top + 86} Z" fill="url(#m${u})"/>` : '';
  const visorPath = flat
    ? `M 34 ${top + 84} L 150 ${top + 84} L 128 ${top + 104} L 18 ${top + 104} Z`
    : `M 30 ${top + 82} C 60 ${top + 76}, 130 ${top + 78}, 150 ${top + 86} C 120 ${top + 116}, 40 ${top + 120}, 10 ${top + 104} C 12 ${top + 94}, 20 ${top + 86}, 30 ${top + 82} Z`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="c${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(crown, 30)}"/><stop offset="1" stop-color="${shade(crown, -25)}"/></linearGradient>
      <linearGradient id="v${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(visor, 20)}"/><stop offset="1" stop-color="${shade(visor, -35)}"/></linearGradient>
    </defs>
    <ellipse cx="100" cy="${top + 118}" rx="80" ry="10" fill="rgba(0,0,0,.45)"/>
    <path d="M 32 ${top + 86} C 32 ${top + 20}, 70 ${top}, 104 ${top} C 146 ${top}, 176 ${top + 30}, 176 ${top + 86} Z" fill="url(#c${u})"/>
    ${mesh}
    <path d="M 104 ${top} C 96 ${top + 30}, 94 ${top + 60}, 96 ${top + 86}" stroke="${shade(crown, -50)}" stroke-width="1.5" fill="none" opacity=".7"/>
    <path d="M 104 ${top} C 128 ${top + 26}, 136 ${top + 56}, 136 ${top + 86}" stroke="${shade(crown, -50)}" stroke-width="1.5" fill="none" opacity=".5"/>
    <ellipse cx="104" cy="${top + 2}" rx="7" ry="3.5" fill="${shade(crown, -30)}"/>
    <path d="${visorPath}" fill="url(#v${u})"/>
    <rect x="58" y="${top + 38}" width="34" height="18" rx="3" fill="none" stroke="${shade(crown, light ? -90 : 90)}" stroke-width="2" opacity=".85"/>
    <text x="75" y="${top + 51}" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="800" fill="${shade(crown, light ? -90 : 90)}">DSCZ</text>
  </svg>`;
}
const pic = (g, ci = 0) => { const p = photo(g); return p ? `<img src="${p}" alt="">` : capSVG(g, ci); };
const dot = (c) => `<span class="dot" style="background:linear-gradient(135deg, ${c[1]} 50%, ${c[2]} 50%)"></span>`;
const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2.1 1.3 2.4 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>';

const ESTILOS = ['Béisbol', 'Trucker', 'Snapback', 'Dad hat', 'Plana'];

const cover = `
<section class="page cover" id="inicio">
  ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
  <div class="brand">DISTINTO SCZ</div>
  <div class="kicker">CATÁLOGO DE GORRAS · 18 MODELOS</div>
  <h1>Las mismas gorras,<br><span>250 Bs</span> más baratas.</h1>
  <div class="compare">
    <div class="them"><small>En otras tiendas</small><b>${PRECIO_OTRAS} Bs</b></div>
    <div class="us"><small>Aquí</small><b>${PRECIO} Bs</b></div>
  </div>
  <div class="hero-caps">${[0, 6, 1].map((i) => `<div>${capSVG(GORRAS[i])}</div>`).join('')}</div>
  <a class="btn primary" href="#indice">Ver las 18 gorras →</a>
  <a class="btn wa" href="${wa('Hola! Vi el catálogo de gorras a 350 Bs y quiero consultar.')}">${WA_ICON} Consultar por WhatsApp</a>
  <p class="hint">Toca cualquier gorra o botón: este catálogo es interactivo.</p>
</section>`;

const index = `
<section class="page" id="indice">
  <div class="head"><h2>Elige tu gorra</h2><p>Todas a <b>${PRECIO} Bs</b> · toca una para ver detalles</p></div>
  <div class="filters">${ESTILOS.map((e) => `<a href="#estilo-${e.replace(/\s/g, '')}">${e}</a>`).join('')}</div>
  <div class="index-grid">
    ${GORRAS.map((g) => `
      <a class="tile" href="#gorra-${g.id}">
        <div class="tile-pic">${pic(g)}${g.etiqueta ? `<span class="tag">${esc(g.etiqueta)}</span>` : ''}</div>
        <div class="tile-name">${esc(g.nombre)}</div>
        <div class="tile-price">${PRECIO} Bs <s>${PRECIO_OTRAS}</s></div>
      </a>`).join('')}
  </div>
</section>`;

const firstOfStyle = new Set(ESTILOS.map((e) => GORRAS.find((g) => g.estilo === e)?.id));
const products = GORRAS.map((g) => `
<section class="page product" id="gorra-${g.id}">
  ${firstOfStyle.has(g.id) ? `<span id="estilo-${g.estilo.replace(/\s/g, '')}"></span>` : ''}
  <div class="nav"><a href="#indice">← Todas las gorras</a><span>${g.id} / ${GORRAS.length}</span></div>
  <div class="big-pic">${pic(g)}${g.etiqueta ? `<span class="tag">${esc(g.etiqueta)}</span>` : ''}<span class="save">Ahorras ${PRECIO_OTRAS - PRECIO} Bs</span></div>
  <div class="style">${esc(g.estilo)}</div>
  <h2>${esc(g.nombre)}</h2>
  <div class="price"><b>${PRECIO} Bs</b><span>En otras tiendas <s>${PRECIO_OTRAS} Bs</s></span></div>
  <p class="desc">${esc(g.desc)}</p>
  <ul class="features">${[...DETALLES[g.estilo], 'Talla única ajustable'].map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
  <div class="colors-label">Toca el color que quieres pedir:</div>
  <div class="colors">
    ${g.colores.map((c, ci) => `
      <a class="color" href="${wa(`Hola! Quiero la gorra "${g.nombre}" color ${c[0]} a ${PRECIO} Bs. ¿Está disponible?`)}">
        <div class="mini">${pic(g, ci)}</div>${dot(c)}<span>${esc(c[0])}</span>
      </a>`).join('')}
  </div>
  <a class="btn wa" href="${wa(`Hola! Quiero la gorra "${g.nombre}" a ${PRECIO} Bs. ¿Qué colores tienes disponibles?`)}">${WA_ICON} Pedir por WhatsApp</a>
  <div class="pager">
    ${g.id > 1 ? `<a href="#gorra-${g.id - 1}">← Anterior</a>` : '<span></span>'}
    ${g.id < GORRAS.length ? `<a href="#gorra-${g.id + 1}">Siguiente →</a>` : '<a href="#pedir">Cómo pedir →</a>'}
  </div>
</section>`).join('');

const howTo = `
<section class="page how" id="pedir">
  <h2>¿Cómo pido?</h2>
  <ol>
    <li><b>Elige tu gorra</b> y el color en este catálogo.</li>
    <li><b>Toca "Pedir por WhatsApp".</b> El mensaje ya va escrito.</li>
    <li><b>Te confirmamos</b> disponibilidad, pago y entrega.</li>
  </ol>
  <div class="deal">
    <div><small>1 gorra</small><b>${PRECIO} Bs</b><span>ahorras ${PRECIO_OTRAS - PRECIO} Bs</span></div>
    <div><small>2 gorras</small><b>${PRECIO * 2} Bs</b><span>ahorras ${(PRECIO_OTRAS - PRECIO) * 2} Bs</span></div>
    <div><small>3 gorras</small><b>${PRECIO * 3} Bs</b><span>ahorras ${(PRECIO_OTRAS - PRECIO) * 3} Bs</span></div>
  </div>
  <a class="btn wa" href="${wa('Hola! Vi el catálogo de gorras y quiero hacer un pedido.')}">${WA_ICON} Hacer mi pedido</a>
  <a class="btn" href="#indice">← Volver a las gorras</a>
  <div class="foot">${logo ? `<img src="${logo}" alt="">` : ''}DISTINTO SCZ · Santa Cruz · WhatsApp +${WHATSAPP.replace(/^591/, '591 ')}</div>
</section>`;

const css = `
@page { size: 120mm 213mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #0a0a0a; color: #f5f5f5; font-family: "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
svg, img { width: 100%; height: 100%; display: block; object-fit: cover; }
.page { width: 120mm; height: 213mm; padding: 9mm 8mm; page-break-after: always; overflow: hidden; position: relative; display: flex; flex-direction: column; }
.btn { display: flex; align-items: center; justify-content: center; gap: 2.5mm; border: .3mm solid rgba(255,255,255,.45); border-radius: 20mm; padding: 3.6mm; font-weight: 700; font-size: 4mm; margin-top: 3mm; }
.btn svg { width: 5mm; height: 5mm; }
.btn.primary { background: #f5f5f5; color: #000; border-color: #f5f5f5; }
.btn.wa { background: #25d366; color: #05290f; border-color: #25d366; }
.tag { position: absolute; top: 2mm; left: 2mm; background: #f5c518; color: #111; font-size: 2.4mm; font-weight: 800; padding: .8mm 1.6mm; border-radius: 1mm; text-transform: uppercase; }
.dot { display: inline-block; width: 4mm; height: 4mm; border-radius: 50%; border: .2mm solid rgba(255,255,255,.4); }

.cover { text-align: center; align-items: center; background: radial-gradient(circle at 50% 35%, #232323, #0a0a0a 70%); }
.cover .logo { width: 16mm; height: 16mm; object-fit: contain; }
.cover .brand { letter-spacing: .3em; font-weight: 700; font-size: 4mm; margin-top: 2mm; }
.cover .kicker { color: #f5c518; font-size: 2.8mm; letter-spacing: .2em; font-weight: 700; margin-top: 6mm; }
.cover h1 { font-size: 9mm; line-height: 1.1; margin: 3mm 0 5mm; }
.cover h1 span { color: #22c55e; }
.compare { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border: .3mm solid rgba(255,255,255,.2); border-radius: 4mm; overflow: hidden; }
.compare > div { padding: 3.5mm; display: flex; flex-direction: column; }
.compare small { font-size: 2.6mm; text-transform: uppercase; letter-spacing: .1em; opacity: .7; }
.compare .them b { font-size: 8mm; color: #9a9a9a; text-decoration: line-through; }
.compare .us { background: #f5c518; color: #111; }
.compare .us b { font-size: 9mm; }
.hero-caps { display: grid; grid-template-columns: 1fr 1.3fr 1fr; align-items: center; width: 100%; margin: 2mm 0; flex: 1; }
.hero-caps div { aspect-ratio: 1; }
.cover .btn { width: 100%; }
.hint { font-size: 2.8mm; color: #9a9a9a; margin: 3mm 0 0; }

.head h2 { margin: 0; font-size: 7mm; }
.head p { margin: 1mm 0 0; color: #a3a3a3; font-size: 3.2mm; }
.head b { color: #f5c518; }
.filters { display: flex; gap: 1.5mm; flex-wrap: wrap; margin: 3mm 0; }
.filters a { border: .25mm solid rgba(255,255,255,.3); border-radius: 10mm; padding: 1mm 2.5mm; font-size: 2.7mm; }
.index-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6mm; }
.tile { background: #151515; border: .25mm solid rgba(255,255,255,.12); border-radius: 2.5mm; overflow: hidden; }
.tile-pic { position: relative; aspect-ratio: 1.8; background: radial-gradient(circle at 50% 40%, #2a2a2a, #121212 70%); }
.tile-pic svg { object-fit: contain; }
.tile .tag { font-size: 1.7mm; padding: .5mm 1mm; top: 1mm; left: 1mm; }
.tile-name { font-size: 2.6mm; font-weight: 700; padding: 1.2mm 1.5mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile-price { font-size: 2.6mm; font-weight: 800; padding: 0 1.5mm 1.2mm; color: #f5c518; }
.tile-price s { color: #888; font-weight: 400; font-size: 2.2mm; }

.product .nav { display: flex; justify-content: space-between; font-size: 3mm; color: #a3a3a3; margin-bottom: 3mm; }
.product .nav a { color: #f5f5f5; border: .25mm solid rgba(255,255,255,.3); border-radius: 10mm; padding: 1.2mm 3mm; }
.big-pic { position: relative; height: 66mm; border-radius: 4mm; overflow: hidden; background: radial-gradient(circle at 50% 40%, #2c2c2c, #121212 70%); }
.big-pic svg { object-fit: contain; }
.save { position: absolute; bottom: 2.5mm; left: 2.5mm; background: rgba(34,197,94,.18); color: #22c55e; border: .25mm solid rgba(34,197,94,.5); font-weight: 800; font-size: 2.8mm; padding: 1mm 2mm; border-radius: 1.2mm; }
.product .style { margin-top: 4mm; color: #a3a3a3; font-size: 2.8mm; letter-spacing: .14em; text-transform: uppercase; }
.product h2 { margin: 1mm 0 1.5mm; font-size: 7mm; line-height: 1.1; }
.price { display: flex; align-items: baseline; gap: 3mm; }
.price b { font-size: 8mm; color: #f5c518; }
.price span { color: #a3a3a3; font-size: 3mm; }
.desc { color: #c9c9c9; font-size: 3.2mm; line-height: 1.4; margin: 2mm 0; }
.features { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .8mm 3mm; font-size: 2.9mm; }
.features li::before { content: "✓ "; color: #22c55e; font-weight: 800; }
.colors-label { font-size: 2.7mm; color: #a3a3a3; text-transform: uppercase; letter-spacing: .1em; margin-top: 3.5mm; }
.colors { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 1.5mm; }
.color { display: flex; align-items: center; gap: 2mm; border: .25mm solid rgba(255,255,255,.25); border-radius: 3mm; padding: 1mm 2mm 1mm 1mm; font-size: 3mm; font-weight: 600; }
.color .mini { width: 11mm; height: 11mm; border-radius: 2mm; overflow: hidden; background: #1e1e1e; flex: none; }
.color .mini svg { object-fit: contain; }
.pager { display: flex; justify-content: space-between; margin-top: auto; font-size: 3.2mm; font-weight: 700; }
.pager a { padding: 1.5mm 0; }

.how h2 { font-size: 9mm; margin: 4mm 0; }
.how ol { padding-left: 6mm; font-size: 4mm; line-height: 1.5; margin: 0 0 6mm; }
.how li { margin-bottom: 2.5mm; }
.deal { display: grid; gap: 2.5mm; margin-bottom: 4mm; }
.deal div { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; border: .25mm solid rgba(255,255,255,.2); border-radius: 3mm; padding: 3mm 4mm; background: #151515; }
.deal small { color: #a3a3a3; font-size: 3mm; }
.deal b { grid-row: span 2; align-self: center; font-size: 6.5mm; color: #f5c518; }
.deal span { color: #22c55e; font-weight: 700; font-size: 3.2mm; }
.foot { margin-top: auto; display: flex; align-items: center; gap: 2mm; justify-content: center; color: #8a8a8a; font-size: 2.6mm; }
.foot img { width: 6mm; height: 6mm; object-fit: contain; }
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Catálogo de Gorras · Distinto SCZ</title><style>${css}</style></head>
<body>${cover}${index}${products}${howTo}</body></html>`;

(async () => {
  const out = path.join(ROOT, 'Catalogo-Gorras.pdf');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log(`Listo: ${out} (${GORRAS.length + 3} páginas)`);
})();
