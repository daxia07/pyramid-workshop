import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARGO_SPECS,
  DECK,
  EXPANSION_THREE_VOYAGE_SOLUTION,
  THREE_VOYAGE_SOLUTION,
  canSail,
  footprint,
  loadMetrics,
  occupiedCells,
  placementProblem,
  suggestPlacement,
} from '../cargo-packing.js';

const boat = items => items.map((item, index) => ({
  id: item.id || `cargo-${index}`,
  status: 'boat',
  ...item,
}));

const item = (type, column, row, rotation = 0, extra = {}) => ({
  type,
  column,
  row,
  rotation,
  ...extra,
});

test('the padded sled catalogue and deck establish the intended puzzle scale', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CARGO_SPECS).map(([type, spec]) =>
    [type, {weight: spec.weight, tiles: spec.cells.length}])), {
    brick: {weight: 2, tiles: 2},
    edge: {weight: 3, tiles: 3},
    corner: {weight: 3, tiles: 3},
    cap: {weight: 5, tiles: 4},
  });
  assert.deepEqual(DECK.blocked, [[2, 1], [2, 2]]);
  assert.equal(DECK.columns, 5);
  assert.equal(DECK.rows, 4);
  assert.equal(DECK.capacity, 16);
  assert.equal(DECK.fee, 3);
  assert.ok(DECK.maxOffsetX > 0 && DECK.maxOffsetX < 0.5);
  assert.ok(DECK.maxOffsetZ > 0 && DECK.maxOffsetZ < 0.5);
});

test('footprints normalize and rotate domino, triomino and square sleds', () => {
  assert.deepEqual(footprint('brick', 0), [[0, 0], [1, 0]]);
  assert.deepEqual(footprint('brick', 90), [[0, 0], [0, 1]]);
  assert.deepEqual(footprint('edge', 90), [[0, 0], [0, 1], [0, 2]]);
  assert.deepEqual(footprint('corner', 0), [[0, 0], [1, 0], [0, 1]]);
  assert.deepEqual(footprint('corner', 90), [[0, 0], [1, 0], [1, 1]]);
  assert.deepEqual(footprint('cap', 0), footprint('cap', 90));
  assert.deepEqual(footprint('edge', 1), footprint('edge', 90), 'quarter-turn shorthand is accepted');
});

test('occupiedCells translates a normalized footprint to deck coordinates', () => {
  assert.deepEqual(occupiedCells(item('corner', 2, 1, 90)), [[2, 1], [3, 1], [3, 2]]);
  assert.deepEqual(occupiedCells(item('cap', 1, 2)), [[1, 2], [2, 2], [1, 3], [2, 3]]);
});

test('placement rejects deck edges, the mast and collisions', () => {
  assert.match(placementProblem([], item('edge', 3, 0), 3, 0, 0), /off the deck/);
  assert.match(placementProblem([], item('edge', 2, 0), 2, 0, 90), /mast/);
  assert.equal(placementProblem([], item('edge', 0, 0, 90), 0, 0), null,
    'an omitted rotation follows the item rotation');
  const existing = boat([item('brick', 0, 0)]);
  assert.match(placementProblem(existing, item('brick', 1, 0), 1, 0), /collides/);
});

test('only boat cargo occupies the deck while quay and delivered stock remain available', () => {
  const stock = [
    item('cap', 0, 0, 0, {id: 'cap-1', status: 'quay'}),
    item('edge', 0, 0, 0, {id: 'edge-1', status: 'delivered'}),
  ];
  assert.equal(placementProblem(stock, item('brick', 0, 0), 0, 0), null);
  assert.equal(placementProblem([...stock, ...boat([item('brick', 0, 0)])], item('brick', 1, 0), 1, 0),
    'That sled collides with another stone on the deck.');
});

test('loadMetrics reports mass, padded tiles and normalized centre offsets', () => {
  const metrics = loadMetrics(boat([item('brick', 0, 0)]));
  assert.deepEqual({items: metrics.items, weight: metrics.weight, tiles: metrics.tiles},
    {items: 1, weight: 2, tiles: 2});
  assert.equal(metrics.centerX, 1);
  assert.equal(metrics.centerZ, 0.5);
  assert.equal(metrics.offsetX, -0.6);
  assert.equal(metrics.offsetZ, -0.75);
  assert.equal(metrics.overweight, false);
  assert.equal(metrics.balanced, false);
});

test('both balance axes are enforced independently', () => {
  const lateral = boat([
    item('brick', 0, 0),
    item('brick', 0, 3),
  ]);
  const lateralMetrics = loadMetrics(lateral);
  assert.equal(lateralMetrics.offsetZ, 0);
  assert.ok(Math.abs(lateralMetrics.offsetX) > DECK.maxOffsetX);
  assert.match(canSail(lateral), /lateral/);

  const foreAft = boat([
    item('brick', 0, 0, 90),
    item('brick', 4, 0, 90),
  ]);
  const foreAftMetrics = loadMetrics(foreAft);
  assert.equal(foreAftMetrics.offsetX, 0);
  assert.ok(Math.abs(foreAftMetrics.offsetZ) > DECK.maxOffsetZ);
  assert.match(canSail(foreAft), /fore\/aft/);
});

test('capacity is a separate sailing constraint from spatial placement', () => {
  const heavy = boat([
    ...THREE_VOYAGE_SOLUTION[0].map((x, i) => ({...x, id: `solution-${i}`})),
    item('brick', 3, 0, 0, {id: 'extra-brick'}),
  ]);
  const metrics = loadMetrics(heavy);
  assert.equal(metrics.weight, 17);
  assert.equal(metrics.overweight, true);
  assert.match(canSail(heavy), /too heavy.*17\/16/);
});

test('placement hints find a valid open cell without solving the whole shipment', () => {
  const suggestion = suggestPlacement([], 'cap');
  assert.deepEqual(Object.keys(suggestion), ['type', 'column', 'row', 'rotation']);
  assert.equal(suggestion.type, 'cap');
  const candidate = {...suggestion, status: 'quay'};
  assert.equal(placementProblem([], candidate, suggestion.column, suggestion.row, suggestion.rotation), null);
  assert.equal(suggestPlacement([], 'unknown'), null);
});

test('the exported witness carries the complete order in three balanced voyages', () => {
  assert.equal(THREE_VOYAGE_SOLUTION.length, 3);
  const composition = {};
  let fees = 0;
  for (const [index, load] of THREE_VOYAGE_SOLUTION.entries()) {
    const cargo = boat(load.map((x, itemIndex) => ({...x, id: `v${index}-${itemIndex}`})));
    assert.equal(canSail(cargo), null, `voyage ${index + 1} should be sail-worthy`);
    const metrics = loadMetrics(cargo);
    assert.ok(metrics.weight <= DECK.capacity);
    assert.equal(metrics.balanced, true);
    for (const stone of load) composition[stone.type] = (composition[stone.type] || 0) + 1;
    fees += DECK.fee;
  }
  assert.deepEqual(composition, {corner: 8, edge: 4, cap: 1, brick: 1});
  assert.equal(fees, 9);
});

test('the witness does not reuse a deck cell or put a sled through the mast', () => {
  for (const load of THREE_VOYAGE_SOLUTION) {
    const seen = new Set();
    for (const stone of load) {
      for (const [column, row] of occupiedCells(stone)) {
        assert.ok(column >= 0 && column < DECK.columns);
        assert.ok(row >= 0 && row < DECK.rows);
        assert.equal(DECK.blocked.some(([c, r]) => c === column && r === row), false);
        const cell = `${column},${row}`;
        assert.equal(seen.has(cell), false, `duplicate deck cell ${cell}`);
        seen.add(cell);
      }
    }
  }
});

test('the four-layer expansion order also has a balanced three-voyage witness', () => {
  assert.equal(EXPANSION_THREE_VOYAGE_SOLUTION.length, 3);
  const composition = {};
  let totalWeight = 0;
  for (const [index, load] of EXPANSION_THREE_VOYAGE_SOLUTION.entries()) {
    const cargo = boat(load.map((x, itemIndex) => ({...x, id: `exp-${index}-${itemIndex}`})));
    assert.equal(canSail(cargo), null, `expansion voyage ${index + 1} should be sail-worthy`);
    const metrics = loadMetrics(cargo);
    assert.ok(metrics.weight <= DECK.capacity);
    assert.equal(metrics.balanced, true);
    totalWeight += metrics.weight;
    for (const stone of load) composition[stone.type] = (composition[stone.type] || 0) + 1;
  }
  assert.deepEqual(composition, {edge: 8, brick: 4, corner: 4});
  assert.equal(totalWeight, 44);
  assert.ok(totalWeight > DECK.capacity * 2, 'two voyages cannot carry the expansion order');
});
