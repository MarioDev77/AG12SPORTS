'use strict';

const { pool } = require('../db/pool');

// Whitelist de categorias válidas
const VALID_CATS = new Set(['all', 'society', 'futsal', 'campo', 'tenis', 'acessorios', 'blusas', 'kits', 'chuteiras']);

// "chuteiras" é um grupo (não uma categoria do banco): reúne os três pisos.
const CHUTEIRA_SLUGS = ['society', 'futsal', 'campo'];

// Whitelist de colunas para ORDER BY — evita SQL injection via sort param.
const SORT_MAP = {
  price_asc:  'p.price ASC',
  price_desc: 'p.price DESC',
  name_asc:   'p.name ASC',
  newest:     'p.id DESC',
};

// Colunas retornadas — explícitas (nunca SELECT *).
const PRODUCT_COLS = `
  p.id, p.name, p.brand, c.slug AS category, p.price, p.old_price,
  p.image_url AS image, p.description AS \`desc\`, p.sizes_json AS sizes,
  p.sku, p.weight_grams, p.length_cm, p.width_cm, p.height_cm, p.sold_qty,
  p.available_for_order, p.available_on_request
`;

const FROM_JOIN = `
  FROM products p
  INNER JOIN categories c ON c.id = p.category_id
`;

// Subquery de galeria — agregada em JSON para vir em uma única query.
// COALESCE garante array vazio em vez de NULL quando não há linhas.
const IMAGES_SUBQUERY = `(
  SELECT COALESCE(
    JSON_ARRAYAGG(
      JSON_OBJECT('url', pi.url, 'isPrimary', pi.is_primary, 'sortOrder', pi.sort_order)
    ), JSON_ARRAY()
  )
  FROM (
    SELECT url, is_primary, sort_order
    FROM product_images
    WHERE product_id = p.id
    ORDER BY sort_order ASC, id ASC
  ) pi
) AS images_json`;

/**
 * Lista produtos com filtro de categoria, marca, preço, tamanho, busca por
 * nome, sort e paginação. Retorna { products, total, hasMore } para o front
 * controlar "carregar mais". 100% parametrizado — sem interpolação de
 * strings em SQL.
 */
async function listProducts({
  category, sort = 'newest', q = '', page = 1, limit = 12,
  brand = '', minPrice, maxPrice, size = '', fulfillment = '',
} = {}) {
  const cat      = (category || 'all').toString().trim();
  const useAll   = !VALID_CATS.has(cat) || cat === 'all';
  const useSearch = q && q.trim().length > 0;
  const useBrand  = brand && brand.trim().length > 0;
  const useSize   = size && size.toString().trim().length > 0;

  const orderClause = SORT_MAP[sort] || SORT_MAP.newest;
  const safePage    = Math.max(1, Number(page) || 1);
  const safeLimit   = Math.min(100, Math.max(1, Number(limit) || 12));
  const offset      = (safePage - 1) * safeLimit;

  // ── Monta cláusulas WHERE dinamicamente ─────────────────────────────────
  const conditions = ['p.is_active = 1'];
  const params     = [];

  if (!useAll && cat === 'chuteiras') {
    conditions.push(`c.slug IN (${CHUTEIRA_SLUGS.map(() => '?').join(', ')})`);
    params.push(...CHUTEIRA_SLUGS);
  } else if (!useAll) {
    conditions.push('c.slug = ?');
    params.push(cat);
  }

  // Disponibilidade (independentes; um produto pode ter as duas):
  // "pronta" = estoque liberado para compra no site (available_for_order = 1);
  // "encomenda" = "Disponível para pedidos", sob consulta (available_on_request = 1).
  if (fulfillment === 'pronta') {
    conditions.push('p.available_for_order = 1');
  } else if (fulfillment === 'encomenda') {
    conditions.push('p.available_on_request = 1');
  }

  if (useSearch) {
    // Escapa caracteres especiais do LIKE para evitar wildcards não intencionais
    const safeTerm = q.trim().replace(/[%_\\]/g, '\\$&');
    conditions.push('p.name LIKE ?');
    params.push(`%${safeTerm}%`);
  }

  if (useBrand) {
    conditions.push('p.brand = ?');
    params.push(brand.trim());
  }

  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    conditions.push('p.price >= ?');
    params.push(Number(minPrice));
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    conditions.push('p.price <= ?');
    params.push(Number(maxPrice));
  }

  if (useSize) {
    // sizes_json guarda tamanhos como string ou número — cobre os dois
    // formatos sem exigir migração dos dados já cadastrados.
    const sizeStr = size.toString().trim();
    conditions.push('(JSON_CONTAINS(p.sizes_json, JSON_QUOTE(?)) OR JSON_CONTAINS(p.sizes_json, CAST(? AS JSON)))');
    params.push(sizeStr, sizeStr);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  // ── Count total (para o front saber se há mais páginas) ─────────────────
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total ${FROM_JOIN} ${where}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  // ── Dados paginados ──────────────────────────────────────────────────────
  const [rows] = await pool.query(
    `SELECT ${PRODUCT_COLS}, ${IMAGES_SUBQUERY} ${FROM_JOIN} ${where} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    products: rows.map(mapProduct),
    total,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Metadados para montar os filtros do catálogo: marcas disponíveis, faixa
 * de preço e tamanhos existentes entre os produtos ativos. Tamanhos são
 * calculados em JS (não em SQL) porque sizes_json mistura strings e
 * números conforme cadastrado no admin.
 */
async function getFilterMeta() {
  const [brandRows] = await pool.query(
    `SELECT DISTINCT p.brand FROM products p WHERE p.is_active = 1 AND p.brand <> '' ORDER BY p.brand ASC`
  );
  const [priceRows] = await pool.query(
    `SELECT MIN(p.price) AS min, MAX(p.price) AS max FROM products p WHERE p.is_active = 1`
  );
  const [sizeRows] = await pool.query(
    `SELECT p.sizes_json FROM products p WHERE p.is_active = 1`
  );

  const sizeSet = new Set();
  for (const row of sizeRows) {
    let sizes = row.sizes_json;
    if (typeof sizes === 'string') {
      try { sizes = JSON.parse(sizes || '[]'); } catch { sizes = []; }
    }
    if (Array.isArray(sizes)) sizes.forEach((s) => sizeSet.add(String(s)));
  }

  // Ordena numericamente quando possível (tamanhos de calçado), com
  // fallback alfabético para valores não numéricos.
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return {
    brands: brandRows.map((r) => r.brand),
    sizes,
    priceMin: priceRows[0]?.min == null ? 0 : Number(priceRows[0].min),
    priceMax: priceRows[0]?.max == null ? 0 : Number(priceRows[0].max),
  };
}

/**
 * Busca produto por ID (inteiro positivo já validado no controller).
 */
async function getProductById(id) {
  const [rows] = await pool.query(
    `SELECT ${PRODUCT_COLS}, ${IMAGES_SUBQUERY} ${FROM_JOIN} WHERE p.id = ? AND p.is_active = 1 LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  return mapProduct(rows[0]);
}

// ─── Mapper seguro ─────────────────────────────────────────────────────────────
function mapProduct(r) {
  // mysql2 já devolve colunas JSON como array/objeto JS pronto — rodar
  // JSON.parse() de novo aqui corrompe o valor (ex.: ["43"] vira 43).
  // Só fazemos o parse se, por algum motivo, ainda vier como string.
  let sizes = r.sizes;
  if (typeof sizes === 'string') {
    try { sizes = JSON.parse(sizes || '[]'); } catch { sizes = []; }
  }
  if (!Array.isArray(sizes)) sizes = [];

  let images = [];
  try {
    // images_json já vem como array via JSON_ARRAYAGG; alguns drivers
    // retornam string, outros objeto já parseado — cobre os dois casos.
    images = typeof r.images_json === 'string' ? JSON.parse(r.images_json) : r.images_json;
    if (!Array.isArray(images)) images = [];
  } catch {
    images = [];
  }
  // Fallback: produto sem linha em product_images ainda usa a imagem única.
  if (images.length === 0 && r.image) {
    images = [{ url: r.image, isPrimary: true, sortOrder: 0 }];
  }

  return {
    id:       Number(r.id),
    name:     String(r.name  || ''),
    brand:    String(r.brand || ''),
    category: String(r.category || ''),
    price:    Number(r.price),
    oldPrice: r.old_price == null ? null : Number(r.old_price),
    image:    String(r.image || ''),
    images,
    desc:     String(r.desc  || ''),
    sizes,
    sku:          r.sku == null ? null : String(r.sku),
    weightGrams:  r.weight_grams == null ? null : Number(r.weight_grams),
    dimensions: (r.length_cm == null && r.width_cm == null && r.height_cm == null)
      ? null
      : {
          lengthCm: r.length_cm == null ? null : Number(r.length_cm),
          widthCm:  r.width_cm  == null ? null : Number(r.width_cm),
          heightCm: r.height_cm == null ? null : Number(r.height_cm),
        },
    soldQty: Number(r.sold_qty || 0),
    availableForOrder: !!Number(r.available_for_order || 0),
    availableOnRequest: !!Number(r.available_on_request || 0),
  };
}

module.exports = { listProducts, getProductById, getFilterMeta };