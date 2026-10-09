import {LEVELS} from './game.js';

export const missionWage = missionId => {
  const index = LEVELS.findIndex(l => l.missionId === missionId);
  return index < 0 ? 0 : 20 + (index % 4) * 5;
};

export function awardCompletedMissions(state) {
  state.profile ||= {coins: 0, awarded: [], decorations: ['path']};
  let earned = 0;
  for (const id of state.completed) {
    if (!state.profile.awarded.includes(id) && missionWage(id)) {
      earned += missionWage(id);
      state.profile.awarded.push(id);
    }
  }
  state.profile.coins += earned;
  return earned;
}

export const DECORATIONS = {
  path: {name: 'Stone path', cost: 0, symbol: '▱', description: 'A processional approach'},
  palms: {name: 'Palm grove', cost: 10, symbol: '♧', description: 'Shade beside your monument'},
  banners: {name: 'Festival banners', cost: 10, symbol: '⚑', description: 'A little ceremony and color'},
  obelisk: {name: 'Obelisk', cost: 20, symbol: '◇', description: 'A tall carved stone marker'},
  pool: {name: 'Garden pool', cost: 25, symbol: '≈', description: 'A quiet circle of blue'},
};

export function unlockDecoration(profile, type) {
  const item = DECORATIONS[type];
  if (!item || profile.decorations.includes(type)) return false;
  if (profile.coins < item.cost) return false;
  profile.coins -= item.cost;
  profile.decorations.push(type);
  return true;
}
