'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import ImageLightbox from '@/components/ImageLightbox';

const WPP_NUMBER = '557598756510';
const AUTOPLAY_MS = 4200;

const OFFERS = [
  {
    src: '/assets/img/ofertas/oferta-camisas-times.jpeg',
    alt: 'Camisas de times — Palmeiras, Flamengo, Lakers e Arsenal',
    href: `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent('Olá! Quero saber mais sobre as camisas de times.')}`,
    external: true,
  },
  {
    src: '/assets/img/ofertas/oferta-blusas-termicas.jpeg',
    alt: 'Blusas térmicas AG12 Sports',
    href: '/produtos?cat=blusas',
  },
  {
    src: '/assets/img/ofertas/oferta-shorts-dryfit.jpeg',
    alt: 'Shorts Dry Fit Premium',
    href: `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent('Olá! Quero saber mais sobre os shorts Dry Fit Premium.')}`,
    external: true,
  },
  {
    src: '/assets/img/ofertas/oferta-necessaire.jpeg',
    alt: 'Necessaire premium AG12 Sports',
    href: '/produtos?cat=acessorios',
  },
];

/**
 * Hero em formato de carrossel de ofertas: cards verticais (proporção 9:16)
 * com as artes promocionais da loja, passando sozinho e também podendo ser
 * arrastado com o dedo/mouse a qualquer momento — mesmo comportamento do
 * PromoBanner, só que como destaque principal da home.
 *
 * Clicar num card abre a arte em tela cheia (mesmo visualizador da galeria
 * de produto, com zoom por roda/pinça), com um botão pra seguir pro link
 * original (produto ou WhatsApp).
 */
export default function HeroOffers() {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const isPausedRef = useRef(false);
  const resumeTimeoutRef = useRef(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const goTo = useCallback((index) => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.children[index];
    if (!slide) return;
    el.scrollTo({ left: slide.offsetLeft - 16, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isPausedRef.current) return;
      setActive((prev) => {
        const next = (prev + 1) % OFFERS.length;
        goTo(next);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [goTo]);

  function pauseThenResume() {
    isPausedRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => { isPausedRef.current = false; }, 6000);
  }

  function handleManualScroll() {
    const el = trackRef.current;
    if (!el) return;
    pauseThenResume();

    let closestIndex = 0;
    let closestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - el.scrollLeft);
      if (dist < closestDist) { closestDist = dist; closestIndex = i; }
    });
    setActive(closestIndex);
  }

  function scrollByAmount(dir) {
    pauseThenResume();
    setActive((prev) => {
      const next = (prev + dir + OFFERS.length) % OFFERS.length;
      goTo(next);
      return next;
    });
  }

  useEffect(() => () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  }, []);

  const lightboxItems = OFFERS.map((o) => ({
    src: o.src,
    alt: o.alt,
    cta: {
      label: o.external ? 'Falar no WhatsApp' : 'Ver produtos',
      href: o.href,
      external: o.external,
    },
  }));

  return (
    <section id="heroOffers" aria-label="Ofertas em destaque">
      <div className="hero-offers-inner">
        <div className="ag12-hero-banner">
          <div className="ag12-hero-copy">
            <span className="ag12-hero-kicker">AG12 SPORTS · PAIXÃO PELO JOGO</span>
            <h1>Entre em campo com <em>atitude.</em></h1>
            <p>Chuteiras, acessórios e estilo esportivo para acompanhar você em cada jogada.</p>
            <div className="ag12-hero-ctas">
              <a href="#productsSection" className="btn-primary">
                <iconify-icon className="iconify" icon="mdi:shoe-cleat" style={{ fontSize: 17 }} />
                Explorar produtos
              </a>
              <a href="/produtos" className="ag12-hero-secondary">Ver catálogo completo <span aria-hidden="true">→</span></a>
            </div>
            <div className="ag12-hero-proof">
              <span><iconify-icon className="iconify" icon="mdi:check-circle-outline" /> Seleção esportiva</span>
              <span><iconify-icon className="iconify" icon="mdi:lightning-bolt-outline" /> Pronto para o jogo</span>
            </div>
          </div>
          <div className="ag12-hero-photo" aria-label="Parede com variedade de chuteiras esportivas" role="img">
            <img src="/assets/img/hero.webp" alt="Variedade de chuteiras AG12 Sports" fetchPriority="high" />
            <div className="ag12-hero-photo-tag"><strong>SEU JOGO.</strong><span>SEU ESTILO.</span></div>
          </div>
          <div className="ag12-hero-glow" aria-hidden="true" />
        </div>
        <p className="hero-offers-eyebrow">Escolhas da semana</p>
        <h2 className="hero-offers-title">Ofertas em destaque</h2>

        <div className="hero-offers-carousel-wrap">
          <button
            type="button"
            className="hero-offers-arrow left"
            onClick={() => scrollByAmount(-1)}
            aria-label="Oferta anterior"
          >
            <iconify-icon className="iconify" icon="mdi:chevron-left" style={{ fontSize: 22 }} />
          </button>

          <div
            className="hero-offers-track"
            ref={trackRef}
            onScroll={handleManualScroll}
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
          >
            {OFFERS.map((o, i) => (
              <button
                key={i}
                type="button"
                className="hero-offers-card"
                aria-label={`Ver ${o.alt} em tela cheia`}
                onClick={() => { pauseThenResume(); setLightboxIndex(i); setLightboxOpen(true); }}
              >
                <Image
                  src={o.src}
                  alt={o.alt}
                  fill
                  sizes="(max-width: 700px) 78vw, 320px"
                  style={{ objectFit: 'cover' }}
                  priority={i === 0}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="hero-offers-arrow right"
            onClick={() => scrollByAmount(1)}
            aria-label="Próxima oferta"
          >
            <iconify-icon className="iconify" icon="mdi:chevron-right" style={{ fontSize: 22 }} />
          </button>
        </div>

        <div className="hero-offers-dots" role="tablist" aria-label="Selecionar oferta">
          {OFFERS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={`Ir para a oferta ${i + 1}`}
              className={`hero-offers-dot${active === i ? ' active' : ''}`}
              onClick={() => { pauseThenResume(); setActive(i); goTo(i); }}
            />
          ))}
        </div>

        <div className="hero-offers-actions">
          <a href="#productsSection" className="btn-primary">
            <iconify-icon className="iconify" icon="mdi:shoe-cleat" style={{ fontSize: 16 }} />
            Ver catálogo
          </a>
          <a
            href={`https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent('Olá! Quero saber mais sobre os produtos.')}`}
            target="_blank"
            rel="noopener"
            className="btn-ghost"
          >
            <iconify-icon className="iconify" icon="mdi:whatsapp" style={{ fontSize: 16 }} />
            Falar no WhatsApp
          </a>
        </div>
      </div>

      {mounted && lightboxOpen && createPortal(
        <ImageLightbox
          items={lightboxItems}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setLightboxIndex((i) => (i + 1) % OFFERS.length)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + OFFERS.length) % OFFERS.length)}
          onSelect={setLightboxIndex}
        />,
        document.body,
      )}
    </section>
  );
}
