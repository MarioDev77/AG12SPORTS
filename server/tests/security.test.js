'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isHttpUrl, parsePositiveInt, escapeHtml } = require('../src/utils/security');

test('isHttpUrl aceita só http(s) absolutos', () => {
  assert.equal(isHttpUrl('https://correios.com.br/rastreio?c=AA123'), true);
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', '//evil.com', 'evil.com', '', null, undefined, 1]) {
    assert.equal(isHttpUrl(bad), false, String(bad));
  }
});

test('parsePositiveInt rejeita injeção e valores inválidos', () => {
  for (const bad of ["1 OR 1=1", "1; DROP TABLE users", '-5', '0', '1.5', 'abc', '', undefined, '99999999999999999999']) {
    assert.throws(() => parsePositiveInt(bad, 'id'), undefined, String(bad));
  }
  assert.equal(parsePositiveInt('42', 'id'), 42);
});

test('escapeHtml neutraliza tags e aspas', () => {
  const out = escapeHtml('<img src=x onerror="alert(1)">');
  assert.ok(!out.includes('<') && !out.includes('"'));
});
