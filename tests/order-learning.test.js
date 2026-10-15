import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS, key} from '../game.js';
import {checkOrderCounts, countingStones, toggleCountMark} from '../order-learning.js';
import {confirmOrder} from '../journey-game.js';
import {canEnterLevel} from '../journey-progress.js';
import {buyOrder} from '../harbor-game.js';

test('counting help marks only the chosen shape, without filling answers or unlocking shipping', () => {
  const state=initial(0), level=LEVELS[0];
  state.counting={type:'corner',marks:[]};
  const stones=countingStones(level), corners=stones.filter(b=>b.type==='corner');
  for(const b of stones)assert.equal(toggleCountMark(state,level,key(b.x,b.y,b.z)),b.type==='corner');
  assert.equal(state.counting.marks.length,8);
  assert.deepEqual(state.estimates,{brick:'',edge:'',corner:'',cap:''});
  assert.equal(checkOrderCounts(level,state.estimates).correct,0);
  assert.equal(canEnterLevel(state,1),false);
  const cell=key(corners[0].x,corners[0].y,corners[0].z);
  toggleCountMark(state,level,cell);
  assert.equal(state.counting.marks.length,7,'a second tap undoes a mark');
  const reloaded=JSON.parse(JSON.stringify(state));
  assert.deepEqual(reloaded.counting,state.counting);
});

test('count feedback accepts zero but rejects blanks, fractions and invalid numbers', () => {
  const level=LEVELS[3];
  for(const value of ['',null,undefined,-1,1.5,Infinity,'words',31]) {
    const result=checkOrderCounts(level,{...level.requiredNewQuantities,brick:value});
    assert.equal(result.problem.type,'brick');
    assert.match(result.problem.message,/whole number/);
  }
  assert.equal(checkOrderCounts(level,level.requiredNewQuantities).problem,null);
  assert.match(checkOrderCounts(LEVELS[0],{brick:1,edge:4,corner:7,cap:1}).problem.message,/bigger.*bottom.*middle/);
  assert.match(checkOrderCounts(LEVELS[0],{brick:1,edge:5,corner:8,cap:1}).problem.message,/smaller/);
});

test('expansion counting excludes all saved upper stones and keeps zero-capstone reasoning', () => {
  const level=LEVELS[3], stones=countingStones(level);
  assert.equal(stones.length,16);
  assert.ok(stones.every(b=>b.y===0));
  assert.equal(stones.filter(b=>b.type==='cap').length,0);
  const result=checkOrderCounts(level,{...level.requiredNewQuantities,cap:1});
  assert.match(result.problem.message,/already built.*Zero/);
});

test('checking answers alone never awards or advances; exact counts and all purchases remain required', () => {
  const level=LEVELS[0],state=initial(0);
  state.estimates={...level.requiredNewQuantities};
  const before=structuredClone(state);
  assert.equal(checkOrderCounts(level,state.estimates).problem,null);
  assert.deepEqual(state,before);
  assert.equal(confirmOrder(state,level),null);
  assert.equal(canEnterLevel(state,1),false);
  assert.equal(buyOrder(state,level),true);
  assert.equal(canEnterLevel(state,1),true);
});
