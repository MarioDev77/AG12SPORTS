'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, productPrimaryImage } from '@/lib/api';

/**
 * CartContext — réplica fiel de readCart/writeCart/addToCart/etc. do front
 * vanilla (front/assets/app.js). Mesma chave de localStorage, mesma regra
 * de merge por productId+size, mesmo limite de 10 unidades por linha.
 *
 * NOTA DE SEGURANÇA (preservada do original): o item guardado aqui é só
 * um snapshot de exibição (nome, marca, imagem, preço no momento em que foi
 * adicionado). Esse preço NUNCA é enviado como fonte de verdade no checkout
 * — o backend sempre recalcula a partir do preço atual no banco
 * (ver server/src/services/orders.service.js). Isso é o que impede
 * "price tampering" via IDOR; não mudar esse contrato ao editar.
 */
const CART_KEY = 'pitch_cart_v1';
const MAX_QTY_PER_LINE = 10;

const CartContext = createContext(null);

function readCartFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeCartToStorage(items) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* localStorage indisponível (modo privado, quota) — silencioso, como no original */
  }
}

function lineKey(productId, size) {
  return `${productId}:${size || ''}`;
}

export function CartProvider({ children }) {
  // Hidratação client-side: começa vazio no SSR, lê localStorage no mount.
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCartFromStorage());
    setHydrated(true);
  }, []);

  // Carrinhos salvos antes da correção ficaram sem foto: completa uma vez,
  // buscando a foto principal de cada produto que está sem imagem.
  useEffect(() => {
    if (!hydrated) return;
    const missing = [...new Set(readCartFromStorage().filter((it) => !it.image).map((it) => it.productId))];
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        apiRequest(`/products/${id}`)
          .then((data) => [id, productPrimaryImage((data && data.product) || data)])
          .catch(() => [id, ''])
      )
    ).then((pairs) => {
      if (cancelled) return;
      const found = new Map(pairs.filter(([, img]) => img));
      if (found.size === 0) return;
      const next = readCartFromStorage().map((it) => (!it.image && found.has(it.productId) ? { ...it, image: found.get(it.productId) } : it));
      setItems(next);
      writeCartToStorage(next);
    });
    return () => { cancelled = true; };
  }, [hydrated]);

  const persist = useCallback((next) => {
    setItems(next);
    writeCartToStorage(next);
  }, []);

  const addToCart = useCallback(
    (product, size, qty) => {
      const key = lineKey(product.id, size);
      const current = readCartFromStorage();
      const existing = current.find((it) => lineKey(it.productId, it.size) === key);

      let next;
      if (existing) {
        next = current.map((it) =>
          lineKey(it.productId, it.size) === key
            ? { ...it, qty: Math.min(MAX_QTY_PER_LINE, it.qty + qty) }
            : it
        );
      } else {
        next = [
          ...current,
          {
            productId: product.id,
            size: size || null,
            qty: Math.min(MAX_QTY_PER_LINE, qty),
            name: product.name,
            brand: product.brand,
            image: productPrimaryImage(product),
            unitPrice: product.price,
          },
        ];
      }
      persist(next);
    },
    [persist]
  );

  const updateQty = useCallback(
    (productId, size, qty) => {
      const current = readCartFromStorage();
      const next = current.map((it) =>
        it.productId === productId && (it.size || null) === (size || null)
          ? { ...it, qty: Math.max(1, Math.min(MAX_QTY_PER_LINE, qty)) }
          : it
      );
      persist(next);
    },
    [persist]
  );

  const removeFromCart = useCallback(
    (productId, size) => {
      const current = readCartFromStorage();
      const next = current.filter(
        (it) => !(it.productId === productId && (it.size || null) === (size || null))
      );
      persist(next);
    },
    [persist]
  );

  const clearCart = useCallback(() => persist([]), [persist]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const value = { items, hydrated, count, subtotal, addToCart, updateQty, removeFromCart, clearCart };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>');
  return ctx;
}
