'use client';

import { useEffect, useState } from 'react';
import CinematicIntro from './CinematicIntro';

const INTRO_SESSION_KEY = 'ag12-intro-seen';

/**
 * Envolve a home da loja e exibe a abertura cinematográfica por cima,
 * apenas uma vez por sessão do navegador. Não altera a estrutura da loja:
 * o conteúdo real (children) continua sendo renderizado normalmente por
 * baixo, a abertura some sozinha assim que termina ou é pulada.
 */
export default function StoreIntroGate({ children }) {
  // `null` = ainda decidindo (evita flash de conteúdo); depois vira boolean.
  const [showIntro, setShowIntro] = useState(null);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(INTRO_SESSION_KEY);
      setShowIntro(!seen);
    } catch {
      // sessionStorage indisponível (ex.: modo privado restrito) — não bloqueia a loja.
      setShowIntro(false);
    }
  }, []);

  function handleFinish() {
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      // ignora — pior caso, a abertura pode repetir numa próxima aba.
    }
    setShowIntro(false);
  }

  return (
    <>
      {children}
      {showIntro && <CinematicIntro onFinish={handleFinish} />}
    </>
  );
}
