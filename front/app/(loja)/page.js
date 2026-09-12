'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import HeroOffers from '@/components/HeroOffers';
import PromoBanner from '@/components/PromoBanner';
import CategoryCarousel from '@/components/CategoryCarousel';
import SizeCarousel from '@/components/SizeCarousel';
import CatalogSpotlight from '@/components/store/CatalogSpotlight';
import StoreIntroGate from '@/components/intro/StoreIntroGate';
import { useProducts } from '@/lib/useProducts';

export default function HomePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { products, status, errorMessage, hasMore, isLoadingMore, loadMore, retry } = useProducts({
    category: 'all',
    sort: 'newest',
  });

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/produtos?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <StoreIntroGate>
      {/* ====== HERO (carrossel de ofertas) ====== */}
      <HeroOffers />

      {/* ====== TRUST BAR ====== */}
      <div id="trustBar" aria-label="Diferenciais">
        <div className="trust-inner">
          <div className="trust-item">
            <iconify-icon className="iconify" icon="mdi:shield-check-outline" />
            Compra segura e garantida
          </div>
          <div className="trust-item">
            <iconify-icon className="iconify" icon="mdi:truck-fast-outline" />
            Entrega para todo o Brasil
          </div>
          <div className="trust-item">
            <iconify-icon className="iconify" icon="mdi:storefront-outline" />
            Loja física e online
          </div>
          <div className="trust-item">
            <iconify-icon className="iconify" icon="mdi:headset" />
            Atendimento especializado
          </div>
        </div>
      </div>

      {/* ====== PROMO BANNER (carrossel deslizante) ====== */}
      <PromoBanner />

      {/* ====== CATEGORIAS (ícones circulares) ====== */}
      <CategoryCarousel />

      {/* ====== NUMERAÇÃO (tamanhos 35 ao 45) ====== */}
      <SizeCarousel />

      {/* ====== DESTAQUES (carrossel spotlight com fotos reais do catálogo) ====== */}
      <CatalogSpotlight />

      {/* ====== PRODUCTS ====== */}
      <section id="productsSection" aria-label="Catálogo de produtos">
        <div className="section-inner">
          <div className="section-header reveal">
            <div>
              <p className="section-eyebrow">Catálogo</p>
              <h2 className="section-title">Todos os Produtos</h2>
            </div>
          </div>

          <div className="catalog-controls">
            <form className="search-bar" role="search" onSubmit={handleSearchSubmit}>
              <iconify-icon className="search-icon iconify" icon="mdi:magnify" aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar produto…"
                aria-label="Buscar produto"
                autoComplete="off"
                spellCheck="false"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
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
    </StoreIntroGate>
  );
}
