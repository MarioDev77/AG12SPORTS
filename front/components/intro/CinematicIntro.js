'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const LOGO_SRC = '/ag12-sports-logo.jpeg';

// Arquivos pesados da home que carregam enquanto a barra anda. Assim a
// loja já aparece com o hero pronto, em vez de montar na frente do cliente.
const PRELOAD_IMAGES = ['/assets/img/hero.webp'];

const MIN_DURATION = 1300;   // tempo mínimo da barra, em ms (evita "piscar")
const MAX_DURATION = 3500;   // limite: se a rede estiver lenta, entra assim mesmo
const EXIT_DURATION = 350;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Tela de carregamento exibida uma vez por sessão: logo + barra de progresso
 * fina com porcentagem. A barra acompanha o carregamento real (fontes e
 * imagem do hero); até lá ela segura em 90%. Dura cerca de 1,3 s numa
 * conexão normal e pode ser pulada. Respeita "prefers-reduced-motion"
 * (entra direto na loja).
 */
export default function CinematicIntro({ onFinish }) {
  const [exiting, setExiting] = useState(false);
  const [percent, setPercent] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);
  const assetsReadyRef = useRef(false);

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

  // Pré-carrega imagens e fontes da home.
  useEffect(() => {
    let cancelled = false;
    const tasks = PRELOAD_IMAGES.map(
      (src) => new Promise((resolve) => {
        const img = new window.Image();
        img.onload = resolve;
        img.onerror = resolve; // falhou? não trava a entrada na loja
        img.src = src;
      }),
    );
    if (document.fonts && document.fonts.ready) tasks.push(document.fonts.ready);
    Promise.all(tasks).then(() => {
      if (!cancelled) assetsReadyRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || reducedMotion) return undefined;
    const start = performance.now();
    let raf = 0;

    const tick = (now) => {
      const elapsed = now - start;
      const timeProgress = easeOutCubic(Math.min(elapsed / MIN_DURATION, 1));
      const loaded = assetsReadyRef.current || elapsed >= MAX_DURATION;
      const progress = loaded ? timeProgress : Math.min(timeProgress, 0.9);

      setPercent(Math.round(progress * 100));

      if (loaded && elapsed >= MIN_DURATION) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, reducedMotion, finish]);

  if (!ready || reducedMotion) return null;

  return (
    <div
      className={`intro-loader${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-label="Carregando AG12 Sports"
    >
      <div className="intro-loader-content">
        <div className="intro-loader-logo-wrap">
          <Image
            src={LOGO_SRC}
            alt="AG12 Sports"
            fill
            priority
            sizes="148px"
            className="intro-loader-logo"
          />
        </div>

        <div className="intro-loader-progress">
          <div
            className="intro-loader-bar"
            role="progressbar"
            aria-label="Carregando a loja"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="intro-loader-fill" style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
          <div className="intro-loader-meta" aria-hidden="true">
            <span>Carregando</span>
            <span>{percent}%</span>
          </div>
        </div>
      </div>

      <button type="button" onClick={finish} className="intro-loader-skip">
        Pular
      </button>
    </div>
  );
}
