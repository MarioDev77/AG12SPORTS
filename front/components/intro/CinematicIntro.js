'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ParticleField from './ParticleField';

const BRAND_NAME = 'AG12 SPORTS';
const INTRO_SLOGAN = 'Vista sua paixão pelo esporte.';
const LOGO_SRC = '/ag12-sports-logo.jpeg';

// Duração total da abertura antes de revelar a loja, em milissegundos
// (o logo, o nome, o slogan e a linha entram todos nesse intervalo,
// com atrasos escalonados definidos no CSS — mesmo comportamento do
// protótipo em public/ag12-abertura.html).
const INTRO_DURATION = 4200;
const EXIT_DURATION = 900;

/**
 * Abertura cinematográfica exibida uma vez por sessão ao entrar na loja:
 * logo com anel dourado e halo pulsante, nome revelado letra a letra,
 * slogan e uma linha decorativa, sobre poeira dourada flutuando no
 * escuro. Pode ser pulada a qualquer momento. Respeita
 * "prefers-reduced-motion" (entra direto na loja).
 */
export default function CinematicIntro({ onFinish }) {
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true);
    setTimeout(onFinish, EXIT_DURATION);
  }, [onFinish]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(reduce);
    setReady(true);
    if (reduce) {
      finishedRef.current = true;
      onFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || reducedMotion) return undefined;
    const timer = setTimeout(finish, INTRO_DURATION);
    return () => clearTimeout(timer);
  }, [ready, reducedMotion, finish]);

  useEffect(() => {
    if (!ready || reducedMotion) return undefined;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min((now - start) / INTRO_DURATION, 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, reducedMotion]);

  if (!ready || reducedMotion) return null;

  const letters = BRAND_NAME.split('');

  return (
    <div
      className={`cinematic-intro${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-label="Abertura AG12 SPORTS"
    >
      <ParticleField />

      <div className="cinematic-intro-content">
        <div className="cinematic-intro-logo-wrap">
          <Image
            src={LOGO_SRC}
            alt={`Logo ${BRAND_NAME}`}
            fill
            priority
            sizes="200px"
            className="cinematic-intro-logo"
          />
        </div>

        <h1 className="cinematic-intro-name" aria-label={BRAND_NAME}>
          {letters.map((char, i) => (
            <span
              key={`${char}-${i}`}
              aria-hidden="true"
              className={`cinematic-intro-letter${char === ' ' ? ' is-space' : ''}`}
              style={{ animationDelay: `${0.6 + i * 0.07}s` }}
            >
              {char === ' ' ? '' : char}
            </span>
          ))}
        </h1>

        <p className="cinematic-intro-slogan">{INTRO_SLOGAN}</p>
        <div className="cinematic-intro-line" aria-hidden="true" />
      </div>

      <div className="cinematic-intro-progress" style={{ width: `${progress * 100}%` }} aria-hidden="true" />

      <button type="button" onClick={finish} className="cinematic-intro-skip">
        Pular introdução
      </button>
    </div>
  );
}
