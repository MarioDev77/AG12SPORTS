import test from 'node:test';
import assert from 'node:assert/strict';

// Simula o navegador mínimo que lib/consent.js usa.
const store = new Map();
globalThis.window = {
  location: { protocol: 'https:' },
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
};
let cookieJar = '';
globalThis.document = {
  get cookie() { return cookieJar; },
  set cookie(v) { const [pair] = v.split(';'); const name = pair.split('=')[0]; cookieJar = cookieJar.split('; ').filter((c) => c && !c.startsWith(`${name}=`)).concat(pair).join('; '); },
};

const { loadConsent, saveConsent, CONSENT_COOKIE } = await import('../lib/consent.js').catch(() => import('../lib/consent.mjs'));

test('sem escolha salva retorna null', () => assert.equal(loadConsent(), null));

test('salva e relê a escolha; opcionais nunca ligam sozinhos', () => {
  saveConsent({});
  assert.deepEqual({ a: loadConsent().analytics, m: loadConsent().marketing }, { a: false, m: false });
  saveConsent({ analytics: true, marketing: false });
  assert.equal(loadConsent().analytics, true);
  assert.equal(loadConsent().marketing, false);
});

test('cookie adulterado ou de versão antiga é ignorado', () => {
  cookieJar = `${CONSENT_COOKIE}=${encodeURIComponent('{"v":999,"analytics":true}')}`;
  store.clear();
  assert.equal(loadConsent(), null);
  cookieJar = `${CONSENT_COOKIE}=lixo{{`;
  assert.equal(loadConsent(), null);
});
