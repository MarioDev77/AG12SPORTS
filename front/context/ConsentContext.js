'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CHOICES, loadConsent, saveConsent } from '@/lib/consent';

/**
 * ConsentContext — guarda a escolha de cookies do visitante.
 *
 * Uso em qualquer componente (ex.: antes de carregar uma ferramenta de análise):
 *   const { allowed } = useConsent();
 *   if (allowed.analytics) { ...carrega o script... }
 */
const ConsentContext = createContext(null);

export function ConsentProvider({ children }) {
  const [ready, setReady] = useState(false);       // leitura do cookie concluída
  const [consent, setConsent] = useState(null);    // null = ainda não escolheu
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Leitura do cookie só no cliente (evita divergência de hidratação com o SSR).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(loadConsent());
    setReady(true);
  }, []);

  const save = useCallback((choices) => {
    setConsent(saveConsent(choices));
    setPrefsOpen(false);
  }, []);

  const acceptAll = useCallback(() => save({ analytics: true, marketing: true }), [save]);
  const rejectAll = useCallback(() => save(DEFAULT_CHOICES), [save]);
  const openPreferences = useCallback(() => setPrefsOpen(true), []);
  const closePreferences = useCallback(() => setPrefsOpen(false), []);

  const value = useMemo(
    () => ({
      ready,
      decided: consent !== null,
      allowed: {
        necessary: true,
        analytics: consent ? consent.analytics : false,
        marketing: consent ? consent.marketing : false,
      },
      prefsOpen,
      acceptAll,
      rejectAll,
      save,
      openPreferences,
      closePreferences,
    }),
    [ready, consent, prefsOpen, acceptAll, rejectAll, save, openPreferences, closePreferences]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent deve ser usado dentro de <ConsentProvider>');
  return ctx;
}
