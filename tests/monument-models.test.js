import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addTempleModel} from '../monument-models.js';

function build(style, materials = {}) {
  const group = new THREE.Group();
  const count = addTempleModel(group, style, materials);
  group.updateMatrixWorld(true);
  return {group, count, meshes: group.children};
}

function assertFiniteGeometry(group) {
  group.traverse(object => {
    if (!object.isMesh) return;
    assert.equal(object.isInstancedMesh, undefined, 'the software renderer receives ordinary meshes');
    const positions = object.geometry.attributes.position;
    assert.ok(positions, 'each merged model has vertex positions');
    for (const value of positions.array) assert.ok(Number.isFinite(value));
  });
}

function assertBounds(group, maxHeight) {
  const bounds = new THREE.Box3().setFromObject(group);
  const epsilon = 1e-6;
  assert.ok(bounds.min.x >= -.54 - epsilon && bounds.max.x <= .54 + epsilon,
    `x bounds ${bounds.min.x}..${bounds.max.x} fit the established temple envelope`);
  assert.ok(bounds.min.z >= -.54 - epsilon && bounds.max.z <= .54 + epsilon,
    `z bounds ${bounds.min.z}..${bounds.max.z} fit the established temple envelope`);
  assert.ok(bounds.min.y >= -epsilon && bounds.max.y <= maxHeight + epsilon,
    `y bounds ${bounds.min.y}..${bounds.max.y} fit the temple envelope`);
}

function assertOpenDoorway(group) {
  const raycaster = new THREE.Raycaster();
  const intoRoom = new THREE.Vector3(0, 0, -1);
  for (const y of [.16, .32, .5]) {
    raycaster.set(new THREE.Vector3(0, y, 1), intoRoom);
    const hits = raycaster.intersectObjects(group.children, false);
    assert.ok(hits.length, 'the chamber interior remains visible through the entrance');
    assert.ok(hits.every(hit => hit.point.z < .3),
      `the doorway throat is open at y=${y}; only the recessed room can be hit`);
  }
}

test('Maya temple has a stepped limestone roof and an open framed doorway', () => {
  const materials = {
    wall: new THREE.MeshStandardMaterial({color: 0xe9dfc4}),
    roof: new THREE.MeshStandardMaterial({color: 0xc6b894}),
    frame: new THREE.MeshStandardMaterial({color: 0xf1e6c7}),
    interior: new THREE.MeshStandardMaterial({color: 0x453c31}),
  };
  const {group, count, meshes} = build('maya', materials);

  assert.equal(count, 5);
  assert.deepEqual(meshes.map(mesh => mesh.userData.monumentDetail.feature), [
    'foundation', 'chamber-walls', 'doorway-frame', 'recessed-interior', 'stepped-roof',
  ]);
  assert.equal(meshes[0].material, materials.roof);
  assert.equal(meshes[1].material, materials.wall);
  assert.equal(meshes[2].material, materials.frame);
  assert.equal(meshes[4].material, materials.roof);
  assertFiniteGeometry(group);
  assertBounds(group, 1.15);
  assertOpenDoorway(group);
});

test('Ur temple has exposed brick courses, projecting buttresses and an open doorway', () => {
  const materials = {
    wall: new THREE.MeshStandardMaterial({color: 0xb48b66}),
    roof: new THREE.MeshStandardMaterial({color: 0xd3ad81}),
    frame: new THREE.MeshStandardMaterial({color: 0xc89a6c}),
    interior: new THREE.MeshStandardMaterial({color: 0x50382d}),
    buttress: new THREE.MeshStandardMaterial({color: 0xa77b58}),
    course: new THREE.MeshStandardMaterial({color: 0x805c45}),
  };
  const {group, count, meshes} = build('mesopotamia', materials);

  assert.equal(count, 6);
  assert.deepEqual(meshes.map(mesh => mesh.userData.monumentDetail.feature), [
    'plinth-and-flat-coping', 'mudbrick-chamber-walls', 'doorway-frame',
    'recessed-interior', 'corner-buttresses', 'brick-courses',
  ]);
  assert.equal(meshes[1].material, materials.wall);
  assert.equal(meshes[4].material, materials.buttress);
  assert.equal(meshes[5].material, materials.course);
  assertFiniteGeometry(group);
  assertBounds(group, 1.15);
  assertOpenDoorway(group);
});

test('Maya and Ur models keep distinct silhouettes and unknown styles stay empty', () => {
  const maya = build('maya');
  const ur = build('ur');
  const mayaBounds = new THREE.Box3().setFromObject(maya.group);
  const urBounds = new THREE.Box3().setFromObject(ur.group);

  assert.ok(mayaBounds.max.y > urBounds.max.y + .15,
    'the Maya stepped roof rises above Ur’s low flat coping');
  assert.ok(urBounds.max.z > .5, 'Ur buttresses project beyond the chamber wall');
  assert.ok(maya.meshes.some(mesh => mesh.userData.monumentDetail.feature === 'stepped-roof'));
  assert.ok(ur.meshes.some(mesh => mesh.userData.monumentDetail.feature === 'brick-courses'));
  assert.equal(addTempleModel(new THREE.Group(), 'egypt'), 0);
  assert.equal(addTempleModel(new THREE.Mesh(), 'maya'), 0);
});
