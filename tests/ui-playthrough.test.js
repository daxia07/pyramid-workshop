import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {build} from 'esbuild';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEVELS, key, sku, target} from '../game.js';
import {cargoCoach} from '../cargo-coach.js';
import {missionWage} from '../workshop-profile.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeKey = 'pyramid-workshop-chapters-v3';
const historyFixture = JSON.parse(await readFile(new URL('../public/history.json', import.meta.url), 'utf8'));

async function compileApp() {
  const result = await build({
    entryPoints: [path.join(root, 'main.js')],
    bundle: true,
    write: false,
    format: 'iife',
    loader: {'.css': 'empty'},
    logLevel: 'silent',
    plugins: [{
      name: 'stub-visual-renderers',
      setup(builder) {
        // These stubs keep the UI playthrough deterministic; they do not validate WebGL or visual layout.
        builder.onLoad({filter: /\/(world|harbor-world|harbor-reference)\.js$/}, args => ({
          contents: args.path.endsWith('/world.js')
            ? 'export const createWorld=()=>new Proxy({}, {get:()=>()=>{}});'
            : args.path.endsWith('/harbor-world.js')
              ? 'export const createHarborWorld=()=>new Proxy({}, {get:()=>()=>{}});'
              : "export const createOrderReference=()=>({element:document.createElement('div'),sync(){},highlight(){}});",
          loader: 'js'
        }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

function createHarness(bundle, store = new Map()) {
  const {window} = parseHTML('<!doctype html><html><body><div id="app"></div></body></html>');
  const {document} = window;
  window.HTMLElement.prototype.scrollIntoView = function() {};
  window.HTMLElement.prototype.focus = function() { document.activeElement = this; };
  window.innerWidth = 1280;
  window.innerHeight = 900;
  const context = vm.createContext({
    window,
    document,
    console,
    structuredClone,
    setTimeout: () => 1,
    clearTimeout() {},
    requestAnimationFrame() {},
    ResizeObserver: class { observe() {} },
    localStorage: {
      getItem: keyName => store.get(keyName) || null,
      setItem: (keyName, value) => store.set(keyName, value)
    },
    fetch: () => Promise.resolve({json: () => Promise.resolve(historyFixture)})
  });
  vm.runInContext(bundle, context, {timeout: 15000});
  const click = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, `control exists: ${selector}`);
    assert.ok(!element.disabled, `control enabled: ${selector}`);
    element.click();
    return element;
  };
  const readState = () => JSON.parse(store.get(storeKey)).data;
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return {window, document, store, click, state: readState, settle};
}

test('actual controls complete and preserve all twelve mission journeys', async () => {
  const bundle = await compileApp();
  const store = new Map();
  let ui = createHarness(bundle, store);
  let expectedCoins = 0;

  const click = selector => ui.click(selector);
  const state = () => ui.state();
  const activeLevel = () => LEVELS[state().level];
  const noticeText = () => ui.document.querySelector('body > .feedback')?.textContent || '';

  function checkLearningLab(missionId) {
    assert.equal(activeLevel().missionId, missionId);
    const before = JSON.stringify(state());
    const host = ui.document.querySelector('#learning-lab-host');
    assert.ok(host, `${missionId} learning lab host exists`);
    if (host.querySelector('[data-learning-action="toggle"]')?.getAttribute('aria-expanded') !== 'true') {
      click('#learning-lab-host [data-learning-action="toggle"]');
    }
    const answer = host.querySelector('[data-learning-action="answer"]');
    assert.ok(answer, `${missionId} exposes one optional prediction`);
    click('#learning-lab-host [data-learning-action="answer"]');
    assert.ok(host.querySelector('.learning-feedback')?.textContent.trim(), `${missionId} returns answer feedback`);
    const reveal = host.querySelector('[data-learning-action="reveal"]');
    if (reveal) click('#learning-lab-host [data-learning-action="reveal"]');
    assert.ok(host.querySelector('.learning-revealed'), `${missionId} can reveal model data voluntarily`);
    assert.equal(JSON.stringify(state()), before, `${missionId} learning interaction leaves gameplay save unchanged`);
  }

  function assertReloadPreservesRewards(missionId) {
    const before = state();
    assert.equal(before.profile.coins, expectedCoins, `${missionId} earned the expected wage`);
    assert.ok(before.profile.awarded.includes(missionId), `${missionId} wage is recorded once`);
    ui = createHarness(bundle, store);
    assert.equal(state().profile.coins, expectedCoins, `${missionId} reload does not add another wage`);
    assert.ok(state().profile.awarded.includes(missionId));
    assert.ok(state().completed.includes(missionId));
    assert.equal(state().stage, 'complete');
  }

  async function passMission(missionId) {
    assert.equal(activeLevel().missionId, missionId);
    click('#check');
    assert.equal(state().stage, 'complete', `${missionId} inspection passes: ${noticeText()}`);
    assert.ok(state().completed.includes(missionId));
    expectedCoins += missionWage(missionId);
    if (missionId === 'ur-4') {
      await ui.settle();
      click('#open-reward');
      assert.match(ui.document.querySelector('.modal-shade h2').textContent, /Great Ziggurat of Ur/,
        'the final reward opens the real story from the history fixture');
      assert.ok(ui.document.querySelector('.history-story')?.textContent.length > 100);
      assert.match(ui.document.querySelector('#card-next').textContent, /Back to my discoveries/);
      click('#card-next');
      assert.ok(ui.document.querySelector('[data-card="mesopotamia"]'),
        'the final reward returns to the discoveries collection');
      click('#close-modal');
    } else {
      click('#close-modal');
    }
    assertReloadPreservesRewards(missionId);
  }

  function fillEgyptCounts() {
    const level = activeLevel();
    for (const type of level.types) {
      const input = ui.document.querySelector(`[data-shopping="${type}"]`);
      assert.ok(input, `Egypt count field exists for ${type}`);
      input.value = String(level.requiredNewQuantities[type] || 0);
      input.oninput();
    }
  }

  function confirmEgyptOrder() {
    assert.equal(ui.document.querySelector('#reference-counts'), null, 'order quantities start as child-entered counts');
    click('#confirm-order');
    assert.match(ui.document.querySelector('#order-feedback').textContent, /whole number|count checked/i);
    fillEgyptCounts();
    click('#confirm-order');
  }

  function shipEgyptMission(reloadFirstArrival = false) {
    let steps = 0;
    while (!state().harbor.finished) {
      assert.ok(steps++ < 100, `${activeLevel().missionId} cargo journey is finite`);
      const current = state();
      const hint = cargoCoach(current, activeLevel());
      if (hint.status === 'place') {
        click('#guided-cargo');
        const placement = hint.suggestion;
        const selected = state().harbor.cargo.find(item => item.id === state().harbor.selected);
        assert.ok(selected, 'guided control selects its suggested sled');
        const before = state().harbor.cargo.filter(item => item.status === 'boat').length;
        const startRotation = state().harbor.rotation;
        if (startRotation !== placement.rotation
          && !ui.document.querySelector(`[data-deck="${placement.column},${placement.row}"]`).disabled) {
          click(`[data-deck="${placement.column},${placement.row}"]`);
          assert.equal(state().harbor.cargo.filter(item => item.status === 'boat').length, before,
            'an unrotated guided sled is not placed');
        }
        let turns = 0;
        while (state().harbor.rotation !== placement.rotation) {
          assert.ok(turns++ < 4);
          click('#rotate-cargo');
        }
        const placed = state().harbor.cargo.filter(item => item.status === 'boat').length;
        click(`[data-deck="${placement.column},${placement.row}"]`);
        assert.equal(state().harbor.cargo.filter(item => item.status === 'boat').length, placed + 1);
      } else if (hint.status === 'sail') {
        click('#sail-cargo');
        assert.ok(state().harbor.inTransit);
        assert.equal(ui.document.querySelector('#harbor-next'), null, 'shipping does not advance before arrival');
        click('#finish-voyage');
        if (reloadFirstArrival && state().trips === 1) ui = createHarness(bundle, store);
      } else {
        assert.fail(`${activeLevel().missionId} cargo coach stopped: ${JSON.stringify(hint)}`);
      }
    }
  }

  function buildEgyptPyramid() {
    for (const wanted of target(activeLevel())) {
      if (state().blocks.some(piece => key(piece.x, piece.y, piece.z) === key(wanted.x, wanted.y, wanted.z))) continue;
      click(`[data-layer="${wanted.y}"]`);
      click(`[data-part="${wanted.type}"]`);
      click(`[data-cell="${wanted.x},${wanted.z},0"]`);
    }
    assert.match(ui.document.querySelector('#build-hint-text').textContent, /Check my pyramid/);
    click('#build-hint-button');
    assert.equal(state().stage, 'complete');
    assert.ok(ui.document.querySelector('#build-tools #next'));
  }

  // Egypt: count, buy, cargo, build, and the expansion are driven through visible controls.
  checkLearningLab('egypt-1');
  click('#confirm-order');
  assert.match(ui.document.querySelector('#order-feedback').textContent, /whole number/);
  click('[data-count-kind="corner"]');
  click('[data-count-cell="-1,0,-1"]');
  assert.equal(state().counting.marks.length, 1);
  assert.equal(state().estimates.corner, '');
  fillEgyptCounts();
  click('#confirm-order');
  assert.equal(state().stage, 'purchase');
  assert.ok(ui.document.querySelector('[data-journey="1"]').disabled, 'later Egypt mission stays locked until the order is sealed');
  click('#buy-order');
  assert.equal(state().stage, 'complete');
  expectedCoins += missionWage('egypt-1');
  assertReloadPreservesRewards('egypt-1');
  click('#order-next');
  assert.equal(state().level, 1);

  checkLearningLab('egypt-2');
  shipEgyptMission(true);
  assert.equal(state().money, 3);
  assert.equal(state().level, 1);
  expectedCoins += missionWage('egypt-2');
  assertReloadPreservesRewards('egypt-2');
  click('#harbor-next');
  assert.equal(state().level, 2);
  assert.equal(state().stage, 'build');

  checkLearningLab('egypt-3');
  const initialStock = state().inventory.brick;
  click('[data-cell="-1,-1,0"]');
  assert.equal(state().blocks.length, 0, 'wrong shape is not consumed');
  assert.equal(state().inventory.brick, initialStock);
  buildEgyptPyramid();
  expectedCoins += missionWage('egypt-3');
  assertReloadPreservesRewards('egypt-3');
  click('#next');
  assert.equal(state().level, 3);

  checkLearningLab('egypt-4');
  fillEgyptCounts();
  click('#confirm-order');
  assert.equal(state().stage, 'purchase');
  click('#buy-order');
  assert.equal(state().stage, 'harbor');
  shipEgyptMission();
  click('#harbor-next');
  assert.equal(state().stage, 'build');
  assert.equal(state().blocks.length, 14, 'the original upper layers remain in place during expansion');
  buildEgyptPyramid();
  assert.equal(state().blocks.length, 30);
  expectedCoins += missionWage('egypt-4');
  assertReloadPreservesRewards('egypt-4');

  // Use the visible chapter selector and mission timeline to enter Maya, then check a completed chapter stays available.
  click('#next');
  assert.equal(state().level, 4);
  assert.equal(ui.document.querySelectorAll('#journey-timeline [data-journey]').length, 4);
  click('[data-scene="egypt"]');
  assert.equal(state().level, 3, 'chapter navigation reopens the completed Egypt expansion');
  const coinsBeforeNavigation = state().profile.coins;
  click('[data-scene="maya"]');
  assert.equal(state().level, 4, 'chapter navigation opens Maya at its first available mission');
  assert.equal(state().profile.coins, coinsBeforeNavigation);

  function fillPlan(level) {
    for (const type of level.types) {
      const input = ui.document.querySelector(`[data-estimate="${type}"]`);
      assert.ok(input, `${level.missionId} estimate exists for ${type}`);
      input.value = String(level.requiredNewQuantities[type] || 0);
      input.oninput();
    }
  }

  function makePlan(level) {
    if (level.missionId === 'maya-1') {
      click('[data-design="3"]');
      fillPlan(level);
      click('#to-shop');
      assert.equal(state().stage, 'plan', 'oversized terrace is rejected before shopping');
      assert.match(noticeText(), /footprint|terrace/i);
      click('[data-design="2"]');
    } else if (level.missionId === 'maya-4') {
      click('[data-design="large"]');
      fillPlan(level);
      click('#to-shop');
      assert.equal(state().stage, 'plan', 'wide plan that blocks access is rejected');
      click('[data-design="small"]');
    } else if (level.site) {
      click('[data-site="low"]');
      click('#test-water');
      assert.equal(state().waterPreview, true);
      assert.match(noticeText(), /reaches the low/i);
      fillPlan(level);
      click('#to-shop');
      assert.equal(state().stage, 'plan', 'low site does not satisfy the model waterline');
      assert.match(noticeText(), /higher site/i);
      click('[data-site="high"]');
      click('#test-water');
      assert.equal(state().waterPreview, false);
      assert.match(noticeText(), /stays above/i);
    } else {
      fillPlan(level);
    }
    if (!ui.document.querySelector('[data-estimate]')) fillPlan(level);
    click('#to-shop');
    assert.equal(state().stage, 'shop', `${level.missionId} accepted plan: ${noticeText()}`);
  }

  function buyAndBuild(level) {
    const packSizes = Object.fromEntries((level.packs || []).map(pack => [pack.sku, pack.quantity]));
    for (const type of level.types) {
      const input = ui.document.querySelector(`[data-order="${type}"]`);
      assert.ok(input, `${level.missionId} order exists for ${type}`);
      const needed = level.requiredNewQuantities[type] || 0;
      input.value = String(Math.ceil(needed / (packSizes[type] || 1)));
      input.oninput?.();
    }
    const purchased = level.types.reduce((sum, type) => sum + (level.requiredNewQuantities[type] || 0), 0);
    if (purchased) click('#buy');
    else assert.equal(level.missionId, 'maya-3', 'only the repair mission has a zero-piece order');
    click('#to-build');
    assert.equal(state().stage, 'build');
  }

  function chooseBuildLayer(level, layer) {
    if (level.missionId === 'maya-3') {
      click(`#map-layer-${layer}`);
      assert.equal(state().layer, layer, 'top-view layer button changes the active building layer');
    } else {
      click(`[data-layer="${layer}"]`);
    }
  }

  function chooseBuildTool(level, tool) {
    if (level.missionId === 'maya-3') {
      click(`#map-${tool}`);
      assert.equal(ui.document.querySelector(`#map-${tool}`).getAttribute('aria-pressed'), 'true',
        `top-view ${tool} button selects its tool`);
    } else {
      click(`#${tool}-tool`);
    }
  }

  function removeWrongPieces(level) {
    const wanted = target(level);
    const wrong = state().blocks.filter(block => {
      const planPiece = wanted.find(item => key(item.x, item.y, item.z) === key(block.x, block.y, block.z));
      return !planPiece || sku(planPiece) !== sku(block);
    }).sort((a, b) => b.y - a.y);
    if (!wrong.length) return;
    chooseBuildTool(level, 'remove');
    for (const block of wrong) {
      if (state().layer !== block.y) chooseBuildLayer(level, block.y);
      if (block.type === 'stairs') click(`[data-stair="${block.x},${block.y},${block.z}"]`);
      else click(`[data-cell="${block.x},${block.z},0"]`);
    }
    chooseBuildTool(level, 'place');
  }

  function placeMissingPieces(level) {
    const mapBuild = level.missionId === 'maya-3';
    for (const wanted of target(level)) {
      const present = state().blocks.some(block => key(block.x, block.y, block.z) === key(wanted.x, wanted.y, wanted.z)
        && sku(block) === sku(wanted));
      if (present) continue;
      if (state().layer !== wanted.y) chooseBuildLayer(level, wanted.y);
      const part = sku(wanted);
      if (mapBuild) {
        click(`#map-part-${part}`);
        assert.equal(ui.document.querySelector(`#map-part-${part}`).getAttribute('aria-pressed'), 'true',
          `top-view material button selects ${part}`);
      } else if (state().part !== part || state().tool !== 'place') {
        click(`#material-tray [data-part="${part}"]`);
      }
      if (mapBuild) chooseBuildTool(level, 'place');
      if (mapBuild && wanted.type === 'stairs') {
        const beforeInventory = state().inventory.stairs;
        const beforeBlocks = state().blocks.length;
        click(`[data-stair="${wanted.x},${wanted.y},${wanted.z}"]`);
        assert.equal(state().inventory.stairs, beforeInventory - 1, 'placing the repaired stair spends one inventory piece');
        assert.equal(state().blocks.length, beforeBlocks + 1);
        click('#map-undo');
        assert.equal(state().inventory.stairs, beforeInventory, 'top-view undo restores the stair to inventory');
        assert.equal(state().blocks.length, beforeBlocks, 'top-view undo removes the trial placement');
        chooseBuildTool(level, 'place');
      }
      if (wanted.type === 'stairs') click(`[data-stair="${wanted.x},${wanted.y},${wanted.z}"]`);
      else click(`[data-cell="${wanted.x},${wanted.z},0"]`);
      const placed = state().blocks.find(block => key(block.x, block.y, block.z) === key(wanted.x, wanted.y, wanted.z));
      assert.ok(placed && sku(placed) === sku(wanted), `${level.missionId} placed ${part} at ${key(wanted.x, wanted.y, wanted.z)}`);
    }
  }

  async function completeModelMission(level) {
    checkLearningLab(level.missionId);
    assert.equal(state().stage, 'plan');
    makePlan(level);
    buyAndBuild(level);
    if (level.missionId === 'maya-3') {
      const misplaced = state().blocks.find(block => block.type === 'stairs' && block.routeId === 'rear');
      assert.ok(misplaced, 'repair mission starts with a rear stair on the wrong route');
      const inventoryBefore = state().inventory.stairs;
      removeWrongPieces(level);
      assert.equal(state().inventory.stairs, inventoryBefore + 1, 'lifting the stray stair returns it to the store');
      assert.equal(state().freeInventory.stairs, 1, 'the salvaged stair remains free to reuse');
    } else {
      removeWrongPieces(level);
    }
    placeMissingPieces(level);
    assert.deepEqual(state().blocks.map(block => key(block.x, block.y, block.z)).sort(),
      target(level).map(block => key(block.x, block.y, block.z)).sort(), `${level.missionId} matches its full footprint`);
    assert.equal(state().inventory.stairs || 0, 0, `${level.missionId} uses every purchased stair`);
    await passMission(level.missionId);
  }

  for (let index = 4; index < LEVELS.length; index++) {
    const level = LEVELS[index];
    assert.equal(state().level, index, `${level.missionId} is reached by its completion control`);
    await completeModelMission(level);
    if (index === 4) {
      click('#journey-timeline [data-journey="5"]');
      assert.equal(state().level, 5, 'timeline advances to the newly unlocked Maya stair mission');
    } else if (index < LEVELS.length - 1) {
      click('#next');
      assert.equal(state().level, index + 1, `${level.missionId} next control opens the next mission`);
    }
  }

  assert.deepEqual(state().completed, LEVELS.map(level => level.missionId));
  assert.equal(expectedCoins, 330);
  assert.equal(state().profile.coins, 330, 'all twelve mission wages are earned once');
  assert.equal(new Set(state().profile.awarded).size, 12);
  assert.deepEqual(state().profile.awarded, LEVELS.map(level => level.missionId));
  assert.equal(ui.document.querySelectorAll('#journey-timeline [data-journey]').length, 4);
  click('#next');
  assert.ok(ui.document.querySelector('.modal-shade'), 'final completion control opens the discoveries view');
  for (const scene of ['egypt', 'maya', 'mesopotamia']) {
    const card = ui.document.querySelector(`[data-card="${scene}"]`);
    assert.ok(card && !card.disabled, `${scene} discovery is unlocked after its four missions`);
    assert.match(card.textContent, /4\/4 missions/);
  }
  await ui.settle();
  click('[data-card="mesopotamia"]');
  assert.match(ui.document.querySelector('.modal-shade h2').textContent, /Great Ziggurat of Ur/);
  assert.ok(ui.document.querySelector('[data-read-aloud="#history-reading"]'), 'story card exposes read-aloud control');
  click('#card-next');
  assert.ok(ui.document.querySelector('[data-card="mesopotamia"]'), 'non-reward story card returns to discoveries');
  click('#close-modal');

  // Reopen the saved journey after all scenes and confirm startup awards no repeat wages.
  ui = createHarness(bundle, store);
  assert.equal(state().level, 11);
  assert.equal(state().profile.coins, 330);
  assert.deepEqual(state().completed, LEVELS.map(level => level.missionId));
  assert.equal(ui.document.querySelectorAll('#journey-timeline [data-journey]').length, 4);
});
