import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS} from '../game.js';
import {evaluateLearningAnswer, getLearningModel, renderLearningLab} from '../learning-lab.js';

const byMission = id => LEVELS.find(level => level.missionId === id);

test('learning models cover every mission blueprint without losing pieces', () => {
  assert.equal(LEVELS.length, 12);
  for (const level of LEVELS) {
    const model = getLearningModel(level);
    assert.equal(model.missionId, level.missionId);
    assert.equal(model.total, level.blueprint.length, `${level.missionId} total`);
    assert.equal(model.layers.reduce((sum, layer) => sum + layer.count, 0), model.total, `${level.missionId} layer sum`);
    assert.ok(model.question.options.some(option => option.id === model.question.answer), `${level.missionId} has a valid answer`);
    assert.equal(new Set(model.question.options.map(option => option.id)).size, model.question.options.length, `${level.missionId} options are distinct`);
  }
});

test('Egypt layer counts and prediction answers come from each mission target', () => {
  const expected = {
    'egypt-1': [9, 4, 1],
    'egypt-2': [9, 4, 1],
    'egypt-3': [9, 4, 1],
    'egypt-4': [16, 9, 4, 1]
  };
  for (const [id, counts] of Object.entries(expected)) {
    const model = getLearningModel(byMission(id));
    assert.deepEqual(model.layers.map(layer => layer.count), counts);
    assert.equal(evaluateLearningAnswer(byMission(id), '0').correct, true);
    assert.equal(evaluateLearningAnswer(byMission(id), '1').correct, false);
  }
});

test('Maya model maps terraces and front/rear route symmetry to the right lesson', () => {
  const first = getLearningModel(byMission('maya-1'));
  assert.deepEqual(first.widths, [3, 2, 1]);
  assert.equal(first.question.answer, 'narrower');

  const mirrored = getLearningModel(byMission('maya-2'));
  assert.deepEqual(mirrored.stairs.routeTotals, {front: 3, rear: 3});
  assert.equal(mirrored.stairs.mirrored, true);
  assert.equal(mirrored.question.answer, 'each-level');

  const connected = getLearningModel(byMission('maya-3'));
  assert.equal(connected.stairs.routeTotals.front, 3);
  assert.equal(connected.stairs.routeTotals.rear, 0);
  assert.equal(connected.question.answer, 'connect');

  assert.equal(getLearningModel(byMission('maya-4')).question.answer, 'narrower');
});

test('Ur model derives core, facing, four-brick packs, and the model waterline', () => {
  const first = getLearningModel(byMission('ur-1'));
  assert.equal(first.materialCounts.core, 1);
  assert.equal(first.materialCounts.facing, 8);
  assert.equal(first.question.answer, 'facing');

  const packs = getLearningModel(byMission('ur-2'));
  assert.equal(packs.facingNeeded, 8);
  assert.equal(packs.packsNeeded, 2);
  assert.equal(packs.question.answer, 'group-four');

  const water = getLearningModel(byMission('ur-3'));
  assert.equal(water.site.waterline, 1);
  assert.equal(water.question.answer, 'high');
  assert.equal(evaluateLearningAnswer(byMission('ur-3'), 'low').correct, false);
  assert.equal(evaluateLearningAnswer(byMission('ur-3'), 'high').correct, true);

  const combined = getLearningModel(byMission('ur-4'));
  assert.equal(combined.facingNeeded, 24);
  assert.equal(combined.packsNeeded, 6);
  assert.ok(combined.site);
  assert.equal(combined.question.answer, 'high');
});

test('closed learning panel does not print model counts before the child opens it', () => {
  const html = renderLearningLab(byMission('egypt-1'), {stage: 'plan'});
  assert.match(html, /Explore the model/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /data-learning-count/);
  assert.doesNotMatch(html, /14 pieces|9 pieces|4 pieces/);
});

test('prediction feedback supports a retry and a correct explanation', () => {
  const level = byMission('maya-2');
  const wrong = evaluateLearningAnswer(level, 'top-only');
  assert.equal(wrong.correct, false);
  assert.match(wrong.message, /whole climb|route/i);
  assert.equal(wrong.answer, null);

  const right = evaluateLearningAnswer(level, 'each-level');
  assert.equal(right.correct, true);
  assert.match(right.message, /level by level/i);
  assert.equal(right.answer, 'each-level');
});
