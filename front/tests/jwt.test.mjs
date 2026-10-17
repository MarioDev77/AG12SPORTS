import test from 'node:test';
import assert from 'node:assert/strict';
import { jwtExpiryMs } from '../lib/jwt.mjs';

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const tok = (payload) => `${b64u({ alg: 'HS256' })}.${b64u(payload)}.assinatura`;

test('lê exp em milissegundos', () => assert.equal(jwtExpiryMs(tok({ sub: '1', exp: 1800000000 })), 1800000000000));

test('token ilegível ou sem exp válido devolve 0 (nunca lança)', () => {
  for (const bad of ['', 'abc', 'a.b.c', tok({ sub: '1' }), tok({ exp: 'amanha' }), null, undefined, 42]) {
    assert.equal(jwtExpiryMs(bad), 0, String(bad));
  }
});
