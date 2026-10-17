'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useConsent } from '@/context/ConsentContext';

const OPTIONAL = [
  {
    key: 'analytics',
    title: 'Estatísticas',
    text: 'Ajudam a entender como a loja é usada para melhorá-la. Hoje a loja não usa nenhuma ferramenta de análise.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    text: 'Permitiriam anúncios e ofertas personalizadas. Hoje a loja não usa nenhum cookie de marketing.',
  },
];

function PreferencesDialog() {
  const { allowed, save, rejectAll, acceptAll, closePreferences } = useConsent();
  const [choices, setChoices] = useState({ analytics: allowed.analytics, marketing: allowed.marketing });
  const dialogRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closePreferences(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
    };
  }, [closePreferences]);

  return (
    <div className="ag-ck-overlay" onClick={closePreferences}>
      <div
        className="ag-ck-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ag-ck-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ag-ck-title">Preferências de cookies</h2>
        <p className="ag-ck-lead">
          Escolha quais cookies podem ser usados. Você pode mudar isso quando quiser, pelo link
          “Preferências de cookies” no rodapé. Detalhes na <Link href="/privacidade">Política de Privacidade</Link>.
        </p>

        <div className="ag-ck-row">
          <div>
            <strong>Necessários</strong>
            <p>Mantêm carrinho, favoritos e a sua escolha de cookies. A loja não funciona sem eles.</p>
          </div>
          <span className="ag-ck-always">Sempre ativos</span>
        </div>

        {OPTIONAL.map((o) => (
          <div className="ag-ck-row" key={o.key}>
            <div>
              <strong id={`ck-${o.key}`}>{o.title}</strong>
              <p>{o.text}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={choices[o.key]}
              aria-labelledby={`ck-${o.key}`}
              className={`ag-ck-switch${choices[o.key] ? ' is-on' : ''}`}
              onClick={() => setChoices((c) => ({ ...c, [o.key]: !c[o.key] }))}
            />
          </div>
        ))}

        <div className="ag-ck-actions">
          <button type="button" className="ag-ck-btn ag-ck-btn--ghost" onClick={rejectAll}>Rejeitar opcionais</button>
          <button type="button" className="ag-ck-btn ag-ck-btn--ghost" onClick={() => save(choices)}>Salvar escolhas</button>
          <button type="button" className="ag-ck-btn ag-ck-btn--solid" onClick={acceptAll}>Aceitar todos</button>
        </div>
      </div>
    </div>
  );
}

export default function CookieBanner() {
  const { ready, decided, prefsOpen, acceptAll, rejectAll, openPreferences } = useConsent();

  if (!ready) return null;

  return (
    <>
      {!decided && !prefsOpen && (
        <div className="ag-ck-banner" role="region" aria-label="Aviso de cookies">
          <p>
            Usamos cookies necessários para a loja funcionar (carrinho e favoritos) e, com a sua permissão,
            outros para estatísticas e marketing. Veja a <Link href="/privacidade">Política de Privacidade</Link>.
          </p>
          <div className="ag-ck-actions">
            <button type="button" className="ag-ck-btn ag-ck-btn--ghost" onClick={openPreferences}>Personalizar</button>
            <button type="button" className="ag-ck-btn ag-ck-btn--ghost" onClick={rejectAll}>Rejeitar opcionais</button>
            <button type="button" className="ag-ck-btn ag-ck-btn--solid" onClick={acceptAll}>Aceitar todos</button>
          </div>
        </div>
      )}
      {prefsOpen && <PreferencesDialog />}
    </>
  );
}
