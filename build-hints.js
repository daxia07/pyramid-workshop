import { key, planningValid, sku, supported, target, unusedPurchases } from './game.js';
import { STONE_DETAILS } from './stone-art.js';

export { egyptPlacementProblem } from './egypt-building.js';

const isEgyptConstruction = level => level?.id === 'egypt';

const friendlyShape = type => ({
  brick: 'flat brick',
  edge: 'edge stone',
  corner: 'corner stone',
  cap: 'capstone',
}[type] || STONE_DETAILS[type]?.label?.toLowerCase() || 'matching stone');

const positionLabel = type => ({
  brick: 'the center',
  edge: 'an edge',
  corner: 'a corner',
  cap: 'the top',
}[type] || 'the marked space');

const egyptHint = (state, level) => {
  const placed = Array.isArray(state.blocks) ? state.blocks : [];
  const occupied = new Map(placed.map(block => [key(block.x, block.y, block.z), block]));
  const wanted = target(level);
  const correct = new Set();
  const wrong = [];

  for (const want of wanted) {
    const position = key(want.x, want.y, want.z);
    const block = occupied.get(position);
    if (!block) continue;
    if (sku(block) === sku(want)) correct.add(position);
    else wrong.push({block, want});
  }

  // A wrong shape needs to be fixed before we count its space as filled. The
  // action tells the shell which layer and tool make the recovery easy.
  const misplaced = wrong.filter(({block}) => !block.locked)
    .sort((a, b) => a.want.y - b.want.y)[0];
  if (misplaced) {
    const {block, want} = misplaced;
    const expected = sku(want);

    // Removing a lower wrong stone can leave the correct stones above it
    // floating. Find the whole dependency chain, not only the first layer.
    // For a three-layer pyramid, removing one foundation corner can first
    // unset an upper corner and then the capstone. The capstone is the safe
    // first lift.
    const removalSet = new Set([block]);
    let changed = true;
    while (changed) {
      changed = false;
      const rest = placed.filter(candidate => !removalSet.has(candidate));
      for (const candidate of placed) {
        if (removalSet.has(candidate) || candidate.locked) continue;
        if (supported(candidate, placed, level) && !supported(candidate, rest, level)) {
          removalSet.add(candidate);
          changed = true;
        }
      }
    }
    const blocker = placed
      .filter(candidate => candidate !== block && removalSet.has(candidate))
      .sort((a, b) => b.y - a.y)[0];
    if (blocker) {
      return {
        text: `Lift the upper ${friendlyShape(sku(blocker))} on L${blocker.y + 1} first.`,
        layer: blocker.y,
        tool: 'remove',
      };
    }

    return {
      text: `That stone has the wrong shape. Lift it out, then choose a ${friendlyShape(expected)}.`,
      layer: want.y,
      part: expected,
      tool: 'remove',
    };
  }

  const outside = placed.find(block => !wanted.some(candidate => key(candidate.x, candidate.y, candidate.z)
    === key(block.x, block.y, block.z)) && !block.locked);
  if (outside) {
    return {
      text: 'That stone is outside the plan. Lift it out and use a marked space.',
      layer: outside.y,
      tool: 'remove',
    };
  }

  const placeTool = state.tool === 'remove' ? {tool: 'place'} : {};

  const pending = wanted.filter(block => !correct.has(key(block.x, block.y, block.z)));
  if (!pending.length) {
    return {text: 'Your pyramid is ready! Tap “Check my pyramid”.', check: true, ...placeTool};
  }

  const available = block => (state.inventory?.[sku(block)] || 0) > 0
    && supported(block, placed, level);
  const ready = pending.filter(block => !occupied.has(key(block.x, block.y, block.z)) && available(block));
  const next = ready.find(block => sku(block) === state.part && block.y === state.layer)
    || ready.find(block => sku(block) === state.part)
    || ready.find(block => block.y === state.layer)
    || ready[0];

  if (!next) {
    const first = pending[0];
    const expected = sku(first);
    return {
      text: `Build the lower stones first, then place a ${friendlyShape(expected)}.`,
      part: expected,
      ...placeTool,
    };
  }

  const expected = sku(next);
  const scaffold = state.scaffold === true;
  const scaffoldLead = scaffold
    ? 'The upper stones are locked on the scaffold. Start with the new foundation. '
    : '';

  if (next.y !== state.layer) {
    const currentLayer = wanted.filter(block => block.y === state.layer);
    const currentFilled = currentLayer.length > 0 && currentLayer.every(block =>
      correct.has(key(block.x, block.y, block.z)));
    return {
      text: `${scaffoldLead}${currentFilled ? `L${state.layer + 1} is filled. ` : ''}`
        + `The ${friendlyShape(expected)} goes on L${next.y + 1}. Select that layer to continue.`,
      layer: next.y,
      part: expected,
      ...placeTool,
      ...(scaffold ? {scaffold: true} : {}),
    };
  }

  if (expected !== state.part) {
    return {
      text: `${scaffoldLead}Choose the ${friendlyShape(expected)}, then tap ${positionLabel(expected)} on L${state.layer + 1}.`,
      ...(scaffold ? {layer: state.layer} : {}),
      part: expected,
      ...placeTool,
      ...(scaffold ? {scaffold: true} : {}),
    };
  }

  if (expected === 'cap') {
    return {
      text: `${scaffoldLead}L${state.layer + 1} is selected. Tap the top space to place the capstone.`,
      ...(scaffold ? {layer: state.layer} : {}),
      part: expected,
      ...placeTool,
      ...(scaffold ? {scaffold: true} : {}),
    };
  }

  if (scaffold) {
    return {
      text: `${scaffoldLead}Place the ${friendlyShape(expected)} on L${state.layer + 1}.`,
      layer: state.layer,
      part: expected,
      ...placeTool,
      scaffold: true,
    };
  }

  return {
    text: `Place the ${friendlyShape(expected)} ${expected === 'brick' ? 'in' : 'on'} ${positionLabel(expected)} on L${state.layer + 1}.`,
    ...placeTool,
    ...(state.tool === 'remove' ? {part: expected} : {}),
  };
};

const routeName = block => (block?.routeId || block?.side || (block?.z < 0 ? 'rear' : 'front')) === 'rear'
  ? 'rear'
  : 'front';

const pieceLabel = block => block?.type === 'stairs'
  ? `${routeName(block)} stair flight`
  : STONE_DETAILS[sku(block)]?.label?.toLowerCase() || 'stone';

const samePlanPiece = (block, wanted) => !!wanted
  && sku(block) === sku(wanted)
  && (wanted.type !== 'stairs' || routeName(block) === routeName(wanted));

const upperRemovalBlocker = (block, placed, level) => {
  const removalSet = new Set([block]);
  let changed = true;
  while (changed) {
    changed = false;
    const rest = placed.filter(candidate => !removalSet.has(candidate));
    for (const candidate of placed) {
      if (removalSet.has(candidate)) continue;
      if (supported(candidate, placed, level) && !supported(candidate, rest, level)) {
        removalSet.add(candidate);
        changed = true;
      }
    }
  }
  return placed
    .filter(candidate => candidate !== block && removalSet.has(candidate))
    .sort((a, b) => b.y - a.y)[0];
};

const misplacedHint = (block, wanted, placed, level) => {
  const blocker = upperRemovalBlocker(block, placed, level);
  if (blocker?.locked) {
    return {
      text: `A fixed ${pieceLabel(blocker)} on L${blocker.y + 1} still rests on this misplaced piece. Restart this mission to repair the saved layout.`,
    };
  }
  if (blocker) {
    return {
      text: `Lift the upper ${pieceLabel(blocker)} on L${blocker.y + 1} first; it rests on the misplaced ${pieceLabel(block)}.`,
      layer: blocker.y,
      tool: 'remove',
    };
  }
  if (block.locked) {
    return {text: `The misplaced ${pieceLabel(block)} is fixed at the site. Restart this mission to repair the saved layout.`};
  }

  if (block.type === 'stairs' && wanted && routeName(block) !== routeName(wanted)) {
    return {
      text: `That stair is on the ${routeName(block)} route. Lift it out, then add the planned ${routeName(wanted)} stair flight.`,
      layer: block.y,
      tool: 'remove',
    };
  }
  if (!wanted) {
    return {
      text: `That ${pieceLabel(block)} is outside the plan. Lift it out and reuse it in a marked space.`,
      layer: block.y,
      tool: 'remove',
    };
  }
  return {
    text: `That ${pieceLabel(block)} is the wrong piece for a ${pieceLabel(wanted)} space. Lift it out, then choose the planned piece.`,
    layer: block.y,
    tool: 'remove',
  };
};

const nonEgyptHint = (state, level) => {
  const placed = Array.isArray(state.blocks) ? state.blocks : [];
  const wanted = target(level);
  const wantedAt = new Map(wanted.map(block => [key(block.x, block.y, block.z), block]));
  const occupied = new Map(placed.map(block => [key(block.x, block.y, block.z), block]));
  const misplaced = placed.find(block => !samePlanPiece(block, wantedAt.get(key(block.x, block.y, block.z))));

  if (misplaced) {
    return misplacedHint(misplaced, wantedAt.get(key(misplaced.x, misplaced.y, misplaced.z)), placed, level);
  }

  const pending = wanted.filter(block => !occupied.has(key(block.x, block.y, block.z)));
  if (!pending.length) {
    if (!planningValid(level, state)) {
      return {text: 'The design or site misses this mission’s requirement. Open Market, choose Review plan, and correct that choice before inspection.'};
    }
    if (state.money < 0) {
      return {text: 'Your budget is below zero. Return unused purchases at the market before inspection.'};
    }
    const unused = unusedPurchases(state);
    if (unused) {
      return {text: `Your building matches the plan. Return ${unused} unused purchased ${unused === 1 ? 'piece' : 'pieces'} at the market, then inspect your building.`};
    }
    const unsupported = placed.find(block => !supported(block, placed, level));
    if (unsupported) {
      return {text: `The ${pieceLabel(unsupported)} on L${unsupported.y + 1} still needs support. Check the lower layer before inspection.`};
    }
    return {text: 'Your building matches the plan. Tap “Inspect my building” to finish.', check: true};
  }

  const inventory = state.inventory || {};
  const available = block => (inventory[sku(block)] || 0) > 0 && supported(block, placed, level);
  const ready = pending.filter(available);
  const next = ready.find(block => sku(block) === state.part && block.y === state.layer)
    || ready.find(block => sku(block) === state.part)
    || ready.find(block => block.y === state.layer)
    || ready[0];

  if (!next) {
    const first = [...pending].sort((a, b) => a.y - b.y)[0];
    const type = sku(first);
    const label = STONE_DETAILS[type]?.label?.toLowerCase() || 'matching piece';
    if (!(inventory[type] > 0)) {
      return {
        text: `No ${label} remains for the next supported space on L${first.y + 1}. Tap Market to buy one, then return to place it.`,
      };
    }
    return {
      text: `Build the lower support first, then place the ${label} on L${first.y + 1}.`,
      layer: first.y,
      part: type,
      tool: 'place',
    };
  }

  const type = sku(next);
  const label = STONE_DETAILS[type]?.label?.toLowerCase() || 'matching piece';
  if (type === 'stairs') {
    const route = routeName(next);
    return {
      text: next.y !== state.layer
        ? `The ${route} stair flight goes on L${next.y + 1}. Select that layer, then use its ${route} stair slot.`
        : `Use the ${route} stair slot on L${next.y + 1} to connect this route.`,
      layer: next.y,
      part: type,
      tool: 'place',
    };
  }
  if (next.y !== state.layer) {
    return {
      text: `The ${label} goes on L${next.y + 1}. Select that layer to continue.`,
      layer: next.y,
      part: type,
      tool: 'place',
    };
  }
  return {
    text: `Place the ${label} on L${next.y + 1}.`,
    layer: next.y,
    part: type,
    tool: 'place',
  };
};

// Hints can point to a recovery action, but the player still chooses every
// piece placement and every inspection.
export function buildHint(state, level) {
  if (state.stage !== 'build') return null;
  if (isEgyptConstruction(level)) return egyptHint(state, level);
  return nonEgyptHint(state, level);
}
