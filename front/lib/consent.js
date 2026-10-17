/**
 * Consentimento de cookies (LGPD) — AG12 Sports.
 *
 * Categorias:
 *  - necessary: sempre ativa (carrinho, favoritos, abertura da loja, o próprio consentimento).
 *  - analytics: estatísticas de uso. Hoje a loja NÃO usa nenhuma ferramenta de análise;
 *               a categoria existe para quando uma for adicionada.
 *  - marketing: anúncios/remarketing. Idem.
 *
 * A escolha é guardada em um cookie próprio (first-party), por 6 meses, e
 * espelhada no localStorage como reserva. Mudou a CONSENT_VERSION → pede de novo.
 */
export const CONSENT_COOKIE = 'ag12_consent';
export const CONSENT_VERSION = 1;
const MAX_AGE_DAYS = 180;

export const DEFAULT_CHOICES = { analytics: false, marketing: false };

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function loadConsent() {
  let raw = null;
  try { raw = readCookie(CONSENT_COOKIE); } catch { /* ignora */ }
  if (!raw) {
    try { raw = window.localStorage.getItem(CONSENT_COOKIE); } catch { /* ignora */ }
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== CONSENT_VERSION) return null;
    return {
      analytics: data.analytics === true,
      marketing: data.marketing === true,
      at: typeof data.at === 'number' ? data.at : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveConsent(choices) {
  const payload = {
    v: CONSENT_VERSION,
    analytics: choices.analytics === true,
    marketing: choices.marketing === true,
    at: Date.now(),
  };
  const json = JSON.stringify(payload);
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(json)}; Max-Age=${MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
  } catch { /* ignora */ }
  try { window.localStorage.setItem(CONSENT_COOKIE, json); } catch { /* ignora */ }
  return payload;
}
