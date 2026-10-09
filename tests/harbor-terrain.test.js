import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKDROP_BOUNDS,
  PYRAMID_SITES,
  QUARRY_SITE,
  ROUTE,
  ROUTE_END,
  ROUTE_HULL_CLEARANCE,
  WATER_LEVEL,
  bankX,
  createBankGeometry,
  createRiverGeometry,
  isDryLand,
  isWithinBackdrop,
  pyramidSiteIsDry,
  quarryReferenceHeight,
  routeClearance,
  routeIsNavigable,
  routePoint,
  terrainHeight,
  voyagePose,
} from '../harbor-terrain.js';

const close = (actual, expected, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

function positions(geometry) {
  return geometry.getAttribute('position').array;
}

test('the analytic banks are continuous, separated and bend toward the far background', () => {
  close(bankX(0, 'west'), -3, 1e-8);
  close(bankX(0, 'east'), 22, 1e-8);

  let previousWest;
  let previousEast;
  let previousWidth;
  let changed = false;
  for (let z = -150; z <= 95; z += 1) {
    const west = bankX(z, 'west');
    const east = bankX(z, 'east');
    const width = east - west;
    assert.ok(west < east, `banks cross at z=${z}`);
    assert.ok(width > 10, `the river pinches too far at z=${z}`);
    if (previousWest !== undefined) {
      assert.ok(Math.abs(west - previousWest) < 0.2, 'west bank has no hard steps');
      assert.ok(Math.abs(east - previousEast) < 0.2, 'east bank has no hard steps');
      if (width !== previousWidth) changed = true;
    }
    previousWest = west;
    previousEast = east;
    previousWidth = width;
  }
  assert.equal(changed, true);
  assert.ok(bankX(-60, 'east') < bankX(0, 'east'), 'the east shore narrows into the distance');
  assert.ok(bankX(ROUTE_END.z, 'east') >= 13, 'the far end leaves hull room beside the east shore');
});

test('terrain meets the water datum at the shore and never creates an inland island', () => {
  for (const z of [-150, -80, -17, 0, 40, 95]) {
    const west = bankX(z, 'west');
    const east = bankX(z, 'east');
    close(terrainHeight(west, z), WATER_LEVEL, 2e-4);
    close(terrainHeight(east, z), WATER_LEVEL, 2e-4);
    assert.ok(terrainHeight((west + east) * 0.5, z) < WATER_LEVEL);
    assert.equal(isDryLand(west - 0.01, z), true);
    assert.equal(isDryLand(east + 0.01, z), true);
    assert.equal(isDryLand((west + east) * 0.5, z), false);
    assert.equal(isDryLand(west - 0.01, z, 0.02), false);
  }

  // This is the dock datum used by the existing near-bank quay.
  assert.ok(terrainHeight(-4.5, 0) >= 0.12);
  assert.ok(terrainHeight(-4.5, 0) <= 0.4);
  assert.equal(isDryLand(-4.5, 0, 0.2), true);
  assert.equal(isWithinBackdrop(-120, -150), true);
  assert.equal(isWithinBackdrop(120, 95), true);
  assert.equal(isWithinBackdrop(121, 95), false);
});

test('the quarry is dry, carved below its surrounding land, and has a stable reference height', () => {
  assert.equal(isDryLand(QUARRY_SITE.x, QUARRY_SITE.z), true);
  assert.ok(terrainHeight(QUARRY_SITE.x, QUARRY_SITE.z) > WATER_LEVEL);
  close(quarryReferenceHeight(), QUARRY_SITE.referenceHeight, 1e-8);
  close(quarryReferenceHeight(QUARRY_SITE.x, QUARRY_SITE.z), QUARRY_SITE.referenceHeight, 1e-8);
  assert.ok(terrainHeight(QUARRY_SITE.x - 7, QUARRY_SITE.z) > quarryReferenceHeight());
  assert.ok(terrainHeight(QUARRY_SITE.x + 7, QUARRY_SITE.z) > quarryReferenceHeight());


});

function assertSurfaceAttributes(geometry) {
  for (const name of ['position', 'normal', 'uv', 'color']) {
    assert.ok(geometry.getAttribute(name), `missing ${name} attribute`);
  }
  assert.equal(
    geometry.getAttribute('position').count,
    geometry.getAttribute('normal').count,
  );
  assert.equal(
    geometry.getAttribute('position').count,
    geometry.getAttribute('color').count,
  );
  assert.ok(geometry.index.count > 0);
  for (const value of positions(geometry)) assert.ok(Number.isFinite(value));
}

test('bank meshes use shoreline vertices, vertex colors and continuous inland terrain', () => {
  for (const side of ['west', 'east']) {
    const geometry = createBankGeometry(side);
    assertSurfaceAttributes(geometry);
    assert.equal(geometry.userData.kind, 'bank');
    assert.equal(geometry.userData.side, side);
    const columns = geometry.userData.columns;
    const rows = geometry.userData.rows;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const colors = geometry.getAttribute('color').array;
    const colorTriples = new Set();
    for (let row = 0; row <= rows; row++) {
      const first = row * (columns + 1);
      const last = first + columns;
      const z = position.getZ(first);
      close(position.getX(first), bankX(z, side), 2e-4);
      for (let column = 0; column <= columns; column++) {
        const index = row * (columns + 1) + column;
        const x = position.getX(index);
        if (side === 'west') assert.ok(x <= bankX(z, side) + 2e-4);
        else assert.ok(x >= bankX(z, side) - 2e-4);
      }
      assert.ok(Number.isFinite(position.getY(last)));
    }
    for (let index = 0; index < normal.count; index += Math.max(1, Math.floor(normal.count / 12))) {
      assert.ok(normal.getY(index) > 0, 'bank normals face upward');
    }
    for (let i = 0; i < colors.length; i += 3) colorTriples.add(colors.slice(i, i + 3).join(','));
    assert.ok(colorTriples.size > 4, 'shore and inland terrain use distinct vertex colors');
  }
});

test('river mesh spans the exact space between both moving shores', () => {
  const geometry = createRiverGeometry();
  assertSurfaceAttributes(geometry);
  assert.equal(geometry.userData.kind, 'river');
  const columns = geometry.userData.columns;
  const rows = geometry.userData.rows;
  const position = geometry.getAttribute('position');
  for (let row = 0; row <= rows; row++) {
    const first = row * (columns + 1);
    const last = first + columns;
    const z = position.getZ(first);
    close(position.getX(first), bankX(z, 'west'), 2e-4);
    close(position.getX(last), bankX(z, 'east'), 2e-4);
    close(position.getY(first), WATER_LEVEL, 2e-4);
    close(position.getY(last), WATER_LEVEL, 2e-4);
    for (let column = 0; column <= columns; column++) {
      const index = row * (columns + 1) + column;
      assert.ok(position.getX(index) >= bankX(z, 'west') - 2e-4);
      assert.ok(position.getX(index) <= bankX(z, 'east') + 2e-4);
      close(position.getY(index), WATER_LEVEL, 2e-4);
    }
  }
});

test('pyramid sites stay wholly on the far east bank with positive foundations', () => {
  assert.ok(PYRAMID_SITES.length >= 3);
  for (const site of PYRAMID_SITES) {
    assert.ok(site.x >= 24 && site.x <= 50);
    assert.ok(site.z >= -60 && site.z <= -30);
    assert.ok(site.baseHeight > 0);
    assert.equal(site.baseY, site.baseHeight);
    assert.equal(pyramidSiteIsDry(site, 4), true);
    for (const [x, z] of site.corners) {
      assert.equal(isDryLand(x, z, 0.15), true);
      assert.ok(x > bankX(z, 'east'));
    }
  }
});

test('the whole voyage route keeps a three-unit hull clearance over riverbed', () => {
  close(routePoint(0).x, ROUTE.start.x, 1e-8);
  close(routePoint(0).z, ROUTE.start.z, 1e-8);
  close(routePoint(1).x, ROUTE.end.x, 1e-8);
  close(routePoint(1).z, ROUTE.end.z, 1e-8);
  for (let sample = 0; sample <= 200; sample++) {
    const point = routePoint(sample / 200);
    assert.equal(routeIsNavigable(point, ROUTE_HULL_CLEARANCE), true);
    assert.ok(routeClearance(point) >= ROUTE_HULL_CLEARANCE - 1e-8);
    assert.equal(isDryLand(point.x, point.z), false);
    assert.ok(terrainHeight(point.x, point.z) <= WATER_LEVEL + 1e-8);
  }
});

test('a voyage travels into the distance and disappears without returning across the river',()=>{
  let previousZ=0;
  for(let i=0;i<=200;i++){
    const pose=voyagePose(i/200);
    assert.ok(pose.z<=previousZ,'cargo always advances downriver');
    assert.ok(routeIsNavigable(pose),'boat stays in the navigable channel');
    assert.ok(Math.abs(pose.heading)<.12,'bow points downriver, not at the opposite shore');
    previousZ=pose.z;
  }
  assert.ok(voyagePose(.85).z < -100);
  assert.equal(voyagePose(.95).visible,false);
  assert.equal(voyagePose(1).visible,false);
  assert.ok(voyagePose(1).z<-120);
});
