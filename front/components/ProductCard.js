'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWish } from '@/context/WishContext';
import { brl } from '@/lib/format';
import { productImageUrl } from '@/lib/api';
import { fulfillmentOf } from '@/lib/fulfillment.mjs';

/**
 * ProductCard — réplica de renderProductCard() em front/assets/app.js,
 * agora com carrossel de fotos: se o produto tiver mais de uma imagem
 * (product.images, vindo da API), o usuário pode passar entre elas
 * arrastando o dedo (scroll horizontal nativo com snap, funciona no
 * celular) ou pelas setas que aparecem ao passar o mouse (desktop).
 * Clicar no card abre a página do produto. Clicar no coração ou nas
 * setas não navega (stopPropagation), igual ao original.
 */
export default function ProductCard({ product, onToast }) {
  const router = useRouter();
  const { isWished, toggleWish } = useWish();
  const scrollRef = useRef(null);
  const dragStartRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const wished = isWished(product.id);
  const fulfillment = fulfillmentOf(product);
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  // Monta a lista de imagens: usa product.images (API já retorna todas as
  // fotos cadastradas no admin); se não vier nada, cai para a imagem única.
  const images = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    if (product.image) return [{ url: product.image, isPrimary: true }];
    return [];
  }, [product.images, product.image]);

  const hasMultiple = images.length > 1;

  function handleWishClick(e) {
    e.stopPropagation();
    const nowWished = toggleWish(product.id, product);
    if (onToast) {
      onToast(
        nowWished ? `${product.name} salvo nos favoritos ♡` : `${product.name} removido dos favoritos`,
        nowWished ? 'success' : 'info'
      );
    }
  }

  const scrollToIndex = useCallback((index) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = (index + images.length) % images.length;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    setActiveIndex(clamped);
  }, [images.length]);

  function handleArrowClick(e, dir) {
    e.stopPropagation();
    scrollToIndex(activeIndex + dir);
  }

  // Atualiza o dot ativo conforme o usuário arrasta o dedo / rola.
  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex((prev) => (prev !== index ? index : prev));
  }

  // Evita que um arraste (swipe) vire "clique" e navegue para o produto
  // sem querer — só navega se o ponteiro não se moveu de forma relevante.
  function handlePointerDown(e) {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleCardClick(e) {
    const start = dragStartRef.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > 8 || dy > 8) return; // foi um arraste, não um clique
    }
    router.push(`/produto/${product.id}`);
  }

  return (
    <div className="product-card" onPointerDown={handlePointerDown} onClick={handleCardClick}>
      <div className="product-img-wrap">
        <div className="product-badges">
          {fulfillment.pronta && <span className="product-badge ready">Pronta entrega</span>}
          {fulfillment.encomenda && <span className="product-badge order">Encomenda</span>}
          {hasDiscount && <span className="product-badge off">-{discountPct}%</span>}
        </div>
        <button
          type="button"
          className={`wish-btn${wished ? ' wished' : ''}`}
          title={wished ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-label={`Favoritar ${product.name}`}
          onClick={handleWishClick}
        >
          {wished ? '♥' : '♡'}
        </button>

        {images.length > 0 ? (
          <div
            ref={scrollRef}
            className="product-img-scroll"
            onScroll={handleScroll}
            aria-label={hasMultiple ? `Fotos de ${product.name}, arraste para ver mais` : undefined}
          >
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id || i}
                src={productImageUrl(img.url)}
                alt={product.name || 'Produto'}
                loading="lazy"
                draggable={false}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13,
            }}
          >
            Sem imagem
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              className="product-img-nav left"
              aria-label="Foto anterior"
              onClick={(e) => handleArrowClick(e, -1)}
            >
              <iconify-icon className="iconify" icon="mdi:chevron-left" style={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              className="product-img-nav right"
              aria-label="Próxima foto"
              onClick={(e) => handleArrowClick(e, 1)}
            >
              <iconify-icon className="iconify" icon="mdi:chevron-right" style={{ fontSize: 18 }} />
            </button>

            <div className="product-img-dots" onClick={(e) => e.stopPropagation()}>
              {images.map((img, i) => (
                <button
                  key={img.id || i}
                  type="button"
                  className={`product-img-dot${i === activeIndex ? ' active' : ''}`}
                  aria-label={`Ver foto ${i + 1}`}
                  onClick={() => scrollToIndex(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="body">
        <span className="brand">{product.brand || ''}</span>
        <h3 className="name">{product.name || ''}</h3>
        {Array.isArray(product.sizes) && product.sizes.length > 0 && (
          <div className="card-sizes" aria-label="Tamanhos disponíveis">
            {product.sizes.slice(0, 5).map((size) => (
              <span key={size} className="card-size-chip">{size}</span>
            ))}
            {product.sizes.length > 5 && (
              <span className="card-sizes-more">+{product.sizes.length - 5}</span>
            )}
          </div>
        )}
        <div className="price-row">
          {hasDiscount && <span className="price-old">{brl(product.oldPrice)}</span>}
          <span className="price-now">{brl(product.price)}</span>
        </div>
      </div>
    </div>
  );
}
