import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundCacheKey,RenderReadiness} from '../render-state.js';
const camera={fov:46,aspect:1.2},direction={x:.2,y:-.3,z:.5};
const key=e=>backgroundCacheKey(1000,700,camera,direction,e);
test('identically sized civilization panoramas have distinct cache identities',()=>{
 const maps=['Egypt','Maya','Ur'].map(uuid=>({uuid,image:{width:1774},offset:{x:0,y:0},repeat:{x:1,y:1}}));
 assert.equal(new Set(maps.map(key)).size,3);
 const sequence=[maps[0],maps[1],maps[2],maps[0],maps[1],maps[2],maps[0]];
 sequence.slice(1).forEach((map,i)=>assert.notEqual(key(map),key(sequence[i])));
 assert.equal(key(maps[0]),key(maps[0]));
 assert.notEqual(key(maps[0]),key({...maps[0],offset:{x:.47,y:0}}));
});
test('loading complete is not ready until a textured frame has finished',()=>{
 const r=new RenderReadiness();r.beginScene();r.loadStart();assert.equal(r.ready,false);
 assert.equal(r.frameDone(),false);r.loadDone();assert.equal(r.ready,false);
 assert.equal(r.frameDone(),true);assert.equal(r.ready,true);
});
test('cached scene navigation also requires a new frame',()=>{
 const r=new RenderReadiness();
 for(const scene of ['Egypt','Maya','Ur','Egypt','Maya','Ur','Egypt']){
  r.beginScene();assert.equal(r.ready,false,scene);assert.equal(r.frameDone(),true,scene);
 }
 r.loadStart();assert.equal(r.ready,false);r.loadDone();assert.equal(r.ready,false);assert.equal(r.frameDone(),true);
});
