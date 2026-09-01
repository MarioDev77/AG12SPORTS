'use strict';

const nodemailer = require('nodemailer');

// ─── EmailService ───────────────────────────────────────────────────────────
// Notifica o admin de pedido novo, e o cliente na criação do pedido e quando
// o rastreio é preenchido. Continua sendo canal de AVISO — a confirmação
// final da compra em si segue via WhatsApp, como o resto do site já faz.
//
// Se as variáveis de SMTP não estiverem configuradas, o envio é pulado
// silenciosamente (só loga um aviso) — a criação/atualização do pedido NUNCA
// falha por causa de e-mail. Ver .env.example para as variáveis necessárias.

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

/**
 * Confirma pro cliente que o pedido foi recebido (status ainda 'pending').
 * Deixa claro que é uma pré-confirmação — o pagamento é validado à parte.
 * Nunca lança — falha de e-mail não pode derrubar a criação do pedido.
 */
async function notifyCustomerOrderReceived(order) {
  if (!order.email) return;

  const tx = getTransporter();
  if (!tx) return;

  try {
    await tx.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: order.email,
      subject: `Recebemos seu pedido #${order.id} — AG12 Sports`,
      text:
        `Olá, ${order.customerName}!\n\n` +
        `Recebemos seu pedido #${order.id}, no valor de R$ ${Number(order.total).toFixed(2)}.\n` +
        `Forma de pagamento: ${order.paymentMethod}.\n\n` +
        `Ele está aguardando confirmação — assim que o pagamento for validado, você recebe um aviso ` +
        `e o pedido passa a aparecer em "Meus pedidos" na sua conta.\n\n` +
        `Qualquer dúvida, é só chamar no WhatsApp da loja.`,
    });
  } catch (e) {
    console.error('[email] Falha ao enviar confirmação de pedido recebido:', e.message);
  }
}

/**
 * Avisa o cliente que o pedido foi enviado, com os dados de rastreio.
 * Chamado quando o admin preenche o código de rastreio no painel.
 * Nunca lança — falha de e-mail não pode derrubar a atualização do pedido.
 */
async function notifyCustomerOrderShipped(order) {
  if (!order.email || !order.tracking?.code) return;

  const tx = getTransporter();
  if (!tx) return;

  const trackingLine = order.tracking.url
    ? `Rastreie em: ${order.tracking.url}`
    : `Código de rastreio: ${order.tracking.code}`;

  try {
    await tx.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: order.email,
      subject: `Seu pedido #${order.id} foi enviado — AG12 Sports`,
      text:
        `Olá, ${order.customerName}!\n\n` +
        `Seu pedido #${order.id} foi enviado` +
        `${order.tracking.carrier ? ` pela ${order.tracking.carrier}` : ''}.\n\n` +
        `${trackingLine}\n` +
        `Código: ${order.tracking.code}\n\n` +
        `Você também pode acompanhar o status em "Meus pedidos" na sua conta.`,
    });
  } catch (e) {
    console.error('[email] Falha ao enviar aviso de pedido enviado:', e.message);
  }
}

module.exports = { notifyNewOrder, notifyCustomerOrderReceived, notifyCustomerOrderShipped };
