import test from 'node:test';import assert from 'node:assert/strict';
import {riseHeight,earthenRiseGeometry} from '../earthen-rise.js';
test('raised teaching site remains flat at exact elevation under all block and stair positions',()=>{for(const size of[5.3,7.3])for(let x=-size/2;x<=size/2;x+=.1)for(let z=-size/2;z<=size/2;z+=.1)assert.equal(riseHeight(x,z,size),1);});
test('front access slopes continuously from the workyard onto the higher site',()=>{let previous=1;for(let z=3.65;z<8;z+=.05){const h=riseHeight(0,z,7.3);assert.ok(h<=previous+1e-9);assert.ok(previous-h<.03);previous=h;}assert.equal(previous,0);assert.ok([...earthenRiseGeometry(7.3).attributes.position.array].every(Number.isFinite));});
