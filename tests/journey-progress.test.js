import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,LEVELS} from '../game.js';
import {confirmOrder} from '../journey-game.js';
import {buyCargo,buyOrder,placeCargo,unloadAllCargo,dispatchCargo,arriveCargo} from '../harbor-game.js';
import {prepareJourneyProgress,canEnterLevel,restartJourneyLevel} from '../journey-progress.js';
import {awardCompletedMissions} from '../workshop-profile.js';
import {cargoGuidance} from '../cargo-guidance.js';

test('Level 1 requires all paid materials; sealing is immutable and does not earn a wage',()=>{
  const s=initial(0),l=LEVELS[0];prepareJourneyProgress(s);
  assert.equal(buyCargo(s,l,'brick'),false,'cannot buy before sealing');
  s.estimates={...l.requiredNewQuantities};assert.equal(confirmOrder(s,l),null);
  assert.equal(s.stage,'purchase');assert.equal(awardCompletedMissions(s),0);
  assert.equal(canEnterLevel(s,1),false);
  const order=structuredClone(s.expedition.orders.three);
  s.estimates.cap=8;assert.match(confirmOrder(s,l),/sealed/);
  assert.deepEqual(s.expedition.orders.three,order);
  for(const type of ['brick','edge','corner'])assert.equal(buyCargo(s,l,type,true),true);
  assert.equal(s.harbor.cargo.filter(c=>c.status==='quay').length,13);
  assert.equal(s.stage,'purchase');assert.equal(canEnterLevel(s,1),false);
  assert.equal(placeCargo(s,'brick-1',0,0),false);
  assert.equal(buyCargo(s,l,'cap'),true);
  assert.equal(s.stage,'complete');assert.equal(s.money,12);
  assert.ok(s.expedition.orders.three.purchased);assert.equal(canEnterLevel(s,1),true);
  assert.equal(awardCompletedMissions(s),20);
  assert.equal(buyOrder(s,l),false);assert.equal(awardCompletedMissions(s),0);
});

test('sealed stages cannot be revisited and restarting shipping keeps paid stock and rewards',()=>{
  const s=initial(1);s.completed=['egypt-1','egypt-2'];s.stage='complete';
  s.profile={coins:45,awarded:['egypt-1','egypt-2'],decorations:['path']};
  prepareJourneyProgress(s);s.expedition.activeLevel=1;
  s.harbor.cargo.forEach(c=>c.status='delivered');s.harbor.finished=true;
  s.harbor.feesPaid=9;s.money=3;s.trips=3;
  assert.equal(canEnterLevel(s,0),false);assert.equal(canEnterLevel(s,2),true);
  const r=restartJourneyLevel(s);
  assert.equal(r.stage,'harbor');assert.equal(r.money,12);assert.equal(r.trips,0);
  assert.ok(r.harbor.cargo.every(c=>c.status==='quay'));
  assert.equal(r.completed.includes('egypt-2'),false);assert.equal(canEnterLevel(r,2),false);
  assert.equal(canEnterLevel(r,0),false);
  assert.deepEqual(r.expedition.orders.three,s.expedition.orders.three);
  assert.deepEqual(r.profile,s.profile);
  r.completed.push('egypt-2');assert.equal(awardCompletedMissions(r),0);
});

test('unload all resets only the deck, leaving delivered cargo, voyages and fees intact',()=>{
  const s=initial(1),l=LEVELS[1];
  placeCargo(s,'edge-1',0,0,0);placeCargo(s,'edge-2',2,3,0);
  assert.ok(dispatchCargo(s,l,100).voyage);
  const transit=structuredClone(s);assert.equal(unloadAllCargo(s),false);assert.deepEqual(s,transit);
  arriveCargo(s,l);placeCargo(s,'corner-1',0,0,90);placeCargo(s,'brick-1',3,3,0);
  s.harbor.selected='corner-1';s.harbor.rotation=270;
  assert.equal(unloadAllCargo(s),true);
  assert.equal(s.harbor.cargo.filter(c=>c.status==='delivered').length,2);
  assert.equal(s.harbor.cargo.filter(c=>c.status==='quay').length,12);
  assert.equal(s.money,9);assert.equal(s.trips,1);assert.equal(s.harbor.feesPaid,3);
  assert.equal(s.harbor.selected,null);assert.equal(s.harbor.rotation,0);
  assert.ok(s.harbor.cargo.filter(c=>c.status==='quay').every(c=>c.column===null&&c.row===null));
  assert.equal(unloadAllCargo(s),false);
});

test('legacy shipping buys only the outstanding reserve and preserves an active voyage across reload',()=>{
  const s=initial(1),l=LEVELS[1];s.completed=['egypt-1'];
  placeCargo(s,'edge-1',0,0,0);placeCargo(s,'edge-2',2,3,0);dispatchCargo(s,l,100);
  const cap=s.harbor.cargo.find(c=>c.type==='cap');cap.status='market';s.money+=5;
  const v=structuredClone(s.harbor.inTransit);
  prepareJourneyProgress(s);
  assert.equal(s.money,9);assert.equal(cap.status,'quay');assert.deepEqual(s.harbor.inTransit,v);
  assert.ok(s.expedition.orders.three.purchased);
  const copy=structuredClone(s);prepareJourneyProgress(s);assert.deepEqual(s,copy);
});

test('restarting a sealed shopping level clears only that level and requires purchases again',()=>{
  const s=initial(0);prepareJourneyProgress(s);s.estimates={...LEVELS[0].requiredNewQuantities};
  confirmOrder(s,LEVELS[0]);buyOrder(s,LEVELS[0]);awardCompletedMissions(s);
  const r=restartJourneyLevel(s);
  assert.equal(r.stage,'order');assert.equal(r.money,63);assert.equal(r.harbor,undefined);
  assert.equal(r.expedition.orders.three,undefined);assert.equal(canEnterLevel(r,1),false);
  assert.equal(r.profile.coins,20);
});

test('cargo guidance explains rotation, both balance axes and retry at the relevant moment',()=>{
  const s=initial(1);
  assert.match(cargoGuidance(s),/Choose a stone/);
  s.harbor.selected='corner-1';assert.match(cargoGuidance(s),/Rotate.*R/);
  placeCargo(s,'corner-1',0,0,0);
  assert.match(cargoGuidance(s),/right.*stern/);
  placeCargo(s,'corner-2',3,2,180);
  assert.match(cargoGuidance(s),/Balanced.*Sail/);
});
