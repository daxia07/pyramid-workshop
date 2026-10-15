import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS} from '../game.js';
import {dispatchCargo,dispatchProblem,placeCargo,arriveCargo,undoVoyage} from '../harbor-game.js';

test('small trips cannot spend the fares needed for the stones still waiting',()=>{
  const state=initial(1),level=LEVELS[1];
  placeCargo(state,'edge-1',0,0,0);placeCargo(state,'edge-2',2,3,0);
  assert.ok(dispatchCargo(state,level,100).voyage);
  arriveCargo(state,level);
  placeCargo(state,'edge-3',0,0,0);placeCargo(state,'edge-4',2,3,0);
  assert.ok(dispatchCargo(state,level,200).voyage);
  arriveCargo(state,level);
  placeCargo(state,'corner-1',0,0,0);placeCargo(state,'corner-2',3,2,180);
  const before=structuredClone(state);
  assert.match(dispatchProblem(state,level),/Pack more stones/);
  assert.match(dispatchCargo(state,level).problem,/2 more trips/);
  assert.deepEqual(state,before,'a blocked departure never spends coins or moves cargo');
  assert.equal(undoVoyage(state),true);
  assert.equal(state.money,9);
  assert.equal(state.trips,1);
});

test('the final fare cannot leave a stone behind, but can carry the last balanced load',()=>{
  const state=initial(1),level=LEVELS[1];
  state.money=3;
  state.harbor.cargo.forEach(c=>c.status='delivered');
  for(const id of ['corner-1','corner-2','brick-1'])state.harbor.cargo.find(c=>c.id===id).status='quay';
  placeCargo(state,'corner-1',0,0,0);placeCargo(state,'corner-2',3,2,180);
  assert.match(dispatchProblem(state,level),/1 more trip.*1 stone/);
  placeCargo(state,'brick-1',1,3,0);
  assert.equal(dispatchProblem(state,level),null);
});
