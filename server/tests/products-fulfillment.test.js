'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Troca o pool do MySQL por um espião (sem banco) antes de carregar o service.
const calls = [];
const poolPath = require.resolve(path.join('..', 'src', 'db', 'pool'));
require.cache[poolPath] = {
  id: poolPath, filename: poolPath, loaded: true,
  exports: {
    pool: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }]];
        return [[{ id: 1, name: 'X', brand: 'B', category: 'society', price: 100, sizes: '[]', images_json: '[]',
                   available_for_order: 1, available_on_request: 1 }]];
      },
    },
  },
};
const { listProducts } = require('../src/services/products.service');

test('filtro "encomenda" usa available_on_request; "pronta" usa available_for_order', async () => {
  calls.length = 0;
  await listProducts({ fulfillment: 'encomenda' });
  assert.match(calls[0].sql, /p\.available_on_request = 1/);
  assert.doesNotMatch(calls[0].sql, /available_for_order = 0/);
  calls.length = 0;
  await listProducts({ fulfillment: 'pronta' });
  assert.match(calls[0].sql, /p\.available_for_order = 1/);
});

test('produto pode ser pronta entrega e encomenda ao mesmo tempo', async () => {
  const { products } = await listProducts({});
  assert.equal(products[0].availableForOrder, true);
  assert.equal(products[0].availableOnRequest, true);
});
