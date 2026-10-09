/**
 * The cargo puzzle uses padded sled footprints instead of trying to make the
 * real masonry dimensions fit a tiny game boat.  A cargo item is an object
 * with at least `{type, status, column, row, rotation}`.  Only items whose
 * status is `boat` are on the deck; quay and delivered items are ignored by
 * the collision and load calculations.
 */

const freezeCells = cells => Object.freeze(cells.map(cell => Object.freeze([...cell])));

export const CARGO_SPECS = Object.freeze({
  brick: Object.freeze({
    name: 'Brick sled',
    weight: 2,
    cells: freezeCells([[0, 0], [1, 0]]),
    color: '#d6b276',
  }),
  edge: Object.freeze({
    name: 'Edge stone sled',
    weight: 3,
    cells: freezeCells([[0, 0], [1, 0], [2, 0]]),
    color: '#e5c98e',
  }),
  corner: Object.freeze({
    name: 'Corner stone sled',
    weight: 3,
    cells: freezeCells([[0, 0], [1, 0], [0, 1]]),
    color: '#efd69c',
  }),
  cap: Object.freeze({
    name: 'Capstone sled',
    weight: 5,
    cells: freezeCells([[0, 0], [1, 0], [0, 1], [1, 1]]),
    color: '#f3dfad',
  }),
});

export const DECK = Object.freeze({
  columns: 5,
  rows: 4,
  blocked: freezeCells([[2, 1], [2, 2]]),
  capacity: 16,
  // Offsets are normalized to half the deck width/depth.  A load can be a
  // little off centre, but the two independent axes both matter.
  maxOffsetX: 0.30,
  maxOffsetZ: 0.30,
  fee: 3,
});

const DEGREES = Object.freeze([0, 90, 180, 270]);
const key = (column, row) => `${column},${row}`;
const deckCenterX = DECK.columns / 2;
const deckCenterZ = DECK.rows / 2;
const blocked = new Set(DECK.blocked.map(([column, row]) => key(column, row)));

function specFor(type) {
  const spec = CARGO_SPECS[type];
  if (!spec) throw new TypeError(`Unknown cargo type: ${String(type)}`);
  return spec;
}

function rotationDegrees(rotation = 0) {
  if (rotation === undefined || rotation === null) return 0;
  if (typeof rotation !== 'number' || !Number.isFinite(rotation)) {
    throw new TypeError('Cargo rotation must be a finite number.');
  }

  // The public API accepts either quarter turns (0..3) or degrees.  Values
  // that are already in degree notation are easier to read in saved games;
  // small integers remain convenient for keyboard controls.
  const degrees = Math.abs(rotation) <= 3 ? rotation * 90 : rotation;
  if (!Number.isInteger(degrees) || degrees % 90 !== 0) {
    throw new RangeError('Cargo rotation must be a quarter turn or a multiple of 90 degrees.');
  }
  return ((degrees % 360) + 360) % 360;
}

function turn([column, row], degrees) {
  if (degrees === 0) return [column, row];
  if (degrees === 90) return [-row, column];
  if (degrees === 180) return [-column, -row];
  return [row, -column];
}

/**
 * Return a normalized footprint.  The top-left occupied cell is always
 * `[0, 0]`, which makes `column` and `row` the anchor cell on the deck.
 */
export function footprint(type, rotation = 0) {
  const spec = specFor(type);
  const degrees = rotationDegrees(rotation);
  const turned = spec.cells.map(cell => turn(cell, degrees));
  const minColumn = Math.min(...turned.map(([column]) => column));
  const minRow = Math.min(...turned.map(([, row]) => row));
  return turned
    .map(([column, row]) => [column - minColumn, row - minRow])
    .sort(([aColumn, aRow], [bColumn, bRow]) => aRow - bRow || aColumn - bColumn);
}

/** Return absolute deck cells for an item and its proposed placement. */
export function occupiedCells(item) {
  if (!item || typeof item !== 'object') throw new TypeError('Cargo item is required.');
  specFor(item.type);
  if (!Number.isInteger(item.column) || !Number.isInteger(item.row)) {
    throw new TypeError('A placed cargo item needs integer column and row values.');
  }
  return footprint(item.type, item.rotation).map(([column, row]) => [
    item.column + column,
    item.row + row,
  ]);
}

function sameItem(a, b) {
  if (a === b) return true;
  return Boolean(a?.id && b?.id && a.id === b.id);
}

function boatItems(cargo) {
  return (Array.isArray(cargo) ? cargo : []).filter(item => item?.status === 'boat');
}

function placementItem(item, column, row, rotation) {
  return {...item, column, row, rotation: rotationDegrees(rotation)};
}

/**
 * Explain why a proposed placement cannot go on the deck.  Existing cargo is
 * intentionally filtered to `status === 'boat'`; quay, market, transit and
 * delivered pieces are inventory, not obstacles.
 */
export function placementProblem(cargo, item, column, row, rotation) {
  if (!item || typeof item !== 'object') return 'Choose a stone to place on the boat.';
  if (!CARGO_SPECS[item.type]) return `Unknown cargo type: ${String(item.type)}.`;
  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    return 'Place the stone on a whole deck cell.';
  }

  let candidate;
  try {
    candidate = placementItem(item, column, row, rotation === undefined ? item.rotation ?? 0 : rotation);
  } catch (error) {
    return error instanceof Error ? error.message : 'Choose a valid rotation.';
  }

  const cells = occupiedCells(candidate);
  if (cells.some(([cellColumn, cellRow]) =>
    cellColumn < 0 || cellColumn >= DECK.columns || cellRow < 0 || cellRow >= DECK.rows)) {
    return 'That sled footprint runs off the deck.';
  }
  if (cells.some(([cellColumn, cellRow]) => blocked.has(key(cellColumn, cellRow)))) {
    return 'The mast occupies that deck space. Rotate or move the sled.';
  }

  const otherItems = boatItems(cargo).filter(other => !sameItem(other, item));
  for (const other of otherItems) {
    // Malformed existing items are handled by canSail; placement remains
    // useful while the player is editing a load, so skip a half-placed item.
    if (!Number.isInteger(other.column) || !Number.isInteger(other.row)) continue;
    const occupied = new Set(occupiedCells(other).map(([c, r]) => key(c, r)));
    if (cells.some(([cellColumn, cellRow]) => occupied.has(key(cellColumn, cellRow)))) {
      return 'That sled collides with another stone on the deck.';
    }
  }
  return null;
}

/**
 * Calculate a weighted centre of mass.  The weight of each item is spread
 * over its padded sled cells, so a long edge sled still has the same total
 * mass as a compact cap sled.  Coordinates refer to cell centres: a 5×4
 * deck is centred at (2.5, 2).
 */
export function loadMetrics(cargo) {
  const items = boatItems(cargo);
  let weight = 0;
  let tiles = 0;
  let weightedX = 0;
  let weightedZ = 0;

  for (const item of items) {
    const spec = specFor(item.type);
    const cells = occupiedCells(item);
    const cellWeight = spec.weight / cells.length;
    weight += spec.weight;
    tiles += cells.length;
    for (const [column, row] of cells) {
      weightedX += (column + 0.5) * cellWeight;
      weightedZ += (row + 0.5) * cellWeight;
    }
  }

  const centerX = weight ? weightedX / weight : deckCenterX;
  const centerZ = weight ? weightedZ / weight : deckCenterZ;
  const offsetX = (centerX - deckCenterX) / deckCenterX;
  const offsetZ = (centerZ - deckCenterZ) / deckCenterZ;
  const balanced = Math.abs(offsetX) <= DECK.maxOffsetX && Math.abs(offsetZ) <= DECK.maxOffsetZ;

  return {
    items: items.length,
    weight,
    tiles,
    centerX,
    centerZ,
    offsetX,
    offsetZ,
    balanced,
    overweight: weight > DECK.capacity,
  };
}

function geometryProblem(cargo) {
  const items = boatItems(cargo);
  for (const item of items) {
    const problem = placementProblem(items, item, item.column, item.row, item.rotation);
    if (problem) return problem;
  }
  return null;
}

/** Return null when a load can sail, or a player-facing reason when it cannot. */
export function canSail(cargo) {
  const items = boatItems(cargo);
  if (!items.length) return 'Load at least one stone before sailing.';

  let metrics;
  try {
    metrics = loadMetrics(cargo);
  } catch (error) {
    return error instanceof Error ? error.message : 'Check the stones on the deck.';
  }
  const shapeProblem = geometryProblem(cargo);
  if (shapeProblem) return shapeProblem;
  if (metrics.overweight) {
    return `The load is too heavy: ${metrics.weight}/${DECK.capacity} weight.`;
  }
  if (!metrics.balanced) {
    const axes = [];
    if (Math.abs(metrics.offsetX) > DECK.maxOffsetX) axes.push('lateral');
    if (Math.abs(metrics.offsetZ) > DECK.maxOffsetZ) axes.push('fore/aft');
    return `The boat is out of balance (${axes.join(' and ')}). Shift the stones toward the centre.`;
  }
  return null;
}

function candidateFor(cargo, type) {
  const existing = (Array.isArray(cargo) ? cargo : []).find(item =>
    item?.type === type && item.status !== 'boat' && item.status !== 'delivered');
  return existing || {type, status: 'quay'};
}

/**
 * Find one useful open placement for a stone.  It is deliberately a single
 * placement hint, not a solver for the entire contract.  Candidates are
 * scored by balance first so a player can build a stable load incrementally.
 */
export function suggestPlacement(cargo, type, rotation) {
  if (!CARGO_SPECS[type]) return null;
  const source = candidateFor(cargo, type);
  let rotations;
  try {
    rotations = rotation === undefined
      ? [...DEGREES]
      : [rotationDegrees(rotation)];
  } catch {
    return null;
  }

  const candidates = [];
  for (const degrees of rotations) {
    const shape = footprint(type, degrees);
    const maxColumn = DECK.columns - 1 - Math.max(...shape.map(([column]) => column));
    const maxRow = DECK.rows - 1 - Math.max(...shape.map(([, row]) => row));
    for (let row = 0; row <= maxRow; row++) {
      for (let column = 0; column <= maxColumn; column++) {
        const problem = placementProblem(cargo, source, column, row, degrees);
        if (problem) continue;
        const proposed = placementItem(source, column, row, degrees);
        const next = (Array.isArray(cargo) ? cargo : [])
          .filter(item => !sameItem(item, source))
          .concat({...proposed, status: 'boat'});
        const metrics = loadMetrics(next);
        candidates.push({
          type,
          column,
          row,
          rotation: degrees,
          balanced: metrics.balanced,
          score: Math.abs(metrics.offsetX) + Math.abs(metrics.offsetZ),
        });
      }
    }
  }
  candidates.sort((a, b) => Number(b.balanced) - Number(a.balanced) || a.score - b.score ||
    a.row - b.row || a.column - b.column || a.rotation - b.rotation);
  const result = candidates[0];
  return result ? {type: result.type, column: result.column, row: result.row, rotation: result.rotation} : null;
}

// A compact, hand-auditable contract solution.  It is exported so the UI can
// use it as a teaching hint, while tests verify every load with canSail.
export const THREE_VOYAGE_SOLUTION = Object.freeze([
  Object.freeze([
    {type: 'corner', column: 3, row: 1, rotation: 0},
    {type: 'corner', column: 0, row: 1, rotation: 180},
    {type: 'edge', column: 0, row: 3, rotation: 0},
    {type: 'edge', column: 0, row: 0, rotation: 0},
    {type: 'corner', column: 3, row: 2, rotation: 180},
  ]),
  Object.freeze([
    {type: 'corner', column: 2, row: 2, rotation: 180},
    {type: 'edge', column: 4, row: 0, rotation: 270},
    {type: 'cap', column: 0, row: 2, rotation: 180},
    {type: 'corner', column: 0, row: 0, rotation: 0},
  ]),
  Object.freeze([
    {type: 'edge', column: 1, row: 0, rotation: 90},
    {type: 'corner', column: 3, row: 2, rotation: 90},
    {type: 'corner', column: 3, row: 0, rotation: 0},
    {type: 'corner', column: 0, row: 2, rotation: 270},
    {type: 'brick', column: 0, row: 0, rotation: 270},
  ]),
]);

// The later expansion contract replaces the cap with four bricks, eight
// edges and four corners.  It still fits in three balanced voyages, while its
// 44 total weight makes three the mathematical minimum at capacity 16.
export const EXPANSION_THREE_VOYAGE_SOLUTION = Object.freeze([
  Object.freeze([
    {type: 'edge', column: 0, row: 0, rotation: 180},
    {type: 'brick', column: 4, row: 1, rotation: 270},
    {type: 'edge', column: 2, row: 3, rotation: 180},
    {type: 'edge', column: 0, row: 1, rotation: 90},
    {type: 'edge', column: 3, row: 0, rotation: 90},
    {type: 'brick', column: 1, row: 1, rotation: 90},
  ]),
  Object.freeze([
    {type: 'edge', column: 0, row: 0, rotation: 90},
    {type: 'edge', column: 2, row: 0, rotation: 0},
    {type: 'edge', column: 0, row: 3, rotation: 180},
    {type: 'corner', column: 3, row: 2, rotation: 180},
    {type: 'corner', column: 3, row: 1, rotation: 0},
  ]),
  Object.freeze([
    {type: 'corner', column: 0, row: 2, rotation: 0},
    {type: 'edge', column: 4, row: 1, rotation: 90},
    {type: 'brick', column: 3, row: 0, rotation: 90},
    {type: 'brick', column: 0, row: 0, rotation: 270},
    {type: 'corner', column: 2, row: 2, rotation: 180},
  ]),
]);
