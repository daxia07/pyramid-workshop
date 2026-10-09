import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, initial, target, unusedPurchases } from '../game.js';
import { confirmOrder, globalJourney, migrateJourney } from '../journey-game.js';

const level = id => LEVELS.find(mission => mission.missionId === id);
const egypt = ['egypt-1', 'egypt-2', 'egypt-3', 'egypt-4'].map(level);
const order = (mission, values) => Object.fromEntries(mission.types.map(type => [type, values[type] ?? 0]));

test('Egypt now has an order, cargo, supplied build and expansion journey', () => {
  const [m1, m2, m3, m4] = egypt;
  assert.deepEqual(egypt.map(mission => mission.journeyRole), ['order', 'cargo', 'build', 'expand']);
  assert.deepEqual(egypt.map(mission => mission.name), [
    'Shopping list', 'Pack and ship', 'Build three layers', 'Expand to four',
  ]);
  assert.deepEqual(m1.dims, [3, 2, 1]);
  assert.equal(m1.target.length, 14);
  assert.equal(m2.target.length, 14);
  assert.equal(m3.target.length, 14);
  assert.equal(m4.target.length, 30);
  assert.equal(m1.seed.length, 0);
  assert.equal(m2.seed.length, 0);
  assert.equal(m3.seed.length, 0);
  assert.equal(m4.seed.length, 14);
  assert.deepEqual(m4.targetQuantities, {brick: 5, edge: 12, corner: 12, cap: 1});
  assert.deepEqual(m4.requiredNewQuantities, {brick: 4, edge: 8, corner: 4, cap: 0});
  assert.equal(m1.minimumPurchaseCost, 51);
  assert.equal(m1.minimumTotalCost, 60);
  assert.equal(m2.minimumTotalCost, 60);
  assert.equal(m2.budget, 63);
  assert.equal(m3.budget, 0);
  assert.equal(m4.budget, 60);
  assert.equal(m4.minimumPurchaseCost, 48);
  assert.equal(m4.minimumTotalCost, 57);
  assert.equal(m2.delivery.weights.corner, 3);
  assert.deepEqual(m3.suppliedInventory, {brick: 1, edge: 4, corner: 8, cap: 1});
  assert.ok(m4.seed.every(block => block.locked && block.provenance === 'site' && block.y >= 1));
  assert.deepEqual(
    m4.seed.map(block => [block.x, block.y, block.z, block.type]),
    m1.target.map(block => [block.x, block.y + 1, block.z, block.type]),
  );
});

test('initial journey states expose the intended phase and inventory', () => {
  const [m1, m2, m3, m4] = egypt;
  const s1 = initial(LEVELS.indexOf(m1));
  assert.equal(s1.journeyVersion, 2);
  assert.equal(s1.stage, 'order');
  assert.deepEqual(s1.estimates, {brick: '', edge: '', corner: '', cap: ''});
  assert.equal(s1.blocks.length, 0);

  const s2 = initial(LEVELS.indexOf(m2));
  assert.equal(s2.stage, 'harbor');
  assert.equal(s2.harbor.cargo.length, 14);
  assert.equal(s2.money, 63);

  const s3 = initial(LEVELS.indexOf(m3));
  assert.equal(s3.stage, 'build');
  assert.equal(s3.blocks.length, 0);
  assert.deepEqual(s3.inventory, {brick: 1, edge: 4, corner: 8, cap: 1});
  assert.deepEqual(s3.freeInventory, s3.inventory);
  assert.equal(s3.money, 0);

  const s4 = initial(LEVELS.indexOf(m4));
  assert.equal(s4.stage, 'order');
  assert.equal(s4.harbor, undefined);
  assert.equal(s4.blocks.length, 14);
  assert.deepEqual(s4.estimates, {brick: '', edge: '', corner: '', cap: ''});
});

test('confirmOrder checks every quantity and completes only the reference order', () => {
  const m1 = level('egypt-1');
  const state = initial(LEVELS.indexOf(m1));
  const before = structuredClone(state);
  state.estimates = order(m1, {brick: 1, edge: 4, corner: 7, cap: 1});
  assert.match(confirmOrder(state, m1), /needs 8 corner/);
  assert.deepEqual(state.expedition, before.expedition);
  assert.equal(state.stage, 'order');

  state.estimates = order(m1, {brick: 1, edge: 4, corner: 8, cap: 1});
  assert.equal(confirmOrder(state, m1), null);
  assert.equal(state.stage, 'complete');
  assert.ok(state.completed.includes('egypt-1'));
  assert.deepEqual(state.expedition.orders.three.quantities, m1.requiredNewQuantities);
  assert.equal(state.expedition.orders.three.stoneCost, 51);
  assert.equal(state.expedition.orders.three.shippingBudget, 12);
});

test('confirming expansion opens a sixteen-stone harbor run', () => {
  const m4 = level('egypt-4');
  const state = initial(LEVELS.indexOf(m4));
  state.estimates = order(m4, {brick: 4, edge: 8, corner: 4, cap: 0});
  assert.equal(confirmOrder(state, m4), null);
  assert.equal(state.stage, 'harbor');
  assert.equal(state.harbor.cargo.length, 16);
  assert.equal(state.expedition.orders.expansion.stoneCost, 48);
  assert.equal(state.completed.includes('egypt-4'), false);

  const savedHarbor = structuredClone(state.harbor);
  state.harbor.cargo[0].status = 'quay';
  assert.match(confirmOrder(state, m4), /already been confirmed/);
  assert.deepEqual(state.harbor, {...savedHarbor, cargo: [{...savedHarbor.cargo[0], status: 'quay'}, ...savedHarbor.cargo.slice(1)]});
});

function legacyCargoState() {
  return {
    level: 1,
    stage: 'harbor',
    money: 3,
    trips: 1,
    blocks: [],
    inventory: {},
    warehouse: {},
    harbor: {
      version: 1,
      feesPaid: 2,
      cargo: [
        {id: 'corner-1', type: 'corner', status: 'delivered', slot: 0},
        {id: 'corner-2', type: 'corner', status: 'quay', slot: null},
        {id: 'corner-3', type: 'corner', status: 'market', slot: null},
        {id: 'corner-4', type: 'corner', status: 'boat', slot: 1},
        {id: 'cap-1', type: 'cap', status: 'market', slot: null},
      ],
    },
  };
}

test('migration archives Egypt runs while preserving cargo statuses, build work and globals', () => {
  const m3 = level('egypt-3');
  const oldM3Blocks = [
    ...target(m3).slice(0, 10).map(block => ({...block, locked: block.y === 0, provenance: 'site'})),
    {...target(m3)[10], type: 'edge', provenance: 'site'},
  ];
  const legacy = {
    level: 3,
    stage: 'complete',
    money: 2,
    completed: ['egypt-1', 'egypt-2', 'egypt-3'],
    profile: {coins: 42, awarded: ['egypt-1'], decorations: ['path']},
    studio: {size: 5, shape: 'smooth', blocks: [], garden: []},
    blocks: target(level('egypt-4')).slice(0, 14).map(block => ({...block})),
    runs: {
      1: legacyCargoState(),
      2: {level: 2, stage: 'build', blocks: oldM3Blocks, inventory: {edge: 2}, freeInventory: {edge: 2}},
      4: {level: 4, stage: 'complete', marker: 'maya-progress'},
    },
  };
  const returned = migrateJourney(legacy);
  assert.equal(returned, legacy);
  assert.equal(legacy.journeyVersion, 2);
  assert.match(legacy.migrationNotice, /archived/);
  assert.deepEqual(legacy.profile, {coins: 42, awarded: ['egypt-1'], decorations: ['path']});
  assert.deepEqual(legacy.studio, {size: 5, shape: 'smooth', blocks: [], garden: []});
  assert.deepEqual(legacy.completed, ['egypt-1', 'egypt-2', 'egypt-3']);
  assert.equal(legacy.runs[4].marker, 'maya-progress');
  assert.equal(legacy.stage, 'order');
  assert.equal(legacy.level, 3);
  assert.equal(legacy.blocks.length, 14);
  assert.ok(legacy.legacyEgyptRuns[3]);
  assert.deepEqual(legacy.expedition.orders.three.quantities, level('egypt-1').requiredNewQuantities);

  const cargo = legacy.runs[1].harbor.cargo;
  assert.equal(cargo.length, 14);
  assert.equal(cargo.find(item => item.id === 'corner-1').status, 'delivered');
  assert.equal(cargo.find(item => item.id === 'corner-2').status, 'quay');
  assert.equal(cargo.find(item => item.id === 'corner-3').status, 'quay');
  assert.equal(cargo.find(item => item.id === 'corner-4').status, 'market');
  assert.equal(cargo.find(item => item.id === 'cap-1').status, 'market');
  assert.equal(cargo.filter(item => item.type === 'brick').every(item => item.status === 'market'), true);
  assert.equal(legacy.runs[1].harbor.feesPaid, 2);
  assert.equal(legacy.runs[1].money, 49, 'migration retains the old purchase and fare spend');

  const build = legacy.runs[2];
  assert.equal(build.blocks.length, 11, 'wrong salvaged stones remain available to lift out');
  assert.ok(build.blocks.some(block => block.type === 'edge' && block.x === target(m3)[10].x
    && block.y === target(m3)[10].y && block.z === target(m3)[10].z));
  assert.deepEqual(build.inventory, {brick: 0, edge: 2, corner: 3, cap: 1});
  assert.deepEqual(build.freeInventory, {brick: 0, edge: 2, corner: 3, cap: 1});
  assert.equal(build.stage, 'build');
  assert.equal(legacy.legacyEgyptRuns[1].harbor.cargo.length, 5);
});

test('journey migration is idempotent and globalJourney does not erase orders', () => {
  const state = initial(0);
  state.expedition.orders.three = {confirmed: true, quantities: {brick: 1}};
  globalJourney(state);
  const first = structuredClone(state);
  assert.equal(migrateJourney(state), state);
  assert.deepEqual(state, first);
});


// A retired purchasing phase must never strand a returning player with
// paid stock that can only be refunded at a now-absent market.
test('legacy purchased stock is reused without double top-ups or a refund gate', () => {
  const s=initial(2);delete s.journeyVersion;delete s.expedition;
  s.blocks=target(LEVELS[2]).filter(b=>b.y===0).map(b=>({...b,locked:true,provenance:'purchase'}));
  s.inventory={brick:0,edge:2,corner:2,cap:1};
  s.freeInventory={brick:0,edge:2,corner:0,cap:0};
  migrateJourney(s);
  assert.deepEqual(s.inventory,{brick:0,edge:2,corner:4,cap:1});
  assert.deepEqual(s.freeInventory,s.inventory);
  assert.equal(unusedPurchases(s),0);
  assert.ok(s.blocks.every(b=>b.provenance==='site'),'retained paid stones stay free when lifted');
});
