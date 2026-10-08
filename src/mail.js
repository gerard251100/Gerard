'use strict';

// Envío de correos por SMTP (por ejemplo Gmail con una "contraseña de aplicación"),
// sin librerías externas. Soporta SSL directo (puerto 465) y STARTTLS (puerto 587).

const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');
const os = require('node:os');

const TIMEOUT = 20000;

function b64(text) {
  return Buffer.from(String(text), 'utf8').toString('base64');
}

// Encabezado con acentos (RFC 2047).
function encodeHeader(text) {
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${b64(text)}?=`;
}

function buildMessage({ fromName, from, to, subject, html }) {
  const body = b64(html).replace(/.{1,76}/g, '$&\r\n');
  const domain = (from.split('@')[1] || 'localhost').replace(/[^\w.-]/g, '');
  return [
    `From: ${encodeHeader(fromName || from)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

// Conversación SMTP mínima.
function smtpSession(socket) {
  let buffer = '';
  let waiting = null;
  const lines = [];
  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      lines.push(buffer.slice(0, i).replace(/\r$/, ''));
      buffer = buffer.slice(i + 1);
    }
    flush();
  };
  const flush = () => {
    if (!waiting) return;
    // Una respuesta termina en la línea "NNN texto" (sin guion después del código).
    const end = lines.findIndex((l) => /^\d{3}( |$)/.test(l));
    if (end < 0) return;
    const reply = lines.splice(0, end + 1);
    const { resolve } = waiting;
    waiting = null;
    resolve({ code: Number(reply[end].slice(0, 3)), text: reply.join('\n') });
  };
  // Un error o cierre de la conexión rechaza la espera actual (nunca deja caer la página).
  let failure = null;
  const onFail = (err) => {
    failure = failure || err || new Error('la conexion con el servidor de correo se cerro');
    if (waiting) { const { reject } = waiting; waiting = null; reject(failure); }
  };
  const onClose = () => onFail(null);
  socket.on('data', onData);
  socket.on('error', onFail);
  socket.on('close', onClose);
  const read = () => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    waiting = { resolve, reject };
    flush();
  });
  const send = async (line, expect) => {
    if (line !== null) socket.write(line + '\r\n');
    const reply = await read();
    if (expect && !expect.includes(reply.code)) {
      const err = new Error(reply.text.split('\n').pop());
      err.smtpCode = reply.code;
      throw err;
    }
    return reply;
  };
  const detach = () => {
    socket.off('data', onData);
    socket.off('close', onClose);
    socket.off('error', onFail);
    socket.on('error', () => {}); // el socket viejo queda envuelto por TLS
  };
  return { send, detach };
}

function connect({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    // Puerto 465: conexión cifrada desde el inicio. Otros (587): se cifra con STARTTLS.
    const implicitTls = secure ?? Number(port) === 465;
    const socket = implicitTls
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    socket.setTimeout(TIMEOUT, () => socket.destroy(new Error('el servidor de correo no respondio a tiempo')));
    const onError = (err) => reject(err);
    socket.once('error', onError);
    socket.once(implicitTls ? 'secureConnect' : 'connect', () => {
      socket.off('error', onError);
      resolve(socket);
    });
  });
}

async function sendMail(config, { to, subject, html }) {
  const host = config.host || 'smtp.gmail.com';
  const port = Number(config.port) || 465;
  const user = String(config.user || '').trim();
  const pass = String(config.pass || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('Falta configurar el correo de la tienda');

  let socket = await connect({ host, port, secure: config.secure });
  try {
    let smtp = smtpSession(socket);
    const hello = `EHLO ${os.hostname().replace(/[^\w.-]/g, '') || 'distinto-scz'}`;
    await smtp.send(null, [220]);
    let ehlo = await smtp.send(hello, [250]);

    if (!(socket instanceof tls.TLSSocket)) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('el servidor no permite conexion segura');
      await smtp.send('STARTTLS', [220]);
      smtp.detach();
      socket = await new Promise((resolve, reject) => {
        const secure = tls.connect({ socket, servername: host }, () => {
          secure.off('error', reject);
          resolve(secure);
        });
        secure.once('error', reject);
      });
      socket.setTimeout(TIMEOUT, () => socket.destroy(new Error('el servidor de correo no respondio a tiempo')));
      smtp = smtpSession(socket);
      ehlo = await smtp.send(hello, [250]);
    }

    try {
      await smtp.send('AUTH LOGIN', [334]);
      await smtp.send(b64(user), [334]);
      await smtp.send(b64(pass), [235]);
    } catch (err) {
      if (err.smtpCode === 535 || err.smtpCode === 534) {
        throw new Error('Gmail rechazo el usuario o la contrasena de aplicacion');
      }
      throw err;
    }
    await smtp.send(`MAIL FROM:<${user}>`, [250]);
    await smtp.send(`RCPT TO:<${to}>`, [250, 251]);
    await smtp.send('DATA', [354]);
    const message = buildMessage({ fromName: config.name, from: user, to, subject, html })
      .replace(/\r\n\./g, '\r\n..'); // "dot-stuffing"
    await smtp.send(`${message}\r\n.`, [250]);
    await smtp.send('QUIT', [221]).catch(() => {});
  } finally {
    socket.on('error', () => {});
    socket.end();
  }
}

module.exports = { sendMail, buildMessage };
