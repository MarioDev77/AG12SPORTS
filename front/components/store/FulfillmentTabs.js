'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ProductGrid from '@/components/ProductGrid';
import { useProducts } from '@/lib/useProducts';
import { FULFILLMENT, wppLink } from '@/lib/store';

/**
 * Duas abas de chuteiras: pronta entrega (em estoque, compra no site) e
 * encomenda (sob consulta). Cada aba mostra os lançamentos daquele grupo e
 * leva ao catálogo completo já filtrado.
 */
export default function FulfillmentTabs() {
  const [tab, setTab] = useState('pronta');
  const tabRefs = useRef({});
  const { products, status, errorMessage, retry } = useProducts({
    category: 'chuteiras',
    fulfillment: tab,
    sort: 'newest',
    limit: 8,
  });
  const current = FULFILLMENT.find((f) => f.value === tab);

  function handleKeyDown(e) {
    const idx = FULFILLMENT.findIndex((f) => f.value === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % FULFILLMENT.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + FULFILLMENT.length) % FULFILLMENT.length;
    if (next === null) return;
    e.preventDefault();
    const value = FULFILLMENT[next].value;
    setTab(value);
    tabRefs.current[value]?.focus();
  }

  return (
    <section className="ag-section" id="chuteiras" aria-labelledby="chuteirasTitle">
      <div className="ag-wrap">
        <div className="ag-section-head">
          <h2 id="chuteirasTitle" className="ag-h2">Chuteiras</h2>
          <div className="ag-tabs" role="tablist" aria-label="Disponibilidade das chuteiras" onKeyDown={handleKeyDown}>
            {FULFILLMENT.map((f) => (
              <button
                key={f.value}
                ref={(el) => { tabRefs.current[f.value] = el; }}
                type="button"
                role="tab"
                id={`tab-${f.value}`}
                aria-selected={tab === f.value}
                aria-controls="chuteirasPanel"
                tabIndex={tab === f.value ? 0 : -1}
                className={`ag-tab${tab === f.value ? ' is-active' : ''}`}
                onClick={() => setTab(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="ag-tab-hint">
          {current.hint}
          {tab === 'encomenda' && (
            <>
              {' '}
              <a href={wppLink('Olá! Quero encomendar uma chuteira.')} target="_blank" rel="noopener">
                Pedir pelo WhatsApp
              </a>
            </>
          )}
        </p>

        <div role="tabpanel" id="chuteirasPanel" aria-labelledby={`tab-${tab}`}>
          <ProductGrid
            status={status}
            products={products}
            errorMessage={errorMessage}
            hasMore={false}
            isLoadingMore={false}
            onLoadMore={() => {}}
            onRetry={retry}
          />
        </div>

        <div className="ag-more-row">
          <Link href={`/produtos?cat=chuteiras&tipo=${tab}`} className="ag-btn ag-btn-ink">
            Ver todas em {current.label.toLowerCase()}
          </Link>
        </div>
      </div>
    </section>
  );
}
