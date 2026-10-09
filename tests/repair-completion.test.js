import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS, target, unusedPurchases, validate} from '../game.js';

test('a repaired mission 3 can finish while keeping its two salvaged edge stones', () => {
  const s = initial(2);
  s.blocks = structuredClone(target(LEVELS[2]));
  s.inventory.edge = 2;
  s.freeInventory.edge = 2;
  assert.deepEqual(validate(LEVELS[2], s.blocks), {missing: 0, extra: 0, wrong: 0, unsupported: 0});
  assert.equal(unusedPurchases(s), 0);
});

test('salvaged stock does not hide unused purchased pieces of the same shape or at the quay', () => {
  const s = initial(2);
  s.inventory.edge = 3;
  s.freeInventory.edge = 2;
  s.warehouse.corner = 1;
  assert.equal(unusedPurchases(s), 2);
  assert.equal(unusedPurchases({inventory: {edge: 1}, warehouse: {}}), 1);
});
