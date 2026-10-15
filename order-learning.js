import {key, sku} from './game.js';
import {STONE_DETAILS} from './stone-art.js';

// A counting aid, never an answer filler. Marks and answers are independent.
export function countingStones(level) {
  const owned = new Set(level.seed.map(b => key(b.x, b.y, b.z)));
  return level.blueprint.filter(b => !owned.has(key(b.x, b.y, b.z)));
}

export function countClue(level, type) {
  if (level.journeyRole === 'expand' && type === 'cap') return 'The top is already built. Do you need any new capstones? Zero is a number too!';
  const clues = {
    brick: 'Look inside the bottom layer. Count the flat bricks in the middle.',
    edge: 'Look along the sides of the bottom layer. Count the stones between the corners.',
    corner: level.journeyRole === 'expand'
      ? 'Count the corners of the new bottom layer. The layers above are already built.'
      : 'Count the corners on the bottom layer, then the corners on the middle layer. Add them together.',
    cap: 'Look at the very top. Count the pointed stone.',
  };
  return clues[type] || 'Count this kind of stone in each new layer.';
}

export function checkOrderCounts(level, estimates) {
  const results = level.types.map(type => {
    const raw = estimates?.[type], value = Number(raw);
    const label = STONE_DETAILS[type].label.toLowerCase();
    if (raw === '' || raw === null || raw === undefined || !Number.isInteger(value) || value < 0 || value > 30) {
      return {type, correct:false, message:`Write your ${label} count. Use a whole number from 0 to 30.`};
    }
    const expected = level.requiredNewQuantities[type] || 0;
    return {type, correct:value === expected, message:value === expected ? '✓ Count checked!'
      : `Try ${value < expected ? 'a bigger' : 'a smaller'} number for ${label}. ${countClue(level, type)}`};
  });
  return {results, correct:results.filter(r => r.correct).length, problem:results.find(r => !r.correct) || null};
}

export function toggleCountMark(state, level, cellKey) {
  const learning = state.counting ||= {type:level.types[0], marks:[]};
  const stone = countingStones(level).find(b => key(b.x, b.y, b.z) === cellKey);
  if (!stone || sku(stone) !== learning.type) return false;
  const marks = new Set(learning.marks || []);
  if (marks.has(cellKey)) marks.delete(cellKey); else marks.add(cellKey);
  learning.marks = [...marks];
  return true;
}
