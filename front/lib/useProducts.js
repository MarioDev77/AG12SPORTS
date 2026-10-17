'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { CHUTEIRA_CATS } from '@/lib/store';
import { fulfillmentOf } from '@/lib/fulfillment.mjs';

const PAGE_LIMIT = 12;

function buildQuery(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * useProducts — réplica de loadProducts/loadMore/buildQuery do front
 * vanilla. Mantém os mesmos parâmetros de query (category, sort, q, page,
 * limit) e a mesma filtragem de imagens válidas.
 */
/**
 * Rede de segurança: se a API ainda for a versão antiga (sem o grupo
 * "chuteiras" nem o filtro de disponibilidade), o front filtra o que chegou
 * para as abas continuarem corretas. Com a API nova isso não remove nada.
 */
function matchesClientFilters(p, category, fulfillment) {
  if (category === 'chuteiras' && p.category && !CHUTEIRA_CATS.includes(p.category)) return false;
  const f = fulfillmentOf(p);
  if (fulfillment && f.known) {
    if (fulfillment === 'pronta' && !f.pronta) return false;
    if (fulfillment === 'encomenda' && !f.encomenda) return false;
  }
  return true;
}

export function useProducts({
  category = 'all', sort = 'newest', search = '',
  brand = '', minPrice = '', maxPrice = '', size = '',
  fulfillment = '', limit = PAGE_LIMIT,
} = {}) {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'empty' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Evita condição de corrida: só aplica a resposta da requisição mais recente.
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (targetPage, append) => {
    const requestId = ++requestIdRef.current;
    if (!append) setStatus('loading');
    else setIsLoadingMore(true);

    try {
      const params = { page: targetPage, limit };
      if (category !== 'all') params.category = category;
      if (sort) params.sort = sort;
      if (search) params.q = search;
      if (brand) params.brand = brand;
      if (minPrice !== '' && minPrice !== null && minPrice !== undefined) params.minPrice = minPrice;
      if (maxPrice !== '' && maxPrice !== null && maxPrice !== undefined) params.maxPrice = maxPrice;
      if (size) params.size = size;
      if (fulfillment) params.fulfillment = fulfillment;

      const data = await apiRequest(`/products${buildQuery(params)}`);
      if (requestId !== requestIdRef.current) return; // resposta obsoleta

      const rawProducts = ((data && data.products) || []).filter((p) => matchesClientFilters(p, category, fulfillment));
      const more = !!(data && data.hasMore);

      setHasMore(more);
      setProducts((prev) => (append ? [...prev, ...rawProducts] : rawProducts));

      if (!append) {
        setStatus(rawProducts.length ? 'ready' : 'empty');
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!append) {
        setStatus('error');
        setErrorMessage(
          err.status === undefined
            ? 'Não foi possível conectar à loja. Verifique sua internet.'
            : 'Não foi possível carregar os produtos. Tente novamente.'
        );
      }
      // Em "carregar mais", o erro é só um toast no componente que consome o hook.
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingMore(false);
    }
  }, [category, sort, search, brand, minPrice, maxPrice, size, fulfillment, limit]);

  // Sempre que filtro/sort/busca mudam, reseta para a página 1.
  useEffect(() => {
    setPage(1);
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort, search, brand, minPrice, maxPrice, size, fulfillment, limit]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [isLoadingMore, hasMore, page, fetchPage]);

  const retry = useCallback(() => fetchPage(1, false), [fetchPage]);

  return { products, status, errorMessage, hasMore, isLoadingMore, loadMore, retry };
}
