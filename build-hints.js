import { key, sku, supported, target } from './game.js';
import { STONE_DETAILS } from './stone-art.js';

// Suggest only empty, supported blueprint spaces with delivered stock.
// Hints never change the player's chosen layer or place a stone for them.
export function buildHint(state, level) {
  if (state.stage !== 'build' || state.tool !== 'place') return null;
  const occupied = new Set(state.blocks.map(b => key(b.x, b.y, b.z)));
  const pending = target(level).filter(b => !occupied.has(key(b.x, b.y, b.z)));
  const ready = pending.filter(b => state.inventory[sku(b)] > 0 && supported(b, state.blocks, level));
  const next = ready.find(b => sku(b) === state.part && b.y === state.layer)
    || ready.find(b => sku(b) === state.part)
    || ready.find(b => b.y === state.layer)
    || ready[0];
  if (!next) {
    if (state.part === 'cap' && pending.some(b => sku(b) === 'cap') && state.inventory.cap > 0) {
      return {text: 'The capstone needs a complete support below. Finish the lower stones first.'};
    }
    return null;
  }
  const label = STONE_DETAILS[sku(next)].label.toLowerCase();
  if (next.y !== state.layer) {
    const filled = !pending.some(b => b.y === state.layer);
    return {
      text: `${filled ? `L${state.layer + 1} is filled. ` : ''}The ${label} goes on L${next.y + 1}. Select that layer to continue.`,
      layer: next.y,
    };
  }
  if (sku(next) !== state.part) {
    return {text: `Choose the ${label}, then tap its space on L${state.layer + 1}.`, part: sku(next)};
  }
  if (state.part === 'cap' || state.part === 'temple') {
    return {text: `L${state.layer + 1} is selected. Tap the top space to place the ${label}.`};
  }
  return null;
}
