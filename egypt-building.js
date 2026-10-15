import { key, sku, target } from './game.js';

// Egypt is the only scene where a stone's shape is part of the lesson. Keep
// this check pure so the placement UI can ask for a friendly explanation
// before it spends a stone or changes the saved building.
const isEgypt = level => level?.id === 'egypt' || level?.sceneId === 'egypt'
  || level?.shapeFamily === 'egypt';

const SHAPE_SPOTS = {
  brick: {name: 'flat brick', place: 'the center'},
  edge: {name: 'edge stone', place: 'an edge'},
  corner: {name: 'corner stone', place: 'a corner'},
  cap: {name: 'capstone', place: 'the top'},
};

const shapeSpot = type => SHAPE_SPOTS[type] || {name: 'matching stone', place: 'this marked space'};

/**
 * Explain why a proposed Egypt placement is not the shape in the plan.
 *
 * A valid placement returns null. Non-Egypt levels also return null so the
 * existing free-form placement rules keep their original behavior. Invalid
 * results use the small `{code, text, layer?, expectedType?}` contract. The
 * returned object is descriptive only; this function never writes to state.
 */
export function egyptPlacementProblem(state, level, placement = {}) {
  if (!isEgypt(level)) return null;

  const {x, y, z} = placement;
  const proposedType = placement.material || placement.type;
  const blueprint = target(level);
  if (!Array.isArray(blueprint)) return null;
  const wanted = blueprint.find(block => key(block.x, block.y, block.z) === key(x, y, z));

  if (!wanted) {
    return {
      code: 'outside-plan',
      text: 'That space is outside the plan. Tap a marked space.',
    };
  }

  const expectedType = sku(wanted);
  if (proposedType === expectedType) return null;

  const spot = shapeSpot(expectedType);
  const text = `That is ${spot.place}. Choose a ${spot.name}.`;
  return {
    code: 'wrong-shape',
    layer: wanted.y,
    expectedType,
    text,
  };
}

