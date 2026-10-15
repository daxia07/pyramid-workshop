import {DECK,loadMetrics} from './cargo-packing.js';

export function cargoGuidance(state) {
  const h=state.harbor,m=loadMetrics(h.cargo),selected=h.cargo.find(c=>c.id===h.selected);
  if(h.inTransit)return 'Anchor up, sail open, then downriver. Your next load waits at the quay.';
  if(h.finished)return 'Every stone has arrived. Level passed — continue to the building site.';
  const money=Number(state.money);
  const fareWarning=money<DECK.fee
    ? ` Sailing costs ${DECK.fee} coins and you have ${Math.max(0,money||0)}. ${h.voyages?.length ? 'Undo your last voyage or ' : ''}restart this level to get the freight coins back.`
    : '';
  if(selected)return `Rotate the sled with ↻ or R, then tap a deck space. Green fits; red is blocked. Drag empty water to turn the view while keeping your stone selected.${fareWarning}`;
  const market=h.cargo.filter(c=>c.status==='market');
  if(market.length)return `Buy the ${market.length} stone${market.length===1?'':'s'} still at the market before sailing.`;
  if(!m.items)return 'Choose a stone below. Rotate its padded sled, then tap the deck. Deck view makes fitting easier.';
  if(m.overweight)return `Too heavy by ${m.weight-DECK.capacity}. Tap a loaded stone and Return stone, or Unload all to retry.`;
  if(!m.balanced) {
    const shifts=[];
    if(Math.abs(m.offsetX)>DECK.maxOffsetX)shifts.push(m.offsetX>0?'left':'right');
    if(Math.abs(m.offsetZ)>DECK.maxOffsetZ)shifts.push(m.offsetZ>0?'toward the bow (top of Deck view)':'toward the stern (bottom of Deck view)');
    return `Move or add weight ${shifts.join(' and ')}. Keep the dot inside the square on both axes.`;
  }
  if(money<DECK.fee) {
    const recovery=h.voyages?.length
      ? 'Undo your last voyage or restart this level to get the freight coins back.'
      : 'Restart this level to get the freight coins back.';
    return `This load is balanced, but a voyage costs ${DECK.fee} coins and you have ${Math.max(0,Number(state.money)||0)}. ${recovery}`;
  }
  return 'Balanced and within weight. Sail this load, or add another stone. Every stone must arrive to pass.';
}
