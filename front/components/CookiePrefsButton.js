'use client';

import { useConsent } from '@/context/ConsentContext';

/** Link do rodapé que reabre o painel de preferências de cookies. */
export default function CookiePrefsButton({ className }) {
  const { openPreferences } = useConsent();
  return (
    <button type="button" className={className} onClick={openPreferences}>
      Preferências de cookies
    </button>
  );
}
