/**
 * lib/format.js — helpers de formatação. Réplica fiel de brl() no front
 * vanilla (front/assets/app.js).
 */
export function brl(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Remove tudo que não for dígito. */
export function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

/** Máscara de CEP: 00000-000 */
export function maskCep(value) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

/** Máscara de CPF: 000.000.000-00 */
export function maskCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** Máscara de telefone: (00) 00000-0000 ou (00) 0000-0000 */
export function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)$/, '$1-$2');
}

/** Rótulo em pt-BR e cor de cada status de pedido — usado em "Meus pedidos" e no admin. */
export const ORDER_STATUS_LABELS = {
  pending:    'Aguardando confirmação',
  paid:       'Pago',
  processing: 'Processando',
  shipped:    'Enviado',
  delivered:  'Entregue',
  cancelled:  'Cancelado',
};

export const ORDER_STATUS_COLORS = {
  pending:    '#b45309',
  paid:       '#0f766e',
  processing: '#1d4ed8',
  shipped:    '#7c3aed',
  delivered:  '#15803d',
  cancelled:  '#b91c1c',
};

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}
