'use strict';

// Dónde se guardan la base de datos y las imágenes.
//
// Por defecto se usa una carpeta fija en el usuario (~/DistintoSCZ-datos, o en Windows
// %LOCALAPPDATA%\DistintoSCZ-datos si la primera no se puede usar), fuera de la carpeta
// de la página, para que al descargar una versión nueva no se pierda nada.
// En un hosting se puede cambiar con DATA_DIR / UPLOAD_DIR (o STORE_DIR para ambas).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const APP_DIR = path.join(__dirname, '..');

function canWrite(dir) {
  try {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
    const probe = path.join(dir, 'data', '.prueba-escritura');
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

// Algunas computadoras (antivirus, "Acceso controlado a carpetas" de Windows) no dejan
// escribir en la carpeta del usuario. Se prueban varios lugares y se usa el primero que
// funcione; si ya hay datos guardados en alguno, se sigue usando ese.
function chooseStoreDir() {
  if (process.env.STORE_DIR) return process.env.STORE_DIR;
  const candidates = [path.join(os.homedir(), 'DistintoSCZ-datos')];
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'DistintoSCZ-datos'));
  const withData = candidates.find((dir) => fs.existsSync(path.join(dir, 'data', 'perfumeria.db')) && canWrite(dir));
  if (withData) return withData;
  const writable = candidates.find(canWrite);
  if (writable) return writable;
  // Último recurso: dentro de la carpeta de la página (como en las primeras versiones).
  console.log('');
  console.log('  Aviso: Windows no dejo crear la carpeta de datos fuera de la pagina.');
  console.log('  Los datos se guardan en las carpetas "data" y "uploads" de esta carpeta:');
  console.log('  copialas a la carpeta nueva cada vez que descargues una version nueva.');
  return APP_DIR;
}

const STORE_DIR = chooseStoreDir();
const DATA_DIR = process.env.DATA_DIR || path.join(STORE_DIR, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(STORE_DIR, 'uploads');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'perfumeria.db');

const LEGACY_DATA_DIR = path.join(APP_DIR, 'data');
const LEGACY_UPLOAD_DIR = path.join(APP_DIR, 'uploads');
const LEGACY_DB = path.join(LEGACY_DATA_DIR, 'perfumeria.db');

// Una base "vacía" solo tiene la cuenta del administrador: nada que se pueda perder.
function hasContent(file) {
  if (!fs.existsSync(file)) return false;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const count = (sql) => {
      try { return Object.values(db.prepare(sql).get())[0]; } catch { return 0; }
    };
    return count('SELECT COUNT(*) FROM perfumes') + count('SELECT COUNT(*) FROM orders') +
      count("SELECT COUNT(*) FROM users WHERE role = 'vendor'") > 0;
  } finally {
    db.close();
  }
}

// Las versiones anteriores guardaban los datos dentro de la carpeta de la página.
// Si hay datos ahí y la carpeta fija aún no tiene nada, se copian una sola vez.
function adoptLegacyData() {
  if (process.env.DATA_DIR || process.env.DB_FILE || process.env.STORE_DIR) return;
  if (path.resolve(LEGACY_DATA_DIR) === path.resolve(DATA_DIR) || !fs.existsSync(LEGACY_DB)) return;
  const marker = path.join(LEGACY_DATA_DIR, 'YA-TRASLADADO.txt');
  if (fs.existsSync(marker) || !hasContent(LEGACY_DB)) return;
  if (hasContent(DB_FILE)) {
    console.log(`  Aviso: hay datos antiguos en ${LEGACY_DATA_DIR}, pero se usan los de ${DATA_DIR}.`);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(DB_FILE + suffix, { force: true });
    if (fs.existsSync(LEGACY_DB + suffix)) fs.copyFileSync(LEGACY_DB + suffix, DB_FILE + suffix);
  }
  if (!process.env.UPLOAD_DIR && fs.existsSync(LEGACY_UPLOAD_DIR)) {
    fs.cpSync(LEGACY_UPLOAD_DIR, UPLOAD_DIR, { recursive: true, force: false, errorOnExist: false });
  }
  fs.writeFileSync(
    marker,
    `Estos datos se copiaron a ${STORE_DIR} y la pagina ahora usa esa carpeta.\r\n` +
      'Esta copia ya no se usa. Puedes borrarla cuando quieras.\r\n'
  );
  console.log(`  Se trasladaron tus datos a ${STORE_DIR}`);
}

try {
  adoptLegacyData();
} catch (err) {
  console.log(`  Aviso: no se pudieron trasladar los datos antiguos (${err.message}).`);
}
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = { APP_DIR, STORE_DIR, DATA_DIR, UPLOAD_DIR, DB_FILE };
