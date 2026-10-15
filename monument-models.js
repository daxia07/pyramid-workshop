import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const fallbackMaterials = new Map();

function materialFor(palette, role, fallbackColor) {
  const supplied = palette?.[role];
  if (supplied?.isMaterial) return supplied;

  const color = supplied ?? fallbackColor;
  const hex = new THREE.Color(color).getHex();
  if (!fallbackMaterials.has(hex)) {
    fallbackMaterials.set(hex, new THREE.MeshStandardMaterial({color: hex, roughness: .9}));
  }
  return fallbackMaterials.get(hex);
}

function addBoxSet(parent, boxes, material, style, feature, role) {
  const pieces = boxes.map(({size, position}) => {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.translate(...position);
    return geometry;
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  if (!geometry) throw new Error(`Could not merge ${style} ${feature} geometry`);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.monumentMaterialRole = role;
  mesh.userData.monumentDetail = {style, feature};
  parent.add(mesh);
  return mesh;
}

const box = (width, height, depth, x, y, z) => ({
  size: [width, height, depth],
  position: [x, y, z],
});

function mayaTemple(group, palette) {
  const wall = materialFor(palette, 'wall', 0xe9dfc4);
  const roof = materialFor(palette, 'roof', 0xc6b894);
  const frame = materialFor(palette, 'frame', 0xf1e6c7);
  const interior = materialFor(palette, 'interior', 0x453c31);

  addBoxSet(group, [box(1.02, .1, 1.02, 0, .05, 0)], roof,
    'maya', 'foundation', 'roof');

  // A real chamber surrounds a narrow, open entrance. The two front wall
  // sections stop at the door edges; the back wall sits deep inside the room.
  addBoxSet(group, [
    box(.12, .5, .8, -.4, .35, 0),
    box(.12, .5, .8, .4, .35, 0),
    box(.68, .5, .12, 0, .35, -.4),
    box(.29, .5, .06, -.315, .35, .43),
    box(.29, .5, .06, .315, .35, .43),
  ], wall, 'maya', 'chamber-walls', 'wall');

  addBoxSet(group, [
    box(.055, .45, .075, -.17, .325, .48),
    box(.055, .45, .075, .17, .325, .48),
    box(.48, .075, .075, 0, .59, .48),
  ], frame, 'maya', 'doorway-frame', 'frame');

  addBoxSet(group, [box(.4, .4, .012, 0, .34, -.333)], interior,
    'maya', 'recessed-interior', 'interior');

  // Each successively smaller stone band sits above the chamber and makes a
  // clear stepped roof profile with a simple raised crown at its summit.
  addBoxSet(group, [
    box(1.08, .1, 1.08, 0, .65, 0),
    box(.96, .09, .96, 0, .745, 0),
    box(.84, .09, .84, 0, .835, 0),
    box(.72, .09, .72, 0, .925, 0),
    box(.6, .09, .6, 0, 1.015, 0),
  ], roof, 'maya', 'stepped-roof', 'roof');

  return 5;
}

function urTemple(group, palette) {
  const wall = materialFor(palette, 'wall', 0xb48b66);
  const coping = materialFor(palette, 'roof', 0xd3ad81);
  const frame = materialFor(palette, 'frame', 0xc89a6c);
  const buttress = materialFor(palette, 'buttress', 0xa77b58);
  const course = materialFor(palette, 'course', 0x805c45);
  const interior = materialFor(palette, 'interior', 0x50382d);

  addBoxSet(group, [
    box(1.08, .1, 1.08, 0, .05, 0),
    box(1.0, .05, 1.0, 0, .675, 0),
    box(.96, .1, .96, 0, .75, 0),
  ], coping, 'ur', 'plinth-and-flat-coping', 'roof');

  addBoxSet(group, [
    box(.12, .55, .8, -.4, .375, 0),
    box(.12, .55, .8, .4, .375, 0),
    box(.68, .55, .12, 0, .375, -.4),
    box(.29, .55, .06, -.315, .375, .43),
    box(.29, .55, .06, .315, .375, .43),
  ], wall, 'ur', 'mudbrick-chamber-walls', 'wall');

  addBoxSet(group, [
    box(.055, .52, .075, -.17, .36, .48),
    box(.055, .52, .075, .17, .36, .48),
    box(.48, .075, .075, 0, .655, .48),
  ], frame, 'ur', 'doorway-frame', 'frame');

  addBoxSet(group, [
    box(.4, .42, .012, 0, .37, -.333),
  ], interior, 'ur', 'recessed-interior', 'interior');

  // Front and rear corner piers project from the chamber wall. Flared feet
  // and caps give each support a readable outline in the small model.
  const piers = [];
  for (const x of [-.39, .39]) {
    for (const z of [-.445, .445]) {
      piers.push(
        box(.14, .55, .14, x, .375, z),
        box(.17, .06, .17, x, .14, z),
        box(.17, .06, .17, x, .63, z),
      );
    }
  }
  addBoxSet(group, piers, buttress, 'ur', 'corner-buttresses', 'buttress');

  const courses = [];
  for (const y of [.22, .36, .5]) {
    // Two exposed front runs stop short of the entrance and corner piers.
    for (const x of [-.245, .245]) courses.push(box(.14, .014, .014, x, y, .468));
    // Side wall courses continue between the projecting corner supports.
    for (const x of [-.465, .465]) courses.push(box(.014, .014, .57, x, y, 0));
  }
  // Short head joints stagger between horizontal courses to read as masonry.
  for (const y of [.29, .43]) {
    for (const x of [-.28, -.21, .21, .28]) courses.push(box(.012, .126, .014, x, y, .468));
    for (const z of [-.28, -.21, .21, .28]) courses.push(box(.014, .126, .012, .465, y, z));
  }
  addBoxSet(group, courses, course, 'ur', 'brick-courses', 'course');

  return 6;
}

/**
 * Build the complete visible model for a temple puzzle piece. Call this in
 * `addPart` instead of the generic temple-box branch. `style` is `maya` or
 * `ur`/`mesopotamia`; `materials` may provide shared Three.js materials or
 * colors for `wall`, `roof`, `frame`, `interior`, `buttress`, and `course`.
 * Each returned mesh owns its merged geometry and carries
 * `userData.monumentMaterialRole` plus `userData.monumentDetail` for the
 * world's material, preview, picking, and disposal passes.
 */
export function addTempleModel(group, style, materials = {}) {
  if (!group?.isGroup) return 0;
  if (style === 'maya') return mayaTemple(group, materials);
  if (style === 'ur' || style === 'mesopotamia') return urTemple(group, materials);
  return 0;
}
