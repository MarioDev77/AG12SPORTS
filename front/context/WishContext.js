'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { productPrimaryImage } from '@/lib/api';

/**
 * WishContext — réplica fiel de readWish/writeWish/toggleWish/snapshots do
 * front vanilla. Duas chaves de localStorage, como no original:
 *  - pitch_wish_v1:      array de productId
 *  - pitch_wish_snap_v1: dict { [productId]: { name, brand, image, price } }
 *    usado só para exibir o painel de favoritos sem precisar rebuscar cada
 *    produto na API.
 */
const WISH_KEY = 'pitch_wish_v1';
const WISH_SNAP_KEY = 'pitch_wish_snap_v1';

const WishContext = createContext(null);

function readWishIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeWishIds(ids) {
  try {
    window.localStorage.setItem(WISH_KEY, JSON.stringify(ids));
  } catch {
    /* silencioso, como no original */
  }
}

function readSnapshots() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(WISH_SNAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeSnapshots(snaps) {
  try {
    window.localStorage.setItem(WISH_SNAP_KEY, JSON.stringify(snaps));
  } catch {
    /* silencioso */
  }
}

export function WishProvider({ children }) {
  const [ids, setIds] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(readWishIds());
    setSnapshots(readSnapshots());
    setHydrated(true);
  }, []);

  const isWished = useCallback((productId) => ids.includes(productId), [ids]);

  /**
   * Alterna favorito. productSnapshot é opcional: { id, name, brand, image, price }.
   * Retorna o novo estado (true = favoritado) para quem chamou decidir o toast.
   */
  const toggleWish = useCallback(
    (productId, productSnapshot) => {
      const currentIds = readWishIds();
      const idx = currentIds.indexOf(productId);
      let nextIds;
      let nowWished;

      const currentSnaps = readSnapshots();
      let nextSnaps = currentSnaps;

      if (idx > -1) {
        nextIds = currentIds.filter((id) => id !== productId);
        nextSnaps = { ...currentSnaps };
        delete nextSnaps[productId];
        nowWished = false;
      } else {
        nextIds = [...currentIds, productId];
        if (productSnapshot) {
          nextSnaps = {
            ...currentSnaps,
            [productId]: {
              name: productSnapshot.name,
              brand: productSnapshot.brand,
              image: productPrimaryImage(productSnapshot),
              price: productSnapshot.price,
            },
          };
        }
        nowWished = true;
      }

      writeWishIds(nextIds);
      writeSnapshots(nextSnaps);
      setIds(nextIds);
      setSnapshots(nextSnaps);
      return nowWished;
    },
    []
  );

  const value = { ids, snapshots, hydrated, count: ids.length, isWished, toggleWish };

  return <WishContext.Provider value={value}>{children}</WishContext.Provider>;
}

export function useWish() {
  const ctx = useContext(WishContext);
  if (!ctx) throw new Error('useWish deve ser usado dentro de <WishProvider>');
  return ctx;
}
