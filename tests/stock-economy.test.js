import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS, sku, target, key, validate} from '../game.js';
import {stockRefund, returnPurchasedStock} from '../stock-economy.js';

test('returning bought stock preserves the salvaged stair needed to repair Maya', () => {
  const level = LEVELS[6], state = initial(6);
  const rogue = state.blocks.find(b => !target(level).some(t => key(t.x,t.y,t.z) === key(b.x,b.y,b.z)));
  assert.ok(rogue);
  state.blocks = state.blocks.filter(b => b !== rogue);
  state.inventory[sku(rogue)] = 3;
  state.freeInventory[sku(rogue)] = 1;
  state.money = 0;
  assert.equal(stockRefund(state, level), 6);
  assert.equal(returnPurchasedStock(state, level), 6);
  assert.equal(state.money, 6);
  assert.equal(state.inventory.stairs, 1);
  assert.equal(state.freeInventory.stairs, 1);
  const missing = target(level).find(t => !state.blocks.some(b => key(t.x,t.y,t.z) === key(b.x,b.y,b.z)));
  state.blocks.push({...missing, provenance:'site'});
  assert.deepEqual(validate(level, state.blocks), {missing:0,extra:0,wrong:0,unsupported:0});
  assert.equal(returnPurchasedStock(state, level), 0, 'refund cannot be collected twice');
});

test('refund includes purchased warehouse stock but never sells free stones', () => {
  const level = LEVELS[8], state = initial(8);
  state.inventory.facing = 5; state.freeInventory.facing = 2;
  state.warehouse.facing = 4;
  state.history.push({inventory:{facing:5}});
  assert.equal(returnPurchasedStock(state, level), 14);
  assert.equal(state.inventory.facing, 2);
  assert.equal(state.warehouse.facing, 0);
  assert.equal(state.history.length, 0);
});
