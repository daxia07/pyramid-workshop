import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS} from '../game.js';
import {cargoCoach, nextCargoPlacement} from '../cargo-coach.js';
import {THREE_VOYAGE_SOLUTION, EXPANSION_THREE_VOYAGE_SOLUTION} from '../cargo-packing.js';
import {arriveCargo, buyOrder, dispatchCargo, placeCargo} from '../harbor-game.js';
import {cargoGuidance} from '../cargo-guidance.js';
import {confirmOrder} from '../journey-game.js';
import {awardCompletedMissions} from '../workshop-profile.js';

const shipping = LEVELS[1];
const expansion = LEVELS[3];

function placeRoute(state, route) {
  for (const placement of route) {
    const item = state.harbor.cargo.find(candidate =>
      candidate.status === 'quay' && candidate.type === placement.type);
    assert.ok(item, `a quay ${placement.type} is available`);
    assert.equal(placeCargo(state, item.id, placement.column, placement.row, placement.rotation), true);
  }
}

test('cargo coach offers one witness placement and never mutates the load', () => {
  const state = initial(1);
  const before = structuredClone(state);
  const hint = cargoCoach(state, shipping);

  assert.equal(hint.status, 'place');
  assert.deepEqual(hint.suggestion, {
    itemId: 'corner-1', type: 'corner', column: 3, row: 1, rotation: 0,
  });
  assert.deepEqual(nextCargoPlacement(state, shipping), hint.suggestion);
  assert.deepEqual(state, before);
});

test('coach accepts any order for a partial witness deck', () => {
  const state = initial(1);
  const [first, second] = THREE_VOYAGE_SOLUTION[0];

  assert.equal(placeCargo(state, 'corner-1', second.column, second.row, second.rotation), true);
  const hint = cargoCoach(state, shipping);
  assert.equal(hint.status, 'place');
  assert.equal(hint.suggestion.type, first.type);
  assert.deepEqual(
    [hint.suggestion.column, hint.suggestion.row, hint.suggestion.rotation],
    [first.column, first.row, first.rotation],
  );
});

test('coach asks for an unload when the current deck diverges from the witness', () => {
  const state = initial(1);
  assert.equal(placeCargo(state, 'corner-1', 0, 0, 0), true);
  const before = structuredClone(state);
  const hint = cargoCoach(state, shipping);

  assert.equal(hint.status, 'unload');
  assert.equal(hint.action, 'unload-all');
  assert.deepEqual(state, before);
});

test('coach copy names the stone and tells the child to rotate before tapping', () => {
  const state = initial(1);
  const hint = cargoCoach(state, shipping);

  assert.match(hint.text, /Rotate the corner stone/);
  assert.match(hint.text, /then tap deck D2/);
  assert.ok(hint.text.indexOf('Rotate') < hint.text.indexOf('tap'));
});

test('coach identifies a different completed voyage as an undo point', () => {
  const state = initial(1);
  assert.equal(placeCargo(state, 'edge-1', 0, 0, 0), true);
  assert.equal(placeCargo(state, 'edge-2', 2, 3, 0), true);
  assert.ok(dispatchCargo(state, shipping, 100).voyage);
  assert.equal(arriveCargo(state, shipping), true);

  const hint = cargoCoach(state, shipping);
  assert.equal(hint.status, 'undo');
  assert.equal(hint.action, 'undo-voyage');
  assert.equal(hint.voyage, 1);
});

test('coach reports sail only after the whole planned load is placed', () => {
  const state = initial(1);
  placeRoute(state, THREE_VOYAGE_SOLUTION[0]);
  const hint = cargoCoach(state, shipping);

  assert.equal(hint.status, 'sail');
  assert.equal(hint.voyage, 1);
});

test('coach does not call a no-coin load ready to sail', () => {
  const state = initial(1);
  placeRoute(state, THREE_VOYAGE_SOLUTION[0]);
  state.money = 2;
  const hint = cargoCoach(state, shipping);

  assert.equal(hint.status, 'money');
  assert.equal(hint.action, 'restart-level');
});

test('expansion coach uses the sixteen-stone witness route', () => {
  const state = initial(3);
  state.estimates = {...expansion.requiredNewQuantities};
  assert.equal(confirmOrder(state, expansion), null);
  assert.equal(buyOrder(state, expansion), true);
  const hint = cargoCoach(state, expansion);

  assert.equal(hint.status, 'place');
  assert.deepEqual(hint.suggestion, {
    itemId: 'edge-1', type: 'edge', column: 0, row: 0, rotation: 180,
  });
  assert.deepEqual(nextCargoPlacement(state, expansion), hint.suggestion);
  assert.ok(EXPANSION_THREE_VOYAGE_SOLUTION[0].some(p => p.type === hint.suggestion.type));
});

test('balanced guidance warns when the next fare cannot be paid', () => {
  const state = initial(1);
  assert.equal(placeCargo(state, 'edge-1', 0, 0, 0), true);
  assert.equal(placeCargo(state, 'edge-2', 2, 3, 0), true);
  state.money = 2;

  assert.match(cargoGuidance(state), /costs 3 coins/);
  assert.match(cargoGuidance(state), /Restart this level/);
});

function followCoach(state, level, reloadAfter = 0) {
  let placements = 0;
  for (let voyage = 0; voyage < 3; voyage++) {
    while (true) {
      const hint = cargoCoach(state, level);
      assert.notEqual(hint.status, 'unload');
      assert.notEqual(hint.status, 'undo');
      if (hint.status === 'sail') break;
      assert.equal(hint.status, 'place');
      const before = structuredClone(state);
      const suggestion = hint.suggestion;
      assert.equal(placeCargo(state, suggestion.itemId, suggestion.column, suggestion.row, suggestion.rotation), true);
      assert.notDeepEqual(state, before, 'the test placement changes the deck, not the coach');
      placements++;
      if (placements === reloadAfter) state = JSON.parse(JSON.stringify(state));
    }
    assert.equal(state.completed.includes(level.missionId), false,
      'a ready hint does not complete the mission');
    assert.ok(dispatchCargo(state, level, 1000 + voyage).voyage);
    assert.equal(state.completed.includes(level.missionId), false,
      'dispatch does not complete the mission before arrival');
    assert.equal(arriveCargo(state, level), true);
    if (voyage < 2) assert.equal(state.completed.includes(level.missionId), false);
  }
  return state;
}

test('coached first shipment completes after arrival, including a save and reload', () => {
  const state = initial(1);
  state.profile = {coins: 0, awarded: [], decorations: []};
  const completed = followCoach(state, shipping, 4);

  assert.equal(completed.stage, 'complete');
  assert.ok(completed.completed.includes('egypt-2'));
  assert.equal(completed.profile.coins, 0, 'arrival does not award the wage by itself');
  assert.equal(awardCompletedMissions(completed), 25);
  assert.equal(completed.profile.coins, 25);
  assert.equal(cargoCoach(completed, shipping).status, 'complete');
});

test('coached expansion shipment also survives a save and waits for building', () => {
  let state = initial(3);
  state.profile = {coins: 0, awarded: [], decorations: []};
  state.estimates = {...expansion.requiredNewQuantities};
  assert.equal(confirmOrder(state, expansion), null);
  assert.equal(buyOrder(state, expansion), true);
  state = followCoach(state, expansion, 7);

  assert.equal(state.harbor.finished, true);
  assert.equal(state.stage, 'harbor');
  assert.equal(state.completed.includes('egypt-4'), false, 'delivery alone does not pass the expansion build');
  assert.equal(state.profile.coins, 0, 'delivery alone does not award the expansion wage');
  assert.equal(cargoCoach(state, expansion).status, 'complete');
});
