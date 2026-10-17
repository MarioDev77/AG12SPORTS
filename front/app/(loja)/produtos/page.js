'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import { useProducts } from '@/lib/useProducts';
import { apiRequest } from '@/lib/api';
import { BRANDS, FULFILLMENT, SIZES } from '@/lib/store';

const CATEGORIES = [
  { slug: 'all',        label: 'Tudo' },
  { slug: 'chuteiras',  label: 'Chuteiras' },
  { slug: 'society',    label: 'Society' },
  { slug: 'futsal',     label: 'Futsal' },
  { slug: 'campo',      label: 'Campo' },
  { slug: 'acessorios', label: 'Acessórios' },
  { slug: 'blusas',     label: 'Blusas' },
  { slug: 'kits',       label: 'Kits de treino' },
];

const SORTS = [
  { value: 'newest',     label: 'Mais recentes' },
  { value: 'price_asc',  label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name_asc',   label: 'A–Z' },
];

const TIPO_TO_API = { pronta: 'pronta', encomenda: 'encomenda' };

function ProdutosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // A URL é a fonte de verdade dos filtros: dá para compartilhar o link e o
  // botão voltar do navegador funciona.
  const category = searchParams.get('cat') || 'all';
  const tipo = TIPO_TO_API[searchParams.get('tipo')] || '';
  const brand = searchParams.get('brand') || '';
  const size = searchParams.get('size') || '';
  const search = searchParams.get('q') || '';

  const [sort, setSort] = useState('newest');
  const [inputVal, setInputVal] = useState(search);
  const [brands, setBrands] = useState(BRANDS.map((b) => b.name));

  useEffect(() => { setInputVal(search); }, [search]);

  // Marcas reais do catálogo (a lista fixa serve de reserva se a API falhar).
  useEffect(() => {
    let cancelled = false;
    apiRequest('/products/meta')
      .then((meta) => {
        if (!cancelled && Array.isArray(meta?.brands) && meta.brands.length) setBrands(meta.brands);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function setParams(changes) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || v === 'all') next.delete(k);
      else next.set(k, v);
    });
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { products, status, errorMessage, hasMore, isLoadingMore, loadMore, retry } = useProducts({
    category, sort, search, brand, size, fulfillment: tipo,
  });

  const catLabel = CATEGORIES.find((c) => c.slug === category)?.label || 'Produtos';
  const title = [
    category === 'all' && !brand ? 'Todos os produtos' : null,
    category !== 'all' ? catLabel : null,
    brand || null,
  ].filter(Boolean).join(' ');
  const tipoLabel = FULFILLMENT.find((f) => f.value === tipo)?.label;

  function handleSearchSubmit(e) {
    e.preventDefault();
    setParams({ q: inputVal.trim() });
  }

  const hasFilters = category !== 'all' || tipo || brand || size || search;

  return (
    <section id="productsSection" aria-label="Catálogo de produtos">
      <div className="ag-wrap">
        <header className="ag-catalog-head">
          <h1 className="ag-h1">{title}{tipoLabel ? `, ${tipoLabel.toLowerCase()}` : ''}</h1>
          {tipo && (
            <p className="ag-sub">{FULFILLMENT.find((f) => f.value === tipo).hint}</p>
          )}
        </header>

        <div className="ag-filters">
          <div className="ag-filter-row" role="group" aria-label="Disponibilidade">
            <button type="button" className={`ag-chip${!tipo ? ' is-active' : ''}`} aria-pressed={!tipo} onClick={() => setParams({ tipo: '' })}>
              Todas
            </button>
            {FULFILLMENT.map((f) => (
              <button key={f.value} type="button" className={`ag-chip ag-chip-key${tipo === f.value ? ' is-active' : ''}`} aria-pressed={tipo === f.value} onClick={() => setParams({ tipo: f.value })}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="ag-filter-row" role="group" aria-label="Categoria">
            {CATEGORIES.map((c) => (
              <button key={c.slug} type="button" className={`ag-chip${category === c.slug ? ' is-active' : ''}`} aria-pressed={category === c.slug} onClick={() => setParams({ cat: c.slug, q: '' })}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="ag-filter-row" role="group" aria-label="Marca">
            <button type="button" className={`ag-chip${!brand ? ' is-active' : ''}`} aria-pressed={!brand} onClick={() => setParams({ brand: '' })}>
              Todas as marcas
            </button>
            {brands.map((b) => (
              <button key={b} type="button" className={`ag-chip${brand.toLowerCase() === b.toLowerCase() ? ' is-active' : ''}`} aria-pressed={brand.toLowerCase() === b.toLowerCase()} onClick={() => setParams({ brand: b })}>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="ag-catalog-tools">
          <form className="ag-tool-search" role="search" onSubmit={handleSearchSubmit}>
            <iconify-icon className="iconify ag-search-icon" icon="mdi:magnify" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar nesta lista"
              aria-label="Buscar produto"
              autoComplete="off"
              spellCheck="false"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
          </form>
          <label className="ag-tool">
            <span>Numeração</span>
            <select className="ag-select" value={size} onChange={(e) => setParams({ size: e.target.value })}>
              <option value="">Todas</option>
              {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="ag-tool">
            <span>Ordenar</span>
            <select className="ag-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button type="button" className="ag-link ag-clear" onClick={() => { setInputVal(''); router.replace(pathname, { scroll: false }); }}>
              Limpar filtros
            </button>
          )}
        </div>

        <ProductGrid
          status={status}
          products={products}
          errorMessage={errorMessage}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          onRetry={retry}
        />
      </div>
    </section>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={
      <div style={{ paddingTop: 56, textAlign: 'center', color: 'var(--muted)' }}>
        Carregando…
      </div>
    }>
      <ProdutosContent />
    </Suspense>
  );
}
