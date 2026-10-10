import {LEVELS, initial, available} from './game.js';
import {createHarbor, migrateHarbor} from './harbor-game.js';

const egypt = index => LEVELS[index]?.id === 'egypt';
const record = level => ({confirmed:true, purchased:true, missionId:level.missionId,
  quantities:{...level.requiredNewQuantities}, stoneCost:level.minimumPurchaseCost,
  shippingBudget:level.budget-level.minimumPurchaseCost});

// Upgrade the purchase/shipping boundary without rebuilding saved decks,
// voyages, buildings or rewards. Previously reserved stone coins pay the
// remaining order once; no item already owned is charged a second time.
export function prepareJourneyProgress(state) {
  const expedition=state.expedition;
  if(!expedition)return state;
  if(expedition.purchaseFlowVersion===1)return state;
  expedition.orders ||= {};
  const runs=[...Object.values(state.runs||{}),state];
  for(const run of runs) {
    const level=LEVELS[run.level];
    if(!level?.journeyRole)continue;
    if(level.journeyRole==='order'&&run.stage==='complete') {
      run.harbor=createHarbor(level,true);
      run.money=level.budget-level.minimumPurchaseCost;
      run.estimates={...level.requiredNewQuantities};
      expedition.orders.three=record(level);
    }
    if((level.journeyRole==='cargo'||level.journeyRole==='expand')&&run.harbor) {
      migrateHarbor(run,level);
      const remaining=run.harbor.cargo.filter(c=>c.status==='market');
      run.money-=remaining.reduce((n,c)=>n+level.prices[c.type],0);
      remaining.forEach(c=>c.status='quay');
      expedition.orders[level.journeyRole==='expand'?'expansion':'three']=record(level);
      if(run.harbor.cargo.every(c=>c.status==='delivered')) {
        run.harbor.finished=true;
        if(level.journeyRole==='cargo') {
          run.stage='complete';
          if(!state.completed.includes(level.missionId))state.completed.push(level.missionId);
        }
      }
    }
  }
  if(state.completed.includes('egypt-1'))expedition.orders.three ||= record(LEVELS[0]);
  expedition.purchaseFlowVersion=1;
  expedition.activeLevel=egypt(state.level)?state.level:Math.min(3,[0,1,2,3].find(i=>!state.completed.includes(`egypt-${i+1}`))??3);
  return state;
}

export function activeEgyptLevel(state) {
  return state.expedition?.activeLevel ?? (egypt(state.level)?state.level:0);
}

export function canEnterLevel(state,index) {
  if(!LEVELS[index]||!available(LEVELS[index],state.completed))return false;
  if(!egypt(index))return true;
  const active=activeEgyptLevel(state);
  if(index===active)return true;
  if(index!==active+1)return false;
  const run=state.level===active?state:state.runs?.[active];
  return run?.stage==='complete' && (index!==1||state.expedition?.orders?.three?.purchased===true);
}

export function restartJourneyLevel(state) {
  const next=initial(state.level),expedition=structuredClone(state.expedition);
  const level=LEVELS[state.level];
  const runs={...state.runs};delete runs[state.level];
  if(level.journeyRole==='order')delete expedition.orders.three;
  if(level.journeyRole==='expand'){delete expedition.orders.expansion;if(expedition.delivered)delete expedition.delivered.expansion;}
  if(level.journeyRole==='cargo'&&expedition.delivered)delete expedition.delivered.three;
  return {...next,completed:state.completed.filter(id=>id!==level.missionId),runs,
    profile:state.profile,studio:state.studio,expedition,journeyVersion:state.journeyVersion,
    legacyEgyptRuns:state.legacyEgyptRuns};
}
