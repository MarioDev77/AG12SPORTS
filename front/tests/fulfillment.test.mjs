import test from 'node:test';
import assert from 'node:assert/strict';
import { fulfillmentOf } from '../lib/fulfillment.mjs';

test('pronta entrega e encomenda são independentes', () => {
  assert.deepEqual(fulfillmentOf({ availableForOrder: true, availableOnRequest: false }), { known: true, pronta: true, encomenda: false });
  assert.deepEqual(fulfillmentOf({ availableForOrder: false, availableOnRequest: true }), { known: true, pronta: false, encomenda: true });
  assert.deepEqual(fulfillmentOf({ availableForOrder: true, availableOnRequest: true }), { known: true, pronta: true, encomenda: true });
  assert.deepEqual(fulfillmentOf({ availableForOrder: false, availableOnRequest: false }), { known: true, pronta: false, encomenda: false });
});

test('API antiga (sem availableOnRequest): quem não é pronta entrega segue como encomenda', () => {
  assert.equal(fulfillmentOf({ availableForOrder: false }).encomenda, true);
  assert.equal(fulfillmentOf({ availableForOrder: true }).encomenda, false);
});

test('sem informação nenhuma não mostra selo nem filtra', () => {
  for (const p of [null, undefined, {}, { availableForOrder: 'sim' }]) {
    assert.deepEqual(fulfillmentOf(p), { known: false, pronta: false, encomenda: false });
  }
});
