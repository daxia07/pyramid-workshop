import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, LEVELS} from '../game.js';
import {buyCargo, placeCargo, unloadCargo, harborStats, dispatchProblem, dispatchCargo, arriveCargo, migrateHarbor} from '../harbor-game.js';
const level=LEVELS[1];
function purchased(){const s=initial(1);for(let i=0;i<4;i++)assert.ok(buyCargo(s,level,'corner'));assert.ok(buyCargo(s,level,'cap'));return s;}

test('the quarry order and two shipping fees fit the exact contract budget',()=>{
  const s=purchased();assert.equal(s.money,4);assert.equal(buyCargo(s,level,'cap'),false);
  placeCargo(s,'cap-1',0);placeCargo(s,'corner-1',1);
  assert.equal(dispatchProblem(s,level),null);assert.ok(dispatchCargo(s,level).voyage);
  assert.equal(s.money,2);assert.equal(s.harbor.feesPaid,2);
  assert.equal(dispatchCargo(s,level).voyage,undefined,'cannot charge twice while sailing');
  const saved=JSON.parse(JSON.stringify(s));assert.ok(arriveCargo(saved,level));assert.equal(arriveCargo(saved,level),false);
  ['corner-2','corner-3','corner-4'].forEach((id,i)=>placeCargo(saved,id,i));
  assert.equal(harborStats(saved,level).weight,6);assert.ok(dispatchCargo(saved,level).voyage);arriveCargo(saved,level);
  assert.equal(saved.money,0);assert.equal(saved.trips,2);assert.equal(saved.harbor.feesPaid,4);
  assert.equal(saved.stage,'complete');assert.ok(saved.completed.includes('egypt-2'));
  assert.equal(saved.blocks.length,level.seed.length,'shipping ends without repeating the construction');
});
test('the load can be overweight or unbalanced while arranging, but cannot sail or charge a fee',()=>{
  const s=purchased();placeCargo(s,'cap-1',0);placeCargo(s,'corner-1',2);
  assert.match(dispatchProblem(s,level),/leans/);
  const before=JSON.stringify(s);assert.ok(dispatchCargo(s,level).problem);assert.equal(JSON.stringify(s),before);
  placeCargo(s,'corner-1',1);placeCargo(s,'corner-2',2);
  assert.match(dispatchProblem(s,level),/Too heavy/);
  assert.equal(s.money,4);
});
test('the shipping budget explains an inefficient load before it can strand the player',()=>{
  const s=purchased();placeCargo(s,'corner-1',0);placeCargo(s,'corner-2',1);
  assert.match(dispatchProblem(s,level),/7 weight.*2 more trips/);
  assert.equal(s.trips,0);
});
test('moving, swapping and unloading cargo preserves every purchased stone',()=>{
  const s=purchased();placeCargo(s,'cap-1',0);placeCargo(s,'corner-1',1);placeCargo(s,'cap-1',1);
  assert.equal(s.harbor.cargo.find(c=>c.id==='corner-1').slot,0);
  placeCargo(s,'corner-2',1);assert.equal(s.harbor.cargo.find(c=>c.id==='cap-1').status,'quay');
  assert.ok(unloadCargo(s,'corner-2'));assert.equal(s.harbor.cargo.length,5);
  assert.equal(placeCargo(s,'made-up',0),false);assert.equal(placeCargo(s,'cap-1',6),false);
});
test('old boat progress migrates once without losing purchases, shipments or completed missions',()=>{
  const s=initial(1);delete s.harbor;s.money=3;s.stage='shop';s.inventory.corner=1;s.inventory.cap=1;s.warehouse.corner=3;s.trips=1;
  migrateHarbor(s,level);assert.equal(s.money,4);assert.equal(harborStats(s,level).delivered,2);
  assert.equal(s.harbor.cargo.filter(c=>c.status==='quay').length,3);
  const before=JSON.stringify(s);migrateHarbor(s,level);assert.equal(JSON.stringify(s),before);
  ['corner-2','corner-3','corner-4'].forEach((id,i)=>placeCargo(s,id,i));dispatchCargo(s,level);arriveCargo(s,level);
  assert.equal(s.stage,'complete');assert.equal(s.money,2);
});
test('purchases and rearrangement are locked during a saved voyage',()=>{
  const s=purchased();placeCargo(s,'cap-1',0);placeCargo(s,'corner-1',1);dispatchCargo(s,level);
  assert.equal(placeCargo(s,'corner-2',3),false);assert.equal(unloadCargo(s,'cap-1'),false);
  assert.equal(buyCargo(s,level,'corner'),false);assert.equal(s.harbor.inTransit.weight,5);
});
