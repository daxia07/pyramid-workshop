import {key, sku} from './game.js';
import {stoneArt, STONE_DETAILS} from './stone-art.js';
import {countingStones, countClue} from './order-learning.js';

export function countingMatHTML(state, level) {
  const type = state.counting?.type || level.types[0];
  const marks = new Set(state.counting?.marks || []);
  const stones = countingStones(level);
  const marked = stones.filter(b => sku(b) === type && marks.has(key(b.x,b.y,b.z))).length;
  return `<details class="counting-help" ${state.counting?.open ? 'open' : ''}>
    <summary>Help me count</summary>
    <p>Choose a shape. Tap each matching stone once.</p>
    <div class="count-kinds" aria-label="Choose a shape to count">${level.types.map(t => `<button data-count-kind="${t}" aria-pressed="${type === t}" aria-label="Count ${STONE_DETAILS[t].label.toLowerCase()}">${stoneArt(t)}<span>${STONE_DETAILS[t].label}</span></button>`).join('')}</div>
    <p class="count-clue">${countClue(level, type)}</p>
    <div class="counting-layers">${level.dims.map((n,y) => {
      const layer = stones.filter(b => b.y === y);
      if (!layer.length) return '';
      return `<div class="counting-layer"><strong>${y === 0 ? 'Bottom' : y === level.dims.length-1 ? 'Top' : 'Middle'} layer</strong><div style="grid-template-columns:repeat(${n},44px)">${layer.map(b => {
        const k = key(b.x,b.y,b.z), matches = sku(b) === type, checked = matches && marks.has(k);
        return `<button data-count-cell="${k}" class="${matches ? 'matching' : 'other-shape'} ${checked ? 'counted' : ''}" aria-label="${STONE_DETAILS[sku(b)].label}, layer ${y+1}, ${checked ? 'counted' : 'not counted'}" aria-pressed="${checked}">${stoneArt(sku(b))}${checked ? '<b aria-hidden="true">✓</b>' : ''}</button>`;
      }).join('')}</div></div>`;
    }).join('')}</div>
    <p class="count-tally" role="status">${marked} marked. Write your count in the list below.</p>
    ${level.journeyRole === 'expand' ? '<p class="count-kept">Your first 14 stones stay built. Count only the new bottom layer.</p>' : ''}
  </details>`;
}
