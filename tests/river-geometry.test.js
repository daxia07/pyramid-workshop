import test from 'node:test';import assert from 'node:assert/strict';
import {shoreline,riverWidth,createRiverGeometry} from '../river-geometry.js';
test('one river remains west of the entire building footprint, without surrounding it',()=>{
 for(let z=-70;z<=70;z+=.35){assert.ok(shoreline(z)<-7.5);assert.ok(riverWidth(z)>=7);}
});
test('river and both bank edges share precisely the same shoreline vertices',()=>{
 const {water,banks}=createRiverGeometry(),w=water.attributes.position,b=banks.attributes.position;
 for(let i=0;i<w.count/2;i++){assert.equal(w.getX(i*2),b.getX(i*10));assert.equal(w.getX(i*2+1),b.getX(i*10+5));assert.equal(w.getZ(i*2),b.getZ(i*10));assert.equal(w.getY(i*2),b.getY(i*10));}
 assert.ok(w.count>700);for(const geo of[water,banks])assert.ok([...geo.attributes.position.array].every(Number.isFinite));
});
