'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import ImageLightbox from '@/components/ImageLightbox';
import { OFFERS } from '@/lib/store';

const AUTOPLAY_MS = 4800;
const RESUME_MS = 7000;

/**
 * Carrossel das artes promocionais da loja. Os cards têm a mesma altura e a
 * largura segue a proporção de cada arte (nenhuma é cortada). Passa sozinho,
 * pausa ao tocar/passar o mouse e aceita arrastar. Clicar abre a arte em
 * tela cheia com zoom e botão para o link original.
 *
 * Usado em dois pontos da home (início e meio); `reverse` muda a ordem do
 * segundo para as duas faixas não começarem iguais.
 */
export default function OfferCarousel({ id, title, subtitle, reverse = false }) {
  const items = useMemo(() => (reverse ? [...OFFERS].reverse() : OFFERS), [reverse]);
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const programmaticRef = useRef(false);
  const programmaticTimerRef = useRef(null);
  const [active, setActiveState] = useState(0);
  const activeRef = useRef(0);
  const setActive = useCallback((i) => { activeRef.current = i; setActiveState(i); }, []);
  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const [mounted, setMounted] = useState(false);
  const titleId = `${id}-title`;

  useEffect(() => setMounted(true), []);

  const pauseFor = useCallback((ms = RESUME_MS) => {
    pausedRef.current = true;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => { pausedRef.current = false; }, ms);
  }, []);

  const goTo = useCallback((index) => {
    const el = trackRef.current;
    const slide = el?.children[index];
    if (!el || !slide) return;
    programmaticRef.current = true;
    clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = setTimeout(() => { programmaticRef.current = false; }, 800);
    el.scrollTo({ left: slide.offsetLeft - el.children[0].offsetLeft, behavior: 'smooth' });
    setActive(index);
  }, [setActive]);

  // Autoplay (desligado quando o sistema pede movimento reduzido).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      goTo((activeRef.current + 1) % items.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [goTo, items.length]);

  useEffect(() => () => {
    clearTimeout(resumeTimerRef.current);
    clearTimeout(programmaticTimerRef.current);
  }, []);

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    if (!programmaticRef.current) pauseFor();
    const origin = el.children[0].offsetLeft;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - origin - el.scrollLeft);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    setActive(best);
  }

  function step(dir) {
    pauseFor();
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const lightboxItems = items.map((o) => ({
    src: o.src,
    alt: o.alt,
    cta: { label: o.external ? 'Falar no WhatsApp' : 'Ver produtos', href: o.href, external: o.external },
  }));

  return (
    <section className="ag-offers" id={id} aria-labelledby={titleId}>
      <div className="ag-wrap">
        <div className="ag-section-head">
          <div>
            <h2 id={titleId} className="ag-h2">{title}</h2>
            {subtitle && <p className="ag-sub">{subtitle}</p>}
          </div>
          <div className="ag-arrows">
            <button type="button" className="ag-arrow" onClick={() => step(-1)} aria-label="Ofertas anteriores">
              <iconify-icon className="iconify" icon="mdi:chevron-left" style={{ fontSize: 22 }} />
            </button>
            <button type="button" className="ag-arrow" onClick={() => step(1)} aria-label="Próximas ofertas">
              <iconify-icon className="iconify" icon="mdi:chevron-right" style={{ fontSize: 22 }} />
            </button>
          </div>
        </div>

        <div
          className="ag-offers-track"
          ref={trackRef}
          onScroll={handleScroll}
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => pauseFor(1200)}
          onTouchStart={() => pauseFor()}
          onFocus={() => pauseFor()}
        >
          {items.map((o, i) => (
            <button
              key={o.src}
              type="button"
              className="ag-offer-card"
              style={{ aspectRatio: `${o.w} / ${o.h}` }}
              aria-label={`Ver em tela cheia: ${o.alt}`}
              onClick={() => { pauseFor(); setLightbox({ open: true, index: i }); }}
            >
              <Image src={o.src} alt="" width={o.w} height={o.h} sizes="(max-width: 700px) 78vw, 420px" draggable={false} />
            </button>
          ))}
        </div>

        <div className="ag-dots" role="group" aria-label="Escolher oferta">
          {items.map((o, i) => (
            <button
              key={o.src}
              type="button"
              className={`ag-dot${active === i ? ' is-active' : ''}`}
              aria-label={`Ir para a oferta ${i + 1}`}
              aria-current={active === i ? 'true' : undefined}
              onClick={() => { pauseFor(); goTo(i); }}
            />
          ))}
        </div>
      </div>

      {mounted && lightbox.open && createPortal(
        <ImageLightbox
          items={lightboxItems}
          activeIndex={lightbox.index}
          onClose={() => setLightbox((s) => ({ ...s, open: false }))}
          onNext={() => setLightbox((s) => ({ ...s, index: (s.index + 1) % items.length }))}
          onPrev={() => setLightbox((s) => ({ ...s, index: (s.index - 1 + items.length) % items.length }))}
          onSelect={(index) => setLightbox((s) => ({ ...s, index }))}
        />,
        document.body,
      )}
    </section>
  );
}
