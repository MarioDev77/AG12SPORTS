'use client';

import Hero from '@/components/store/Hero';
import OfferCarousel from '@/components/store/OfferCarousel';
import BrandCircles from '@/components/store/BrandCircles';
import FulfillmentTabs from '@/components/store/FulfillmentTabs';
import InfoBanners from '@/components/store/InfoBanners';
import BrandShelf from '@/components/store/BrandShelf';
import CatalogSpotlight from '@/components/store/CatalogSpotlight';
import HelpBlock from '@/components/store/HelpBlock';
import StoreIntroGate from '@/components/intro/StoreIntroGate';
import { BRANDS } from '@/lib/store';

/**
 * Home enxuta, na ordem em que o cliente decide:
 * 1. hero de marca + produto (Mizuno Morelia Neo)
 * 2. ofertas (carrossel do início)
 * 3. filtro por marca
 * 4. chuteiras: abas de pronta entrega e encomenda
 * 5. rastreio, redes sociais e cartão (banners do meio)
 * 6. ofertas (carrossel do meio)
 * 7. prateleira por marca, destaques do catálogo
 * 8. atendimento pelo WhatsApp
 */
export default function HomePage() {
  return (
    <StoreIntroGate>
      <Hero />
      <OfferCarousel
        id="ofertas-inicio"
        title="Ofertas da semana"
        subtitle="Toque na arte para ver em tela cheia."
      />
      <BrandCircles />
      <FulfillmentTabs />
      <InfoBanners />
      <OfferCarousel
        id="ofertas-meio"
        title="Mais para o seu treino"
        subtitle="Camisas, blusas térmicas, shorts e acessórios."
        reverse
      />
      {BRANDS.map((b) => <BrandShelf key={b.name} brand={b.name} />)}
      <CatalogSpotlight />
      <HelpBlock />
    </StoreIntroGate>
  );
}
