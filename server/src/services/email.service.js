'use strict';

const nodemailer = require('nodemailer');

// ─── EmailService ───────────────────────────────────────────────────────────
// Só usado para notificar o admin de pedido novo — não envia nada ao cliente
// (o cliente é avisado via WhatsApp, no fluxo de checkout).
//
// Se as variáveis de SMTP não estiverem configuradas, o envio é pulado
// silenciosamente (só loga um aviso) — a criação do pedido NUNCA falha por
// causa de e-mail. Ver .env.example para as variáveis necessárias.

let transporter = null;
let warnedMissingConfig = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    if (!warnedMissingConfig) {
      console.warn('[email] SMTP não configurado (SMTP_HOST/PORT/USER/PASS) — notificações de pedido por e-mail desativadas.');
      warnedMissingConfig = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/**
 * Notifica o admin de um pedido novo. Nunca lança — falha de e-mail não
 * pode derrubar a criação do pedido.
 */
async function notifyNewOrder(order) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return;

  const tx = getTransporter();
  if (!tx) return;

  try {
    await tx.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Novo pedido #${order.id} — ${order.customerName}`,
      text:
        `Pedido #${order.id}\n` +
        `Cliente: ${order.customerName}\n` +
        `Total: R$ ${Number(order.total).toFixed(2)}\n` +
        `Pagamento: ${order.paymentMethod}\n\n` +
        `Acesse o painel administrativo para ver os detalhes e confirmar o pedido.`,
    });
  } catch (e) {
    console.error('[email] Falha ao enviar notificação de pedido novo:', e.message);
  }
}

module.exports = { notifyNewOrder };
