'use strict';

// Correo que recibe el cliente sobre su pedido (en negro y blanco, como la página).

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function money(n) {
  return 'Bs ' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deliveryText(o) {
  if (o.delivery_method === 'recojo') return 'Recojo en tienda';
  if (o.delivery_method === 'domicilio') return `Envío a domicilio · ${o.client_address || ''}`;
  if (o.delivery_method === 'envio') {
    return `Envío a ${o.delivery_city} · Recibe: ${o.recipient_name} (CI ${o.recipient_ci}, cel. ${o.recipient_phone}) · ${o.client_address || ''}`;
  }
  return '';
}

// kind: 'created' (pedido recibido), 'status' (cambió el estado) o 'paid' (pago confirmado).
function orderEmail(order, kind, link) {
  const status = STATUS_LABELS[order.status] || order.status;
  const firstName = String(order.client_name || '').split(' ')[0];
  let subject;
  let intro;
  if (kind === 'created') {
    subject = `Recibimos tu pedido #${order.id} · Distinto SCZ`;
    intro = order.payment_status === 'pagado'
      ? `Recibimos tu pedido <strong>#${order.id}</strong>. ¡Gracias por tu compra!`
      : `Recibimos tu pedido <strong>#${order.id}</strong>. Para completarlo, paga <strong>${money(order.total)}</strong> con nuestro QR${link ? ' desde el enlace de abajo' : ''} y sube la captura de tu comprobante.`;
  } else if (kind === 'paid') {
    subject = `Pago confirmado · Pedido #${order.id}`;
    intro = `Confirmamos tu pago de <strong>${money(order.total)}</strong>. Ya estamos preparando tu pedido <strong>#${order.id}</strong>.`;
  } else {
    subject = `Tu pedido #${order.id}: ${status}`;
    intro = order.status === 'cancelado'
      ? `Tu pedido <strong>#${order.id}</strong> fue <strong>cancelado</strong>. Si tienes dudas, respóndenos a este correo.`
      : `Tu pedido <strong>#${order.id}</strong> ahora está: <strong>${esc(status)}</strong>.`;
  }

  const rows = order.items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#dddddd">${it.quantity} × ${esc(it.perfume_name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#dddddd;text-align:right;white-space:nowrap">${money(it.unit_price * it.quantity)}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #ffffff;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
        <tr><td style="padding:28px 28px 18px;text-align:center;border-bottom:1px solid #333333">
          <div style="font-family:Georgia,serif;font-size:24px;letter-spacing:6px">DISTINTO SCZ</div>
          <div style="font-family:Georgia,serif;font-style:italic;color:#bbbbbb;margin-top:6px">Tu fragancia, tu sello</div>
        </td></tr>
        <tr><td style="padding:26px 28px">
          <p style="margin:0 0 14px;font-size:16px">Hola ${esc(firstName)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#dddddd">${intro}</p>
          ${order.admin_note && kind === 'status' ? `<p style="margin:0 0 20px;padding:12px 14px;border-left:2px solid #ffffff;color:#dddddd;font-size:14px">${esc(order.admin_note)}</p>` : ''}
          <div style="display:inline-block;margin:0 0 18px;padding:6px 12px;border:1px solid #ffffff;font-size:12px;letter-spacing:2px;text-transform:uppercase">Estado: ${esc(status)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
            ${rows}
            <tr>
              <td style="padding:12px 0 0;font-family:Georgia,serif;font-size:18px">Total</td>
              <td style="padding:12px 0 0;font-family:Georgia,serif;font-size:18px;text-align:right">${money(order.total)}</td>
            </tr>
          </table>
          ${deliveryText(order) ? `<p style="margin:18px 0 0;font-size:13px;color:#bbbbbb"><strong style="color:#ffffff">Entrega:</strong> ${esc(deliveryText(order))}</p>` : ''}
          ${link ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px">
            <tr><td style="background:#ffffff;text-align:center">
              <a href="${esc(link)}" style="display:inline-block;padding:14px 26px;color:#000000;text-decoration:none;font-size:13px;letter-spacing:3px;text-transform:uppercase">Ver mi pedido</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #333333;text-align:center;color:#888888;font-size:12px">
          Distinto SCZ · Santa Cruz
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

module.exports = { orderEmail };
