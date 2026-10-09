import {SCENES, LEVELS, cells, key, supported} from './game.js';

export const STONE_STYLES = {
  limestone: {name: 'Ivory limestone', color: '#eee5ca', tint: 0xffffff},
  sandstone: {name: 'Golden sandstone', color: '#d6ac6b', tint: 0xd9b578},
  granite: {name: 'Rose granite', color: '#c39386', tint: 0xc49a91},
  basalt: {name: 'Midnight basalt', color: '#5b6460', tint: 0x737e79},
};
export const GARDEN_SLOTS = ['Front left', 'Entrance', 'Front right', 'Right garden', 'Back right', 'Rear garden', 'Back left', 'Left garden'];
export function gardenPosition(slot, size) {
  const r = size / 2 + 1.1;
  const points = [[-r,r],[0,r],[r,r],[r,0],[r,-r],[0,-r],[-r,-r],[-r,0]];
  return {x: points[slot][0], z: points[slot][1]};
}

export function studioBlueprint(size, shape = 'smooth') {
  return Array.from({length:size},(_,y)=>cells(size-y,y).map(b=>{
    const edge = (size-y-1)/2, x = Math.abs(b.x) === edge, z = Math.abs(b.z) === edge;
    return {...b,type:edge===0?'cap':shape==='stepped'?'brick':x&&z?'corner':x||z?'edge':'brick'};
  })).flat();
}
export function createStudio() {
  return {size:3,shape:'smooth',stoneStyle:'limestone',blocks:studioBlueprint(3),layer:0,part:'corner',tool:'place',tab:'design',decorations:{},decoration:'path',history:[]};
}
const levelCache = new Map();
export function studioLevel(studio) {
  const cacheKey = `${studio.size}:${studio.shape}:${studio.stoneStyle}`;
  if (!levelCache.has(cacheKey)) levelCache.set(cacheKey, {...SCENES[0],missionId:'studio',name:'Your own wonder',
    dims:Array.from({length:studio.size},(_,i)=>studio.size-i),blueprint:studioBlueprint(studio.size,studio.shape),
    seed:[],mechanics:[],budget:0,lesson:'Your design. Your pace.',stoneTint:STONE_STYLES[studio.stoneStyle].tint});
  return levelCache.get(cacheKey);
}
export const worldLevel = state => state.studioMode ? studioLevel(state) : LEVELS[state.level];

export function studioSnapshot(studio) {
  studio.history.push({blocks:structuredClone(studio.blocks),decorations:{...studio.decorations}});
  if(studio.history.length>40)studio.history.shift();
}
export function redesignStudio(studio, size, shape) {
  if(![3,5,7].includes(size)||!['smooth','stepped'].includes(shape))return false;
  studio.size=size;studio.shape=shape;studio.blocks=studioBlueprint(size,shape);studio.layer=0;studio.history=[];
  return true;
}
export function placeStudioStone(studio,x,y,z) {
  const index=studio.blocks.findIndex(b=>key(b.x,b.y,b.z)===key(x,y,z));
  if(studio.tool==='remove') {
    if(index<0)return 'Tap a stone to lift it out.';
    const rest=studio.blocks.filter((_,i)=>i!==index);
    if(rest.some(b=>supported(b,studio.blocks,studioLevel(studio))&&!supported(b,rest,studioLevel(studio))))return 'Lift out the stones above this one first.';
    studioSnapshot(studio);studio.blocks=rest;return null;
  }
  if(index>=0)return 'A stone is already there. Lift it out to change its shape.';
  const b={x,y,z,type:studio.part};
  if(!supported(b,studio.blocks,studioLevel(studio)))return 'Build a solid support below this stone first.';
  studioSnapshot(studio);studio.blocks.push(b);return null;
}
export function fillStudioLayer(studio) {
  const next=studioLevel(studio).blueprint.filter(b=>b.y===studio.layer&&!studio.blocks.some(p=>key(p.x,p.y,p.z)===key(b.x,b.y,b.z)));
  if(!next.length)return 'This layer is full. Choose a higher layer or lift out a stone.';
  if(next.some(b=>!supported(b,studio.blocks,studioLevel(studio))))return 'Complete the support below this layer first.';
  studioSnapshot(studio);studio.blocks.push(...structuredClone(next));return null;
}
export function decorateStudio(studio, profile, slot) {
  if(!Number.isInteger(slot)||slot<0||slot>=GARDEN_SLOTS.length)return false;
  if(studio.decoration!=='remove'&&!profile.decorations.includes(studio.decoration))return false;
  studioSnapshot(studio);
  if(studio.decoration==='remove')delete studio.decorations[slot];
  else studio.decorations[slot]=studio.decoration;
  return true;
}
