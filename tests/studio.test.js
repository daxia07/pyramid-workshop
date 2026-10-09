import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, validate} from '../game.js';
import {awardCompletedMissions, unlockDecoration} from '../workshop-profile.js';
import {createStudio, studioBlueprint, studioLevel, redesignStudio, placeStudioStone, fillStudioLayer, decorateStudio, gardenPosition} from '../studio-game.js';

test('completed missions earn persistent wages once, including earlier saved discoveries',()=>{
  const s=initial();s.completed=['egypt-1','egypt-2','egypt-3'];
  assert.equal(awardCompletedMissions(s),75);assert.equal(s.profile.coins,75);
  assert.equal(awardCompletedMissions(s),0);
  assert.ok(unlockDecoration(s.profile,'palms'));assert.equal(s.profile.coins,65);
  assert.equal(unlockDecoration(s.profile,'palms'),false);assert.equal(s.profile.coins,65);
  const restored=JSON.parse(JSON.stringify(s));assert.equal(awardCompletedMissions(restored),0);assert.equal(restored.profile.coins,65);
  restored.completed.push('egypt-4');assert.equal(awardCompletedMissions(restored),35);
});
test('unaffordable decorations cannot spend contract funds or create negative earned balances',()=>{
  const s=initial();awardCompletedMissions(s);const budget=s.money;
  assert.equal(unlockDecoration(s.profile,'pool'),false);assert.equal(s.profile.coins,0);assert.equal(s.money,budget);
});
test('all studio sizes and silhouettes form supported centered pyramids',()=>{
  for(const size of[3,5,7])for(const shape of['smooth','stepped']){
    const s=createStudio();redesignStudio(s,size,shape);
    assert.equal(s.blocks.length,size*(size+1)*(2*size+1)/6);
    assert.deepEqual(validate(studioLevel(s),s.blocks),{missing:0,wrong:0,extra:0,unsupported:0});
    for(let slot=0;slot<8;slot++){const p=gardenPosition(slot,size);assert.ok(Math.max(Math.abs(p.x),Math.abs(p.z))>size/2);}
  }
});
test('free building consumes no currency and retains structural support rules',()=>{
  const s=createStudio();s.blocks=[];
  s.part='cap';assert.match(placeStudioStone(s,0,2,0),/support/);
  for(let y=0;y<3;y++){s.layer=y;assert.equal(fillStudioLayer(s),null);}
  assert.equal(s.blocks.length,14);assert.ok(s.history.length);
  s.tool='remove';assert.match(placeStudioStone(s,1,0,1),/above/);
  assert.equal(placeStudioStone(s,0,2,0),null);assert.equal(s.blocks.length,13);
  s.tool='place';s.part='cap';assert.equal(placeStudioStone(s,0,2,0),null);
});
test('decorations require an unlock, can be placed repeatedly, and preserve ownership when removed',()=>{
  const state=initial();state.completed=['egypt-1'];awardCompletedMissions(state);const s=createStudio();
  s.decoration='pool';assert.equal(decorateStudio(s,state.profile,0),false);
  unlockDecoration(state.profile,'palms');s.decoration='palms';
  assert.ok(decorateStudio(s,state.profile,0));assert.ok(decorateStudio(s,state.profile,2));assert.equal(state.profile.coins,10);
  s.decoration='remove';decorateStudio(s,state.profile,0);assert.equal(s.decorations[0],undefined);assert.ok(state.profile.decorations.includes('palms'));
  assert.equal(decorateStudio(s,state.profile,99),false);
});
test('changing size keeps the palette and garden, and rejects unsupported sizes',()=>{
  const s=createStudio();s.stoneStyle='granite';s.decorations={1:'path'};
  assert.ok(redesignStudio(s,7,'stepped'));assert.equal(s.stoneStyle,'granite');assert.deepEqual(s.decorations,{1:'path'});
  assert.equal(redesignStudio(s,200,'smooth'),false);assert.equal(s.size,7);
  assert.equal(studioBlueprint(3).filter(b=>b.type==='cap').length,1);
});
