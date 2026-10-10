import {CARGO_SPECS, DECK, canSail, loadMetrics, placementProblem} from './cargo-packing.js';

export const isHarbor = (level, state) => level.journeyRole === 'cargo'
  || level.journeyRole === 'expand' && state?.stage === 'harbor';
export const isQuarry = (level, state) => isHarbor(level, state)
  || level.journeyRole === 'order' || level.journeyRole === 'expand' && ['order','purchase'].includes(state?.stage);
export const VOYAGE_MS = 7600;
export function createHarbor(level, purchased=false) {
  return {version:2, cargo:Object.entries(level.requiredNewQuantities).flatMap(([type,count]) =>
    Array.from({length:count}, (_,i) => ({id:`${type}-${i+1}`, type, status:purchased?'quay':'market', column:null, row:null, rotation:0}))),
    selected:null, rotation:0, voyages:[], feesPaid:0, inTransit:null};
}

// Purchases and delivered stones from the smaller, earlier contract keep their value.
export function migrateHarbor(state, level) {
  if (!isHarbor(level,state) || state.harbor?.version === 2) return;
  const previous=state.harbor;
  const h=createHarbor(level);
  if (previous) {
    state.legacyHarbor=structuredClone(previous);
    for(const type of level.types) {
      const old=previous.cargo.filter(c=>c.type===type && c.status!=='market');
      const items=h.cargo.filter(c=>c.type===type);
      old.forEach((c,i)=>{if(items[i])items[i].status=['delivered','transit'].includes(c.status)?'delivered':'quay';});
    }
    h.legacyTrips=state.trips||0;
    h.feesPaid=previous.feesPaid||0;
    h.carriedOver=true;
  } else {
    for(const type of level.types) {
      const delivered=(state.inventory[type]||0)+state.blocks.filter(b=>b.type===type&&b.provenance==='purchase').length;
      h.cargo.filter(c=>c.type===type).forEach((c,i)=>{
        c.status=i<delivered?'delivered':i<delivered+(state.warehouse[type]||0)?'quay':'market';
      });
    }
    h.carriedOver=true;
  }
  const bought=h.cargo.filter(c=>c.status!=='market').reduce((n,c)=>n+level.prices[c.type],0);
  state.money=level.budget-bought-h.feesPaid;
  state.harbor=h;state.stage='harbor';state.trips=h.legacyTrips||0;
  state.inventory=Object.fromEntries(level.types.map(t=>[t,0]));state.warehouse={...state.inventory};state.history=[];
}
export function harborStats(state,level) {
  const h=state.harbor, load=h.cargo.filter(c=>c.status==='boat');
  return {...loadMetrics(h.cargo),load,delivered:h.cargo.filter(c=>c.status==='delivered').length,
    purchaseReserve:h.cargo.filter(c=>c.status==='market').reduce((n,c)=>n+(level?.prices?.[c.type]||0),0)};
}
export function buyCargo(state, level, type, all=false) {
  const h=state.harbor;
  if(!h||h.inTransit||state.stage!=='purchase')return false;
  const items=h.cargo.filter(c=>c.type===type&&c.status==='market');
  const count=all?items.length:Math.min(1,items.length);
  if(!count||state.money<level.prices[type]*count)return false;
  state.money-=level.prices[type]*count;
  items.slice(0,count).forEach(c=>c.status='quay');
  h.selected=items[0].id;h.rotation=0;
  completePurchases(state,level);
  return true;
}
export function buyOrder(state,level) {
  const h=state.harbor;
  if(!h||h.inTransit||state.stage!=='purchase')return false;
  const items=h.cargo.filter(c=>c.status==='market');
  const cost=items.reduce((n,c)=>n+level.prices[c.type],0);
  if(!items.length||cost>state.money)return false;
  state.money-=cost;items.forEach(c=>c.status='quay');h.selected=items[0].id;h.rotation=0;completePurchases(state,level);return true;
}
function completePurchases(state,level) {
  const h=state.harbor;
  h.selected=null;
  if(!h.cargo.length||h.cargo.some(c=>c.status==='market'))return;
  const order=state.expedition?.orders?.[level.journeyRole==='expand'?'expansion':'three'];
  if(order){order.purchased=true;order.shippingBudget=state.money;}
  if(level.journeyRole==='order') {
    state.stage='complete';
    h.earnedThisRun=!state.profile?.awarded?.includes(level.missionId);
    if(!state.completed.includes(level.missionId))state.completed.push(level.missionId);
  } else state.stage='harbor';
}
export function placeCargo(state, id, column, row, rotation=state.harbor.rotation) {
  const h=state.harbor;
  if(h.inTransit||state.stage!=='harbor')return false;
  const item=h.cargo.find(c=>c.id===id&&['quay','boat'].includes(c.status));
  if(!item||placementProblem(h.cargo,item,column,row,rotation))return false;
  Object.assign(item,{status:'boat',column,row,rotation});h.selected=null;h.rotation=0;return true;
}
export function unloadCargo(state,id) {
  const h=state.harbor;if(h.inTransit||state.stage!=='harbor')return false;
  const item=h.cargo.find(c=>c.id===id&&c.status==='boat');if(!item)return false;
  Object.assign(item,{status:'quay',column:null,row:null});h.selected=item.id;h.rotation=item.rotation;return true;
}
export function unloadAllCargo(state) {
  const h=state.harbor;
  if(!h||h.inTransit||h.finished||state.stage!=='harbor')return false;
  const load=h.cargo.filter(c=>c.status==='boat');
  if(!load.length)return false;
  load.forEach(c=>Object.assign(c,{status:'quay',column:null,row:null,rotation:0}));
  h.selected=null;h.rotation=0;return true;
}
export function dispatchProblem(state,level) {
  if(state.harbor.inTransit)return 'Your boat is on the river.';
  if(state.stage!=='harbor')return 'Finish buying the sealed order before loading the boat.';
  if(state.harbor.cargo.some(c=>c.status==='market'))return 'Buy every stone in the order before shipping.';
  const problem=canSail(state.harbor.cargo);if(problem)return problem;
  const reserve=state.harbor.cargo.filter(c=>c.status==='market').reduce((n,c)=>n+level.prices[c.type],0);
  if(state.money<DECK.fee+reserve)return 'Keep the coins for your remaining stones. Undo a voyage to reclaim its shipping fee.';
  return null;
}
export function dispatchCargo(state,level,now=Date.now()) {
  if(state.stage!=='harbor')return{problem:'This shipment is complete.'};
  const problem=dispatchProblem(state,level);if(problem)return{problem};
  const {load,weight,offsetX,offsetZ}=harborStats(state);
  const voyage={number:state.trips+1,ids:load.map(c=>c.id),placements:structuredClone(load),weight,offsetX,offsetZ,fee:DECK.fee,startedAt:now};
  state.money-=DECK.fee;state.harbor.feesPaid+=DECK.fee;state.trips++;
  state.harbor.inTransit=voyage;state.harbor.selected=null;state.harbor.showOrder=false;
  load.forEach(c=>c.status='transit');return{voyage};
}
export function arriveCargo(state,level) {
  const h=state.harbor,voyage=h.inTransit;if(!voyage)return false;
  h.cargo.filter(c=>voyage.ids.includes(c.id)).forEach(c=>c.status='delivered');
  h.voyages.push(voyage);h.inTransit=null;
  if(h.cargo.every(c=>c.status==='delivered')) {
    state.expedition ||= {};
    state.expedition.delivered ||= {};
    state.expedition.delivered[level.journeyRole==='expand'?'expansion':'three']={...level.requiredNewQuantities};
    // Arrival is a reviewable checkpoint. The player chooses when to open the building site.
    h.finished=true;
    if(level.journeyRole==='cargo') {
      h.earnedThisRun=!state.profile?.awarded?.includes(level.missionId);
      state.stage='complete';
      if(!state.completed.includes(level.missionId))state.completed.push(level.missionId);
    }
  }
  return true;
}
export function beginExpansionBuild(state,level) {
  if(!state.harbor?.finished||level.journeyRole!=='expand'||state.stage!=='harbor')return false;
  state.inventory=Object.fromEntries(level.types.map(t=>[t,level.requiredNewQuantities[t]||0]));
  state.freeInventory={...state.inventory};state.stage='build';state.layer=0;state.part='corner';state.scaffold=true;state.history=[];return true;
}
export function undoVoyage(state) {
  const h=state.harbor;
  if(h.inTransit||!h.voyages.length||state.stage!=='harbor'||h.finished)return false;
  const v=h.voyages.pop();
  h.cargo.filter(c=>c.status==='boat').forEach(c=>Object.assign(c,{status:'quay',column:null,row:null}));
  for(const p of v.placements)Object.assign(h.cargo.find(c=>c.id===p.id),p,{status:'boat'});
  state.money+=v.fee;h.feesPaid-=v.fee;state.trips--;h.selected=null;return true;
}
export const cargoWeight = type => CARGO_SPECS[type].weight;
