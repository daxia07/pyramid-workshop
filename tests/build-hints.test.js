import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, LEVELS, required, sku, supported, target } from '../game.js';
import { buildHint } from '../build-hints.js';

function capReady() {
  const state = initial(0);
  state.stage = 'build';
  state.blocks = structuredClone(target(LEVELS[0]).filter(b => b.type !== 'cap'));
  state.inventory.cap = 1;
  return state;
}

test('finishing the upper corners hints L3 before the capstone is selected', () => {
  const state = capReady();
  assert.equal(state.part, 'corner');
  assert.equal(state.layer, 1);
  const before = structuredClone(state);
  const hint = buildHint(state, LEVELS[0]);
  assert.equal(hint.layer, 2);
  assert.match(hint.text, /L2 is filled.*capstone.*L3/);
  assert.deepEqual(state, before, 'a hint must not change layers or consume stock');
});

test('capstone guidance follows explicit layer and material choices, then clears after placement', () => {
  const state = capReady();
  state.part = 'cap';
  assert.equal(buildHint(state, LEVELS[0]).layer, 2);
  state.layer = 2;
  state.part = 'corner';
  assert.equal(buildHint(state, LEVELS[0]).part, 'cap');
  state.part = 'cap';
  assert.match(buildHint(state, LEVELS[0]).text, /L3 is selected.*top space/);
  state.blocks.push(target(LEVELS[0]).find(b => b.type === 'cap'));
  state.inventory.cap = 0;
  assert.equal(buildHint(state, LEVELS[0]), null);
});

test('an unsupported capstone never prompts a premature switch to L3', () => {
  const state = initial(0);
  state.stage = 'build';
  state.part = 'cap';
  state.inventory.cap = 1;
  assert.equal(buildHint(state, LEVELS[0]).layer, undefined);
  assert.match(buildHint(state, LEVELS[0]).text, /support.*lower stones/);
  state.inventory.corner = 4;
  assert.equal(buildHint(state, LEVELS[0]).part, 'corner');
});

test('hints do not distract while lifting stones or after completion', () => {
  const state = capReady();
  state.tool = 'remove';
  assert.equal(buildHint(state, LEVELS[0]), null);
  state.tool = 'place';
  for (const stage of ['plan', 'shop', 'complete']) {
    state.stage = stage;
    assert.equal(buildHint(state, LEVELS[0]), null);
  }
});

test('layer suggestions across all missions lead to a supported space with delivered stock', () => {
  LEVELS.forEach((level, i) => {
    const state = initial(i);
    state.stage = 'build';
    state.inventory = required(level);
    for (const part of level.types) for (let layer = 0; layer < level.dims.length; layer++) {
      state.part = part;
      state.layer = layer;
      const hint = buildHint(state, level);
      if (hint?.layer !== undefined) {
        assert.ok(target(level).some(b => b.y === hint.layer && state.inventory[sku(b)] > 0
          && !state.blocks.some(p => p.x === b.x && p.y === b.y && p.z === b.z)
          && supported(b, state.blocks, level)), level.missionId);
      }
    }
  });
});
