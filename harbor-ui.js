import {awardCompletedMissions, missionWage} from './workshop-profile.js';
import {stoneArt, STONE_DETAILS} from './stone-art.js';
import {harborStats, buyCargo, placeCargo, unloadCargo, dispatchProblem, dispatchCargo, arriveCargo} from './harbor-game.js';

let arrivalTimer, timerVoyage;
export function clearHarborTimer() {
  clearTimeout(arrivalTimer); arrivalTimer = null; timerVoyage = null;
}

const cliffArt = `<svg class="quarry-landscape" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="quarry-sand" x2="0" y2="1"><stop stop-color="#ead4a2"/><stop offset="1" stop-color="#f6e9c9"/></linearGradient><pattern id="quarry-cuts" width="135" height="70" patternUnits="userSpaceOnUse"><path d="M0 0H135V70H0Z M40 0V70" stroke="#b6915b" stroke-opacity=".3" fill="none"/></pattern></defs><path fill="url(#quarry-sand)" d="M0 0H570L590 210 515 370 575 550 520 900H0Z"/><path d="M0 190L180 105 270 180 345 132 475 270 390 500 0 460Z" fill="#cbb082"/><path d="M0 210L180 125 265 200 345 151 459 278 380 478 0 440Z" fill="url(#quarry-cuts)"/><path d="M580 0Q700 210 578 405T610 900" stroke="#e7d8aa" stroke-width="34" fill="none"/><path d="M1250 710l70-104 70 104Z" fill="#e4c187"/><path d="M1320 606v104h70Z" fill="#b38e55"/><path d="M1180 727l40-64 42 64Z" fill="#edcf99"/><path d="M1060 745h380v155h-400Z" fill="#dcca9e" opacity=".8"/><g stroke="#d3e5d5" stroke-width="2" opacity=".17"><path d="M700 100h90m160 85h110m-400 80h95m400 130h90m-320 165h90m200 80h90m-500 200h95"/></g></svg>`;

export function renderHarbor({state, level, save, render, notice, restart, next}) {
  awardCompletedMissions(state);
  document.getElementById('earned-purse').textContent=`◉ ${state.profile.coins} earned`;
  const root = document.getElementById('harbor-scene');
  const h = state.harbor, {capacity, maxImbalance, fee, weights} = level.delivery;
  const stats = harborStats(state, level), sailing = !!h.inTransit, complete = state.stage === 'complete';
  const problem = dispatchProblem(state, level);
  const quay = h.cargo.filter(c => c.status === 'quay');
  const title = complete ? 'The river kept your promise.' : 'From quarry to wonder.';
  root.classList.toggle('is-sailing', sailing);
  root.innerHTML = `${cliffArt}
    <div class="harbor-content">
      <header class="harbor-title"><div><span class="eyebrow">EGYPT · MISSION 02 · THE RIVER MASTER</span><h2>${title}</h2><p>Four corners. One capstone. A river to cross.</p></div><div class="harbor-purse"><span>CONTRACT BUDGET</span><strong>${state.money}<small> coins</small></strong><span>Shipping paid: ${h.feesPaid} · ${state.trips} voyages</span></div></header>
      ${h.carriedOver ? '<p class="harbor-carried">Your earlier purchases and deliveries are saved. Start a new river puzzle to try the new challenge.</p>' : ''}
      <div class="harbor-playfield" ${sailing ? 'inert' : ''}>
        <section class="quarry-yard" aria-label="Quarry market">
          <span class="eyebrow">01 / THE QUARRY MARKET</span><h3>Choose your cargo</h3>
          <p class="harbor-note">Stone prices and shipping share your budget. Keep ${fee * level.delivery.optimalTrips} coins for the river.</p>
          <div class="quarry-stalls">${['corner','cap'].map(type => {
            const left = h.cargo.filter(c => c.type === type && c.status === 'market').length;
            return `<button class="quarry-stall" data-cargo-buy="${type}" ${!left || complete ? 'disabled' : ''} aria-label="Buy ${STONE_DETAILS[type].label.toLowerCase()} for ${level.prices[type]} coins, weight ${weights[type]}, ${left} remaining">${stoneArt(type)}<strong>${STONE_DETAILS[type].label}</strong><span class="cargo-weight">${weights[type]} weight</span><span class="quarry-price">${left ? `Buy · ${level.prices[type]} coins` : 'Order purchased'}</span><small>${left} left to buy</small></button>`;
          }).join('')}</div>
          <div class="quay-heading"><strong>Waiting at the quay</strong><span>${quay.length} stones</span></div>
          <div class="quay-cargo" aria-label="Purchased cargo">${quay.length ? quay.map(c => `<button data-cargo="${c.id}" draggable="true" aria-label="Select ${STONE_DETAILS[c.type].label.toLowerCase()} ${c.id.split('-')[1]}, weight ${weights[c.type]}" aria-pressed="${h.selected === c.id}" class="cargo-token ${h.selected === c.id ? 'cargo-selected' : ''}">${stoneArt(c.type)}<span>${weights[c.type]}</span></button>`).join('') : `<p>${complete ? 'All stones have reached Giza.' : 'Buy a stone above to bring it here.'}</p>`}</div>
          <p class="harbor-note">Select a stone, then a deck space. You can also drag stones onto the boat.</p>
        </section>
        <section class="river-dock" aria-label="Arrange the boat load">
          <div class="boat-heading"><span class="eyebrow">02 / BALANCE THE BOAT</span><h3>${complete ? 'A well-planned voyage.' : 'Every stone has its place.'}</h3></div>
          ${complete ? `<div class="harbor-success"><span class="harbor-seal">✓</span><h3>All five stones delivered.</h3><p>The builders at Giza can take it from here.</p><p class="wage-reward">${h.earnedThisRun ? `Work well done · +${missionWage(level.missionId)} earned coins` : 'Mission wage already earned'}<br><small>${h.earnedThisRun ? 'Spend them in Free Design.' : 'Replay for the challenge; wages are paid once.'}</small></p><div class="voyage-receipt"><span>${state.trips}<small>voyages</small></span><span>${h.feesPaid}<small>shipping coins</small></span><span>${state.money}<small>coins left</small></span></div><button id="harbor-next" class="primary">Next mission →</button><button id="harbor-restart" class="outline">Play the river puzzle again</button></div>` : `
          <div class="boat-quay"><span>CHOOSE CARGO AT THE QUAY</span><div class="quay-cargo">${quay.map(c=>`<button data-cargo="${c.id}" aria-label="Load ${STONE_DETAILS[c.type].label.toLowerCase()} ${c.id.split('-')[1]}, weight ${weights[c.type]}" aria-pressed="${h.selected===c.id}" class="cargo-token ${h.selected===c.id?'cargo-selected':''}">${stoneArt(c.type)}<span>${weights[c.type]}</span></button>`).join('') || '<p>All purchased stones are aboard or delivered.</p>'}</div></div><div class="boat-waters"><div class="boat-wake"></div><div class="cargo-boat" style="--boat-tilt:${Math.max(-7,Math.min(7,(stats.left-stats.right)*1.5))}deg">
            <span class="boat-bow">NILE TRADER</span><div class="boat-deck" role="group" aria-label="Six deck spaces, left and right sides">${Array.from({length:6},(_,slot)=>{
              const c=h.cargo.find(c=>['boat','transit'].includes(c.status)&&c.slot===slot);
              return `<button class="deck-space ${c?'occupied':''} ${c&&h.selected===c.id?'cargo-selected':''}" data-deck="${slot}" ${c?`data-cargo="${c.id}" draggable="true"`:''} aria-label="${slot%2?'Right':'Left'} side, row ${Math.floor(slot/2)+1}${c?`, ${STONE_DETAILS[c.type].label}, weight ${weights[c.type]}`:', empty deck space'}">${c?`${stoneArt(c.type)}<span class="deck-weight">${weights[c.type]}</span>`:'<span class="deck-cross">+</span>'}</button>`;
            }).join('')}</div><span class="boat-stern">${capacity} WEIGHT MAX</span>
          </div></div>
          <div class="load-readout ${stats.weight>capacity||stats.difference>maxImbalance?'load-warning':''}" role="status"><strong>${stats.weight}<small> / ${capacity} weight</small></strong><div class="weight-meter"><span style="width:${Math.min(100,stats.weight/capacity*100)}%"></span></div><span>Left ${stats.left} · Right ${stats.right}<small>Keep the difference at ${maxImbalance} or less</small></span></div>
          <div class="harbor-tools"><button id="unload-cargo" class="outline" ${stats.load.length?'':'disabled'}>${h.selected && stats.load.some(c=>c.id===h.selected)?'Unload selected stone':'Unload boat'}</button><button id="sail-cargo" class="primary" aria-disabled="${!!problem}">Sail to Giza · ${fee} coins →</button></div>
          <p class="harbor-guidance" role="status">${problem || `Ready to sail. ${stats.load.length} stones aboard; this voyage costs ${fee} coins.`}</p>`}
        </section>
        <aside class="giza-order" aria-label="Delivery order"><span class="eyebrow">03 / WAITING AT GIZA</span><div class="giza-monument">${stoneArt('cap')}</div><h3>A promise in stone</h3><p><strong>${stats.delivered} / 5</strong> delivered</p><div class="delivery-stamps">${h.cargo.map(c=>`<span class="delivery-stamp ${c.status==='delivered'?'arrived':''}" aria-label="${STONE_DETAILS[c.type].label}: ${c.status==='delivered'?'delivered':'waiting'}">${stoneArt(c.type)}${c.status==='delivered'?'<b>✓</b>':''}</span>`).join('')}</div><p class="harbor-note">Deliver the order to finish this mission. Your crew handles the building.</p><div class="voyage-log">${h.voyages.map(v=>`<p>Voyage ${v.number}<strong>${v.weight}/${capacity} weight · ${v.fee} coins</strong></p>`).join('')}</div>${!complete?'<button id="harbor-restart" class="harbor-restart">Start a new river puzzle</button>':''}</aside>
      </div>
    </div>
    ${sailing ? `<div class="voyage-overlay" role="region" aria-label="Voyage to Giza"><span class="eyebrow">VOYAGE ${h.inTransit.number} · ${h.inTransit.fee} COINS PAID</span><h2>The current carries your cargo.</h2><div class="voyage-route"><span>QUARRY</span><div class="river-route"><div class="sailing-miniature">${h.inTransit.ids.map(id=>stoneArt(h.cargo.find(c=>c.id===id).type)).join('')}<i></i></div></div><span>GIZA</span></div><p>${h.inTransit.weight}/${capacity} weight · Left ${h.inTransit.left} / Right ${h.inTransit.right}</p><button id="finish-voyage" class="primary">Arrive at Giza →</button></div>` : ''}`;

  const change = fn => { if(fn() !== false) {save(); render();} };
  root.querySelectorAll('[data-cargo-buy]').forEach(b=>b.onclick=()=>change(()=>buyCargo(state,level,b.dataset.cargoBuy)));
  root.querySelectorAll('.quay-cargo [data-cargo]').forEach(b=>b.onclick=()=>{h.selected=h.selected===b.dataset.cargo?null:b.dataset.cargo;save();render();});
  root.querySelectorAll('[data-deck]').forEach(b=>b.onclick=()=>{
    if(h.selected && h.selected!==b.dataset.cargo) change(()=>placeCargo(state,h.selected,+b.dataset.deck));
    else {h.selected=h.selected===b.dataset.cargo?null:b.dataset.cargo||null;save();render();}
  });
  root.querySelectorAll('[draggable]').forEach(b=>b.ondragstart=e=>{e.dataTransfer.setData('text/plain',b.dataset.cargo);e.dataTransfer.effectAllowed='move';});
  root.querySelectorAll('[data-deck]').forEach(b=>{
    b.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
    b.ondrop=e=>{e.preventDefault();change(()=>placeCargo(state,e.dataTransfer.getData('text/plain'),+b.dataset.deck));};
  });
  const bind=(id,fn)=>{const b=root.querySelector('#'+id);if(b)b.onclick=fn;};
  bind('unload-cargo',()=>change(()=>{const ids=stats.load.some(c=>c.id===h.selected)?[h.selected]:stats.load.map(c=>c.id);ids.forEach(id=>unloadCargo(state,id));}));
  bind('sail-cargo',()=>{const result=dispatchCargo(state,level);if(result.problem)notice(result.problem);else{save();render();}});
  bind('harbor-restart',restart);bind('harbor-next',next);
  const arrive=()=>{clearHarborTimer();if(arriveCargo(state,level)){save();render();}};
  bind('finish-voyage',arrive);
  if(sailing && timerVoyage!==h.inTransit){clearHarborTimer();timerVoyage=h.inTransit;arrivalTimer=setTimeout(arrive,5000);}
  else if(!sailing)clearHarborTimer();
}
