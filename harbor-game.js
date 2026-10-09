export const isHarbor = level => level.delivery?.mode === 'harbor';

export function createHarbor(level) {
  return {
    version: 1,
    cargo: Object.entries(level.requiredNewQuantities).flatMap(([type, count]) =>
      Array.from({length: count}, (_, i) => ({id: `${type}-${i + 1}`, type, status: 'market', slot: null}))),
    selected: null, voyages: [], feesPaid: 0, inTransit: null,
  };
}

// Keep purchases, delivered cargo and discoveries from the original boat mission.
export function migrateHarbor(state, level) {
  if (!isHarbor(level) || state.harbor) return;
  state.harbor = createHarbor(level);
  state.money += level.budget - 24;
  for (const type of level.types) {
    const items = state.harbor.cargo.filter(c => c.type === type);
    const purchasedBlocks = state.blocks.filter(b => b.type === type && b.provenance === 'purchase').length;
    const delivered = (state.inventory[type] || 0) + purchasedBlocks;
    const atQuay = state.warehouse[type] || 0;
    items.forEach((c, i) => {
      c.status = state.completed.includes(level.missionId) || i < delivered ? 'delivered'
        : i < delivered + atQuay ? 'quay' : 'market';
    });
    state.money += Math.max(0, delivered + atQuay - items.length) * level.prices[type];
  }
  state.harbor.legacyTrips = state.trips || 0;
  state.harbor.carriedOver = true;
  state.inventory = Object.fromEntries(level.types.map(t => [t, 0]));
  state.warehouse = {...state.inventory};
  state.history = [];
  finishIfDelivered(state, level);
}

export function harborStats(state, level) {
  const load = state.harbor.cargo.filter(c => c.status === 'boat');
  const weight = c => level.delivery.weights[c.type];
  const left = load.filter(c => c.slot % 2 === 0).reduce((n, c) => n + weight(c), 0);
  const right = load.filter(c => c.slot % 2 === 1).reduce((n, c) => n + weight(c), 0);
  return {load, left, right, weight: left + right, difference: Math.abs(left - right),
    delivered: state.harbor.cargo.filter(c => c.status === 'delivered').length};
}

export function buyCargo(state, level, type) {
  if (state.harbor.inTransit || state.stage === 'complete') return false;
  const item = state.harbor.cargo.find(c => c.type === type && c.status === 'market');
  if (!item || state.money < level.prices[type]) return false;
  state.money -= level.prices[type];
  item.status = 'quay';
  state.harbor.selected = item.id;
  return true;
}

export function placeCargo(state, id, slot) {
  if (state.harbor.inTransit || !Number.isInteger(slot) || slot < 0 || slot >= 6) return false;
  const item = state.harbor.cargo.find(c => c.id === id && ['quay', 'boat'].includes(c.status));
  if (!item) return false;
  const old = state.harbor.cargo.find(c => c.status === 'boat' && c.slot === slot);
  if (old && old !== item) {
    old.status = item.status;
    old.slot = item.slot;
  }
  item.status = 'boat';
  item.slot = slot;
  state.harbor.selected = null;
  return true;
}

export function unloadCargo(state, id) {
  if (state.harbor.inTransit) return false;
  const item = state.harbor.cargo.find(c => c.id === id && c.status === 'boat');
  if (!item) return false;
  item.status = 'quay'; item.slot = null; state.harbor.selected = item.id;
  return true;
}

export function dispatchProblem(state, level) {
  const {load, weight, difference} = harborStats(state, level);
  const {capacity, maxImbalance, fee} = level.delivery;
  if (state.harbor.inTransit) return 'Your boat is already on the river.';
  if (!load.length) return 'Choose a stone at the quay, then tap an empty place on the boat.';
  if (weight > capacity) return `Too heavy: ${weight}/${capacity}. Take a stone off the boat.`;
  if (difference > maxImbalance) return `The boat leans! Move a stone across. Keep the two sides within ${maxImbalance} weight units.`;
  if (state.money < fee) return `A voyage costs ${fee} coins. There are not enough coins to sail.`;
  const remaining = state.harbor.cargo.filter(c => ['market', 'quay'].includes(c.status));
  const purchaseCost = remaining.filter(c => c.status === 'market').reduce((n, c) => n + level.prices[c.type], 0);
  const remainingWeight = remaining.reduce((n, c) => n + level.delivery.weights[c.type], 0);
  const tripsNeeded = Math.ceil(remainingWeight / capacity);
  if (state.money - fee < purchaseCost + tripsNeeded * fee) {
    return `This leaves ${remainingWeight} weight for at least ${tripsNeeded} more trips. Save the shipping fees: fit more cargo on this voyage.`;
  }
  return null;
}

export function dispatchCargo(state, level) {
  const problem = dispatchProblem(state, level);
  if (problem) return {problem};
  const {load, weight, left, right} = harborStats(state, level);
  const voyage = {number: state.trips + 1, ids: load.map(c => c.id), weight, left, right, fee: level.delivery.fee};
  state.money -= voyage.fee;
  state.harbor.feesPaid += voyage.fee;
  state.trips++;
  state.harbor.inTransit = voyage;
  state.harbor.selected = null;
  load.forEach(c => { c.status = 'transit'; });
  return {voyage};
}

function finishIfDelivered(state, level) {
  const complete = state.harbor.cargo.every(c => c.status === 'delivered');
  state.stage = complete ? 'complete' : 'harbor';
  if (complete) {
    state.harbor.earnedThisRun = !state.completed.includes(level.missionId);
    if (state.harbor.earnedThisRun) state.completed.push(level.missionId);
  }
  return complete;
}

export function arriveCargo(state, level) {
  const voyage = state.harbor.inTransit;
  if (!voyage) return false;
  state.harbor.cargo.filter(c => voyage.ids.includes(c.id)).forEach(c => {c.status = 'delivered'; c.slot = null;});
  state.harbor.voyages.push(voyage);
  state.harbor.inTransit = null;
  finishIfDelivered(state, level);
  return true;
}
