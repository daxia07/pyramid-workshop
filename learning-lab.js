const sessions = new Map();
const hostContexts = new WeakMap();
const boundHosts = new WeakMap();

const sceneOf = level => level?.sceneId || level?.id || '';
const missionOf = level => level?.missionId || level?.id || sceneOf(level);
const blocksOf = level => {
  if (Array.isArray(level?.target) && level.target.length) return level.target;
  if (Array.isArray(level?.blueprint)) return level.blueprint;
  return [];
};
const safeToken = value => String(value).replace(/[^a-z0-9_-]/gi, '-');
const materialOf = block => block.material || (['core', 'facing'].includes(block.type) ? block.type : null);
const typeLabel = type => ({
  brick: 'brick', edge: 'sloping edge stone', corner: 'corner stone', cap: 'cap stone',
  temple: 'temple', stairs: 'stair piece', core: 'sun-dried core brick', facing: 'fired facing brick'
}[type] || type);

function layerName(index, count) {
  if (index === 0) return 'Base';
  if (index === count - 1) return 'Top';
  const ordinal = ['Second', 'Third', 'Fourth', 'Fifth', 'Sixth'][index - 1];
  return ordinal ? `${ordinal} level` : `Layer ${index + 1}`;
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function makeQuestion(model) {
  if (model.sceneId === 'egypt') {
    const fullest = model.layers.reduce((best, layer) => !best || layer.count > best.count ? layer : best, null);
    return {
      prompt: 'Take a guess: which layer holds the most pieces?',
      options: model.layers.map(layer => ({id: String(layer.y), label: layer.name})),
      answer: String(fullest?.y ?? 0),
      correctText: `${fullest?.name || 'The widest layer'} has the most pieces in this model. Reveal the layer counts to check your guess.`,
      retryText: 'Look at how the shape gets narrower as it rises, then try another layer.'
    };
  }

  if (model.sceneId === 'maya') {
    if (model.missionId === 'maya-2' && model.stairs.mirrored) {
      return {
        prompt: 'What should you compare to check that the stair routes mirror each other?',
        options: [
          {id: 'each-level', label: 'The route at each level'},
          {id: 'top-only', label: 'Only the top step'}
        ],
        answer: 'each-level',
        correctText: 'Matching the route level by level creates a balanced pair of stairs.',
        retryText: 'A mirrored route needs to be compared along its whole climb, not only at the summit.'
      };
    }
    if (model.missionId === 'maya-3') {
      return {
        prompt: 'What helps a stairway make one walkable climb?',
        options: [
          {id: 'connect', label: 'Each step meets the next one'},
          {id: 'switch', label: 'Each step switches to a new side'}
        ],
        answer: 'connect',
        correctText: 'Connected steps make a route that can be followed upward.',
        retryText: 'Follow the route from the plaza upward. A walkable path needs connected steps.'
      };
    }
    const narrows = model.widths.some((width, index) => index > 0 && model.widths[index - 1] > width);
    return {
      prompt: 'What makes a terrace edge around the level above?',
      options: [
        {id: 'narrower', label: 'A smaller footprint above a wider one'},
        {id: 'same', label: 'The same footprint on every level'}
      ],
      answer: narrows ? 'narrower' : 'same',
      correctText: narrows ? 'A smaller upper footprint leaves a rim around it.' : 'Equal footprints would line up without making a rim.',
      retryText: 'Compare the outside edge of one level with the level stacked above it.'
    };
  }

  if (model.site) {
    const safe = model.site.choices.find(choice => choice.elevation > model.site.waterline);
    return {
      prompt: 'Predict: which platform sits above the model waterline?',
      options: model.site.choices.map(choice => ({id: choice.id, label: choice.label})),
      answer: safe?.id || model.site.accepted,
      correctText: 'That platform is above the model line. The line is a simple comparison tool for this building site.',
      retryText: 'Compare each platform with the horizontal waterline, then try again.'
    };
  }

  if (model.missionId === 'ur-2') {
    return {
      prompt: 'What is a good way to work out the number of four-brick packs?',
      options: [
        {id: 'group-four', label: 'Group the bricks needed into fours'},
        {id: 'guess-height', label: 'Guess from the temple height'}
      ],
      answer: 'group-four',
      correctText: 'Counting groups of four connects the unfinished ring to the pack size.',
      retryText: 'The pack size is about groups of bricks, so look at how many fit in one pack.'
    };
  }

  return {
    prompt: 'Which brick makes the outside layer of the wall?',
    options: [
      {id: 'core', label: 'Sun-dried core brick'},
      {id: 'facing', label: 'Fired facing brick'}
    ],
    answer: 'facing',
    correctText: 'Fired facing bricks cover the outside while sun-dried bricks fill the core.',
    retryText: 'Think about which material is named as the outer face of the wall.'
  };
}

/** Build a read-only learning model from the active mission blueprint. */
export function getLearningModel(level) {
  const missionId = missionOf(level);
  const sceneId = sceneOf(level);
  const blocks = blocksOf(level);
  const seed = Array.isArray(level?.seed) ? level.seed : [];
  const yValues = [...new Set(blocks.filter(block => Number.isFinite(block.y)).map(block => block.y))].sort((a, b) => a - b);
  const dims = Array.isArray(level?.dims) ? level.dims : [];
  const layers = yValues.map((y, index) => {
    const pieces = blocks.filter(block => block.y === y);
    const counts = countBy(pieces, block => materialOf(block) || block.type);
    return {
      y,
      name: layerName(index, yValues.length),
      count: pieces.length,
      width: Number.isFinite(dims[y]) ? dims[y] : null,
      counts,
      core: counts.core || 0,
      facing: counts.facing || 0,
      stairs: counts.stairs || 0
    };
  });
  const widths = dims.slice();
  const stairs = blocks.filter(block => block.type === 'stairs');
  const routeByLevel = layers.map(layer => {
    const atLevel = stairs.filter(block => block.y === layer.y);
    return {
      y: layer.y,
      front: atLevel.filter(block => (block.routeId || block.side || 'front') === 'front').length,
      rear: atLevel.filter(block => (block.routeId || block.side) === 'rear').length
    };
  });
  const routeTotals = {
    front: stairs.filter(block => (block.routeId || block.side || 'front') === 'front').length,
    rear: stairs.filter(block => (block.routeId || block.side) === 'rear').length
  };
  const mirrored = routeByLevel.some(row => row.front + row.rear > 0)
    && routeByLevel.every(row => row.front === row.rear);
  const materialCounts = countBy(blocks, materialOf);
  const seedMaterialCounts = countBy(seed, materialOf);
  const facingNeeded = Math.max(0, (materialCounts.facing || 0) - (seedMaterialCounts.facing || 0));
  const site = level?.site ? {
    waterline: Number(level.site.waterline || 0),
    accepted: level.site.accepted,
    choices: (level.site.choices || []).map(choice => ({
      id: choice.id,
      label: choice.id === 'high' ? 'Higher platform' : choice.id === 'low' ? 'Low platform' : choice.label || choice.id,
      elevation: Number(choice.elevation || 0),
      fee: Number(choice.fee || 0)
    }))
  } : null;
  const model = {
    missionId,
    sceneId,
    blocks,
    layers,
    widths,
    total: blocks.length,
    materialCounts,
    seedMaterialCounts,
    facingNeeded,
    packSize: 4,
    packsNeeded: Math.ceil(facingNeeded / 4),
    stairs: {total: stairs.length, routeTotals, routeByLevel, mirrored},
    site
  };
  model.question = makeQuestion(model);
  return model;
}

/** Evaluate one optional prediction without changing mission or build state. */
export function evaluateLearningAnswer(level, answer) {
  const question = getLearningModel(level).question;
  const correct = String(answer) === question.answer;
  return {
    correct,
    message: correct ? question.correctText : question.retryText,
    answer: correct ? question.answer : null
  };
}

function sessionFor(missionId) {
  if (!sessions.has(missionId)) sessions.set(missionId, {open: false, revealed: false, answer: null, feedback: null});
  return sessions.get(missionId);
}

function egyptDiagram(model) {
  const widths = model.layers.map(layer => layer.width || 1);
  const widest = Math.max(1, ...widths);
  const rects = model.layers.map((layer, index) => {
    const width = Math.max(20, Math.round((widths[index] / widest) * 142));
    const x = 90 - width / 2;
    const y = 84 - index * 17;
    const tone = ['#bc8652', '#d3a46c', '#e2be87', '#edd5a5'][index % 4];
    return `<rect x="${x}" y="${y}" width="${width}" height="16" rx="2" fill="${tone}" stroke="#57402e" stroke-width="1.5"/>`;
  }).join('');
  return `<svg viewBox="0 0 180 100" role="img" aria-label="A layered pyramid silhouette, widest at the base">${rects}<line x1="18" y1="87" x2="162" y2="87" stroke="#57402e" stroke-width="2"/></svg>`;
}

function mayaDiagram(model) {
  const widths = model.widths.length ? model.widths : [3, 2, 1];
  const widest = Math.max(1, ...widths);
  const rects = widths.map((width, index) => {
    const size = Math.max(18, Math.round((width / widest) * 96));
    const inset = (110 - size) / 2;
    const y = 78 - index * 13;
    return `<rect x="${inset}" y="${y}" width="${size}" height="12" fill="${index % 2 ? '#c99459' : '#a96d3f'}" stroke="#523b28" stroke-width="1.5"/>`;
  }).join('');
  const hasFront = model.stairs.routeTotals.front > 0;
  const hasRear = model.stairs.routeTotals.rear > 0;
  const front = hasFront ? '<path d="M55 91 L55 79 L65 79 L65 66 L75 66 L75 53" fill="none" stroke="#194b5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M70 56 L75 50 L80 56" fill="none" stroke="#194b5c" stroke-width="3"/>' : '';
  const rear = hasRear ? '<path d="M125 91 L125 79 L115 79 L115 66 L105 66 L105 53" fill="none" stroke="#2f6555" stroke-width="3" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/><path d="M100 56 L105 50 L110 56" fill="none" stroke="#2f6555" stroke-width="3"/>' : '';
  return `<svg viewBox="0 0 180 100" role="img" aria-label="Stepped temple footprints with the model stair routes">${rects}${front}${rear}<text x="8" y="96" fill="#23383e" font-size="9">front</text><text x="142" y="96" fill="#23383e" font-size="9">rear</text></svg>`;
}

function urDiagram(model) {
  const rows = model.layers.filter(layer => layer.count > 0);
  const widths = rows.map(layer => layer.width || Math.max(1, layer.count));
  const widest = Math.max(1, ...widths);
  const shapes = rows.map((layer, index) => {
    const width = Math.max(26, Math.round((widths[index] / widest) * 136));
    const height = 14;
    const x = 90 - width / 2;
    const y = 82 - index * 17;
    const hasFacing = layer.facing > 0;
    const hasCore = layer.core > 0;
    const outer = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1" fill="${hasFacing ? '#b75e3d' : '#b99b67'}" stroke="#523b28" stroke-width="1.5"/>`;
    const innerWidth = Math.max(10, Math.round(width * 0.46));
    const inner = hasCore ? `<rect x="${90 - innerWidth / 2}" y="${y + 3}" width="${innerWidth}" height="8" fill="#d1c39e" stroke="#584e3d" stroke-width="1"/>` : '';
    return outer + inner;
  }).join('');
  return `<svg viewBox="0 0 180 100" role="img" aria-label="A ziggurat cross-section with an inner core and outer facing">${shapes}<line x1="18" y1="86" x2="162" y2="86" stroke="#57402e" stroke-width="2"/></svg>`;
}

function waterDiagram(site) {
  if (!site?.choices?.length) return '';
  const heights = site.choices.map(choice => choice.elevation);
  const min = Math.min(...heights, site.waterline - 1);
  const max = Math.max(...heights, site.waterline + 1);
  const yFor = value => Math.round(76 - ((value - min) / Math.max(1, max - min)) * 48);
  const waterY = yFor(site.waterline);
  const marks = site.choices.map((choice, index) => {
    const x = index === 0 ? 52 : 128;
    const y = yFor(choice.elevation);
    return `<rect x="${x - 20}" y="${y - 8}" width="40" height="8" rx="2" fill="#b78355" stroke="#503a2a" stroke-width="1.5"/><text x="${x}" y="91" text-anchor="middle" fill="#263b40" font-size="10">${index === 0 ? 'Low' : 'Higher'}</text>`;
  }).join('');
  return `<svg viewBox="0 0 180 100" role="img" aria-label="Two platform heights beside a model waterline"><line x1="16" y1="${waterY}" x2="164" y2="${waterY}" stroke="#126b8a" stroke-width="3" stroke-dasharray="6 3"/><text x="18" y="${Math.max(10, waterY - 4)}" fill="#07516b" font-size="9">model waterline</text>${marks}<line x1="18" y1="78" x2="162" y2="78" stroke="#57402e" stroke-width="2"/></svg>`;
}

function diagramFor(model) {
  if (model.sceneId === 'egypt') return {svg: egyptDiagram(model), note: 'Notice how the layers get narrower as the pyramid rises.'};
  if (model.sceneId === 'maya') return {svg: mayaDiagram(model), note: 'Compare the terrace edges and follow each stair route upward.'};
  return {
    svg: `${urDiagram(model)}${model.site ? `<div class="learning-mini-diagram">${waterDiagram(model.site)}</div>` : ''}`,
    note: model.site ? 'The blue line is a model waterline. Compare the two platform heights.' : 'The warm outer band is facing; the pale inside is the core.'
  };
}

function revealedData(model) {
  if (model.sceneId === 'egypt') {
    return `<ul class="learning-count-list">${model.layers.map(layer => `<li><span>${layer.name}</span><strong>${layer.count} ${layer.count === 1 ? 'piece' : 'pieces'}</strong></li>`).join('')}<li class="learning-total"><span>Whole model</span><strong>${model.total} pieces</strong></li></ul>`;
  }
  if (model.sceneId === 'maya') {
    const widths = model.layers.filter(layer => Number.isFinite(layer.width)).map(layer => `<li><span>${layer.name} footprint</span><strong>${layer.width} units wide</strong></li>`).join('');
    const front = model.stairs.routeTotals.front;
    const rear = model.stairs.routeTotals.rear;
    return `<ul class="learning-count-list">${widths}<li><span>Front stair route</span><strong>${front} ${front === 1 ? 'flight' : 'flights'}</strong></li><li><span>Rear stair route</span><strong>${rear} ${rear === 1 ? 'flight' : 'flights'}</strong></li></ul>`;
  }
  const rows = [
    `<li><span>Sun-dried core bricks</span><strong>${model.materialCounts.core || 0}</strong></li>`,
    `<li><span>Fired facing bricks</span><strong>${model.materialCounts.facing || 0}</strong></li>`
  ];
  if (model.missionId === 'ur-2' || model.missionId === 'ur-4') {
    rows.push(`<li><span>Facing bricks still to account for</span><strong>${model.facingNeeded}</strong></li>`);
    rows.push(`<li><span>Packs of four</span><strong>${model.packsNeeded}</strong></li>`);
  }
  if (model.site) {
    rows.push(`<li><span>Model waterline</span><strong>${model.site.waterline} units high</strong></li>`);
    for (const choice of model.site.choices) rows.push(`<li><span>${choice.label}</span><strong>Height ${choice.elevation} · ${choice.fee} coins</strong></li>`);
  }
  return `<ul class="learning-count-list">${rows.join('')}</ul>`;
}

function feedbackMarkup(session, question) {
  if (!session.feedback) return '<p class="learning-feedback" role="status" aria-live="polite">Make a guess when you are ready. You can reveal the model data at any time.</p>';
  const retry = session.feedback.correct ? '' : '<button type="button" class="learning-retry" data-learning-action="retry">Try again</button>';
  const label = session.feedback.correct ? 'That’s it!' : 'Nice try.';
  return `<div class="learning-feedback ${session.feedback.correct ? 'is-correct' : 'is-retry'}" role="status" aria-live="polite"><strong>${label}</strong><span>${session.feedback.message}</span>${retry}</div>`;
}

/** Return the accessible, initially collapsed panel markup for one mission. */
export function renderLearningLab(level, state) {
  const model = getLearningModel(level);
  const session = sessionFor(model.missionId);
  const token = safeToken(model.missionId);
  const contentId = `learning-content-${token}`;
  const heading = model.sceneId === 'egypt' ? 'Explore the pyramid model'
    : model.sceneId === 'maya' ? 'Explore the temple model' : 'Explore the ziggurat model';
  if (!session.open) {
    return `<section class="learning-lab" data-learning-mission="${token}"><button class="learning-toggle" type="button" data-learning-action="toggle" aria-expanded="false" aria-controls="${contentId}"><span>Explore the model</span><span class="learning-toggle-mark" aria-hidden="true">+</span></button></section>`;
  }

  const diagram = diagramFor(model);
  const question = model.question;
  const answers = question.options.map(option => `<button type="button" class="learning-answer" data-learning-action="answer" data-learning-answer="${safeToken(option.id)}" aria-pressed="${session.answer === option.id}">${option.label}</button>`).join('');
  const counts = session.revealed
    ? `<div class="learning-revealed"><h4>Model data</h4>${revealedData(model)}<button type="button" class="learning-reveal" data-learning-action="hide-counts">Hide model data</button></div>`
    : '<button type="button" class="learning-reveal" data-learning-action="reveal">Show the model counts</button>';
  const stateNote = state?.stage === 'build' ? '<p class="learning-stage-note">Use this model for ideas, then return to your worksite when you are ready.</p>' : '';
  return `<section class="learning-lab" data-learning-mission="${token}"><button class="learning-toggle" type="button" data-learning-action="toggle" aria-expanded="true" aria-controls="${contentId}"><span>Explore the model</span><span class="learning-toggle-mark" aria-hidden="true">−</span></button><div class="learning-content" id="${contentId}"><h3>${heading}</h3><p class="learning-intro">Look at the shape, make a prediction, then check the model data if you want.</p>${stateNote}<figure class="learning-figure"><div class="learning-visual">${diagram.svg}</div><figcaption>${diagram.note}</figcaption></figure><fieldset class="learning-question"><legend>${question.prompt}</legend><div class="learning-answers">${answers}</div>${feedbackMarkup(session, question)}</fieldset>${counts}</div></section>`;
}

function focusAfterPaint(container, action, answer) {
  if (!action) return;
  const buttons = [...container.querySelectorAll('[data-learning-action]')];
  const target = buttons.find(button => button.dataset.learningAction === action
    && (answer === undefined || button.dataset.learningAnswer === answer));
  (target || buttons[0])?.focus?.({preventScroll: true});
}

/** Bind the panel to a dedicated host. Interactions only update this host and local session state. */
export function bindLearningLab({level, state, container} = {}) {
  if (!container) return null;
  hostContexts.set(container, {level, state});
  if (!boundHosts.has(container)) {
    const listener = event => {
      const button = event.target?.closest?.('[data-learning-action]');
      if (!button || !container.contains(button)) return;
      const context = hostContexts.get(container);
      if (!context) return;
      const model = getLearningModel(context.level);
      const session = sessionFor(model.missionId);
      const action = button.dataset.learningAction;
      let focusAction = action;
      let focusAnswer;
      if (action === 'toggle') session.open = !session.open;
      else if (action === 'reveal') {
        session.revealed = true;
        focusAction = 'hide-counts';
      } else if (action === 'hide-counts') {
        session.revealed = false;
        focusAction = 'reveal';
      }
      else if (action === 'answer') {
        const answer = button.dataset.learningAnswer;
        session.answer = answer;
        session.feedback = evaluateLearningAnswer(context.level, answer);
        focusAnswer = answer;
      } else if (action === 'retry') {
        session.answer = null;
        session.feedback = null;
        focusAction = 'answer';
      } else return;
      container.innerHTML = renderLearningLab(context.level, context.state);
      focusAfterPaint(container, focusAction, focusAnswer);
    };
    container.addEventListener('click', listener);
    boundHosts.set(container, listener);
  }
  container.innerHTML = renderLearningLab(level, state);
  return {
    update(nextLevel, nextState) {
      hostContexts.set(container, {level: nextLevel, state: nextState});
      container.innerHTML = renderLearningLab(nextLevel, nextState);
    },
    destroy() {
      const listener = boundHosts.get(container);
      if (listener) container.removeEventListener('click', listener);
      boundHosts.delete(container);
      hostContexts.delete(container);
    }
  };
}
