'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProducts } from '@/lib/useProducts';
import { productImageUrl } from '@/lib/api';
import { brl } from '@/lib/format';

const AUTOPLAY_MS = 4500;
const MAX_ITEMS = 8;

const CATEGORY_LABELS = {
  society: 'Society',
  futsal: 'Futsal',
  campo: 'Campo',
  acessorios: 'Acessórios',
  blusas: 'Blusas',
  kits: 'Kits de Treino',
};

function firstImage(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    const primary = product.images.find((img) => img.isPrimary) || product.images[0];
    return productImageUrl(primary.url);
  }
  if (product.image) return productImageUrl(product.image);
  return '';
}

/**
 * Carrossel de destaques do catálogo — um produto por vez, com transição
 * suave, miniaturas e navegação por setas. Usa fotos reais cadastradas no
 * admin (via API/backend da loja), nunca imagens de exemplo.
 */
export default function CatalogSpotlight() {
  const { products, status } = useProducts({ sort: 'newest' });
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const items = useMemo(
    () => products.filter((p) => firstImage(p)).slice(0, MAX_ITEMS),
    [products],
  );
  const count = items.length;

  const go = useCallback(
    (next) => {
      setDirection(next > index ? 1 : -1);
      setIndex(((next % count) + count) % count);
    },
    [index, count],
  );

  const next = useCallback(() => {
    setDirection(1);
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count < 2) return undefined;
    const id = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [next, count]);

  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  if (status === 'loading' || count === 0) return null;

  const item = items[index];
  const hasDiscount = item.oldPrice && item.oldPrice > item.price;
  const categoryLabel = CATEGORY_LABELS[item.category] || item.brand || 'Destaque';

  return (
    <section className="catalog-spotlight-section" aria-label="Destaques do catálogo">
      <div className="section-inner">
        <div className="catalog-spotlight-header">
          <span className="catalog-spotlight-eyebrow">Catálogo</span>
          <h2 className="catalog-spotlight-title">Destaques da coleção</h2>
        </div>

        <div className="catalog-spotlight-card">
          <div className="catalog-spotlight-glow" />

          <div className="catalog-spotlight-stage">
            <div
              key={item.id}
              className="catalog-spotlight-item"
              style={{ '--spotlight-dir': `${direction * 40}px` }}
            >
              <div className="catalog-spotlight-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={firstImage(item)} alt={item.name || 'Produto'} loading="lazy" />
              </div>
              <div className="catalog-spotlight-info">
                <span className="catalog-spotlight-category">{categoryLabel}</span>
                <h3 className="catalog-spotlight-name">{item.name}</h3>
                <div className="catalog-spotlight-price-row">
                  {hasDiscount && <span className="catalog-spotlight-price-old">{brl(item.oldPrice)}</span>}
                  <span className="catalog-spotlight-price-now">{brl(item.price)}</span>
                </div>
              </div>
            </div>

            {count > 1 && (
              <>
                <button
                  type="button"
                  className="catalog-spotlight-arrow left"
                  onClick={prev}
                  aria-label="Produto anterior"
                >
                  <iconify-icon className="iconify" icon="mdi:chevron-left" style={{ fontSize: 20 }} />
                </button>
                <button
                  type="button"
                  className="catalog-spotlight-arrow right"
                  onClick={next}
                  aria-label="Próximo produto"
                >
                  <iconify-icon className="iconify" icon="mdi:chevron-right" style={{ fontSize: 20 }} />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <div className="catalog-spotlight-thumbs">
              {items.map((thumb, i) => (
                <button
                  key={thumb.id}
                  type="button"
                  className={`catalog-spotlight-thumb${i === index ? ' is-active' : ''}`}
                  onClick={() => go(i)}
                  aria-label={`Ver ${thumb.name}`}
                  aria-current={i === index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={firstImage(thumb)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
