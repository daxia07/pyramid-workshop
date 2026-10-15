import {stoneArt, STONE_DETAILS} from './stone-art.js';
import {CARGO_SPECS,DECK,footprint,occupiedCells,placementProblem} from './cargo-packing.js';
import {buyCargo,buyOrder,placeCargo,unloadCargo,unloadAllCargo,harborStats,freightProblem,dispatchProblem,dispatchCargo,arriveCargo,undoVoyage,beginExpansionBuild,VOYAGE_MS} from './harbor-game.js';
import {cargoGuidance} from './cargo-guidance.js';
import {cargoCoach} from './cargo-coach.js';
import {confirmOrder} from './journey-game.js';
import {checkOrderCounts, toggleCountMark} from './order-learning.js';
import {countingMatHTML} from './order-learning-ui.js';
import {createHarborWorld} from './harbor-world.js';
import {createOrderReference} from './harbor-reference.js';
let arrivalTimer,timerVoyage,world,api,reference;
export function clearHarborTimer(){clearTimeout(arrivalTimer);arrivalTimer=null;timerVoyage=null;}
const names={brick:'Flat bricks',edge:'Edge stones',corner:'Corner stones',cap:'Capstone'};
const symbols={brick:'B',edge:'E',corner:'C',cap:'▲'};
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function footprintArt(type,rotation=0){const cells=footprint(type,rotation),w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1;return `<svg class="sled-icon" viewBox="0 0 ${w*12+2} ${h*12+2}" aria-hidden="true">${cells.map(([c,r])=>`<rect x="${c*12+1}" y="${r*12+1}" width="11" height="11" rx="1.5"/><path d="M${c*12+4} ${r*12+4}h5"/>`).join('')}<circle cx="4" cy="4" r="1.4" fill="currentColor"/></svg>`;}
function referenceHTML(level){return `<div class="order-reference"><div class="mini-blueprints">${level.dims.map((n,y)=>{const owned=level.journeyRole==='expand'&&y>0;return `<div class="reference-layer ${owned?'owned':''}"><span>L${y+1} · ${n}×${n}</span><div style="grid-template-columns:repeat(${n},1fr)">${level.blueprint.filter(b=>b.y===y).map(b=>`<i class="ref-${b.type}" title="${STONE_DETAILS[b.type].label}">${symbols[b.type]}</i>`).join('')}</div><small>${owned?'Already built':n*n+(n===1?' stone':' stones')}</small></div>`;}).join('')}</div><p>${level.journeyRole==='expand'?'Keep your 14 stones. Order only the new 4 × 4 foundation.':'9 foundation stones + 4 upper corners + 1 cap = 14 stones.'}</p></div>`;}
function orderHTML(state,level){
  const q=level.requiredNewQuantities,done=state.stage==='complete',sealed=state.stage!=='order',h=state.harbor;
  const total=Object.values(q).reduce((n,c)=>n+c,0),bought=h?.cargo.filter(c=>c.status!=='market').length||0;
  const cost=Object.entries(q).reduce((n,[t,c])=>n+c*level.prices[t],0),remaining=h?.cargo.filter(c=>c.status==='market').reduce((n,c)=>n+level.prices[c.type],0)||0;
  const review=state.counting?.checked?checkOrderCounts(level,state.estimates):null;
  const hint=done?'You counted and bought every stone! Your boat is ready.':sealed?'Your counts are right! Buy the stones for your pyramid.':level.journeyRole==='expand'?'Count the stones for a new bottom layer. Keep the pyramid you already built.':'How many of each shape do we need? Count the model, then write your numbers.';
  return `<section class="order-paper" aria-label="${sealed?'Checked shopping list':'Counting puzzle'}"><div class="order-paper-top"><span class="eyebrow ${sealed?'sealed-stamp':''}">${done?'✓ COUNTING CHALLENGE COMPLETE':sealed?'✓ COUNTS CHECKED':level.journeyRole==='expand'?'STOP 4 / MAKE IT BIGGER':'STOP 1 / COUNT THE STONES'}</span><button id="harbor-restart" class="text-button">Start again</button></div>
  <h3>${done?'Ready for the river!':sealed?'Let’s buy our stones':level.journeyRole==='expand'?'A bigger pyramid':'Let’s count the stones'}</h3>
  <p class="panel-guidance" id="order-instruction">${hint}</p><button class="read-aloud" data-read-aloud="#order-instruction">♪ Read to me</button>
  <details class="order-study" ${sealed?'':'open'}><summary>Look at the pyramid</summary><div id="order-model-slot"></div><details class="order-layers"><summary>See each layer from above</summary>${referenceHTML(level)}</details></details>
  ${sealed?'':countingMatHTML(state,level)}
  <div class="shopping-rows">${level.types.map(type=>{
    const n=h?.cargo.filter(c=>c.type===type&&c.status!=='market').length||0,full=n===(q[type]||0),result=review?.results.find(r=>r.type===type);
    return `<div class="shopping-row ${sealed?'sealed-row':'count-row'} ${result?.correct?'count-correct':''}"><span class="order-stone">${stoneArt(type)}</span><label for="count-${type}"><strong>${names[type]}</strong><small>${sealed?`${n}/${q[type]||0} bought · ${level.prices[type]} coins each`:result?.correct?'✓ Count checked':STONE_DETAILS[type].hint}</small></label>${sealed?`<button data-buy-stone="${type}" ${full||done?'disabled':''} aria-label="Buy one ${STONE_DETAILS[type].label}">${full?'✓':`Buy · ${level.prices[type]}`}</button>`:`<div class="count-stepper"><button data-count-adjust="${type}:-1" aria-label="One fewer ${STONE_DETAILS[type].label.toLowerCase()}">−</button><input id="count-${type}" data-shopping="${type}" aria-label="Your count of ${names[type]}" ${result&&!result.correct?'aria-invalid="true" aria-describedby="order-feedback"':''} type="number" inputmode="numeric" min="0" max="30" value="${clean(state.estimates[type])}"/><button data-count-adjust="${type}:1" aria-label="One more ${STONE_DETAILS[type].label.toLowerCase()}">+</button></div>`}</div>`;
  }).join('')}</div>
  ${!sealed?`<p id="order-feedback" class="order-feedback ${review?.problem?'try-again':''}" role="status" aria-live="polite">${review?`${review.correct} of ${level.types.length} counts checked. ${review.problem?.message||'Every count is right!'}`:'Use + and −, or tap a box to type. Zero is fine if you need none.'}</p>`:''}
  ${sealed?`<div class="order-budget"><span>${bought}/${total} stones bought<small>${cost} coins for stones · 12 for boat trips</small></span><strong>${state.money}<small>coins left</small></strong></div>`:''}
  ${done?`<div class="order-approved">★ All ${total} stones bought${h?.earnedThisRun?' · +20 reward coins':''}</div><button id="order-next" class="primary full">Next: pack the boat →</button>`:sealed?`<button id="buy-order" class="primary full" ${remaining>state.money?'disabled':''}>Buy all ${total-bought} stones · ${remaining} coins</button>`:'<button id="confirm-order" class="primary full">Check my counts →</button>'}
  </section>${cameraHTML(false)}`;
}
function coachHTML(h){const open=h.guideOpen??false;return `<section class="cargo-coach ${open?'open':''}"><button id="cargo-guide" aria-expanded="${open}"><span>How to pack the boat</span><b>${open?'−':'+'}</b></button>${open?'<ol><li><b>Pick a stone</b><span>Tap a stone below. Its little squares show the space it needs.</span></li><li><b>Turn and fit</b><span>Tap Rotate to turn it. Tap a space on the boat. Keep clear of the mast.</span></li><li><b>Make it steady</b><span>Keep the dot in the square and the weight at 16 or less. Then sail!</span></li></ol><p>Need a hand? “Help me pack” shows one move at a time. You place every stone.</p>':''}</section>`;}
function packingMessage(state,level){
  const h=state.harbor;
  const budget=freightProblem(state);
  if(budget&&harborStats(state).items)return budget;
  if(!h.guided)return cargoGuidance(state);
  const hint=cargoCoach(state,level);
  if(hint.status!=='place')return hint.text;
  const p=hint.suggestion,name=STONE_DETAILS[p.type].label.toLowerCase();
  if(h.selected!==p.itemId)return `Try a ${name} next. Tap “Show next hint” to find it.`;
  const turns=((p.rotation-h.rotation+360)%360)/90;
  return turns?`Tap Rotate ${turns===1?'once':turns===2?'twice':'three times'}. Then tap the ★ space (${String.fromCharCode(65+p.column)}${p.row+1}) on the deck map.`:`Now tap the ★ space (${String.fromCharCode(65+p.column)}${p.row+1}) to place your ${name}.`;
}
function cameraHTML(cargo=true){return `<div class="harbor-camera" aria-label="Harbor camera"><button id="harbor-home" aria-label="Reset harbor view">⌂</button><button id="market-view">Market</button>${cargo?'<button id="deck-view">Deck view</button>':''}<button id="harbor-zoom-in" aria-label="Zoom harbor in">+</button><button id="harbor-zoom-out" aria-label="Zoom harbor out">−</button></div>`;}
function balanceHTML(m){return `<div class="balance-target ${m.balanced?'balanced':''}" aria-label="${m.balanced?'Balanced':'Unbalanced'} in both directions"><span class="balance-safe"></span><i style="left:${50+Math.max(-1,Math.min(1,m.offsetX))*43}%;top:${50+Math.max(-1,Math.min(1,m.offsetZ))*43}%"></i><span class="axis-x"></span><span class="axis-z"></span></div>`;}
function deckMapHTML(state,level){const h=state.harbor,coached=h.guided?cargoCoach(state,level):null,hint=coached?.suggestion;return `<div class="accessible-deck" role="group" aria-label="Deck map, front of the boat at the top">${Array.from({length:20},(_,i)=>{const c=i%5,r=Math.floor(i/5),blocked=DECK.blocked.some(([x,z])=>x===c&&z===r),item=h.cargo.find(a=>a.status==='boat'&&occupiedCells(a).some(([x,z])=>x===c&&z===r));return `<button data-deck="${c},${r}" class="${blocked?'mast':''} ${item?'occupied '+item.type:''} ${hint&&hint.column===c&&hint.row===r?'hint-cell':''}" ${h.inTransit||blocked&&(!h.selected||placementProblem(h.cargo,h.cargo.find(a=>a.id===h.selected),c,r,h.rotation))?'disabled':''} aria-label="Deck ${String.fromCharCode(65+c)}${r+1}${blocked?', mast':item?', '+STONE_DETAILS[item.type].label:', empty'}${hint&&hint.column===c&&hint.row===r?', suggested space':''}">${hint&&hint.column===c&&hint.row===r?'★':blocked?'╋':item?symbols[item.type]:`${String.fromCharCode(65+c)}${r+1}`}</button>`;}).join('')}</div>`;}
function cargoHTML(state,level){const h=state.harbor,m=harborStats(state),sailing=!!h.inTransit,finished=h.finished||state.stage==='complete';const selected=h.cargo.find(c=>c.id===h.selected),problem=dispatchProblem(state,level);
  const title=sailing?'Downriver, to Giza.':finished?'Every stone, delivered.':level.journeyRole==='expand'?'A wider foundation.':'Pack. Balance. Sail.';
  const statusPanel=sailing?`<div class="voyage-banner"><span class="eyebrow">VOYAGE ${h.inTransit.number} · ${h.inTransit.weight}/16 WEIGHT</span><strong>Quarry <span class="voyage-line">→</span> Giza</strong><p id="voyage-phase" role="status">Preparing to sail…</p><button id="finish-voyage">Arrive now →</button><button id="harbor-restart" class="text-button">Restart level</button></div>`:finished?`<section class="harbor-complete"><span class="eyebrow">${level.journeyRole==='cargo'?'✓ LEVEL 2 PASSED':'✓ ALL MATERIALS DELIVERED'}</span><h3>Every stone.<br>Safely delivered.</h3><p>${m.delivered}/${h.cargo.length} arrived${state.trips<=3?' · ✦ Efficient Captain':''}</p><p>${state.trips} voyages · ${h.feesPaid} freight coins · ${state.money} left</p>${level.journeyRole==='cargo'?`<p class="shipping-wage">${h.earnedThisRun?'+25 reward coins · Try them in Free Design':'You already earned this reward'}</p>`:''}<button id="harbor-next" class="primary full">${level.journeyRole==='expand'?'Next: build the new bottom layer':'Next: build a pyramid'} →</button><button id="harbor-restart" class="text-button">Restart level</button></section>`:'';
  return `<section class="cargo-order ${h.showOrder?'expanded':''}" aria-label="Shipment order"><header class="harbor-panel-heading"><span class="eyebrow">${level.journeyRole==='expand'?'LEVEL 4 · EXPANSION SHIPMENT':'LEVEL 2 · PACK & SHIP'}</span><h2>${title}</h2><p>${sailing?'Your stones are on their way. The next load waits on shore.':finished?'The order is waiting at the building site.':`${m.delivered}/${h.cargo.length} stones delivered · all must arrive to pass.<br>All your stones are paid for.`}</p></header><button id="toggle-cargo-order" class="cargo-order-heading" aria-expanded="${!!h.showOrder}"><span>SEALED & PAID <small>${m.delivered}/${h.cargo.length} delivered</small></span><strong>◉ ${state.money}</strong><i>⌄</i></button>
  <div class="cargo-order-body"><div class="manifest-labels"><span>Stone</span><span>Shore</span><span>Boat</span><span>Giza</span></div>${level.types.filter(t=>level.requiredNewQuantities[t]).map(type=>{const list=h.cargo.filter(c=>c.type===type),n=status=>list.filter(c=>c.status===status).length;return `<div class="manifest-row"><span>${stoneArt(type)}<b>${STONE_DETAILS[type].label}<small>Order ${list.length}</small></b></span><strong>${n('quay')}</strong><strong>${n('boat')+n('transit')}</strong><strong>${n('delivered')}</strong></div>`;}).join('')}

  <div class="freight-ledger"><span>Freight paid <b>${h.feesPaid} coins</b></span><span>Voyages <b>${state.trips} / aim for 3</b></span></div>
  <p class="fineprint">Budget covers four voyages. Three earns the Efficient Captain seal. Unpack and rearrange freely.</p>
  <div class="cargo-order-links"><button id="undo-voyage" ${!h.voyages.length||sailing||finished?'disabled':''}>Undo last voyage</button></div>
  <details class="packing-rules"><summary>The boat’s rules</summary><p>5 × 4 deck. Two spaces belong to the mast. Sleds cannot overlap or hang over the side. At most 16 weight per voyage.</p><p>The balance dot must stay inside the central square. Distribute weight both left to right and bow to stern.</p><p>Sleds include protective space; these are transport shapes, not the dimensions of masonry.</p></details></div>${statusPanel}</section>
  ${sailing||finished?'':`
  <div class="cargo-controls">${coachHTML(h)}<div class="cargo-read-actions"><button id="guided-cargo" class="gold">${h.guided?'Show next hint':'Help me pack'}</button><button class="read-aloud" data-read-aloud="#cargo-placement-hint">♪ Read to me</button>${h.guided?'<button id="unguided-cargo">Pack on my own</button>':''}</div><div class="load-readout"><div class="load-weight"><span>BOAT WEIGHT</span><strong>${m.weight}<small> / ${DECK.capacity}</small></strong><div class="weight-track"><i class="${m.overweight?'danger':''}" style="width:${Math.min(100,m.weight/DECK.capacity*100)}%"></i></div><small>${m.tiles} of 18 usable spaces</small></div>${balanceHTML(m)}<div class="balance-copy"><span>IS IT STEADY?</span><strong>${m.items?m.balanced?'The boat is steady':'Move some stones':'Ready to load'}</strong><small>Keep the dot in the square</small></div></div>
  <div class="cargo-guidance"><p id="cargo-placement-hint" role="status" aria-live="polite">${packingMessage(state,level)}</p><button id="sail-cargo" class="primary" aria-describedby="cargo-placement-hint" ${problem?'disabled':''}>Sail · ${DECK.fee} coins →</button></div>
  <div class="sail-checklist" aria-label="Boat checks"><span class="${m.items?'ready':''}">${m.items?'✓':'○'} Stones aboard</span><span class="${!m.overweight?'ready':''}">${!m.overweight?'✓':'○'} Weight ≤ 16</span><span class="${m.items&&m.balanced?'ready':''}">${m.items&&m.balanced?'✓':'○'} Steady</span><span>${Math.floor(state.money/DECK.fee)} paid trips left</span></div>
  <div class="cargo-tray" aria-label="Quarry cargo">${level.types.filter(t=>level.requiredNewQuantities[t]).map(type=>{const quay=h.cargo.filter(c=>c.type===type&&c.status==='quay'),unbought=h.cargo.filter(c=>c.type===type&&c.status==='market'),active=selected?.type===type;return `<button class="cargo-stock ${type} ${active?'active':''}" data-cargo-type="${type}" ${!quay.length&&!unbought.length?'disabled':''} aria-label="${quay.length?`Select ${STONE_DETAILS[type].label}, ${quay.length} on shore`:`Buy ${STONE_DETAILS[type].label}, ${level.prices[type]} coins`}" aria-pressed="${active}"><span class="cargo-stone-art">${stoneArt(type)}</span><span class="cargo-stock-text"><b>${STONE_DETAILS[type].label}</b><small>${quay.length?`${quay.length} on shore`:unbought.length?`Buy · ${level.prices[type]} coins`:'All aboard / delivered'}</small></span><span class="cargo-footprint">${footprintArt(type,active?h.rotation:0)}<small>${CARGO_SPECS[type].weight} wt</small></span></button>`;}).join('')}</div>
  <div class="packing-actions"><span class="selection-label">${selected?`${STONE_DETAILS[selected.type].label} · ${h.rotation}°`:'Padded sleds protect your stone'}</span><button id="rotate-cargo" class="${selected?'hint-active':''}" ${!selected?'disabled':''}>↻ Rotate <kbd>R</kbd></button><button id="unload-cargo" ${selected?.status!=='boat'?'disabled':''}>Return stone</button><button id="deselect-cargo" ${!selected?'disabled':''}>Cancel selection</button><button id="unload-all-cargo" ${!m.items?'disabled':''}>Unload all</button><button id="undo-trip" ${!h.voyages.length?'disabled':''}>Undo a trip · get 3 coins back</button><button id="harbor-restart">Start again</button><button id="toggle-deck-map" aria-expanded="${!!h.showMap}">${h.showMap?'Close':'Open'} deck map</button></div>
  ${h.showMap?deckMapHTML(state,level):''}</div>`}
  ${cameraHTML()}`;
}
export function renderHarbor(context){api=context;const{state,level,save,render,notice,next}=context;
  let host=document.getElementById('harbor-world');if(!host){document.getElementById('harbor-scene').innerHTML='<div id="harbor-world"></div><div id="harbor-hud"></div>';host=document.getElementById('harbor-world');}
  const order=['order','purchase'].includes(state.stage)||level.journeyRole==='order';document.getElementById('harbor-scene').dataset.phase=order?'order':'cargo';
  const hud=document.getElementById('harbor-hud'),viewKey=`${state.level}:${state.stage}`;
  const scroll=hud.dataset.viewKey===viewKey?['.order-paper','.cargo-controls','.cargo-order'].map(selector=>[selector,hud.querySelector(selector)?.scrollTop||0]):[];
  reference?.element.remove();
  document.getElementById('harbor-hud').innerHTML=order?orderHTML(state,level):cargoHTML(state,level);
  hud.dataset.viewKey=viewKey;
  if(order){reference??=createOrderReference();document.getElementById('order-model-slot').append(reference.element);reference.sync(level);}
  for(const[selector,top]of scroll){const panel=hud.querySelector(selector);if(panel)panel.scrollTop=top;}
  const update=()=>{save();render();};
  const select=id=>{if(state.stage!=='harbor'||state.harbor.inTransit||state.harbor.finished)return;const c=state.harbor.cargo.find(c=>c.id===id&&['boat','quay'].includes(c.status));if(!c)return;state.harbor.selected=id;state.harbor.rotation=c.rotation||0;state.harbor.guideOpen=false;update();};
  const place=(column,row)=>{const h=state.harbor,item=h.cargo.find(c=>c.id===h.selected);if(!item)return;const hint=h.guided?cargoCoach(state,level).suggestion:null;if(hint&&hint.itemId===item.id&&hint.column===column&&hint.row===row&&h.rotation!==hint.rotation){notice(packingMessage(state,level));return;}const problem=placementProblem(h.cargo,item,column,row,h.rotation);if(problem){notice(problem);return;}if(placeCargo(state,item.id,column,row,h.rotation)){h.guideOpen=false;update();}};
  const rotate=()=>{if(state.stage!=='harbor'||!state.harbor?.selected||state.harbor.inTransit)return;state.harbor.rotation=(state.harbor.rotation+90)%360;update();};
  const deselect=()=>{if(state.harbor){state.harbor.selected=null;update();}};
  // Keep one canvas and one camera alive across every stock, rotation and placement update.
  if(!world){world=createHarborWorld(host,()=>api,{onSelect:id=>api.select(id),onMarket:type=>api.market(type,true),onPlace:(c,r)=>api.place(c,r),onDeselect:()=>api.deselect(),onVoyagePhase:text=>{const e=document.getElementById('voyage-phase');if(e&&e.textContent!==text)e.textContent=text;},onHover:()=>{}});
    document.addEventListener('keydown',e=>{if(document.getElementById('harbor-scene').hidden||document.querySelector('.modal-shade')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key.toLowerCase()==='r'){e.preventDefault();api.rotate();}if(e.key==='Escape')api.deselect();});}
  const market=(type,fromScene=false)=>{
    if(order){if(state.stage==='purchase'){if(buyCargo(state,level,type))update();else notice('All of this stone is already bought. Choose another stack.');return;}if(state.stage==='complete')return notice('Your order is sealed and fully paid. Continue to Level 2.');const input=document.querySelector(`[data-shopping="${type}"]`);if(input){document.querySelectorAll('.shopping-row').forEach(e=>e.classList.remove('market-inspected'));input.closest('.shopping-row').classList.add('market-inspected');input.scrollIntoView({block:'nearest',behavior:'smooth'});input.focus({preventScroll:true});reference?.highlight(type);notice(`Let’s count the ${names[type].toLowerCase()}. Open Help me count to mark each one.`);}return;}
    if(state.harbor.inTransit||state.harbor.finished)return;
    const item=state.harbor.cargo.find(c=>c.type===type&&c.status==='quay');
    if(item)select(item.id);else return;
    if(fromScene||world.view==='market')world.home();
  };
  Object.assign(api,{select,place,rotate,deselect,market});world.sync();
  const bind=(id,fn)=>{const e=document.getElementById(id);if(e)e.onclick=fn;};
  bind('harbor-home',()=>world.home());bind('market-view',()=>{deselect();world.marketView();});bind('deck-view',()=>world.topView());bind('harbor-zoom-in',()=>world.zoom(.86));bind('harbor-zoom-out',()=>world.zoom(1.16));
  bind('harbor-restart',context.restart);
  if(order){clearHarborTimer();
    bind('buy-order',()=>{if(buyOrder(state,level))update();});
    document.querySelectorAll('[data-buy-stone]').forEach(e=>e.onclick=()=>market(e.dataset.buyStone));
    const learning=()=>state.counting ||= {type:level.types[0],marks:[]};
    document.querySelectorAll('[data-shopping]').forEach(e=>e.oninput=()=>{
      state.estimates[e.dataset.shopping]=e.value;learning().checked=false;e.removeAttribute('aria-invalid');
      e.closest('.shopping-row').classList.remove('count-correct');
      e.closest('.shopping-row').querySelector('small').textContent=STONE_DETAILS[e.dataset.shopping].hint;
      document.getElementById('order-feedback').textContent='Ready? Check your counts when you have filled every box.';save();
    });
    document.querySelectorAll('[data-count-adjust]').forEach(e=>e.onclick=()=>{
      const[type,delta]=e.dataset.countAdjust.split(':'),current=Number(state.estimates[type]);
      state.estimates[type]=String(Math.max(0,Math.min(30,(Number.isFinite(current)?current:0)+Number(delta))));
      learning().checked=false;update();
    });
    const counting=document.querySelector('.counting-help');
    if(counting)counting.ontoggle=()=>{learning().open=counting.open;save();};
    document.querySelectorAll('[data-count-kind]').forEach(e=>e.onclick=()=>{
      learning().type=e.dataset.countKind;learning().open=true;update();reference?.highlight(e.dataset.countKind);
    });
    document.querySelectorAll('[data-count-cell]').forEach(e=>e.onclick=()=>{
      learning();if(toggleCountMark(state,level,e.dataset.countCell))update();
      else notice(`Find a ${STONE_DETAILS[learning().type].label.toLowerCase()}. Tap each matching stone once.`);
    });
    bind('confirm-order',()=>{
      learning().checked=true;const review=checkOrderCounts(level,state.estimates);
      if(review.problem){update();document.getElementById(`count-${review.problem.type}`)?.focus({preventScroll:true});document.getElementById('order-feedback')?.scrollIntoView({block:'nearest'});return;}
      const problem=confirmOrder(state,level);if(problem)return notice(problem);update();
    });bind('order-next',next);return;
  }
  const h=state.harbor;
  document.querySelectorAll('[data-cargo-type]').forEach(e=>e.onclick=()=>market(e.dataset.cargoType));
  bind('cargo-guide',()=>{h.guideOpen=!(h.guideOpen??false);update();});
  bind('guided-cargo',()=>{h.guided=true;h.guideOpen=false;h.showMap=true;const hint=cargoCoach(state,level);if(hint.suggestion){h.selected=hint.suggestion.itemId;h.rotation=h.cargo.find(c=>c.id===h.selected)?.rotation||0;}update();document.querySelector('.accessible-deck')?.scrollIntoView({block:'nearest'});});
  bind('unguided-cargo',()=>{h.guided=false;update();});
  bind('unload-all-cargo',()=>{if(unloadAllCargo(state)){update();notice('All deck cargo is back at the quay. Delivered stones and coins are unchanged.');}});
  bind('rotate-cargo',rotate);bind('deselect-cargo',deselect);bind('unload-cargo',()=>{if(unloadCargo(state,h.selected))update();});
  bind('toggle-deck-map',()=>{h.showMap=!h.showMap;update();});bind('toggle-cargo-order',()=>{h.showOrder=!h.showOrder;update();});
  document.querySelectorAll('[data-deck]').forEach(e=>e.onclick=()=>{const[c,r]=e.dataset.deck.split(',').map(Number);if(h.selected)place(c,r);else{const item=h.cargo.find(a=>a.status==='boat'&&occupiedCells(a).some(([x,z])=>x===c&&z===r));if(item)select(item.id);else notice('Select a sled from the quay first.');}});
  bind('sail-cargo',()=>{const result=dispatchCargo(state,level);if(result.problem)notice(result.problem);else update();});
  const undoTrip=()=>{if(undoVoyage(state)){update();notice('Your stones and 3 coins are back. Try a bigger load!');}};bind('undo-voyage',undoTrip);bind('undo-trip',undoTrip);
  bind('harbor-restart',context.restart);
  bind('harbor-next',()=>{if(level.journeyRole==='expand'){beginExpansionBuild(state,level);save();render();context.onBuild?.();}else next();});
  const arrive=()=>{clearHarborTimer();if(arriveCargo(state,level))update();};bind('finish-voyage',arrive);
  if(h.inTransit&&timerVoyage!==h.inTransit){clearHarborTimer();timerVoyage=h.inTransit;arrivalTimer=setTimeout(arrive,Math.max(0,VOYAGE_MS-(Date.now()-h.inTransit.startedAt)));}
  else if(!h.inTransit)clearHarborTimer();
}
