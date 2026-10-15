import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, LEVELS, planningValid, required, sku, supported, target, unusedPurchases, validate } from '../game.js';
import { buildHint, egyptPlacementProblem } from '../build-hints.js';

function capReady() {
  const state = initial(0);
  state.stage = 'build';
  state.blocks = structuredClone(target(LEVELS[0]).filter(b => b.type !== 'cap'));
  state.part = 'corner';
  state.layer = 1;
  state.inventory.corner = 4;
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
  assert.equal(buildHint(state, LEVELS[0]).check, true);
});

test('an unsupported capstone never prompts a premature switch to L3', () => {
  const state = initial(0);
  state.stage = 'build';
  state.part = 'cap';
  state.inventory.cap = 1;
  assert.equal(buildHint(state, LEVELS[0]).layer, undefined);
  assert.match(buildHint(state, LEVELS[0]).text, /lower stones first/);
  state.inventory.corner = 4;
  assert.equal(buildHint(state, LEVELS[0]).part, 'corner');
});

test('hints clear outside the build stage and after completion', () => {
  const state = capReady();
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
      if (hint?.layer !== undefined && hint.tool !== 'remove') {
        assert.ok(target(level).some(b => b.y === hint.layer && state.inventory[sku(b)] > 0
          && !state.blocks.some(p => p.x === b.x && p.y === b.y && p.z === b.z)
          && supported(b, state.blocks, level)), level.missionId);
      }
    }
  });
});

test('Egypt hints count the right shape, so a wrong saved stone asks to be lifted out', () => {
  const level = LEVELS[2];
  const state = initial(2);
  state.stage = 'build';
  state.tool = 'place';
  state.blocks = structuredClone(target(level));
  const wrong = state.blocks.find(block => block.type === 'cap');
  wrong.type = 'edge';
  const before = structuredClone(state);

  const hint = buildHint(state, level);
  assert.equal(hint.layer, wrong.y);
  assert.equal(hint.part, 'cap');
  assert.equal(hint.tool, 'remove');
  assert.match(hint.text, /wrong shape.*Lift it out/i);
  assert.deepEqual(state, before, 'a recovery hint must not repair the saved model');
});

test('Egypt recovery lifts an upper blocker before a wrong lower stone', () => {
  const level = LEVELS[2];
  const state = initial(2);
  state.stage = 'build';
  state.tool = 'place';
  state.blocks = structuredClone(target(level));
  const wrong = state.blocks.find(block => block.type === 'corner' && block.y === 0);
  wrong.type = 'edge';

  const hint = buildHint(state, level);
  assert.equal(hint.tool, 'remove');
  assert.equal(hint.layer, 2);
  assert.match(hint.text, /upper.*capstone.*L3/i);
});

test('Egypt removal mode switches back to placing after the bad stone is gone', () => {
  const level = LEVELS[2];
  const state = initial(2);
  state.stage = 'build';
  state.tool = 'remove';
  const bad = target(level).find(block => block.type === 'corner' && block.y === 0);
  state.blocks = target(level)
    .filter(block => block !== bad)
    .map(block => ({...block}));
  state.inventory = {brick: 0, edge: 0, corner: 1, cap: 0};
  state.layer = 0;
  state.part = 'corner';

  const hint = buildHint(state, level);
  assert.equal(hint.tool, 'place');
  assert.equal(hint.part, 'corner');
  assert.match(hint.text, /corner stone/i);
});

test('a complete Egypt model gives the child a clear inspection action', () => {
  const level = LEVELS[2];
  const state = initial(2);
  state.stage = 'build';
  state.blocks = structuredClone(target(level));
  state.inventory = {brick: 0, edge: 0, corner: 0, cap: 0};

  const hint = buildHint(state, level);
  assert.equal(hint.check, true);
  assert.match(hint.text, /Check my pyramid/);
});

test('Egypt scaffold hints explain that the locked upper stones stay in place', () => {
  const level = LEVELS[3];
  const state = initial(3);
  state.stage = 'build';
  state.scaffold = true;
  state.inventory = required(level);
  state.freeInventory = {...state.inventory};

  const hint = buildHint(state, level);
  assert.equal(hint.layer, 0);
  assert.equal(hint.scaffold, true);
  assert.match(hint.text, /locked.*scaffold/i);
  assert.match(hint.text, /foundation/i);
});

test('Egypt layer progression moves from a complete foundation to the upper corners', () => {
  const level = LEVELS[2];
  const state = initial(2);
  state.stage = 'build';
  state.blocks = target(level).filter(block => block.y === 0).map(block => ({...block}));
  state.inventory = {brick: 0, edge: 0, corner: 4, cap: 1};
  state.layer = 0;
  state.part = 'corner';

  const hint = buildHint(state, level);
  assert.equal(hint.layer, 1);
  assert.equal(hint.part, 'corner');
  assert.match(hint.text, /L1 is filled/);
});

test('Egypt placement problems explain the spot and leave state untouched', () => {
  const level = LEVELS[2];
  const state = initial(2);
  const before = structuredClone(state);

  const problem = egyptPlacementProblem(state, level, {x: -1, y: 0, z: -1, type: 'edge'});
  assert.deepEqual(Object.keys(problem).sort(), ['code', 'expectedType', 'layer', 'text']);
  assert.equal(problem.code, 'wrong-shape');
  assert.equal(problem.expectedType, 'corner');
  assert.match(problem.text, /corner/);
  assert.deepEqual(state, before);
  const outside = egyptPlacementProblem(state, level, {x: 9, y: 0, z: 9, type: 'corner'});
  assert.deepEqual(Object.keys(outside).sort(), ['code', 'text']);
  assert.equal(egyptPlacementProblem(state, level, {x: -1, y: 0, z: -1, type: 'corner'}), null);
  assert.equal(egyptPlacementProblem(state, LEVELS[4], {x: 0, y: 0, z: 0, type: 'brick'}), null);
});

const mission = id => LEVELS.find(level => level.missionId === id);
const emptyStock = level => Object.fromEntries(level.types.map(type => [type, 0]));

function buildState(level) {
  const state = initial(LEVELS.indexOf(level));
  state.stage = 'build';
  state.blocks = structuredClone(level.seed || []);
  state.inventory = emptyStock(level);
  state.freeInventory = emptyStock(level);
  state.warehouse = emptyStock(level);
  state.money = level.budget;
  state.layer = 0;
  state.part = level.types[0];
  if (level.site) state.siteChoice = level.site.accepted;
  if (level.planning?.acceptedChoice) state.planningChoice = level.planning.acceptedChoice;
  else if (level.planning?.choices?.[0]?.upperWidth) state.planningChoice = 2;
  return state;
}

test('every Maya and Ur blueprint satisfies its listed final checks and offers inspection', () => {
  const connected = (blocks, route, topLayer) => {
    const stairs = blocks.filter(block => block.type === 'stairs' && (block.routeId || 'front') === route);
    return stairs.length === topLayer && new Set(stairs.map(block => block.y)).size === topLayer
      && Array.from({length: topLayer}, (_, layer) => stairs.some(block => block.y === layer)).every(Boolean);
  };
  const isAboveWater = (level, state) => {
    if (!level.site) return true;
    const choice = level.site.choices.find(option => option.id === state.siteChoice);
    return state.siteChoice === level.site.accepted && choice?.elevation > level.site.waterline;
  };
  const satisfies = (requirement, level, state, result) => ({
    exactTarget: result.missing === 0 && result.extra === 0,
    correctTypes: result.wrong === 0,
    correctMaterials: result.wrong === 0,
    supported: result.unsupported === 0,
    budgetNonnegative: state.money >= 0,
    bothRoutesConnected: connected(state.blocks, 'front', level.dims.length - 1)
      && connected(state.blocks, 'rear', level.dims.length - 1),
    frontRouteConnected: connected(state.blocks, 'front', level.dims.length - 1),
    corridorClear: planningValid(level, state),
    aboveWaterline: isAboveWater(level, state),
  })[requirement];

  for (const level of LEVELS.filter(item => item.id !== 'egypt')) {
    const state = buildState(level);
    state.blocks = structuredClone(target(level));
    state.inventory = emptyStock(level);
    state.freeInventory = emptyStock(level);
    const result = validate(level, state.blocks);
    assert.deepEqual(result, {missing: 0, extra: 0, wrong: 0, unsupported: 0}, level.missionId);
    assert.equal(unusedPurchases(state), 0, `${level.missionId} has no unused paid pieces`);
    for (const requirement of level.completion) {
      assert.equal(satisfies(requirement, level, state, result), true,
        `${level.missionId} final requirement: ${requirement}`);
    }
    const hint = buildHint(state, level);
    assert.equal(hint.check, true, `${level.missionId} should offer its inspection action`);
    assert.match(hint.text, /Inspect my building/);
  }
});

test('a wrong material is removed from the top down, then the hint leads back to the missing material', () => {
  const level = {
    id: 'mesopotamia',
    missionId: 'ur-test-stack',
    dims: [1, 1],
    types: ['core', 'facing'],
    budget: 10,
    blueprint: [
      {x: 0, y: 0, z: 0, type: 'brick', material: 'core'},
      {x: 0, y: 1, z: 0, type: 'brick', material: 'facing'},
    ],
  };
  const state = {
    stage: 'build', tool: 'place', layer: 0, part: 'core', money: 10,
    blocks: structuredClone(target(level)),
    inventory: {core: 0, facing: 0},
    freeInventory: {core: 0, facing: 0},
    warehouse: {core: 0, facing: 0},
  };
  state.blocks[0].material = 'facing';
  const before = structuredClone(state);
  const upper = buildHint(state, level);
  assert.equal(upper.tool, 'remove');
  assert.equal(upper.layer, 1);
  assert.match(upper.text, /upper facing brick on L2/);
  assert.deepEqual(state, before, 'recovery advice must leave the placed pieces and inventory untouched');

  state.blocks = state.blocks.slice(0, 1);
  state.inventory.facing = 1;
  state.freeInventory.facing = 1;
  state.tool = 'remove';
  const lower = buildHint(state, level);
  assert.equal(lower.tool, 'remove');
  assert.equal(lower.layer, 0);
  assert.match(lower.text, /wrong.*core brick/i);

  state.blocks = [];
  state.inventory.facing = 2;
  state.freeInventory.facing = 2;
  const stock = buildHint(state, level);
  assert.match(stock.text, /No core brick.*Market/);
  assert.equal(stock.check, undefined);
  assert.equal(state.blocks.length, 0, 'hints never place the replacement for the player');

  state.inventory.core = 1;
  const replaceBase = buildHint(state, level);
  assert.equal(replaceBase.tool, 'place');
  assert.equal(replaceBase.layer, 0);
  assert.equal(replaceBase.part, 'core');
  state.blocks.push({...target(level)[0]});
  state.inventory.core = 0;
  state.freeInventory.core = 0;
  state.inventory.facing = 1;
  state.freeInventory.facing = 1;
  const replaceTop = buildHint(state, level);
  assert.equal(replaceTop.layer, 1);
  assert.equal(replaceTop.part, 'facing');
  state.blocks.push({...target(level)[1]});
  state.inventory.facing = 0;
  state.freeInventory.facing = 0;
  assert.equal(buildHint(state, level).check, true);
});

test('Maya 3 repairs its wrong-side stair with the zero-purchase stock recovered from the site', () => {
  const level = mission('maya-3');
  const state = buildState(level);
  const before = structuredClone(state);
  const remove = buildHint(state, level);
  assert.equal(remove.tool, 'remove');
  assert.equal(remove.layer, 1);
  assert.match(remove.text, /rear stair flight.*outside the plan/i);
  assert.deepEqual(state, before, 'the rogue flight remains until the player lifts it');

  const rogue = state.blocks.find(block => !target(level).some(want => want.x === block.x
    && want.y === block.y && want.z === block.z));
  state.blocks = state.blocks.filter(block => block !== rogue);
  state.inventory.stairs = 1;
  state.freeInventory.stairs = 1;
  state.tool = 'remove';
  const replace = buildHint(state, level);
  assert.equal(replace.tool, 'place');
  assert.equal(replace.layer, 1);
  assert.equal(replace.part, 'stairs');
  assert.match(replace.text, /front stair slot/);

  const missing = target(level).find(block => !state.blocks.some(placed => placed.x === block.x
    && placed.y === block.y && placed.z === block.z));
  state.blocks.push({...missing});
  state.inventory.stairs = 0;
  state.freeInventory.stairs = 0;
  assert.equal(buildHint(state, level).check, true);
});

test('Maya 2 names the rear route and selects the correct layer for its missing stair flight', () => {
  const level = mission('maya-2');
  const state = buildState(level);
  state.inventory = required(level);
  state.freeInventory = emptyStock(level);
  state.part = 'stairs';
  state.layer = 0;

  const hint = buildHint(state, level);
  assert.equal(hint.part, 'stairs');
  assert.equal(hint.layer, 0);
  assert.equal(hint.tool, 'place');
  assert.match(hint.text, /rear stair slot on L1/);
});

test('a missing material directs the player to the market, and inspection waits for excess stock returns', () => {
  const level = mission('maya-1');
  const state = buildState(level);
  const hint = buildHint(state, level);
  assert.match(hint.text, /No flat brick.*L2.*Market/);
  assert.equal(hint.check, undefined);

  const ur = mission('ur-2');
  const complete = buildState(ur);
  complete.blocks = structuredClone(target(ur));
  complete.inventory.facing = 1;
  complete.freeInventory.facing = 0;
  const returnStock = buildHint(complete, ur);
  assert.match(returnStock.text, /Return 1 unused purchased piece at the market/);
  assert.equal(returnStock.check, undefined);
  complete.inventory.facing = 0;
  assert.equal(buildHint(complete, ur).check, true);
});

test('inspection stays gated by a valid footprint, site, route, and nonnegative budget', () => {
  for (const [id, invalidate, message] of [
    ['maya-1', state => { state.planningChoice = 3; }, /Review plan/],
    ['maya-4', state => { state.planningChoice = 'large'; }, /Review plan/],
    ['ur-3', state => { state.siteChoice = 'low'; }, /Review plan/],
    ['ur-4', state => { state.money = -1; }, /budget is below zero/],
  ]) {
    const level = mission(id);
    const state = buildState(level);
    state.blocks = structuredClone(target(level));
    invalidate(state);
    const hint = buildHint(state, level);
    assert.notEqual(hint.check, true, `${id} must not bypass its final gate`);
    assert.match(hint.text, message, id);
  }

  const maya = mission('maya-2');
  const state = buildState(maya);
  state.blocks = structuredClone(target(maya));
  const rearGround = state.blocks.find(block => block.type === 'stairs' && block.routeId === 'rear' && block.y === 0);
  state.blocks = state.blocks.filter(block => block !== rearGround);
  state.inventory.stairs = 1;
  state.freeInventory.stairs = 1;
  state.part = 'stairs';
  const route = buildHint(state, maya);
  assert.notEqual(route.check, true);
  assert.equal(route.part, 'stairs');
  assert.match(route.text, /rear stair slot/);
});
