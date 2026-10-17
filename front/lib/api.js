'use client';

/**
 * lib/api.js — cliente de API.
 *
 * Réplica fiel de apiRequest() em front/assets/app.js. Não inventa nenhum
 * comportamento novo: mesma forma de montar headers, mesmo parse de erro,
 * mesma mensagem de erro de rede em português.
 *
 * IMPORTANTE (decisão confirmada com o usuário): o token JWT continua
 * vivendo apenas em memória (nunca em localStorage/sessionStorage), para
 * manter a mesma postura anti-XSS do front vanilla. Por isso esta função
 * recebe o token como parâmetro em vez de lê-lo de um storage — quem injeta
 * o token é o AuthContext (ver context/AuthContext.js).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'https://lojavirtual-production-2708.up.railway.app/api';

// Resolve caminhos relativos da API para o host correto das imagens.
export function productImageUrl(image) {
  if (!image) return '';
  if (/^(https?:|blob:|data:)/i.test(image)) return image;
  const apiOrigin = API_BASE.replace(/\/api\/?$/, '');
  return image.startsWith('/') ? `${apiOrigin}${image}` : `${apiOrigin}/${image}`;
}

/**
 * Foto principal do produto (caminho/URL cru, sem host). O campo legado
 * `image` costuma vir vazio quando as fotos estão em `images` (product_images),
 * então a principal vem de lá. Para exibir, passe por productImageUrl().
 */
export function productPrimaryImage(product) {
  if (!product) return '';
  if (Array.isArray(product.images) && product.images.length > 0) {
    const primary = product.images.find((img) => img && img.isPrimary) || product.images[0];
    if (primary && primary.url) return primary.url;
  }
  return product.image || '';
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * @param {string} path - caminho relativo, ex: '/products'
 * @param {object} options
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [options.method]
 * @param {object} [options.body] - será serializado como JSON
 * @param {string|null} [options.token] - quando presente, manda Authorization: Bearer
 */
export async function apiRequest(path, { method = 'GET', body, token = null } = {}) {
  const headers = {};
  let payload;

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Não foi possível conectar à loja agora. Verifique sua internet.', undefined);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || 'Algo deu errado. Tente novamente.', res.status);
  }
  return data;
}

/**
 * Upload multipart (usado pelo admin: produtos com imagem, galeria).
 * Não define Content-Type manualmente — o browser monta o boundary correto.
 */
export async function apiUpload(path, { method = 'POST', formData, token = null } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  } catch {
    throw new ApiError('Não foi possível conectar à loja agora. Verifique sua internet.', undefined);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || 'Algo deu errado. Tente novamente.', res.status);
  }
  return data;
}
