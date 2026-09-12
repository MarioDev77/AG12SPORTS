'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ParticleField from './ParticleField';

const BRAND_NAME = 'AG12 SPORTS';
const INTRO_SLOGAN = 'Vista sua paixão pelo esporte.';
const LOGO_SRC = '/ag12-sports-logo.jpeg';

// Duração de cada fase, em milissegundos: escuridão → logo + nome → slogan.
const TIMING = { darkness: 700, logo: 1900, slogan: 1700 };
const TOTAL_DURATION = TIMING.darkness + TIMING.logo + TIMING.slogan;
const EXIT_DURATION = 700;

/**
 * Abertura cinematográfica exibida uma vez por sessão ao entrar na loja:
 * escuridão → logo com brilho pulsante → nome revelado letra a letra →
 * slogan → dissolve para o conteúdo real. Pode ser pulada a qualquer
 * momento. Respeita "prefers-reduced-motion" (entra direto na loja).
 */
export default function CinematicIntro({ onFinish }) {
  const [phase, setPhase] = useState('darkness'); // darkness | logo | slogan
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
    const timers = [];
    let elapsed = TIMING.darkness;
    timers.push(setTimeout(() => setPhase('logo'), elapsed));
    elapsed += TIMING.logo;
    timers.push(setTimeout(() => setPhase('slogan'), elapsed));
    elapsed += TIMING.slogan;
    timers.push(setTimeout(finish, elapsed));
    return () => timers.forEach(clearTimeout);
  }, [ready, reducedMotion, finish]);

  useEffect(() => {
    if (!ready || reducedMotion) return undefined;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min((now - start) / TOTAL_DURATION, 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, reducedMotion]);

  if (!ready || reducedMotion) return null;

  const showLogo = phase === 'logo' || phase === 'slogan';
  const showSlogan = phase === 'slogan';
  const letters = BRAND_NAME.split('');

  return (
    <div
      className={`cinematic-intro${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-label="Abertura AG12 SPORTS"
    >
      <div className="cinematic-intro-vignette" />
      <ParticleField intensity={showLogo ? 1.4 : 1} />
      <div className="cinematic-intro-shadow" />

      {showLogo && (
        <div className="cinematic-intro-content">
          <div className="cinematic-intro-beam" />

          <div className="cinematic-intro-logo-wrap">
            <div className="cinematic-intro-logo-glow" />
            <Image
              src={LOGO_SRC}
              alt={`Logotipo ${BRAND_NAME}`}
              fill
              priority
              sizes="300px"
              className="cinematic-intro-logo"
            />
          </div>

          <div className="cinematic-intro-name" aria-hidden="true">
            {letters.map((char, i) => (
              <span
                key={`${char}-${i}`}
                className={`cinematic-intro-letter${char === ' ' ? ' is-space' : ''}`}
                style={{ animationDelay: `${0.55 + i * 0.05}s` }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </div>
          <span className="cinematic-intro-name-sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {BRAND_NAME}
          </span>

          {showSlogan && <p className="cinematic-intro-slogan">{INTRO_SLOGAN}</p>}
        </div>
      )}

      <button type="button" onClick={finish} className="cinematic-intro-skip">
        Pular introdução
      </button>

      <div className="cinematic-intro-progress-track">
        <div className="cinematic-intro-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
