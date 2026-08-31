'use strict';

/**
 * Rotas de administração.
 * Montado em /api/<ADMIN_ROUTE_PREFIX> (padrão: /manage)
 * Requer authJwt + requireRole('admin') em todo o router.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');

const { authJwt } = require('../middlewares/authJwt');
const { requireRole } = require('../middlewares/requireRole');
const { uploadImage, uploadImages, UPLOAD_DIR, MAX_GALLERY_IMAGES } = require('../middlewares/upload');
const { parsePositiveInt } = require('../utils/security');
const { pool } = require('../db/pool');

const router = express.Router();

// Subquery de galeria — mesmo padrão usado no service público (products.service.js).
const IMAGES_SUBQUERY = `(
  SELECT COALESCE(
    JSON_ARRAYAGG(
      JSON_OBJECT('id', pi.id, 'url', pi.url, 'isPrimary', pi.is_primary, 'sortOrder', pi.sort_order)
    ), JSON_ARRAY()
  )
  FROM (
    SELECT id, url, is_primary, sort_order
    FROM product_images
    WHERE product_id = p.id
    ORDER BY sort_order ASC, id ASC
  ) pi
) AS images_json`;

// authJwt + requireRole em TODAS as rotas
router.use(authJwt, requireRole('admin'));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const ProductImageUrlSchema = z.string().max(500).refine(
  (value) => value.startsWith('/uploads/') || value.startsWith('/seed-images/') || /^https?:\/\//i.test(value),
  'Invalid image URL'
);

const ProductSchema = z.object({
  name: z.string().min(2).max(200),
  // Na criação, somente nome, preço e imagem são necessários. Defaults
  // preservam a compatibilidade com as colunas NOT NULL do banco.
  brand: z.string().max(80).optional().default(''),
  category: z.enum(['society', 'futsal', 'campo', 'tenis', 'acessorios', 'blusas', 'kits']).optional().default('society'),
  price: z.number().positive(),
  old_price: z.number().positive().nullable().optional(),
  // image_url: opcional quando há upload de arquivo
  // Uploads internos são caminhos relativos; z.string().url() os rejeitaria.
  image_url: ProductImageUrlSchema.optional(),
  description: z.string().max(2000).optional().default(''),
  sizes_json: z.array(z.union([z.string(), z.number()])).optional().default([]),
  stock_qty: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  // ── Etapa 18: disponibilidade para pedidos (chuteiras/variantes) ──
  available_for_order: z.boolean().optional().default(false),
  // ── Novos campos (etapa 6) — todos opcionais, não quebram payloads antigos ──
  sku: z.string().min(1).max(60).nullable().optional(),
  weight_grams: z.number().int().min(0).nullable().optional(),
  length_cm: z.number().positive().nullable().optional(),
  width_cm: z.number().positive().nullable().optional(),
  height_cm: z.number().positive().nullable().optional(),
});

// ─── Helper: resolve slug de categoria → category_id ─────────────────────────
// Schema usa products.category_id (FK) referenciando categories.id — não
// existe coluna "category" solta em products (ver server/sql/schema.sql).
// O slug já vem validado pelo z.enum no ProductSchema (whitelist fixa),
// então a query abaixo é apenas um lookup seguro, nunca SQL injection.
async function resolveCategoryId(slug) {
  const [rows] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  if (!rows[0]) {
    const err = new Error(`Category "${slug}" not found`);
    err.status = 422;
    throw err;
  }
  return rows[0].id;
}

// ─── Helper: parse body JSON de multipart ────────────────────────────────────
// Quando o upload vem como multipart/form-data os campos chegam como strings
function parseMultipartBody(body) {
  const out = { ...body };
  if (out.price) out.price = Number(out.price);
  if (out.old_price) out.old_price = out.old_price === 'null' ? null : Number(out.old_price);
  if (out.stock_qty) out.stock_qty = Number(out.stock_qty);
  if (out.is_active !== undefined) out.is_active = out.is_active === 'true' || out.is_active === '1';
  if (out.is_featured !== undefined) out.is_featured = out.is_featured === 'true' || out.is_featured === '1';
  if (out.available_for_order !== undefined) out.available_for_order = out.available_for_order === 'true' || out.available_for_order === '1';
  if (out.sizes_json && typeof out.sizes_json === 'string') {
    try { out.sizes_json = JSON.parse(out.sizes_json); } catch { /* deixa falhar no zod */ }
  }
  // ── Novos campos numéricos (etapa 6) — vêm como string em multipart ──
  if (out.weight_grams !== undefined) out.weight_grams = out.weight_grams === '' || out.weight_grams === 'null' ? null : Number(out.weight_grams);
  if (out.length_cm !== undefined)    out.length_cm    = out.length_cm    === '' || out.length_cm    === 'null' ? null : Number(out.length_cm);
  if (out.width_cm !== undefined)     out.width_cm     = out.width_cm     === '' || out.width_cm     === 'null' ? null : Number(out.width_cm);
  if (out.height_cm !== undefined)    out.height_cm    = out.height_cm    === '' || out.height_cm    === 'null' ? null : Number(out.height_cm);
  if (out.sku === '') out.sku = null;
  return out;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
// Limite provisório de "estoque baixo" — 5 unidades. Fica configurável por
// produto quando o campo "estoque mínimo" (prioridade 4 do prompt master)
// for implementado; até lá, usa esse valor fixo pra todos os produtos.
const LOW_STOCK_THRESHOLD = 5;

router.get('/dashboard', async (req, res, next) => {
  try {
    // Um único SELECT com agregações condicionais — evita 8 roundtrips
    // separados ao banco pra montar os cards.
    // "Excluir" no painel é soft delete (is_active = 0) — o produto some
    // da loja mas a linha continua no banco (pra poder ser reativada em
    // /admin/produtos). Pro admin, produto excluído não deve contar como
    // "produto existente": total_products agora = active_products (só o
    // que está de fato visível na loja). inactive_products continua
    // mostrando os soft-deleted que ainda estão no banco (info útil pra
    // saber que dá pra reativar ou apagar de vez com a etapa14).
    // Os demais cards e o gráfico por categoria já contavam só ativos.
    const [[stats]] = await pool.query(`
      SELECT
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)               AS total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)               AS active_products,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END)               AS inactive_products,
        SUM(CASE WHEN is_active = 1 AND old_price IS NOT NULL AND old_price > price THEN 1 ELSE 0 END) AS promo_products,
        SUM(CASE WHEN is_active = 1 AND is_featured = 1 THEN 1 ELSE 0 END)             AS featured_products,
        SUM(CASE WHEN is_active = 1 AND stock_qty = 0 THEN 1 ELSE 0 END)               AS out_of_stock_products,
        SUM(CASE WHEN is_active = 1 AND stock_qty > 0 AND stock_qty <= ? THEN 1 ELSE 0 END) AS low_stock_products
      FROM products
    `, [LOW_STOCK_THRESHOLD]);

    const [[{ total_categories }]] = await pool.query('SELECT COUNT(*) AS total_categories FROM categories');
    const [[{ total_brands }]] = await pool.query(
      `SELECT COUNT(DISTINCT brand) AS total_brands FROM products WHERE brand <> '' AND is_active = 1`
    );

    // Gráfico: quantidade de produtos ATIVOS por categoria
    const [byCategoryRows] = await pool.query(`
      SELECT c.name AS category, COUNT(p.id) AS count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    // Últimos produtos cadastrados (só os ativos — produto excluído some daqui)
    const [recentRows] = await pool.query(`
      SELECT p.id, p.name, p.image_url, c.slug AS category, p.price, p.created_at
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY p.id DESC
      LIMIT 5
    `);

    return res.json({
      totalProducts:      Number(stats.total_products || 0),
      activeProducts:     Number(stats.active_products || 0),
      inactiveProducts:   Number(stats.inactive_products || 0),
      promoProducts:      Number(stats.promo_products || 0),
      featuredProducts:   Number(stats.featured_products || 0),
      outOfStockProducts: Number(stats.out_of_stock_products || 0),
      lowStockProducts:   Number(stats.low_stock_products || 0),
      totalCategories:    Number(total_categories || 0),
      totalBrands:        Number(total_brands || 0),
      byCategory: byCategoryRows.map((r) => ({ category: r.category, count: Number(r.count) })),
      recentProducts: recentRows.map((r) => ({
        id: r.id, name: r.name, image: r.image_url, category: r.category,
        price: Number(r.price), createdAt: r.created_at,
      })),
      // Mantido por compatibilidade com qualquer consumidor antigo do campo.
      total_products: Number(stats.total_products || 0),
    });
  } catch (err) { return next(err); }
});

// ─── Upload de imagem avulso ──────────────────────────────────────────────────
// POST /api/<prefix>/uploads
// Retorna { url } para ser usada no campo image_url do produto
router.post('/uploads', uploadImage, (req, res) => {
  if (!req.uploadedFile)
    return res.status(400).json({ error: 'No image provided' });
  return res.status(201).json({ url: req.uploadedFile.url });
});

// ─── Produtos ─────────────────────────────────────────────────────────────────
router.get('/products', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // ── Filtros opcionais (mesma lógica da loja, mas sem WHERE de status —
    // o painel precisa enxergar TODOS os produtos por padrão) ──────────────
    const conditions = [];
    const params = [];

    const category = (req.query.category || '').toString().trim();
    if (category && category !== 'all') {
      conditions.push('c.slug = ?');
      params.push(category);
    }

    const brand = (req.query.brand || '').toString().trim();
    if (brand) {
      conditions.push('p.brand = ?');
      params.push(brand);
    }

    const minPrice = req.query.minPrice;
    if (minPrice !== undefined && minPrice !== '' && !Number.isNaN(Number(minPrice))) {
      conditions.push('p.price >= ?');
      params.push(Number(minPrice));
    }

    const maxPrice = req.query.maxPrice;
    if (maxPrice !== undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
      conditions.push('p.price <= ?');
      params.push(Number(maxPrice));
    }

    const size = (req.query.size || '').toString().trim();
    if (size) {
      conditions.push('(JSON_CONTAINS(p.sizes_json, JSON_QUOTE(?)) OR JSON_CONTAINS(p.sizes_json, CAST(? AS JSON)))');
      params.push(size, size);
    }

    const status = (req.query.status || '').toString().trim();
    if (status === 'active') conditions.push('p.is_active = 1');
    if (status === 'inactive') conditions.push('p.is_active = 0');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p INNER JOIN categories c ON c.id = p.category_id ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.brand, c.slug AS category, p.price, p.old_price,
              p.image_url, p.description AS \`desc\`, p.sizes_json, p.stock_qty,
              p.is_active, p.is_featured, p.available_for_order, ${IMAGES_SUBQUERY}
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const products = rows.map((r) => {
      // mysql2 já devolve colunas JSON como array/objeto JS pronto — rodar
      // JSON.parse() de novo aqui corrompe o valor (ex.: ["43"] vira 43).
      // Só fazemos o parse se, por algum motivo, ainda vier como string.
      let sizes = r.sizes_json;
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes || '[]'); } catch { sizes = []; }
      }
      if (!Array.isArray(sizes)) sizes = [];

      let images = r.images_json;
      if (typeof images === 'string') {
        try { images = JSON.parse(images || '[]'); } catch { images = []; }
      }
      if (!Array.isArray(images)) images = [];

      // A vitrine usa os nomes image/oldPrice. Manter esse formato também no
      // admin evita previews vazios e campos de edição sem o preço antigo.
      const { sizes_json, images_json, image_url, old_price, ...rest } = r;
      return {
        ...rest,
        image: image_url || '',
        oldPrice: old_price == null ? null : Number(old_price),
        sizes,
        images,
      };
    });
    return res.json({ products, total, hasMore: offset + rows.length < total });
  } catch (err) { return next(err); }
});

// ─── GET /products/meta — dados p/ montar filtros do painel (marca, preço, tamanho) ──
router.get('/products/meta', async (req, res, next) => {
  try {
    const [brandRows] = await pool.query(
      `SELECT DISTINCT brand FROM products WHERE brand <> '' ORDER BY brand ASC`
    );
    const [priceRows] = await pool.query('SELECT MIN(price) AS min, MAX(price) AS max FROM products');
    const [sizeRows] = await pool.query('SELECT sizes_json FROM products');

    const sizeSet = new Set();
    for (const row of sizeRows) {
      let sizes = row.sizes_json;
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes || '[]'); } catch { sizes = []; }
      }
      if (Array.isArray(sizes)) sizes.forEach((s) => sizeSet.add(String(s)));
    }
    const sizes = Array.from(sizeSet).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    return res.json({
      brands: brandRows.map((r) => r.brand),
      sizes,
      priceMin: priceRows[0]?.min == null ? 0 : Number(priceRows[0].min),
      priceMax: priceRows[0]?.max == null ? 0 : Number(priceRows[0].max),
    });
  } catch (err) { return next(err); }
});

// ─── Helper: insere produto + linha inicial em product_images ───────────────
// Centraliza o INSERT (antes duplicado entre o branch multipart e o branch
// JSON puro) e já grava a imagem principal na galeria nova, mantendo
// image_url preenchida para compatibilidade com o front atual.
async function insertProduct(d, categoryId) {
  const [result] = await pool.execute(
    `INSERT INTO products
      (category_id, name, brand, price, old_price, image_url, description, sizes_json,
       stock_qty, is_active, is_featured, available_for_order, sku, weight_grams, length_cm, width_cm, height_cm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      categoryId, d.name, d.brand, d.price, d.old_price ?? null, d.image_url,
      d.description, JSON.stringify(d.sizes_json), d.stock_qty, d.is_active ? 1 : 0, d.is_featured ? 1 : 0,
      d.available_for_order ? 1 : 0,
      d.sku ?? null, d.weight_grams ?? null, d.length_cm ?? null, d.width_cm ?? null, d.height_cm ?? null,
    ]
  );

  if (d.image_url) {
    await pool.execute(
      `INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES (?, ?, 0, 1)`,
      [result.insertId, d.image_url]
    );
  }

  return result.insertId;
}

// POST — suporta JSON puro (image_url) OU multipart/form-data (upload de arquivo)
router.post('/products', (req, res, next) => {
  const ct = req.headers['content-type'] || '';

  // Multipart: tem upload de imagem
  if (ct.includes('multipart/form-data')) {
    return uploadImage(req, res, async () => {
      try {
        const body = parseMultipartBody(req.body);
        if (req.uploadedFile) body.image_url = req.uploadedFile.url;

        const parsed = ProductSchema.safeParse(body);
        if (!parsed.success)
          return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

        const d = parsed.data;
        if (!d.image_url)
          return res.status(400).json({ error: 'image_url or image file required' });

        const categoryId = await resolveCategoryId(d.category);
        const id = await insertProduct(d, categoryId);
        return res.status(201).json({ id });
      } catch (err) { return next(err); }
    });
  }

  // JSON puro: image_url obrigatória no body
  return (async () => {
    try {
      const parsed = ProductSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

      const d = parsed.data;
      if (!d.image_url)
        return res.status(400).json({ error: 'image_url required' });

      const categoryId = await resolveCategoryId(d.category);
      const id = await insertProduct(d, categoryId);
      return res.status(201).json({ id });
    } catch (err) { return next(err); }
  })();
});

// PATCH — atualiza produto, com ou sem nova imagem
router.patch('/products/:id', (req, res, next) => {
  const ct = req.headers['content-type'] || '';

  const doUpdate = async (imageUrl) => {
    try {
      const id = parsePositiveInt(req.params.id, 'product id');

      const rawBody = ct.includes('multipart/form-data')
        ? parseMultipartBody(req.body)
        : req.body;
      if (imageUrl) rawBody.image_url = imageUrl;

      const parsed = ProductSchema.partial().safeParse(rawBody);
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

      const d = parsed.data;
      const fields = [];
      const values = [];

      // Busca a imagem antiga antes do UPDATE. Fazê-lo depois encontra a
      // imagem recém-enviada e a apaga do disco.
      let previousImageUrl = null;
      if (imageUrl) {
        const [[current]] = await pool.query('SELECT image_url FROM products WHERE id = ?', [id]);
        if (!current) return res.status(404).json({ error: 'Not found' });
        previousImageUrl = current.image_url;
      }

      if (d.name !== undefined)        { fields.push('name = ?');        values.push(d.name); }
      if (d.brand !== undefined)       { fields.push('brand = ?');       values.push(d.brand); }
      if (d.category !== undefined)    { fields.push('category_id = ?'); values.push(await resolveCategoryId(d.category)); }
      if (d.price !== undefined)       { fields.push('price = ?');       values.push(d.price); }
      if (d.old_price !== undefined)   { fields.push('old_price = ?');   values.push(d.old_price); }
      if (d.image_url !== undefined)   { fields.push('image_url = ?');   values.push(d.image_url); }
      if (d.description !== undefined) { fields.push('description = ?'); values.push(d.description); }
      if (d.sizes_json !== undefined)  { fields.push('sizes_json = ?');  values.push(JSON.stringify(d.sizes_json)); }
      if (d.stock_qty !== undefined)   { fields.push('stock_qty = ?');   values.push(d.stock_qty); }
      if (d.is_active !== undefined)   { fields.push('is_active = ?');   values.push(d.is_active ? 1 : 0); }
      if (d.is_featured !== undefined) { fields.push('is_featured = ?'); values.push(d.is_featured ? 1 : 0); }
      if (d.available_for_order !== undefined) { fields.push('available_for_order = ?'); values.push(d.available_for_order ? 1 : 0); }
      if (d.sku !== undefined)          { fields.push('sku = ?');          values.push(d.sku); }
      if (d.weight_grams !== undefined) { fields.push('weight_grams = ?'); values.push(d.weight_grams); }
      if (d.length_cm !== undefined)    { fields.push('length_cm = ?');    values.push(d.length_cm); }
      if (d.width_cm !== undefined)     { fields.push('width_cm = ?');     values.push(d.width_cm); }
      if (d.height_cm !== undefined)    { fields.push('height_cm = ?');    values.push(d.height_cm); }

      if (!fields.length)
        return res.status(400).json({ error: 'No fields to update' });

      values.push(id);
      const [result] = await pool.execute(
        `UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ error: 'Not found' });

      // Se subiu nova imagem, apaga a antiga do disco
      if (imageUrl) {
        if (previousImageUrl?.startsWith('/uploads/') && previousImageUrl !== imageUrl) {
          const oldPath = path.join(UPLOAD_DIR, path.basename(previousImageUrl));
          fs.unlink(oldPath, () => {}); // silencia erros
        }

        // Sincroniza galeria: a imagem enviada via PATCH single-image passa a
        // ser a principal (compat com o fluxo antigo de 1 imagem por produto).
        await pool.execute('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [id]);
        await pool.execute(
          'INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES (?, ?, 0, 1)',
          [id, imageUrl]
        );
      }

      return res.json({ updated: true });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  };

  if (ct.includes('multipart/form-data')) {
    return uploadImage(req, res, () => doUpdate(req.uploadedFile?.url));
  }
  return doUpdate(undefined);
});

// ─── Galeria de imagens (etapa 6, ajustada para máx. 5 por produto) ──────────

// POST /manage/products/:id/images — adiciona imagens à galeria, respeitando
// o limite total de MAX_GALLERY_IMAGES por produto (soma do que já existe +
// o que está sendo enviado agora — não é só um limite por chamada).
router.post('/products/:id/images', uploadImages, async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');

    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Not found' });

    if (!req.uploadedFiles || req.uploadedFiles.length === 0)
      return res.status(400).json({ error: 'No images provided' });

    const [[{ existingCount }]] = await pool.query(
      'SELECT COUNT(*) AS existingCount FROM product_images WHERE product_id = ?',
      [id]
    );
    if (Number(existingCount) + req.uploadedFiles.length > MAX_GALLERY_IMAGES) {
      return res.status(422).json({
        error: `Este produto já tem ${existingCount} imagem(ns). O máximo é ${MAX_GALLERY_IMAGES} por produto.`,
      });
    }

    // Próximo sort_order: continua a partir do que já existe na galeria
    const [[{ maxOrder }]] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM product_images WHERE product_id = ?',
      [id]
    );
    // Se o produto ainda não tem nenhuma imagem marcada como principal,
    // a primeira imagem enviada agora assume esse papel.
    const [[{ hasPrimary }]] = await pool.query(
      'SELECT COUNT(*) AS hasPrimary FROM product_images WHERE product_id = ? AND is_primary = 1',
      [id]
    );

    let nextOrder = Number(maxOrder) + 1;
    let primaryAssigned = Number(hasPrimary) > 0;
    const inserted = [];

    for (const file of req.uploadedFiles) {
      const makePrimary = !primaryAssigned;
      const [result] = await pool.execute(
        'INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES (?, ?, ?, ?)',
        [id, file.url, nextOrder, makePrimary ? 1 : 0]
      );
      if (makePrimary) {
        primaryAssigned = true;
        await pool.execute('UPDATE products SET image_url = ? WHERE id = ?', [file.url, id]);
      }
      inserted.push({ id: result.insertId, url: file.url, sortOrder: nextOrder, isPrimary: makePrimary });
      nextOrder += 1;
    }

    return res.status(201).json({ images: inserted });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// PATCH /manage/products/:id/images/:imageId/primary — define uma imagem
// existente como principal (desmarca as demais e sincroniza products.image_url)
router.patch('/products/:id/images/:imageId/primary', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');
    const imageId = parsePositiveInt(req.params.imageId, 'image id');

    const [[image]] = await pool.query(
      'SELECT id, url FROM product_images WHERE id = ? AND product_id = ?',
      [imageId, id]
    );
    if (!image) return res.status(404).json({ error: 'Not found' });

    await pool.execute('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [id]);
    await pool.execute('UPDATE product_images SET is_primary = 1 WHERE id = ?', [imageId]);
    await pool.execute('UPDATE products SET image_url = ? WHERE id = ?', [image.url, id]);

    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// PATCH /manage/products/:id/images/reorder — recebe a nova ordem das
// imagens: { order: [imageId1, imageId2, ...] }. Todas as imagens do
// produto precisam estar na lista.
const ReorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

router.patch('/products/:id/images/reorder', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');

    const parsed = ReorderSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload' });

    const [existing] = await pool.query(
      'SELECT id FROM product_images WHERE product_id = ?',
      [id]
    );
    const existingIds = new Set(existing.map((r) => r.id));
    const sameSet = existingIds.size === parsed.data.order.length &&
      parsed.data.order.every((imgId) => existingIds.has(imgId));
    if (!sameSet)
      return res.status(422).json({ error: 'A lista de ordem não corresponde às imagens do produto' });

    for (let i = 0; i < parsed.data.order.length; i++) {
      await pool.execute(
        'UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?',
        [i, parsed.data.order[i], id]
      );
    }

    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// DELETE /manage/products/:id/images/:imageId — remove uma imagem da galeria
router.delete('/products/:id/images/:imageId', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');
    const imageId = parsePositiveInt(req.params.imageId, 'image id');

    const [[image]] = await pool.query(
      'SELECT id, url, is_primary FROM product_images WHERE id = ? AND product_id = ?',
      [imageId, id]
    );
    if (!image) return res.status(404).json({ error: 'Not found' });

    await pool.execute('DELETE FROM product_images WHERE id = ?', [imageId]);

    // Apaga o arquivo físico se for um upload (não apaga /seed-images, que é versionado)
    if (image.url?.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(image.url)), () => {});
    }

    // Se a imagem removida era a principal, promove a próxima da fila (se houver)
    if (image.is_primary) {
      const [[next]] = await pool.query(
        'SELECT id, url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1',
        [id]
      );
      if (next) {
        await pool.execute('UPDATE product_images SET is_primary = 1 WHERE id = ?', [next.id]);
        await pool.execute('UPDATE products SET image_url = ? WHERE id = ?', [next.url, id]);
      } else {
        // products.image_url é NOT NULL — string vazia sinaliza "sem imagem"
        // pro front (productImageUrl trata '' como ausência de imagem).
        await pool.execute("UPDATE products SET image_url = '' WHERE id = ?", [id]);
      }
    }

    return res.json({ deleted: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ── Variantes de tamanho/estoque (etapa 18) ────────────────────────────────
// Sempre que as variantes de um produto mudam, sizes_json e stock_qty são
// recalculados a partir delas — nenhum outro lugar do sistema (storefront,
// filtros, dashboard) precisa mudar pra continuar lendo esses dois campos.
async function syncProductAggregatesFromVariants(conn, productId) {
  const [variants] = await conn.query(
    'SELECT size, stock FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY id ASC',
    [productId]
  );
  const sizesWithStock = variants.filter((v) => v.stock > 0).map((v) => v.size);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  await conn.execute(
    'UPDATE products SET sizes_json = ?, stock_qty = ? WHERE id = ?',
    [JSON.stringify(sizesWithStock), totalStock, productId]
  );
}

const VariantSchema = z.object({
  size: z.string().trim().min(1).max(20),
  stock: z.coerce.number().int().min(0),
  active: z.boolean().optional().default(true),
  sku: z.string().trim().max(60).optional().nullable(),
});

router.get('/products/:id/variants', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');
    const [rows] = await pool.query(
      'SELECT id, size, sku, stock, active FROM product_variants WHERE product_id = ? ORDER BY id ASC',
      [id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// PUT — substitui o conjunto inteiro de variantes do produto (é assim que o
// admin edita: uma lista de linhas tamanho+estoque, salvas juntas). Roda em
// transação: se algo falhar, nada é gravado.
router.put('/products/:id/variants', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parsePositiveInt(req.params.id, 'product id');

    const [[product]] = await conn.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    const rawList = Array.isArray(req.body?.variants) ? req.body.variants : [];
    const parsed = rawList.map((v) => VariantSchema.parse(v));

    const sizesSeen = new Set();
    for (const v of parsed) {
      if (sizesSeen.has(v.size)) {
        return res.status(400).json({ error: `Tamanho duplicado: ${v.size}` });
      }
      sizesSeen.add(v.size);
    }

    await conn.beginTransaction();

    await conn.execute('DELETE FROM product_variants WHERE product_id = ?', [id]);
    for (const v of parsed) {
      await conn.execute(
        'INSERT INTO product_variants (product_id, size, sku, stock, active) VALUES (?, ?, ?, ?, ?)',
        [id, v.size, v.sku || null, v.stock, v.active ? 1 : 0]
      );
    }

    await syncProductAggregatesFromVariants(conn, id);

    await conn.commit();

    const [rows] = await conn.query(
      'SELECT id, size, sku, stock, active FROM product_variants WHERE product_id = ? ORDER BY id ASC',
      [id]
    );
    return res.json(rows);
  } catch (err) {
    await conn.rollback();
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Variante inválida', details: err.errors });
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  } finally {
    conn.release();
  }
});

// DELETE — soft delete
// DELETE /manage/products — desativa TODOS os produtos de uma vez (mesmo
// soft delete usado na exclusão individual: is_active = 0). Ação em massa,
// então exige um corpo de confirmação explícito pra não disparar por engano
// (ex.: um DELETE sem corpo vindo de algum client mal configurado).
router.delete('/products', async (req, res, next) => {
  try {
    if (req.body?.confirm !== 'DELETE_ALL') {
      return res.status(400).json({ error: 'Confirmação obrigatória: envie { "confirm": "DELETE_ALL" } no corpo da requisição.' });
    }
    const [result] = await pool.execute('UPDATE products SET is_active = 0 WHERE is_active = 1');
    return res.json({ deleted: true, count: result.affectedRows });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');
    const [result] = await pool.execute(
      'UPDATE products SET is_active = 0 WHERE id = ?', [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── Usuários ─────────────────────────────────────────────────────────────────
// ── Pedidos (etapa 19) ──────────────────────────────────────────────────────
const { getAllOrders, getOrderByIdAndUser, countUnseenOrders, markOrderViewed, updateOrderStatus } = require('../services/orders.service');

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

// GET /manage/orders/unseen-count — pro sininho/contador de notificação no painel
router.get('/orders/unseen-count', async (req, res, next) => {
  try {
    const count = await countUnseenOrders();
    return res.json({ count });
  } catch (err) { return next(err); }
});

router.get('/orders', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = (req.query.status || '').toString().trim() || undefined;
    const { orders, total } = await getAllOrders({ page, limit, status });
    return res.json({ orders, total });
  } catch (err) { return next(err); }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'order id');
    const order = await getOrderByIdAndUser(id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    return res.json({ order });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// PATCH /manage/orders/:id/viewed — marca como visto (limpa a notificação)
router.patch('/orders/:id/viewed', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'order id');
    await markOrderViewed(id);
    return res.json({ viewed: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'order id');
    const status = (req.body?.status || '').toString();
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Use um de: ${ORDER_STATUSES.join(', ')}` });
    }
    const updated = await updateOrderStatus(id, status);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ updated: true, status });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ── Regras de frete (etapa 19) ──────────────────────────────────────────────
const ShippingRegionSchema = z.object({
  uf: z.string().trim().regex(/^([A-Za-z]{2}|\*)$/, 'UF inválida (sigla de 2 letras, ou * para regra padrão)').transform((v) => v.toUpperCase()),
  delivery_min_days: z.coerce.number().int().min(0),
  delivery_max_days: z.coerce.number().int().min(0),
  shipping_cost: z.coerce.number().min(0),
  active: z.boolean().optional().default(true),
});

router.get('/shipping-regions', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, uf, delivery_min_days, delivery_max_days, shipping_cost, active FROM shipping_regions ORDER BY (uf = "*") ASC, uf ASC'
    );
    return res.json(rows);
  } catch (err) { return next(err); }
});

router.post('/shipping-regions', async (req, res, next) => {
  try {
    const parsed = ShippingRegionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const d = parsed.data;
    const [result] = await pool.execute(
      `INSERT INTO shipping_regions (uf, delivery_min_days, delivery_max_days, shipping_cost, active)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         delivery_min_days = VALUES(delivery_min_days),
         delivery_max_days = VALUES(delivery_max_days),
         shipping_cost = VALUES(shipping_cost),
         active = VALUES(active)`,
      [d.uf, d.delivery_min_days, d.delivery_max_days, d.shipping_cost, d.active ? 1 : 0]
    );
    return res.status(201).json({ id: result.insertId || undefined, ...d });
  } catch (err) { return next(err); }
});

router.patch('/shipping-regions/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'shipping region id');
    const parsed = ShippingRegionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const d = parsed.data;

    const fields = [];
    const values = [];
    if (d.uf !== undefined) { fields.push('uf = ?'); values.push(d.uf); }
    if (d.delivery_min_days !== undefined) { fields.push('delivery_min_days = ?'); values.push(d.delivery_min_days); }
    if (d.delivery_max_days !== undefined) { fields.push('delivery_max_days = ?'); values.push(d.delivery_max_days); }
    if (d.shipping_cost !== undefined) { fields.push('shipping_cost = ?'); values.push(d.shipping_cost); }
    if (d.active !== undefined) { fields.push('active = ?'); values.push(d.active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });

    values.push(id);
    const [result] = await pool.execute(`UPDATE shipping_regions SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, name, username, email, phone, role, is_active, created_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return res.json({ users: rows });
  } catch (err) { return next(err); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'user id');
    const parsed = z.object({ role: z.enum(['user', 'admin']) }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid role' });

    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [parsed.data.role, id]);
    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'user id');
    const parsed = z.object({ is_active: z.boolean() }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload' });

    await pool.execute(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [parsed.data.is_active ? 1 : 0, id]
    );
    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;