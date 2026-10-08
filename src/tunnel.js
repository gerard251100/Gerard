'use strict';

// Enlace público temporal con Cloudflare (gratis, sin cuenta), para COMPARTIR.bat.
// Descarga el programa "cloudflared" la primera vez y luego crea el enlace *.trycloudflare.com.

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { spawn, execFileSync } = require('node:child_process');

const TOOLS_DIR = path.join(__dirname, '..', 'tools');
const MIN_SIZE = 10 * 1024 * 1024; // un cloudflared completo pesa más de 30 MB
const RELEASES = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';

function binaryPath() {
  if (process.env.CLOUDFLARED) return process.env.CLOUDFLARED;
  return path.join(TOOLS_DIR, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
}

function assetName() {
  const arm = process.arch === 'arm64';
  if (process.platform === 'win32') return process.arch === 'ia32' ? 'cloudflared-windows-386.exe' : 'cloudflared-windows-amd64.exe';
  if (process.platform === 'darwin') return arm ? 'cloudflared-darwin-arm64.tgz' : 'cloudflared-darwin-amd64.tgz';
  return arm ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
}

// Descarga siguiendo redirecciones y mostrando el porcentaje.
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'distinto-scz' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects > 5) return reject(new Error('demasiadas redirecciones'));
        return resolve(download(new URL(res.headers.location, url).toString(), dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`respuesta ${res.statusCode}`));
      }
      const total = Number(res.headers['content-length']) || 0;
      let received = 0;
      let lastShown = -1;
      const out = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        received += chunk.length;
        const pct = total ? Math.floor((received / total) * 100) : -1;
        const step = total ? Math.floor(pct / 10) : Math.floor(received / (5 * 1024 * 1024));
        if (step !== lastShown) {
          lastShown = step;
          const mb = (received / 1024 / 1024).toFixed(0);
          console.log(total ? `  Descargando Cloudflare: ${pct}% (${mb} MB)` : `  Descargando Cloudflare: ${mb} MB`);
        }
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.setTimeout(60000, () => req.destroy(new Error('la conexion tardo demasiado')));
    req.on('error', reject);
  });
}

async function ensureBinary() {
  const exe = binaryPath();
  if (process.env.CLOUDFLARED) return exe;
  if (fs.existsSync(exe) && fs.statSync(exe).size >= MIN_SIZE) return exe;
  fs.rmSync(exe, { force: true }); // descarga anterior incompleta

  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  const asset = assetName();
  const url = process.env.CLOUDFLARED_URL || RELEASES + asset;
  const part = path.join(TOOLS_DIR, asset + '.part');
  console.log('');
  console.log('  Descargando el programa de Cloudflare (solo la primera vez).');
  console.log('  Puede tardar unos minutos segun tu internet. No cierres esta ventana.');
  try {
    await download(url, part);
    if (asset.endsWith('.tgz')) {
      execFileSync('tar', ['-xzf', part, '-C', TOOLS_DIR]);
      fs.rmSync(part, { force: true });
    } else {
      fs.renameSync(part, exe);
    }
    if (process.platform !== 'win32') fs.chmodSync(exe, 0o755);
  } catch (err) {
    fs.rmSync(part, { force: true });
    throw err;
  }
  if (!fs.existsSync(exe) || fs.statSync(exe).size < MIN_SIZE) {
    fs.rmSync(exe, { force: true });
    throw new Error('el archivo descargado esta incompleto');
  }
  console.log('  Descarga completa.');
  return exe;
}

// Inicia el enlace público. onUrl(url | null) se llama cuando el enlace está listo o se cierra.
async function startTunnel(port, onUrl) {
  let exe;
  try {
    exe = await ensureBinary();
  } catch (err) {
    console.log('');
    console.log(`  No se pudo descargar Cloudflare (${err.message}).`);
    console.log('  Revisa tu conexion a internet y vuelve a abrir COMPARTIR.bat.');
    console.log('  La pagina sigue funcionando en esta computadora.');
    console.log('');
    return;
  }

  console.log('  Creando el enlace publico... (puede tardar unos segundos)');
  let url = null;
  const child = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const waiting = setTimeout(() => {
    if (url) return;
    console.log('');
    console.log('  El enlace publico esta tardando. Revisa tu conexion a internet');
    console.log('  o que el antivirus no bloquee "cloudflared".');
    console.log('');
  }, 45000);
  const onOutput = (chunk) => {
    const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
    if (!match || url) return;
    url = match[0];
    clearTimeout(waiting);
    onUrl(url);
    console.log('');
    console.log('  ============================================');
    console.log('   ENLACE PUBLICO (abre desde cualquier celular,');
    console.log('   con Wi-Fi o con datos moviles):');
    console.log('');
    console.log(`     ${url}`);
    console.log('');
    console.log('   Tambien lo ves en Administracion > Pagos y cuenta.');
    console.log('   Cambia cada vez que abres COMPARTIR.bat y solo');
    console.log('   funciona mientras esta ventana este abierta.');
    console.log('  ============================================');
    console.log('');
  };
  child.stdout.on('data', onOutput);
  child.stderr.on('data', onOutput);
  child.on('error', (err) => console.log(`  No se pudo iniciar Cloudflare: ${err.message}`));
  child.on('exit', (code) => {
    clearTimeout(waiting);
    if (url) console.log('  El enlace publico se cerro.');
    else console.log(`  No se pudo crear el enlace publico (codigo ${code}). Revisa tu conexion a internet.`);
    onUrl(null);
  });
  const stop = () => { try { child.kill(); } catch { /* ya cerrado */ } };
  process.on('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(0); });
}

module.exports = { startTunnel };
