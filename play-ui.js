import {canEnterLevel} from './journey-progress.js';
import { STONE_DETAILS, stoneArt } from './stone-art.js';
import { isQuarry } from './harbor-game.js';
import { buildHint } from './build-hints.js';

let lastStage, lastLevel, panelOpen = true;
let shellNotice;
let layoutObserver;

function reportLayout() {
  const scene = document.getElementById('scene');
  if (!scene) return;
  const panel = document.getElementById('panel');
  const dock = document.getElementById('builder-dock');
  if(document.getElementById('app').dataset.mode==='studio'){const studio=document.getElementById('studio-controls');const mobile=window.innerWidth<=800&&window.innerHeight>520;scene.dispatchEvent(new CustomEvent('workshop:layout',{detail:{right:mobile?0:studio.getBoundingClientRect().width+38,bottom:mobile?studio.getBoundingClientRect().height+20:0}}));return;}
  const sideDock = window.innerHeight <= 520 && window.innerWidth >= 600;
  const bottom = dock.hidden || sideDock ? 0 : dock.getBoundingClientRect().height + 22;
  const right = Math.max(panelOpen && window.innerWidth > 800 ? panel.getBoundingClientRect().width + 35 : 0,
    !dock.hidden && sideDock ? dock.getBoundingClientRect().width + 24 : 0);
  document.getElementById('app').style.setProperty('--dock-height', `${bottom}px`);
  scene.dispatchEvent(new CustomEvent('workshop:layout', {detail:{right, bottom}}));
}

export function playShell() {
  return `<header class="game-header">
    <div class="brand"><div class="brand-icon" aria-hidden="true">${stoneArt('cap')}</div><div><h1>Pyramid Workshop</h1><span class="eyebrow">An architect’s expedition</span></div></div>
    <div class="header-actions"><span id="earned-purse" aria-label="Earned coins"></span><button id="free-design">Free Design</button><button id="toggle-panel" aria-controls="panel" aria-expanded="true">Field journal</button><button id="collection" class="outline">Discoveries <span id="card-count">0/3</span></button><button id="fullscreen" class="outline" aria-label="Enter fullscreen">Full screen</button></div>
  </header>
  <nav id="journey-timeline" aria-label="Egypt expedition timeline" hidden></nav>
  <main class="layout">
    <section class="workbench" aria-label="Interactive 3D construction site"><div class="canvas-wrap">
      <div id="scene" style="height:100%"></div>
      <div class="scene-top"><span class="pill" id="scene-tag"></span><h2 id="scene-title"></h2><p id="scene-kind"></p><div class="mission-objective" id="mission-objective"></div></div>
      <div class="site-actions"><button id="site-explore" class="outline">Explore the worksite</button><button id="timeline" class="outline">Later Giza · Sphinx</button></div>
      <div id="timeline-note" class="timeline-note" hidden>Later Giza: Khafre-era landmark, after Khufu</div>
      <div class="camera" aria-label="Camera controls"><button id="rotate" aria-label="Rotate view">↻</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="home-view" aria-label="Reset camera">⌂</button></div>
      <div class="view-help">Drag to orbit · tap to build · pinch to zoom</div><div class="scene-label">Illustrative worksite</div>
      <div id="layer-control" aria-label="Building layer"></div>
    </div></section>
    <section id="harbor-scene" aria-label="Quarry and river shipping puzzle" hidden></section>
    <aside id="studio-controls" aria-label="Free design controls" hidden></aside>
    <aside id="panel" aria-label="Expedition field journal"></aside>
    <section id="builder-dock" aria-label="Building materials and tools" hidden>
      <div class="dock-heading"><span class="eyebrow">THE STONE YARD</span><p id="selected-piece"></p><button id="open-tools" aria-controls="panel" aria-expanded="false">Blueprint & tools</button></div>
      <div id="build-hint" hidden><p id="build-hint-text" role="status" aria-live="polite" aria-atomic="true"></p><span id="build-hint-action"></span></div>
      <div id="material-tray"></div><div id="build-tools"></div>
    </section>
  </main>`;
}

function showPanel(open, focus = false) {
  panelOpen = open;
  const panel = document.getElementById('panel');
  panel.hidden = !open;
  document.getElementById('app').classList.toggle('journal-open', open);
  for (const id of ['toggle-panel', 'open-tools']) document.getElementById(id)?.setAttribute('aria-expanded', String(open));
  if (focus) (open ? panel.querySelector('#close-panel') : document.getElementById('toggle-panel'))?.focus();
  requestAnimationFrame(reportLayout);
}

export function bindPlayShell(notice) {
  shellNotice = notice;
  document.getElementById('toggle-panel').onclick = () => showPanel(!panelOpen, true);
  document.getElementById('open-tools').onclick = () => showPanel(!panelOpen, true);
  const full = document.getElementById('fullscreen');
  if (!document.fullscreenEnabled) full.hidden = true;
  full.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { shellNotice('Fullscreen is unavailable here. The worksite still fills this window.'); }
  };
  document.addEventListener('fullscreenchange', () => {
    full.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    full.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panelOpen && !document.querySelector('.modal-shade')) showPanel(false, true);
  });
  layoutObserver = new ResizeObserver(reportLayout);
  layoutObserver.observe(document.getElementById('builder-dock'));
  layoutObserver.observe(document.getElementById('panel'));
  layoutObserver.observe(document.getElementById('studio-controls'));
  window.addEventListener('resize', reportLayout);
}

export function capturePlayFocus() {
  const active = document.activeElement;
  if (!active || !document.getElementById('app').contains(active)) return null;
  if (active.id) return {id:active.id};
  for (const name of ['part','layer','cell','stair','scene','mission','design','site','studioTab','studioStyle','studioLayer','studioPart','decoration','garden','cargoBuy','cargo','deck']) {
    if (active.dataset[name] !== undefined) return {name, value:active.dataset[name]};
  }
  return null;
}

export function restorePlayFocus(focus) {
  if (!focus) return;
  const element = focus.id ? document.getElementById(focus.id)
    : [...document.querySelectorAll(`[data-${focus.name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}]`)].find(e => e.dataset[focus.name] === focus.value);
  if (element && !element.closest('[hidden]')) element.focus({preventScroll:true});
}

export function updatePlayUI(state, level, guide) {
  const app = document.getElementById('app'), panel = document.getElementById('panel');
  const harbor = isQuarry(level,state);
  const journey=document.getElementById('journey-timeline');journey.hidden=level.id!=='egypt'||state.studioMode;
  if(!journey.hidden)journey.innerHTML=['Plan & buy','Pack & ship','Build 3 layers','Expand to 4'].map((name,i)=>{const done=state.completed.includes(`egypt-${i+1}`),active=state.level===i,open=canEnterLevel(state,i),criteria=['Buy all 14 stones','Deliver all 14 stones','Inspect the pyramid','Inspect all 4 layers'];return `<button data-journey="${i}" class="${active?'current':''} ${done?'done':''}" ${open?'':'disabled'} ${active?'aria-current="step"':''} aria-label="Level ${i+1}: ${name}. ${done?'Passed':criteria[i]}"><b>${done?'✓':i+1}</b><span>${name}<small>${done?'Passed':criteria[i]}</small></span></button>`;}).join('');
  const building = !harbor && !state.studioMode && ['build','complete'].includes(state.stage);
  const stageChanged = lastStage !== state.stage || lastLevel !== state.level;
  if (stageChanged) panelOpen = !building && !harbor && !state.studioMode;
  if(state.studioMode)panelOpen=false;
  lastStage = state.stage; lastLevel = state.level;
  app.dataset.stage = state.stage; app.dataset.civilization = level.id;
  document.getElementById('toggle-panel').textContent = harbor ? 'Expedition' : building ? 'Field journal' : state.stage === 'shop' ? 'Open market' : 'Open plan';
  const heading = document.createElement('div');
  heading.className = 'journal-heading';
  heading.innerHTML = `<span class="eyebrow">${state.stage === 'shop' ? 'THE RIVERSIDE MARKET' : 'YOUR EXPEDITION JOURNAL'}</span><button id="close-panel" aria-label="Close journal">×</button>`;
  panel.prepend(heading);
  document.getElementById('close-panel').onclick = () => showPanel(false, true);
  document.getElementById('mission-objective').innerHTML = `<span>${state.stage === 'plan' ? '01 / Imagine & plan' : state.stage === 'shop' ? '02 / Gather your materials' : state.stage === 'complete' ? 'A wonder, built by you' : '03 / Bring the stones together'}</span><strong>${level.journeyRole?`${state.blocks.length}/${level.blueprint.length} stones · ${level.journeyRole==='expand'?'14 preserved from your first pyramid':'Materials delivered'}`:`${state.money} coins <i aria-hidden="true">·</i> ${state.blocks.length} stones placed`}</strong>`;
  for (const id of ['material-tray','build-tools','layer-control','build-hint-action']) document.getElementById(id).replaceChildren();
  document.getElementById('build-hint').hidden = true;
  document.getElementById('builder-dock').hidden = !building;
  if (building) {
    const move = (selector, id) => { const e = panel.querySelector(selector); if (e) document.getElementById(id).append(e); };
    move('.part-palette', 'material-tray');
    move('.layer-tabs', 'layer-control');
    const layerCaption = document.createElement('span');
    layerCaption.className = 'layer-caption';
    layerCaption.textContent = `L${state.layer + 1} active`;
    document.getElementById('layer-control').prepend(layerCaption);
    move('.tools', 'build-tools');
    move('#market', 'build-tools');
    move('#ghost', 'build-tools');
    move('#check', 'build-tools');
    const detail = STONE_DETAILS[state.part];
    document.getElementById('selected-piece').textContent = state.tool === 'remove' ? 'Lift out a stone to use it again.' : `${detail.label} — ${detail.role}`;
    document.getElementById('ghost')?.setAttribute('aria-pressed', String(guide));
    document.querySelectorAll('[data-part]').forEach(button => {
      button.setAttribute('aria-pressed',String(state.part === button.dataset.part && state.tool === 'place'));
    });
    const hint = buildHint(state, level);
    document.querySelectorAll('#layer-control [data-layer]').forEach(button => {
      const layer = +button.dataset.layer;
      button.setAttribute('aria-pressed', String(layer === state.layer));
      button.setAttribute('aria-label', `Layer ${layer + 1}, ${level.dims[layer]} by ${level.dims[layer]}${hint?.layer === layer ? ', suggested next layer' : ''}`);
      button.classList.toggle('suggested-layer', hint?.layer === layer);
      if (hint?.layer === layer) {
        const marker = document.createElement('span');
        marker.className = 'layer-next';
        marker.textContent = 'Next';
        button.append(marker);
      }
    });
    const hintText = document.getElementById('build-hint-text');
    if (hintText.textContent !== (hint?.text || '')) hintText.textContent = hint?.text || '';
    document.getElementById('build-hint').hidden = !hint;
    if (hint?.layer !== undefined || hint?.part) {
      const action = document.createElement('button');
      action.id = 'build-hint-button';
      if (hint.layer !== undefined) {
        action.dataset.layer = hint.layer;
        action.textContent = `Select L${hint.layer + 1}${hint.layer > state.layer ? ' ↑' : ''}`;
      } else {
        action.dataset.part = hint.part;
        action.textContent = `Select ${STONE_DETAILS[hint.part].label.toLowerCase()}`;
      }
      action.setAttribute('aria-describedby', 'build-hint-text');
      document.getElementById('build-hint-action').append(action);
    }
    // Keep the selected material in reach when the touch tray scrolls.
    requestAnimationFrame(() => {
      const selected = document.querySelector('#material-tray [aria-pressed="true"]');
      const tray = document.getElementById('material-tray');
      if (selected && (selected.offsetLeft < tray.scrollLeft || selected.offsetLeft + selected.offsetWidth > tray.scrollLeft + tray.clientWidth)) tray.scrollLeft = Math.max(0, selected.offsetLeft - tray.clientWidth / 2 + selected.offsetWidth / 2);
    });
  }
  showPanel(panelOpen);
}
