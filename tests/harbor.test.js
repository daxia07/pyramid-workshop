import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS} from '../game.js';
import {
  VOYAGE_MS,
  arriveCargo,
  beginExpansionBuild,
  buyCargo,
  buyOrder,
  dispatchCargo,
  dispatchProblem,
  harborStats,
  migrateHarbor,
  placeCargo,
  unloadCargo,
  undoVoyage,
} from '../harbor-game.js';
import {confirmOrder} from '../journey-game.js';
import {
  EXPANSION_THREE_VOYAGE_SOLUTION,
  THREE_VOYAGE_SOLUTION,
} from '../cargo-packing.js';
import {awardCompletedMissions} from '../workshop-profile.js';

const firstShipping = LEVELS[1];
const expansion = LEVELS[3];

/** Assign the next unused item of each requested type. */
function placeSolution(state, solution) {
  const used = new Set();
  for (const placement of solution) {
    const item = state.harbor.cargo.find(candidate =>
      candidate.status === 'quay' && candidate.type === placement.type && !used.has(candidate.id));
    assert.ok(item, `an unused ${placement.type} must be available for the witness`);
    assert.equal(
      placeCargo(state, item.id, placement.column, placement.row, placement.rotation),
      true,
      `place ${item.id}`,
    );
    used.add(item.id);
  }
}

function countByType(items) {
  return items.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});
}

test('the full first shipment fits in three balanced voyages and keeps its coin ledger', () => {
  const state = initial(1);

  assert.equal(state.stage, 'harbor');
  assert.equal(buyOrder(state, firstShipping), false, 'shipping cannot reopen the paid order');
  assert.equal(state.money, 12, 'the fourteen stones cost 51 from the 63 coin budget');
  assert.equal(state.harbor.cargo.filter(item => item.status === 'quay').length, 14);

  for (const [number, solution] of THREE_VOYAGE_SOLUTION.entries()) {
    placeSolution(state, solution);
    const metrics = harborStats(state);
    assert.ok(metrics.weight <= 16, `voyage ${number + 1} is within deck capacity`);
    assert.equal(metrics.balanced, true, `voyage ${number + 1} balances both axes`);
    assert.equal(dispatchProblem(state, firstShipping), null);

    const result = dispatchCargo(state, firstShipping, 1000 + number);
    assert.ok(result.voyage);
    assert.equal(result.voyage.number, number + 1);
    assert.equal(result.voyage.fee, 3);
    assert.equal(arriveCargo(state, firstShipping), true);
    if(number<2){assert.equal(state.stage,'harbor');assert.equal(state.completed.includes('egypt-2'),false);}
  }

  assert.equal(state.trips, 3);
  assert.equal(state.harbor.feesPaid, 9);
  assert.equal(state.money, 3, 'three fares leave the three-coin surplus');
  assert.equal(state.harbor.cargo.filter(item => item.status === 'delivered').length, 14);
  assert.equal(state.stage, 'complete');
  assert.deepEqual(state.expedition.delivered.three, firstShipping.requiredNewQuantities);
  assert.ok(state.completed.includes('egypt-2'));
  assert.equal(arriveCargo(state, firstShipping), false, 'an arrived voyage cannot be arrived twice');
});

test('the expansion shipment uses its three-voyage witness and opens the four-layer build', () => {
  const state = initial(3);

  assert.equal(state.stage, 'order');
  state.estimates = {...expansion.requiredNewQuantities};
  assert.equal(confirmOrder(state, expansion), null);
  assert.equal(state.stage, 'purchase');
  assert.equal(state.money, 60);
  assert.equal(buyOrder(state, expansion), true);
  assert.equal(state.money, 12, 'sixteen expansion stones cost 48');

  for (const solution of EXPANSION_THREE_VOYAGE_SOLUTION) {
    placeSolution(state, solution);
    assert.equal(dispatchProblem(state, expansion), null);
    assert.ok(dispatchCargo(state, expansion, 2000).voyage);
    assert.equal(arriveCargo(state, expansion), true);
  }

  assert.equal(state.harbor.finished, true);
  assert.equal(state.stage, 'harbor', 'arrival is a reviewable handoff before building');
  assert.equal(state.harbor.feesPaid, 9);
  assert.equal(state.money, 3);
  assert.deepEqual(state.expedition.delivered.expansion, expansion.requiredNewQuantities);
  assert.equal(beginExpansionBuild(state, expansion), true);
  assert.equal(state.stage, 'build');
  assert.deepEqual(state.inventory, {brick: 4, edge: 8, corner: 4, cap: 0});
  assert.deepEqual(state.freeInventory, state.inventory);
  assert.equal(state.scaffold, true);
});

test('collision, mast, bounds, rotation and rearrangement rules keep the deck editable', () => {
  const state = initial(1);

  assert.equal(buyCargo(state, firstShipping, 'brick'), false);
  assert.equal(placeCargo(state, 'brick-1', 0, 0, 0), true);
  assert.equal(buyCargo(state, firstShipping, 'edge'), false);
  assert.equal(placeCargo(state, 'edge-1', 1, 0, 0), false, 'overlapping sleds cannot be stacked');
  assert.equal(placeCargo(state, 'edge-1', 2, 0, 90), false, 'a rotated edge cannot cross the mast');
  assert.equal(placeCargo(state, 'edge-1', 3, 3, 0), false, 'a footprint cannot run off the deck');
  assert.equal(placeCargo(state, 'edge-1', 2, 0, 0), true);

  assert.equal(unloadCargo(state, 'edge-1'), true);
  const unloaded = state.harbor.cargo.find(item => item.id === 'edge-1');
  assert.equal(unloaded.status, 'quay');
  assert.equal(unloaded.column, null);
  assert.equal(unloaded.row, null);
  assert.equal(placeCargo(state, 'edge-1', 3, 1, 90), true, 'an unloaded stone can be rotated and placed again');
  assert.equal(placeCargo(state, 'brick-1', 0, 3, 0), true, 'an existing boat stone can be rearranged');
  assert.deepEqual(
    state.harbor.cargo.filter(item => item.status === 'boat').map(item => item.id).sort(),
    ['brick-1', 'edge-1'],
  );
});

test('purchases, placement and dispatch are locked while a voyage is in transit', () => {
  const state = initial(1);
  placeSolution(state, THREE_VOYAGE_SOLUTION[0]);

  const result = dispatchCargo(state, firstShipping, 1234);
  assert.ok(result.voyage);
  assert.equal(state.harbor.inTransit.startedAt, 1234);
  assert.equal(buyCargo(state, firstShipping, 'cap'), false);
  assert.equal(placeCargo(state, 'brick-1', 3, 0, 0), false);
  assert.equal(unloadCargo(state, 'corner-1'), false);
  assert.match(dispatchCargo(state, firstShipping, 1235).problem, /river/);
  assert.equal(arriveCargo(state, firstShipping), true);
});

test('a saved voyage keeps its departure timestamp and travel duration after reload', () => {
  const state = initial(1);
  assert.equal(placeCargo(state, 'edge-1', 0, 0, 0), true);
  assert.equal(placeCargo(state, 'edge-2', 2, 3, 0), true);

  const startedAt = 1_700_000_000_000;
  const voyage = dispatchCargo(state, firstShipping, startedAt).voyage;
  const reloaded = JSON.parse(JSON.stringify(state));
  assert.deepEqual(reloaded.harbor.inTransit, voyage);
  assert.equal(reloaded.harbor.inTransit.startedAt, startedAt);
  assert.equal(reloaded.harbor.inTransit.startedAt + VOYAGE_MS, startedAt + 7600);
  assert.equal(arriveCargo(reloaded, firstShipping), true);
  assert.equal(reloaded.harbor.voyages[0].startedAt, startedAt);
});

test('undo restores the exact purchased set and shipping fee even with a newer load on deck', () => {
  const state = initial(1);
  placeSolution(state, THREE_VOYAGE_SOLUTION[0]);
  const first = dispatchCargo(state, firstShipping, 3000).voyage;
  assert.ok(first);
  assert.equal(arriveCargo(state, firstShipping), true);

  // Another paid stone is left on deck when the earlier voyage is undone.
  assert.equal(buyCargo(state, firstShipping, 'brick'), false);
  assert.equal(placeCargo(state, 'brick-1', 3, 0, 0), true);
  const purchasedIds = state.harbor.cargo
    .filter(item => item.status !== 'market')
    .map(item => item.id)
    .sort();
  assert.equal(state.money, 9);

  assert.equal(undoVoyage(state), true);
  assert.equal(state.money, 12, 'undo refunds the three-coin fare');
  assert.equal(state.trips, 0);
  assert.equal(state.harbor.feesPaid, 0);
  assert.equal(state.harbor.voyages.length, 0);
  assert.deepEqual(
    state.harbor.cargo.filter(item => item.status !== 'market').map(item => item.id).sort(),
    purchasedIds,
    'undo does not lose or duplicate any purchased item',
  );
  assert.deepEqual(
    state.harbor.cargo.filter(item => item.status === 'boat').map(item => item.id).sort(),
    first.ids.slice().sort(),
  );
  assert.equal(state.harbor.cargo.find(item => item.id === 'brick-1').status, 'quay');
  assert.equal(state.harbor.cargo.filter(item => item.status === 'market').length, 0);
});

test('an inefficient small voyage is still reversible after arrival', () => {
  const state = initial(1);
  assert.equal(placeCargo(state, 'edge-1', 0, 0, 0), true);
  assert.equal(placeCargo(state, 'edge-2', 2, 3, 0), true);
  assert.equal(harborStats(state).weight, 6);
  const result = dispatchCargo(state, firstShipping, 4000);
  assert.ok(result.voyage);
  assert.equal(arriveCargo(state, firstShipping), true);
  assert.equal(state.money, 9);
  assert.equal(undoVoyage(state), true);
  assert.equal(state.money, 12);
  assert.equal(state.trips, 0);
  assert.equal(state.harbor.feesPaid, 0);
  assert.deepEqual(
    state.harbor.cargo.filter(item => item.status === 'boat').map(item => item.id).sort(),
    ['edge-1', 'edge-2'],
  );
});

test('v1 harbor migration preserves bought stones, delivered status, and fee credit', () => {
  const state = initial(1);
  state.harbor = {
    version: 1,
    feesPaid: 2,
    cargo: [
      {id: 'corner-1', type: 'corner', status: 'delivered'},
      {id: 'corner-2', type: 'corner', status: 'quay'},
      {id: 'cap-1', type: 'cap', status: 'transit'},
      {id: 'edge-1', type: 'edge', status: 'market'},
    ],
  };
  state.trips = 1;
  state.money = 0;

  migrateHarbor(state, firstShipping);
  assert.equal(state.harbor.version, 2);
  assert.equal(state.harbor.legacyTrips, 1);
  assert.equal(state.trips, 1);
  assert.equal(state.harbor.feesPaid, 2);
  assert.equal(state.harbor.carriedOver, true);
  assert.equal(state.legacyHarbor.version, 1);
  assert.equal(state.money, 48, '13 coins of prior purchases and two fares are credited');
  assert.deepEqual(
    countByType(state.harbor.cargo.filter(item => item.status === 'delivered')),
    {corner: 1, cap: 1},
  );
  assert.deepEqual(
    countByType(state.harbor.cargo.filter(item => item.status === 'quay')),
    {corner: 1},
  );
  assert.equal(state.harbor.cargo.filter(item => item.status === 'market').length, 11);

  const snapshot = JSON.stringify(state);
  migrateHarbor(state, firstShipping);
  assert.equal(JSON.stringify(state), snapshot, 'migration is idempotent for v2 saves');
});

test('completed mission wages are awarded once, even when completion is revisited', () => {
  const state = initial(1);
  state.completed = ['egypt-1', 'egypt-2'];
  state.profile = {coins: 7, awarded: [], decorations: ['path']};

  assert.equal(awardCompletedMissions(state), 45);
  assert.equal(state.profile.coins, 52);
  assert.deepEqual(state.profile.awarded, ['egypt-1', 'egypt-2']);
  assert.equal(awardCompletedMissions(state), 0);
  assert.equal(state.profile.coins, 52);
});

test('entering an expansion build twice cannot replenish spent stock', () => {
  const s=initial(3);s.stage='harbor';s.harbor={finished:true};
  assert.equal(beginExpansionBuild(s,LEVELS[3]),true);
  s.inventory.brick--;s.freeInventory.brick--;
  assert.equal(beginExpansionBuild(s,LEVELS[3]),false);
  assert.equal(s.inventory.brick,3);
});
