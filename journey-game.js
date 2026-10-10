import { LEVELS, initial, key, sku, target } from './game.js';
import { createHarbor, migrateHarbor } from './harbor-game.js';

export const JOURNEY_VERSION = 2;

const EGYPT_INDICES = LEVELS
  .map((level, index) => level.id === 'egypt' ? index : -1)
  .filter(index => index >= 0);

const clone = value => structuredClone(value);

function isEgyptIndex(index) {
  return EGYPT_INDICES.includes(index);
}

function emptyOrders() {
  return {three: null, expansion: null};
}

/** Ensure the cross-mission expedition ledger exists without replacing it. */
export function globalJourney(state) {
  if (!state || typeof state !== 'object') return {version: JOURNEY_VERSION, orders: emptyOrders()};
  state.journeyVersion = JOURNEY_VERSION;
  state.expedition ||= {};
  state.expedition.version = JOURNEY_VERSION;
  state.expedition.orders ||= {};
  for (const name of ['three', 'expansion']) {
    if (!(name in state.expedition.orders)) state.expedition.orders[name] = null;
  }
  return state.expedition;
}

function orderQuantities(level) {
  return Object.fromEntries(level.types.map(type => [
    type,
    Math.max(0, Number(level.requiredNewQuantities?.[type] || 0)),
  ]));
}

function readEstimate(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : NaN;
}

function orderError(level, estimates) {
  const expected = orderQuantities(level);
  const actual = Object.fromEntries(level.types.map(type => [type, readEstimate(estimates?.[type])]));
  const malformed = Object.values(actual).some(value => value === null || Number.isNaN(value));
  if (malformed) return 'Write a whole-number quantity for every kind of stone before confirming the order.';
  const mismatch = level.types.find(type => actual[type] !== expected[type]);
  if (mismatch) {
    return `The order needs ${expected[mismatch]} ${mismatch} stone${expected[mismatch] === 1 ? '' : 's'}; check the reference list.`;
  }
  return null;
}

function orderRecord(level, quantities) {
  const stoneCost = level.types.reduce((sum, type) =>
    sum + quantities[type] * Number(level.prices?.[type] || 0), 0);
  return {
    confirmed: true,
    missionId: level.missionId,
    quantities: {...quantities},
    stoneCost,
    shippingBudget: Math.max(0, Number(level.budget || 0) - stoneCost),
  };
}

/**
 * Seal quantities before buying. Completion requires the entire paid order;
 * shipping cannot reopen this desk or change the quantities.
 */
export function confirmOrder(state, level) {
  if (!state || !level || !['order', 'expand'].includes(level.journeyRole)) {
    return 'This stop is not an order desk.';
  }
  if (state.stage !== 'order') {
    return 'This shopping list has already been confirmed and sealed.';
  }
  const problem = orderError(level, state.estimates);
  if (problem) return problem;

  const quantities = orderQuantities(level);
  const expedition = globalJourney(state);
  const orderName = level.journeyRole === 'expand' ? 'expansion' : 'three';
  const record = orderRecord(level, quantities);
  expedition.orders[orderName] = record;

  state.stage = 'purchase';
  state.harbor = createHarbor(level);
  state.warehouse ||= Object.fromEntries(level.types.map(type => [type, 0]));
  state.history = [];
  return null;
}

function freshEgyptRun(index) {
  const run = initial(index);
  run.journeyVersion = JOURNEY_VERSION;
  globalJourney(run);
  return run;
}

function preservedBuildBlocks(legacy) {
  // Keep misplaced salvaged stones in the new run. The build UI can lift
  // them out, which is more useful than silently throwing away previous work.
  return (Array.isArray(legacy?.blocks) ? legacy.blocks : []).map(block => ({...clone(block), provenance:'site', refundValue:0}));
}

function setBuildInventory(run, level, legacy) {
  const wanted = new Map(target(level).map(block => [key(block.x, block.y, block.z), sku(block)]));
  const present = {};
  for (const block of run.blocks) {
    if (wanted.get(key(block.x, block.y, block.z)) !== sku(block)) continue;
    present[sku(block)] = (present[sku(block)] || 0) + 1;
  }
  const topUp = Object.fromEntries(level.types.map(type => [
    type,
    Math.max(0, (level.targetQuantities?.[type] || 0) - (present[type] || 0)),
  ]));
  const oldInventory = Object.fromEntries(level.types.map(type => [
    type,
    Math.max(0, Number(legacy?.inventory?.[type] || 0)),
  ]));
  const oldFreeInventory = Object.fromEntries(level.types.map(type => [
    type,
    Math.max(0, Number(legacy?.freeInventory?.[type] || 0)),
  ]));
  // Earlier purchases are already paid for. Top up only the shortfall and
  // make retained stock free to reuse in this supplied-material commission.
  run.inventory = Object.fromEntries(level.types.map(type => [type, Math.max(topUp[type], oldInventory[type], oldFreeInventory[type])]));
  run.freeInventory = {...run.inventory};
  const missing = target(level).filter(block =>
    !run.blocks.some(existing => key(existing.x, existing.y, existing.z) === key(block.x, block.y, block.z)
      && sku(existing) === sku(block)));
  run.layer = missing.length ? Math.min(...missing.map(block => block.y)) : 0;
  run.part = level.types.find(type => topUp[type] + oldInventory[type] > 0) || level.types[0];
}

function preserveHarborCargo(run, legacy, level) {
  if (!legacy || typeof legacy !== 'object') return;

  // Let the harbor migrator calculate the value of already bought stones and
  // fares. Rebuilding the cargo list with a full budget would give returning
  // players back coins they already spent.
  const oldView = clone(legacy);
  oldView.level = LEVELS.indexOf(level);
  oldView.inventory ||= {};
  oldView.warehouse ||= {};
  oldView.blocks ||= [];
  migrateHarbor(oldView, level);
  run.harbor = oldView.harbor;
  run.money = oldView.money;
  run.trips = oldView.trips;
  run.stage = 'harbor';
}

function migrateEgyptRun(index, legacy, completed) {
  const run = freshEgyptRun(index);
  const level = LEVELS[index];
  if (index === EGYPT_INDICES[0]) {
    if (completed.includes(level.missionId)) {
      run.stage = 'complete';
      run.expedition.orders.three ||= orderRecord(level, orderQuantities(level));
    }
    return run;
  }
  if (index === EGYPT_INDICES[1]) {
    preserveHarborCargo(run, legacy, level);
    return run;
  }
  if (index === EGYPT_INDICES[2]) {
    const blocks = preservedBuildBlocks(legacy);
    if (blocks.length) run.blocks = blocks;
    setBuildInventory(run, level, legacy);
    const complete = run.blocks.length === target(level).length
      && target(level).every(wanted => run.blocks.some(block =>
        key(block.x, block.y, block.z) === key(wanted.x, wanted.y, wanted.z)
        && sku(block) === sku(wanted)));
    if (completed.includes(level.missionId) && complete) run.stage = 'complete';
    return run;
  }
  // A previous fourth mission was a fourteen-piece commission.  That run is
  // archived and the new four-layer expansion starts at its order desk.
  run.stage = 'order';
  return run;
}

/**
 * Upgrade the saved campaign in place.  Egypt runs are rebuilt around the
 * new order → cargo → supplied build → expansion sequence, while every
 * profile, studio design, completed id and non-Egypt run remains intact.
 */
export function migrateJourney(state) {
  if (!state || typeof state !== 'object') return state;
  if (state.journeyVersion === JOURNEY_VERSION && state.expedition?.version === JOURNEY_VERSION) {
    const journey = globalJourney(state);
    const firstOrder = LEVELS[EGYPT_INDICES[0]];
    if (state.completed?.includes(firstOrder.missionId) && !journey.orders.three) {
      journey.orders.three = orderRecord(firstOrder, orderQuantities(firstOrder));
    }
    return state;
  }

  // The former fourteen-piece M4 is archived; it does not pass the new
  // thirty-piece expansion. Its already-earned profile reward is retained.
  const completed = Array.isArray(state.completed) ? [...new Set(state.completed)].filter(id=>id!=='egypt-4') : [];
  const oldRuns = state.runs && typeof state.runs === 'object' ? state.runs : {};
  const archive = state.legacyEgyptRuns && typeof state.legacyEgyptRuns === 'object'
    ? clone(state.legacyEgyptRuns) : {};
  const currentIndex = Number.isInteger(state.level) ? state.level : 0;
  const isLegacyCurrentEgypt = isEgyptIndex(currentIndex);

  for (const index of EGYPT_INDICES) {
    if (oldRuns[index] && !archive[index]) archive[index] = clone(oldRuns[index]);
  }
  if (isLegacyCurrentEgypt && !archive[currentIndex]) archive[currentIndex] = clone(state);

  const nextRuns = {...oldRuns};
  for (const index of EGYPT_INDICES) {
    nextRuns[index] = migrateEgyptRun(index, archive[index], completed);
  }

  const journey = globalJourney(state);
  const firstOrder = LEVELS[EGYPT_INDICES[0]];
  if (completed.includes(firstOrder.missionId) && !journey.orders.three) {
    journey.orders.three = orderRecord(firstOrder, orderQuantities(firstOrder));
  }
  state.completed = completed;
  state.runs = nextRuns;
  state.legacyEgyptRuns = archive;
  state.journeyVersion = JOURNEY_VERSION;
  state.migrationNotice = isLegacyCurrentEgypt && currentIndex === EGYPT_INDICES.at(-1)
    ? 'Your earlier Egypt commission is archived. The four-layer expansion is ready at its order desk.'
    : 'Your Egypt expedition ledger is updated. Earlier builds remain archived and your new journey is ready.';

  if (isLegacyCurrentEgypt) {
    const replacement = nextRuns[currentIndex];
    const profile = state.profile;
    const studio = state.studio;
    const mode = state.mode;
    Object.assign(state, replacement, {level: currentIndex, completed, runs: nextRuns, profile, studio, mode});
    state.expedition = journey;
    state.legacyEgyptRuns = archive;
    state.migrationNotice = isLegacyCurrentEgypt && currentIndex === EGYPT_INDICES.at(-1)
      ? 'Your earlier Egypt commission is archived. The four-layer expansion is ready at its order desk.'
      : 'Your Egypt expedition ledger is updated. Earlier builds remain archived and your new journey is ready.';
    globalJourney(state);
  } else {
    journey.orders ||= emptyOrders();
  }
  return state;
}
