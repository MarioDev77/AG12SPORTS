import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl } from '../lib/safeUrl.mjs';

test('aceita http e https', () => {
  assert.equal(safeHttpUrl('https://rastreio.exemplo.com/abc?x=1'), 'https://rastreio.exemplo.com/abc?x=1');
  assert.equal(safeHttpUrl('http://exemplo.com/'), 'http://exemplo.com/');
});

test('bloqueia esquemas perigosos e entradas inválidas', () => {
  for (const bad of [
    'javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd',
    '//evil.com', '/relativo', 'evil.com', '', null, undefined, 42, {}, [],
  ]) {
    assert.equal(safeHttpUrl(bad), '', `deveria bloquear: ${String(bad)}`);
  }
});
