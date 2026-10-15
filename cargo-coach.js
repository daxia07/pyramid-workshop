import {
  EXPANSION_THREE_VOYAGE_SOLUTION,
  THREE_VOYAGE_SOLUTION,
  DECK,
  canSail,
  placementProblem,
} from './cargo-packing.js';
import {STONE_DETAILS} from './stone-art.js';

// These are the same hand-auditable witnesses used by the cargo tests. The
// coach only reveals one next placement from a witness; it never places a
// stone, changes a rotation, or dispatches a voyage for the player.
const routes = Object.freeze({
  cargo: THREE_VOYAGE_SOLUTION,
  expand: EXPANSION_THREE_VOYAGE_SOLUTION,
});

const countTypes = items => items.reduce((counts, item) => {
  counts[item.type] = (counts[item.type] || 0) + 1;
  return counts;
}, {});

function sameCounts(a, b) {
  const types = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...types].every(type => (a[type] || 0) === (b[type] || 0));
}

function samePlacement(item, placement) {
  return item?.type === placement.type
    && item.column === placement.column
    && item.row === placement.row
    && ((item.rotation || 0) % 360 + 360) % 360
      === ((placement.rotation || 0) % 360 + 360) % 360;
}

function message(status, text, extra = {}) {
  return {status, text, ...extra};
}

function routeFor(level) {
  return routes[level?.journeyRole] || null;
}

function voyageTypes(voyage) {
  return countTypes((voyage?.placements || []).map(item => ({type: item.type})));
}

function completedVoyagesMatch(h, route) {
  if (!Array.isArray(h.voyages) || h.voyages.length > route.length) return false;
  return h.voyages.every((voyage, index) => sameCounts(voyageTypes(voyage), countTypes(route[index])));
}

function routeItemsForType(h, type) {
  return h.cargo.filter(item => item.type === type && item.status === 'quay');
}

/**
 * Return a safe, optional next step for the Egypt cargo puzzle.
 *
 * `status === 'place'` includes a single `{itemId,type,column,row,rotation}`
 * suggestion. `status === 'sail'` means the current witness load is ready.
 * `status === 'unload'` means the current deck diverges from the witness and
 * should be cleared before asking for another hint. `status === 'undo'` means
 * the last completed voyage used a different composition and must be undone
 * before this witness can continue. All other statuses are informational.
 */
export function cargoCoach(state, level) {
  const h = state?.harbor;
  const route = routeFor(level);
  if (!h || !route) {
    return message('inactive', 'The packing coach is available while a shipment is being loaded.');
  }
  if (h.finished) return message('complete', 'Every stone has arrived.');
  if (state.stage !== 'harbor') {
    return message('inactive', 'The packing coach is available while a shipment is being loaded.');
  }
  if (h.inTransit) return message('transit', 'Let this voyage arrive before asking for the next packing hint.');
  if (!Array.isArray(h.cargo)) return message('unavailable', 'The cargo list is not ready for a packing hint.');
  if (!Array.isArray(h.voyages) || h.voyages.length >= route.length) {
    return message('restart', 'The guided three-voyage route is complete, but some stones are still waiting. Restart the shipment to try the guided route again.');
  }
  if (!completedVoyagesMatch(h, route)) {
    return message('undo', 'Your last trip used a different load. Undo that trip to use this hint plan.', {
      action: 'undo-voyage',
      voyage: h.voyages.length,
    });
  }

  const plan = route[h.voyages.length];
  const boat = h.cargo.filter(item => item.status === 'boat');
  const unmatched = plan.slice();
  for (const item of boat) {
    const index = unmatched.findIndex(candidate => samePlacement(item, candidate));
    if (index < 0) {
      return message('unload', 'You can keep your own plan. For this hint plan, tap Unload all, then ask for the next hint again.', {
        action: 'unload-all',
        voyage: h.voyages.length + 1,
      });
    }
    unmatched.splice(index, 1);
  }

  if (!unmatched.length) {
    const problem = canSail(h.cargo);
    if (problem) {
      return message('unload', 'These stones are aboard, but the deck is not ready. For this hint plan, tap Unload all and try again.', {
        action: 'unload-all',
        voyage: h.voyages.length + 1,
        problem,
      });
    }
    if (Number(state.money) < DECK.fee) {
      return message('money', `This load is ready, but a voyage costs ${DECK.fee} coins and you have ${Math.max(0, Number(state.money) || 0)}. Undo the last voyage or restart the level before sailing.`, {
        action: h.voyages.length ? 'undo-voyage' : 'restart-level',
        voyage: h.voyages.length + 1,
      });
    }
    return message('sail', `Voyage ${h.voyages.length + 1} is balanced and ready. Sail when you are ready.`, {
      voyage: h.voyages.length + 1,
    });
  }

  const next = unmatched[0];
  const candidates = routeItemsForType(h, next.type);
  if (!candidates.length) {
    const market = h.cargo.some(item => item.type === next.type && item.status === 'market');
    return message(market ? 'buy' : 'unavailable', market
      ? `Buy a ${next.type} stone first, then ask for the next packing hint.`
      : `A ${next.type} stone for this load is not waiting at the quay. Restart the shipment to try the guided route.`, {
      voyage: h.voyages.length + 1,
    });
  }

  const item = candidates[0];
  const problem = placementProblem(h.cargo, item, next.column, next.row, next.rotation);
  if (problem) {
    return message('unload', 'You can keep your own plan. For this hint plan, tap Unload all, then ask for the next hint again.', {
      action: 'unload-all',
      voyage: h.voyages.length + 1,
      problem,
    });
  }
  const label = STONE_DETAILS[next.type]?.label || `${next.type} stone`;
  return message('place', `Rotate the ${label.toLowerCase()} to ${next.rotation}°, then tap deck ${String.fromCharCode(65 + next.column)}${next.row + 1}.`, {
    action: 'place',
    itemId: item.id,
    voyage: h.voyages.length + 1,
    suggestion: {itemId: item.id, type: next.type, column: next.column, row: next.row, rotation: next.rotation},
  });
}

export function nextCargoPlacement(state, level) {
  const coached = cargoCoach(state, level);
  return coached.status === 'place' ? coached.suggestion : null;
}
