import * as THREE from 'three';

export const WATER_LEVEL = -0.13;
export const WATERBED_LEVEL = -0.42;
export const BACKDROP_BOUNDS = Object.freeze({
  minX: -120,
  maxX: 120,
  minZ: -150,
  maxZ: 95,
});

const TAU = Math.PI * 2;
const BANK_SAMPLES = 96;
const BANK_CROSS_SAMPLES = 30;
const RIVER_ACROSS_SAMPLES = 12;
const MAX_MARGIN = 40;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const finite = value => Number.isFinite(value) ? value : 0;
const validSide = side => {
  if (side !== 'west' && side !== 'east') {
    throw new RangeError(`Unknown bank side: ${String(side)}`);
  }
  return side;
};
const farBend = z => smoothstep((-z) / 100);
const wave = (z, frequency, phase = 0) => Math.sin(z * frequency + phase) - Math.sin(phase);

/**
 * Return the river shoreline x coordinate for a given longitudinal z.
 *
 * The banks are analytic, so every consumer (terrain, water, route checks and
 * meshes) uses exactly the same shoreline.  The negative-z bend gently closes
 * the river toward the horizon while small multi-frequency waves keep it from
 * reading as a box.
 */
export function bankX(z, side = 'west') {
  validSide(side);
  const longitudinal = finite(z);
  const bend = farBend(longitudinal);
  if (side === 'west') {
    return -3
      + 2.4 * bend
      + 0.18 * wave(longitudinal, 0.064, 0.4)
      + 0.075 * wave(longitudinal, 0.17, 1.7);
  }
  return 22
    - 8 * bend
    + 0.72 * wave(longitudinal, 0.052, 0.3)
    + 0.18 * wave(longitudinal, 0.13, 1.1);
}

const BERM_FEATURES = Object.freeze([
  Object.freeze({x: -35, z: -8, height: 0.22, radiusX: 9, radiusZ: 15}),
  Object.freeze({x: 42, z: -51, height: 0.18, radiusX: 13, radiusZ: 12}),
  Object.freeze({x: 70, z: 20, height: 0.14, radiusX: 18, radiusZ: 15}),
  Object.freeze({x: -68, z: 44, height: 0.12, radiusX: 22, radiusZ: 18}),
]);

// The quarry terrace is deliberately lower than the surrounding berm.  It is
// a geographic datum shared by the terrain sampler and the scenery builder.
export const QUARRY_SITE = Object.freeze({
  id: 'west-bank-quarry',
  x: -17,
  z: -14,
  width: 12,
  depth: 10,
  terraceWidth: 8.4,
  terraceDepth: 6.4,
  referenceHeight: 0.29,
  cutDepth: 0.2,
});

function gaussianFeature(x, z, feature) {
  const dx = (x - feature.x) / feature.radiusX;
  const dz = (z - feature.z) / feature.radiusZ;
  return feature.height * Math.exp(-0.5 * (dx * dx + dz * dz));
}

function shorelineDistance(x, z) {
  const west = bankX(z, 'west');
  const east = bankX(z, 'east');
  if (x < west) return west - x;
  if (x > east) return x - east;
  return Math.min(x - west, east - x);
}

function quarryCut(x, z) {
  const dx = Math.abs(x - QUARRY_SITE.x) / (QUARRY_SITE.terraceWidth * 0.5);
  const dz = Math.abs(z - QUARRY_SITE.z) / (QUARRY_SITE.terraceDepth * 0.5);
  const inside = Math.max(dx, dz);
  return QUARRY_SITE.cutDepth * (1 - smoothstep((inside - 0.42) / 0.58));
}

function landHeight(x, z, distance) {
  // Two ramps create a natural gravel shoulder followed by a low, dry berm.
  // Both start at exactly zero on the shoreline.
  const shoulder = 0.2 * smoothstep(distance / 1.6)
    + 0.38 * smoothstep(distance / 5.5);
  const undulation = (0.027 * Math.sin(x * 0.11 + z * 0.035)
    + 0.019 * Math.sin(x * 0.037 - z * 0.091 + 1.4))
    * smoothstep(distance / 3.8);
  const berms = BERM_FEATURES.reduce((sum, feature) => sum + gaussianFeature(x, z, feature), 0)
    * smoothstep(distance / 4.5);
  return WATER_LEVEL + shoulder + undulation + berms - quarryCut(x, z);
}

/**
 * Sample the continuous terrain height.  Water transitions to a shallow
 * waterbed at the shoreline; land rises from the same WATER_LEVEL datum.
 */
export function terrainHeight(x, z) {
  const px = finite(x);
  const pz = finite(z);
  const west = bankX(pz, 'west');
  const east = bankX(pz, 'east');
  if (px > west && px < east) {
    const distance = Math.min(px - west, east - px);
    const bedBlend = smoothstep(distance / 2.6);
    const bedRipple = 0.012 * Math.sin(px * 0.17 + pz * 0.043) * bedBlend;
    return WATER_LEVEL + (WATERBED_LEVEL - WATER_LEVEL) * bedBlend + bedRipple;
  }
  return landHeight(px, pz, shorelineDistance(px, pz));
}

/**
 * Check dry land using the same bank equations as terrainHeight.  A positive
 * margin keeps that much clearance from the shoreline, which is useful for
 * foundations and docks.
 */
export function isDryLand(x, z, margin = 0) {
  const px = finite(x);
  const pz = finite(z);
  const clearance = clamp(Math.max(0, finite(margin)), 0, MAX_MARGIN);
  return px <= bankX(pz, 'west') - clearance || px >= bankX(pz, 'east') + clearance;
}

export function isWithinBackdrop(x, z) {
  return x >= BACKDROP_BOUNDS.minX && x <= BACKDROP_BOUNDS.maxX
    && z >= BACKDROP_BOUNDS.minZ && z <= BACKDROP_BOUNDS.maxZ;
}

export const ROUTE = Object.freeze({
  start: Object.freeze({x: 0, z: 0}),
  control: Object.freeze({x: 2.2, z: -42}),
  end: Object.freeze({x: 6.5, z: -126}),
  hullClearance: 3,
});
export const ROUTE_START = ROUTE.start;
export const ROUTE_END = ROUTE.end;
export const ROUTE_HULL_CLEARANCE = ROUTE.hullClearance;

export function routePoint(progress) {
  const t = clamp(finite(progress), 0, 1);
  const mt = 1 - t;
  return {
    x: mt * mt * ROUTE.start.x + 2 * mt * t * ROUTE.control.x + t * t * ROUTE.end.x,
    z: mt * mt * ROUTE.start.z + 2 * mt * t * ROUTE.control.z + t * t * ROUTE.end.z,
  };
}

/** A one-way departure. The next boat is only revealed after delivery completes. */
export function voyagePose(progress) {
  const p=clamp(finite(progress),0,1),t=Math.min(1,p/.93),distance=t*t*(2-t);
  const point=routePoint(distance);
  const dx=2*(1-distance)*(ROUTE.control.x-ROUTE.start.x)+2*distance*(ROUTE.end.x-ROUTE.control.x);
  const dz=2*(1-distance)*(ROUTE.control.z-ROUTE.start.z)+2*distance*(ROUTE.end.z-ROUTE.control.z);
  return {...point,heading:-Math.atan2(dx,-dz),visible:p<.94};
}

export function routeClearance(point, z = point?.z) {
  const x = finite(point?.x);
  const longitudinal = finite(z);
  return Math.min(x - bankX(longitudinal, 'west'), bankX(longitudinal, 'east') - x);
}

export function routeIsNavigable(point, clearance = ROUTE_HULL_CLEARANCE) {
  return routeClearance(point) >= Math.max(0, finite(clearance))
    && !isDryLand(point.x, point.z);
}

const SITE_DEFINITIONS = Object.freeze([
  Object.freeze({id: 'horizon-east-01', x: 29, z: -34, halfWidth: 4.2, halfDepth: 4.4}),
  Object.freeze({id: 'horizon-east-02', x: 39, z: -49, halfWidth: 4.6, halfDepth: 4.1}),
  Object.freeze({id: 'horizon-east-03', x: 49, z: -59, halfWidth: 4.2, halfDepth: 4.8}),
]);

function siteCorners(definition) {
  return [
    [definition.x - definition.halfWidth, definition.z - definition.halfDepth],
    [definition.x + definition.halfWidth, definition.z - definition.halfDepth],
    [definition.x + definition.halfWidth, definition.z + definition.halfDepth],
    [definition.x - definition.halfWidth, definition.z + definition.halfDepth],
  ];
}

export const PYRAMID_SITES = Object.freeze(SITE_DEFINITIONS.map(definition => {
  const baseHeight = Math.max(0.12, terrainHeight(definition.x, definition.z));
  const corners = siteCorners(definition);
  return Object.freeze({
    ...definition,
    baseHeight,
    baseY: baseHeight,
    footprint: Object.freeze({width: definition.halfWidth * 2, depth: definition.halfDepth * 2}),
    corners: Object.freeze(corners.map(corner => Object.freeze(corner))),
  });
}));

export function pyramidSiteIsDry(site, samples = 3) {
  if (!site) return false;
  const corners = site.corners || siteCorners(site);
  if (corners.some(([x, z]) => !isDryLand(x, z, 0.15))) return false;
  const n = Math.max(1, Math.floor(samples));
  for (let row = 0; row <= n; row++) {
    for (let column = 0; column <= n; column++) {
      const x = lerp(site.x - site.halfWidth, site.x + site.halfWidth, column / n);
      const z = lerp(site.z - site.halfDepth, site.z + site.halfDepth, row / n);
      if (!isDryLand(x, z, 0.05)) return false;
    }
  }
  return true;
}

export function quarryReferenceHeight(x = QUARRY_SITE.x, z = QUARRY_SITE.z) {
  const dx = Math.abs(x - QUARRY_SITE.x);
  const dz = Math.abs(z - QUARRY_SITE.z);
  if (dx <= QUARRY_SITE.terraceWidth * 0.5 && dz <= QUARRY_SITE.terraceDepth * 0.5) {
    return QUARRY_SITE.referenceHeight;
  }
  return terrainHeight(x, z);
}

function gridGeometry({
  xAt,
  zAt,
  yAt,
  uAt = u => u,
  vAt = v => v,
  colorAt = () => [1, 1, 1],
  columns,
  rows,
  flipWinding = false,
  userData = {},
}) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      positions.push(finite(xAt(u, v)), finite(yAt(u, v)), finite(zAt(u, v)));
      uvs.push(finite(uAt(u, v)), finite(vAt(u, v)));
      colors.push(...colorAt(u, v).map(finite));
    }
  }
  const rowWidth = columns + 1;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * rowWidth + column;
      const b = a + 1;
      const c = a + rowWidth;
      const d = c + 1;
      if (flipWinding) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(positions.length).fill(0), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {...userData, columns, rows};
  return geometry;
}

function bankColor(u, v) {
  const gravel = new THREE.Color(0xb7ad98);
  const sand = new THREE.Color(0xe5d6b8);
  const dry = new THREE.Color(0xd9c7a2);
  const color = new THREE.Color();
  const shore = clamp(1 - u / 0.10, 0, 1);
  color.copy(sand).lerp(gravel, shore);
  color.lerp(dry, smoothstep(u) * 0.35);
  const variation = 0.035 * Math.sin(v * TAU * 2.7 + u * 5.1);
  return [clamp(color.r + variation, 0, 1), clamp(color.g + variation, 0, 1), clamp(color.b + variation, 0, 1)];
}

/**
 * Build a continuous, triangulated land surface from the exact shoreline
 * toward the backdrop edge.  Vertex colors keep the gravel/silt shoulder
 * distinct from the warmer dry interior.
 */
export function createBankGeometry(side = 'west') {
  validSide(side);
  const inland = side === 'west' ? BACKDROP_BOUNDS.minX : BACKDROP_BOUNDS.maxX;
  return gridGeometry({
    columns: BANK_CROSS_SAMPLES,
    rows: BANK_SAMPLES,
    xAt: (u, v) => {
      const z = lerp(BACKDROP_BOUNDS.minZ, BACKDROP_BOUNDS.maxZ, v);
      const shore = bankX(z, side);
      return lerp(shore, inland, u*u);
    },
    zAt: (u, v) => lerp(BACKDROP_BOUNDS.minZ, BACKDROP_BOUNDS.maxZ, v),
    yAt: (u, v) => {
      const z = lerp(BACKDROP_BOUNDS.minZ, BACKDROP_BOUNDS.maxZ, v);
      const shore = bankX(z, side);
      return terrainHeight(lerp(shore, inland, u*u), z);
    },
    uAt: u => u*u,
    vAt: (_, v) => v,
    colorAt: bankColor,
    flipWinding: side === 'west',
    userData: {kind: 'bank', side, waterLevel: WATER_LEVEL},
  });
}

function riverColor(u, v) {
  const light = new THREE.Color(0x4b9aa0);
  const dark = new THREE.Color(0x2f727d);
  const color = new THREE.Color().copy(light).lerp(dark, 0.25 + 0.18 * Math.sin(v * TAU * 2 + u * 3));
  color.offsetHSL(0, 0, 0.025 * Math.sin(u * Math.PI));
  return [color.r, color.g, color.b];
}

/** Build the water surface with both longitudinal edges pinned to bankX(). */
export function createRiverGeometry() {
  return gridGeometry({
    columns: RIVER_ACROSS_SAMPLES,
    rows: BANK_SAMPLES,
    xAt: (u, v) => {
      const z = lerp(BACKDROP_BOUNDS.minZ, BACKDROP_BOUNDS.maxZ, v);
      return lerp(bankX(z, 'west'), bankX(z, 'east'), u);
    },
    yAt: () => WATER_LEVEL,
    zAt: (u, v) => lerp(BACKDROP_BOUNDS.minZ, BACKDROP_BOUNDS.maxZ, v),
    uAt: u => u,
    vAt: (_, v) => v,
    colorAt: riverColor,
    userData: {kind: 'river', waterLevel: WATER_LEVEL},
  });
}

