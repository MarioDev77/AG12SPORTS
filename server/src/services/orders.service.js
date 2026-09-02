'use strict';

const crypto = require('crypto');
const { pool } = require('../db/pool');
const { calculateShippingEstimate } = require('./shipping.service');
const { notifyNewOrder, notifyCustomerOrderReceived } = require('./email.service');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeCpf(cpfRaw) {
  return cpfRaw.replace(/[.\-\s]/g, '');
}

/**
 * Cria pedido com recálculo de preço/estoque/frete no servidor.
 *
 * SEGURANÇA:
 *  - unitPrice do cliente é IGNORADO — busca preço real no DB
 *  - Estoque validado e reservado por VARIANTE (tamanho), não mais um
 *    stock_qty único do produto — evita duas pessoas comprarem a última
 *    unidade do mesmo tamanho ao mesmo tempo (transação + WHERE
 *    stock >= qty no UPDATE)
 *  - Frete/prazo recalculados no servidor a partir do estado do endereço
 *  - CPF hasheado com pepper antes de persistir (não fica em texto puro)
 *  - Transação atômica com rollback em qualquer falha
 */
async function createOrder(payload, userId) {
  const { customer, address, payment, items } = payload;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const placeholders = productIds.map(() => '?').join(',');

  const [dbProducts] = await pool.query(
    `SELECT id, name, brand, price, is_active, available_for_order FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  // ── Busca as variantes (tamanho/estoque) dos produtos envolvidos ─────────
  const [dbVariants] = await pool.query(
    `SELECT id, product_id, size, stock, active FROM product_variants WHERE product_id IN (${placeholders})`,
    productIds
  );
  const variantMap = new Map(dbVariants.map((v) => [`${v.product_id}:${v.size}`, v]));

  // ── Validações de negócio ─────────────────────────────────────────────────
  for (const item of items) {
    const prod = productMap.get(item.productId);
    if (!prod || !prod.is_active) {
      const err = new Error(`Produto ${item.productId} não disponível`);
      err.status = 422;
      throw err;
    }
    if (!prod.available_for_order) {
      const err = new Error(`Produto "${prod.name}" não está disponível para pedidos`);
      err.status = 422;
      throw err;
    }

    const variant = variantMap.get(`${item.productId}:${item.size}`);
    if (!variant || !variant.active) {
      const err = new Error(`Tamanho ${item.size} indisponível para "${prod.name}"`);
      err.status = 422;
      throw err;
    }
    if (variant.stock < item.qty) {
      const err = new Error('Este tamanho acabou de ficar indisponível.');
      err.status = 422;
      throw err;
    }
  }

  // ── Recalcula subtotal no servidor ────────────────────────────────────────
  let subtotal = 0;
  const enrichedItems = items.map((item) => {
    const prod = productMap.get(item.productId);
    const variant = variantMap.get(`${item.productId}:${item.size}`);
    const unitPrice = Number(prod.price);
    const qty = Number(item.qty);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    return {
      ...item,
      variantId: variant.id,
      unitPrice,
      qty,
      lineTotal,
      productNameSnapshot: prod.name,
      productBrandSnapshot: prod.brand,
    };
  });
  subtotal = Number(subtotal.toFixed(2));

  // ── Frete/prazo recalculados no servidor a partir do endereço ────────────
  // (nunca confia em destinationLat/Lon pra baixar preço/prazo — só pra
  // aumentar quando a distância sugerir isso; ver calculateShippingEstimate)
  const shipping = await calculateShippingEstimate({
    uf: address.state,
    cidade: address.city,
    cep: address.cep,
    destinationLat: address.destinationLat,
    destinationLon: address.destinationLon,
  });
  if (!shipping.available) {
    const err = new Error('Infelizmente ainda não realizamos entregas para este endereço.');
    err.status = 422;
    throw err;
  }
  const total = Number((subtotal + shipping.shippingCost).toFixed(2));

  const cpfNorm = normalizeCpf(customer.cpf);
  const cpfHash = sha256(`${cpfNorm}:${process.env.CPF_PEPPER || 'dev_pepper'}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderResult] = await conn.execute(
      `INSERT INTO orders
        (user_id, customer_name, customer_cpf_hash, email, phone,
         address_cep, address_logradouro, address_numero, address_complemento,
         address_bairro, address_cidade, address_uf,
         payment_method, subtotal_amount, shipping_cost, total_amount,
         estimated_delivery_min_days, estimated_delivery_max_days,
         estimated_delivery_min_date, estimated_delivery_max_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        customer.name,
        cpfHash,
        customer.email,
        customer.phone,
        address.cep,
        address.street,
        address.number,
        address.complement ?? null,
        address.bairro,
        address.city,
        address.state,
        payment.method,
        subtotal,
        shipping.shippingCost,
        total,
        shipping.estimatedMinDays,
        shipping.estimatedMaxDays,
        shipping.estimatedMinDate,
        shipping.estimatedMaxDate,
      ]
    );

    const orderId = orderResult.insertId;

    for (const it of enrichedItems) {
      await conn.execute(
        `INSERT INTO order_items
          (order_id, product_id, product_variant_id, product_name_snapshot, product_brand_snapshot, size, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          it.productId,
          it.variantId,
          it.productNameSnapshot,
          it.productBrandSnapshot,
          String(it.size),
          it.unitPrice,
          it.qty,
          it.lineTotal,
        ]
      );

      // Reserva/decrementa o estoque da variante de forma atômica — o WHERE
      // stock >= ? garante que, mesmo com duas compras simultâneas da última
      // unidade, só uma delas consegue decrementar (affectedRows = 0 na outra).
      const [stockResult] = await conn.execute(
        'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [it.qty, it.variantId, it.qty]
      );
      if (stockResult.affectedRows === 0) {
        const err = new Error('Este tamanho acabou de ficar indisponível.');
        err.status = 409;
        throw err;
      }

      // Mantém products.sizes_json/stock_qty sincronizados (mesma regra
      // usada pelo admin ao editar variantes — etapa18).
      const [remaining] = await conn.query(
        'SELECT size, stock FROM product_variants WHERE product_id = ? AND active = 1',
        [it.productId]
      );
      const sizesWithStock = remaining.filter((v) => v.stock > 0).map((v) => v.size);
      const totalStock = remaining.reduce((sum, v) => sum + v.stock, 0);
      await conn.execute('UPDATE products SET sizes_json = ?, stock_qty = ? WHERE id = ?', [
        JSON.stringify(sizesWithStock),
        totalStock,
        it.productId,
      ]);
    }

    await conn.commit();

    // Notificação por e-mail — fora da transação, nunca bloqueia/derruba o
    // pedido já confirmado se o envio falhar.
    notifyNewOrder({ id: orderId, customerName: customer.name, total, paymentMethod: payment.method }).catch(() => {});
    notifyCustomerOrderReceived({
      id: orderId, customerName: customer.name, email: customer.email, total, paymentMethod: payment.method,
    }).catch(() => {});

    return {
      orderId,
      subtotal,
      shippingCost: shipping.shippingCost,
      total,
      estimatedMinDays: shipping.estimatedMinDays,
      estimatedMaxDays: shipping.estimatedMaxDays,
      estimatedMinDate: shipping.estimatedMinDate,
      estimatedMaxDate: shipping.estimatedMaxDate,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Busca pedido por ID — retorna também user_id para check IDOR no controller.
 */
async function getOrderByIdAndUser(orderId) {
  const [rows] = await pool.query(
    `SELECT o.id, o.user_id, o.status, o.customer_name, o.email, o.phone, o.payment_method,
            o.address_cep, o.address_logradouro, o.address_numero, o.address_complemento,
            o.address_bairro, o.address_cidade, o.address_uf,
            o.subtotal_amount, o.shipping_cost, o.total_amount,
            o.estimated_delivery_min_days, o.estimated_delivery_max_days,
            o.estimated_delivery_min_date, o.estimated_delivery_max_date, o.created_at,
            o.shipment_scope, o.tracking_carrier, o.tracking_code, o.tracking_url,
            o.origin_id, org.name AS origin_name, org.cidade AS origin_cidade, org.uf AS origin_uf,
            JSON_ARRAYAGG(
              JSON_OBJECT(
                'productId', oi.product_id,
                'name', oi.product_name_snapshot,
                'brand', oi.product_brand_snapshot,
                'size', oi.size,
                'unitPrice', oi.unit_price,
                'qty', oi.qty,
                'lineTotal', oi.line_total
              )
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN origins org ON org.id = o.origin_id
     WHERE o.id = ?
     GROUP BY o.id
     LIMIT 1`,
    [orderId]
  );
  if (!rows[0]) return null;

  const row = rows[0];
  let items = [];
  try { items = JSON.parse(row.items || '[]'); } catch { items = []; }

  return {
    id: Number(row.id),
    user_id: row.user_id,
    status: row.status,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    paymentMethod: row.payment_method,
    address: {
      cep: row.address_cep,
      logradouro: row.address_logradouro,
      numero: row.address_numero,
      complemento: row.address_complemento,
      bairro: row.address_bairro,
      cidade: row.address_cidade,
      uf: row.address_uf,
    },
    subtotal: Number(row.subtotal_amount),
    shippingCost: Number(row.shipping_cost),
    total: Number(row.total_amount),
    estimatedMinDays: row.estimated_delivery_min_days,
    estimatedMaxDays: row.estimated_delivery_max_days,
    estimatedMinDate: row.estimated_delivery_min_date ? new Date(row.estimated_delivery_min_date).toISOString().slice(0, 10) : null,
    estimatedMaxDate: row.estimated_delivery_max_date ? new Date(row.estimated_delivery_max_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
    shipmentScope: row.shipment_scope,
    tracking: {
      carrier: row.tracking_carrier,
      code: row.tracking_code,
      url: row.tracking_url,
    },
    origin: row.origin_id ? { id: row.origin_id, name: row.origin_name, cidade: row.origin_cidade, uf: row.origin_uf } : null,
    items,
  };
}

/**
 * Lista os pedidos de um cliente (usado em "Minha conta" > Meus pedidos).
 *
 * IMPORTANTE: pedidos com status 'pending' (aguardando confirmação manual
 * de pagamento pelo admin) NÃO aparecem aqui de propósito — o cliente só
 * vê o pedido em "Meus pedidos" depois que o admin confirma a venda.
 * Antes disso, o pedido já existe no banco e já aparece no painel admin
 * (é assim que o admin sabe que precisa confirmar).
 */
async function getOrdersByUser(userId) {
  const [rows] = await pool.query(
    `SELECT id, status, total_amount, estimated_delivery_min_days, estimated_delivery_max_days, created_at
     FROM orders WHERE user_id = ? AND status <> 'pending' ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    status: r.status,
    total: Number(r.total_amount),
    estimatedMinDays: r.estimated_delivery_min_days,
    estimatedMaxDays: r.estimated_delivery_max_days,
    createdAt: r.created_at,
  }));
}

/**
 * Lista todos os pedidos (admin only — acesso controlado no controller).
 */
async function getAllOrders({ page = 1, limit = 20, status } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT id, customer_name, email, payment_method, total_amount, status, shipment_scope,
            tracking_code, viewed_by_admin, created_at
     FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders ${where}`, params);

  return { orders: rows, total };
}

/** Conta pedidos que o admin ainda não abriu — usado pro contador/notificação. */
async function countUnseenOrders() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM orders WHERE viewed_by_admin = 0');
  return total;
}

async function markOrderViewed(orderId) {
  await pool.execute('UPDATE orders SET viewed_by_admin = 1 WHERE id = ?', [orderId]);
}

async function updateOrderStatus(orderId, status) {
  const [result] = await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  return result.affectedRows > 0;
}

/**
 * Atualiza escopo do envio (nacional/internacional) e/ou dados de rastreio
 * de um pedido. Todos os campos são opcionais — só atualiza o que vier
 * definido, pra não sobrescrever um campo já preenchido com null à toa.
 */
async function updateOrderTracking(orderId, { shipmentScope, trackingCarrier, trackingCode, trackingUrl, originId }) {
  const fields = [];
  const params = [];

  if (shipmentScope !== undefined) { fields.push('shipment_scope = ?'); params.push(shipmentScope); }
  if (trackingCarrier !== undefined) { fields.push('tracking_carrier = ?'); params.push(trackingCarrier || null); }
  if (trackingCode !== undefined) { fields.push('tracking_code = ?'); params.push(trackingCode || null); }
  if (trackingUrl !== undefined) { fields.push('tracking_url = ?'); params.push(trackingUrl || null); }
  if (originId !== undefined) { fields.push('origin_id = ?'); params.push(originId || null); }

  if (!fields.length) return false;

  params.push(orderId);
  const [result] = await pool.execute(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, params);
  return result.affectedRows > 0;
}

module.exports = {
  createOrder,
  getOrderByIdAndUser,
  getOrdersByUser,
  getAllOrders,
  countUnseenOrders,
  markOrderViewed,
  updateOrderStatus,
  updateOrderTracking,
};
