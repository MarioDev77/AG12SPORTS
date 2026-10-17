'use client';

import { useRef } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { useToast } from '@/context/ToastContext';
import { useProducts } from '@/lib/useProducts';

/**
 * Prateleira horizontal de chuteiras de uma marca. Some sozinha se a marca
 * não tiver produtos (evita buraco vazio na home).
 */
export default function BrandShelf({ brand }) {
  const trackRef = useRef(null);
  const showToast = useToast();
  const { products, status } = useProducts({ category: 'chuteiras', brand, sort: 'newest', limit: 10 });

  if (status === 'empty' || status === 'error') return null;

  function step(dir) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const titleId = `shelf-${brand.toLowerCase()}`;

  return (
    <section className="ag-section ag-shelf" aria-labelledby={titleId}>
      <div className="ag-wrap">
        <div className="ag-section-head">
          <h2 id={titleId} className="ag-h2 ag-h2-rule">Chuteiras {brand}</h2>
          <div className="ag-shelf-actions">
            <Link href={`/produtos?cat=chuteiras&brand=${encodeURIComponent(brand)}`} className="ag-link">
              Ver todas
            </Link>
            <div className="ag-arrows">
              <button type="button" className="ag-arrow" onClick={() => step(-1)} aria-label={`Chuteiras ${brand} anteriores`}>
                <iconify-icon className="iconify" icon="mdi:chevron-left" style={{ fontSize: 22 }} />
              </button>
              <button type="button" className="ag-arrow" onClick={() => step(1)} aria-label={`Próximas chuteiras ${brand}`}>
                <iconify-icon className="iconify" icon="mdi:chevron-right" style={{ fontSize: 22 }} />
              </button>
            </div>
          </div>
        </div>

        <div className="ag-shelf-track" ref={trackRef}>
          {status === 'loading'
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="ag-shelf-item ag-shelf-skel" aria-hidden="true" />)
            : products.map((p) => (
                <div key={p.id} className="ag-shelf-item">
                  <ProductCard product={p} onToast={showToast} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
