import './style.css';
import { World, ground } from './world.js';
import { walkable, coastOutline } from './island.js';
import {
  ITEMS,
  NPCS,
  TRADES,
  CHAPTERS,
  CHAPTER,
  DISTRICTS,
  NOTES,
  CHIMES,
  RESOURCES,
  FISH_SPOT,
  nameOf,
  iconOf,
} from './content.js';
import {
  initialState,
  loadSave,
  saveState,
  validSave,
  addItem,
  quantity,
  completeTrade,
  storeItem,
  retrieveItem,
} from './state.js';
import { Soundscape } from './audio.js';
import { SCENES } from './scenes.js';
const $ = (s) => document.querySelector(s),
  saved = loadSave();
let state = saved || initialState();
if (!saved)
  state.settings.reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
if (!walkable(state.x, state.z)) {
  state.x = -33;
  state.z = 62;
}
let world,
  sound = new Soundscape(state.settings),
  started = false,
  scene = null,
  sceneTime = 0,
  shotIndex = -1,
  typingTimer = null,
  fishGame = null,
  tracked = null,
  lastFocus = null,
  afterTrade = null;
const keys = new Set();
let toastTimer,
  saveTimer = 0,
  hudTimer = 0,
  last = performance.now(),
  currentRegion = '',
  nearest = null,
  lastDreamDay = -1,
  dreamUntil = 0,
  lastAvailability = true;
const portrait = (color = '#d1614e') =>
  `<svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="44" fill="${color}" opacity=".2"/><ellipse cx="45" cy="55" rx="25" ry="34" fill="#2e4248"/><ellipse cx="45" cy="62" rx="18" ry="22" fill="#f6efdd"/><ellipse cx="35" cy="38" rx="10" ry="13" fill="#f6efdd"/><ellipse cx="55" cy="38" rx="10" ry="13" fill="#f6efdd"/><circle cx="36" cy="38" r="3" fill="#23393e"/><circle cx="54" cy="38" r="3" fill="#23393e"/><path d="m39 45 12 0-6 8z" fill="#e2a058"/><path d="M22 58q23 9 46 0" stroke="${color}" stroke-width="8" fill="none"/><path d="m59 60 1 18" stroke="${color}" stroke-width="8"/></svg>`;
$('#app').innerHTML = `
<canvas id="world" aria-label="NarNar island. Move with W A S D or arrow keys. Press E near a neighbour or object."></canvas><div class="vignette"></div>
<header class="hud" id="top-hud"><div class="brand">NarNar<span>✦</span><small>A LITTLE JOURNEY TO A PLACE TO CALL HOME.</small></div><div class="location"><span class="location-dot"></span><div id="region">Littlewake Harbour</div><small id="time-of-day">A good day to begin</small></div><nav class="tools"><button id="journal-btn" title="Journal (J)">▤<span>Journal</span><kbd>J</kbd></button><button id="map-btn" title="Island map (M)">⌖<span>Map</span><kbd>M</kbd></button><button id="sound-btn" aria-label="Toggle sound">♫</button><button id="settings-btn" aria-label="Pause and settings">☷</button></nav></header>
<aside id="quest" class="quest hud"><div class="eyebrow" id="chapter-label"></div><h2 id="quest-title"></h2><p id="quest-detail"></p><button id="hint-btn" class="text-button">A little nudge ↗</button><div class="quest-progress"><i id="quest-progress"></i></div></aside>
<button class="compass hud" id="compass" title="Open map"><span id="direction">➤</span><div id="destination-label"></div></button>
<div id="nearby" class="nearby hidden"><span id="nearby-label"></span><button id="interact-btn"><kbd>E</kbd><span>Talk</span></button></div>
<footer id="pockets" class="pockets"><div class="pocket-heading"><span>YOUR LITTLE POCKETS</span><span id="pocket-count">1 / 6</span></div><div id="inventory" class="inventory"></div><div class="pocket-footer"><span id="save-status">Progress saves automatically</span><span>✦ <span id="trade-count">0</span> trades</span></div></footer>
<div class="controls hud"><span><kbd>W A S D</kbd> wander</span><span><kbd>SHIFT</kbd> run</span><span><kbd>E</kbd> interact</span><small>or click the ground to waddle</small></div>
<button class="minimap hud" id="minimap-btn" aria-label="Open full island map"><canvas id="minimap" width="168" height="148"></canvas><span>NORTHLIGHT ISLE <span>↗</span></span></button>
<div class="touch-controls hud"><div class="dpad"><button data-key="w" aria-label="Walk up">↑</button><button data-key="a" aria-label="Walk left">←</button><button data-key="s" aria-label="Walk down">↓</button><button data-key="d" aria-label="Walk right">→</button></div><button data-key="shift">Run</button><button id="touch-action">Interact</button></div>
<div id="thought-bubble" class="thought-bubble hidden" role="status" aria-live="polite"></div>
<div id="toast" role="status" aria-live="polite"></div>
<div id="start-screen" class="start-screen"><div class="start-card"><div class="start-kicker"><i></i> A COSY ISLAND ADVENTURE</div><h1>NarNar<span>✦</span></h1><p class="start-tagline">A little journey to a place to call home.</p><div class="start-rule"></div><p class="start-description">You have a pomegranate, six little pockets,<br>and a wonderfully unreasonable dream.</p><button id="begin-btn" class="primary">${saved?.started ? 'Continue your adventure' : 'Let’s find our home'} <span>→</span></button><button id="start-options" class="start-options">Sound, saves & controls</button><div class="start-meta">Single player <i>·</i> A leisurely 30–60 minute journey</div></div><div class="start-caption"><span>01 / NORTHLIGHT ISLE</span><p>Good things begin small.</p></div></div>
<div id="cinematic" class="cinematic hidden"><div class="cinema-top"><span id="scene-label"></span><button id="skip-scene">Skip scene <kbd>ESC</kbd></button></div><div class="cinema-bottom"><div id="scene-dots"></div><h2 id="scene-text"></h2><button id="next-shot">Continue →</button></div></div>
<dialog id="dialog"><div id="dialog-content"></div></dialog><input type="file" id="import-file" accept="application/json,.json" hidden>`;
function toast(text, bad = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').className = bad ? 'visible bad' : 'visible';
  toastTimer = setTimeout(() => ($('#toast').className = ''), 4200);
}
function persist(announce = false) {
  const ok = saveState(state);
  $('#save-status').textContent = ok
    ? '✓ Saved just now'
    : 'Save unavailable — download a backup';
  if (announce)
    toast(
      ok
        ? 'Your little adventure is saved.'
        : 'Browser storage is unavailable. Download a save from the menu.',
      !ok,
    );
  return ok;
}
function closeModal() {
  clearInterval(typingTimer);
  typingTimer = null;
  fishGame = null;
  $('#dialog').close();
  keys.clear();
  lastFocus?.focus?.();
  const next = afterTrade;
  afterTrade = null;
  if (next) next();
}
function modal(html, wide = false) {
  clearInterval(typingTimer);
  fishGame = null;
  keys.clear();
  world.destination = null;
  lastFocus = document.activeElement;
  $('#dialog').className = wide ? 'wide' : '';
  $('#dialog-content').innerHTML =
    `<button class="close" aria-label="Close window" id="close-dialog">×</button>${html}`;
  if (!$('#dialog').open) $('#dialog').showModal();
  $('#close-dialog').onclick = closeModal;
}
function button(label, fn, cls = 'secondary') {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.onclick = fn;
  return b;
}
function actionRow(actions) {
  const row = document.createElement('div');
  row.className = 'dialog-actions';
  actions.forEach((a) => row.append(button(...a)));
  $('#dialog-content').append(row);
}
function typeText(element, text) {
  clearInterval(typingTimer);
  element.textContent = '';
  let i = 0;
  if (state.settings.reducedMotion) {
    element.textContent = text;
    return;
  }
  typingTimer = setInterval(() => {
    i += 2;
    element.textContent = text.slice(0, i);
    if (i % 6 === 0) sound.voice();
    if (i >= text.length) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
  }, 22);
  element.onclick = () => {
    clearInterval(typingTimer);
    typingTimer = null;
    element.textContent = text;
  };
}
function itemHtml(id, qty = 1) {
  return `<span class="item-icon">${iconOf(id)}</span><span>${nameOf(id)}${qty > 1 ? ` <b>×${qty}</b>` : ''}</span>`;
}
function currentTrade() {
  return TRADES[state.step];
}
function renderInventory() {
  const inv = $('#inventory');
  inv.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const a = state.inventory[i],
      b = document.createElement('button');
    b.className = 'slot' + (a ? ' filled' : '');
    if (a) b.title = nameOf(a.id) + ' — ' + ITEMS[a.id][2];
    b.setAttribute(
      'aria-label',
      a
        ? `${nameOf(a.id)}, ${a.qty}. Open item details.`
        : `Empty pocket ${i + 1}`,
    );
    b.innerHTML = `<span class="slot-number">${i + 1}</span>${a ? `<span class="slot-icon">${iconOf(a.id)}</span>${a.qty > 1 ? `<span class="slot-qty">${a.qty}</span>` : ''}<span class="slot-name">${nameOf(a.id)}</span>` : '<span class="empty-slot">·</span>'}`;
    b.onclick = () =>
      a
        ? itemDetail(a.id)
        : toast('An empty pocket. A little room for possibility.');
    inv.append(b);
  }
  $('#pocket-count').textContent = `${state.inventory.length} / 6`;
  $('#trade-count').textContent = state.step;
}
function itemDetail(id) {
  if (scene) return;
  const a = state.inventory.find((a) => a.id === id);
  if (!a) return;
  modal(
    `<div class="big-item">${iconOf(id)}</div><div class="eyebrow">POCKET TREASURE · ${a.qty} IN YOUR BAG</div><h2>${nameOf(id)}</h2><p>${ITEMS[id][2]}</p><p class="muted">The travel trunk frees a pocket and keeps items safe. Open it in your journal whenever you need something back.</p>`,
  );
  actionRow([
    [
      'Put in travel trunk',
      () => {
        storeItem(state, id);
        changed();
        closeModal();
        toast('Tucked safely into your travel trunk.');
      },
      'primary',
    ],
    ['Keep in pocket', closeModal],
  ]);
}
function changed() {
  world.sync();
  renderInventory();
  renderQuest();
  persist();
}
function renderQuest() {
  const t = currentTrade();
  $('#chapter-label').textContent = state.retired
    ? 'A HAPPY ENDING'
    : `CHAPTER ${CHAPTERS.indexOf(CHAPTER(state.step)) + 1} OF 5`;
  $('#quest-title').textContent = t ? t.title : 'Home, at last';
  $('#quest-detail').textContent = t
    ? `Find ${NPCS.find((n) => n.id === t.npc).name} · ${t.chime && state.chimes.length < 3 ? 'Wake the three wind chimes' : `Trade ${[...new Set(t.needs)].map(nameOf).join(' + ')}`}`
    : 'The kettle is on. The island is yours to enjoy.';
  $('#quest-progress').style.width = `${(state.step / TRADES.length) * 100}%`;
  $('#hint-btn').textContent = state.retired
    ? 'Your story ↗'
    : 'A little nudge ↗';
}
function hint() {
  if (state.retired) {
    journal('history');
    return;
  }
  const t = currentTrade(),
    needed = [...new Set(t.needs)].filter(
      (id) => quantity(state, id) < t.needs.filter((a) => a === id).length,
    );
  let text = '';
  const stored = needed.find((id) => state.storage.some((a) => a.id === id));
  if (stored)
    text = `Your ${nameOf(stored)} is safe in the travel trunk. Open Journal → Travel trunk to retrieve it.`;
  else if (t.chime && state.chimes.length < 3) {
    const c = CHIMES[state.chimes.length];
    tracked = c;
    text = `Play ${c.name} next. The order is Orchard → Pines → Rise. Each chime is marked on your map.`;
  } else if (needed.includes('fish')) {
    tracked = FISH_SPOT;
    text =
      'Find the glowing fishing circle beside Finn at the southern shore. Catch two moonfish using your silver lure.';
  } else if (needed.some((id) => ['wood', 'herbs', 'mushroom'].includes(id))) {
    const id = needed.find((id) => ['wood', 'herbs', 'mushroom'].includes(id));
    tracked = RESOURCES.find(
      (r) => r.type === id && !state.gathered.includes(r.id),
    );
    text = `Look for ${nameOf(id)} in the ${id === 'wood' ? 'southern shore' : id === 'herbs' ? 'western orchard' : 'eastern forest'}. Your compass points to a marked patch.`;
  } else {
    tracked = NPCS.find((n) => n.id === t.npc);
    text = world.cycle.available
      ? `${tracked.name} is waiting. Follow the compass, or open your map. Keep every required item in your pockets.`
      : `${tracked.name} will trade again in the morning. Night lasts three minutes; you can still gather, fish, play chimes, and find postcards.`;
  }
  toast(text);
}
function talk(n) {
  if (!world.cycle.available) {
    toast(
      `${n.name} ${world.cycle.night ? 'is sleeping' : 'is heading home or waking up'}. There is still plenty to gather outside.`,
    );
    return;
  }
  if (!state.met.includes(n.id)) state.met.push(n.id);
  persist();
  const t = currentTrade(),
    isCurrent = t?.npc === n.id;
  modal(
    `<div class="speaker"><div class="portrait">${portrait('#' + n.color.toString(16).padStart(6, '0'))}</div><div><div class="eyebrow">${n.role}</div><h2>${n.name}</h2></div><span class="speaker-heart">♡</span></div><p class="dialogue" id="speech"></p>${
      isCurrent
        ? `<div class="trade-box"><div><span class="eyebrow">YOU GIVE</span>${Object.entries(
            t.needs.reduce((a, id) => ((a[id] = (a[id] || 0) + 1), a), {}),
          )
            .map(
              ([id, q]) =>
                `<div class="trade-item ${quantity(state, id) >= q ? '' : 'missing'}">${itemHtml(id, q)}<small>${quantity(state, id)}/${q}</small></div>`,
            )
            .join(
              '',
            )}</div><span class="trade-arrow">⇄</span><div><span class="eyebrow">YOU RECEIVE</span>${t.gives.length ? t.gives.map((id) => `<div class="trade-item">${itemHtml(id)}</div>`).join('') : '<div class="trade-item">🏡 A well-earned retirement</div>'}</div></div>${t.chime ? `<p class="chime-status">The old song: ${CHIMES.map((c) => `${state.chimes.includes(c.id) ? '●' : '○'} ${c.id}`).join(' · ')}</p>` : ''}`
        : ''
    }`,
  );
  typeText($('#speech'), isCurrent ? t.dialogue : n.line);
  const actions = [];
  if (isCurrent)
    actions.push([
      state.step === 27 ? 'I’m ready to come home' : 'It’s a deal',
      () => makeTrade(t, n),
      'primary',
    ]);
  actions.push([
    'Tell me something',
    () => {
      typeText($('#speech'), n.rumour);
      sound.voice(true);
    },
  ]);
  if (n.id === 'pearl' && !state.sidequests.includes('glass'))
    actions.push(['About this sea glass…', () => sideQuest(n)]);
  if (!isCurrent)
    actions.push([
      'Offer a pocket treasure',
      () => {
        sound.fail();
        typeText(
          $('#speech'),
          '“A lovely thing, truly. But not what I need just now. Keep it—someone on this island will treasure it.”',
        );
      },
    ]);
  actions.push(['See you around', closeModal]);
  actionRow(actions);
}
function makeTrade(t) {
  if (!world.cycle.available) {
    toast('Your neighbours will trade again in the morning.');
    return;
  }
  const result = completeTrade(state, t);
  if (!result.ok) {
    sound.fail();
    toast(result.reason, true);
    return;
  }
  sound.success();
  tracked = null;
  changed();
  modal(
    `<div class="trade-success">✦</div><div class="eyebrow">TRADE ${state.step} OF ${TRADES.length} · A LITTLE CLOSER</div><h2>${t.title}</h2><p class="dialogue after-trade">${t.after.replaceAll('\n', '<br>')}</p>${t.gives.length ? `<div class="received">${t.gives.map((id) => itemHtml(id)).join('')}</div>` : ''}`,
  );
  afterTrade = () => {
    if (state.step === 1) playScene('first');
    else if (state.step === 19) playScene('middle');
    else if (state.retired) playScene('end');
    else if (CHAPTERS.some((c) => c.at === state.step))
      toast(
        `Chapter ${CHAPTERS.indexOf(CHAPTER(state.step)) + 1} · ${CHAPTER(state.step).title}`,
      );
  };
  actionRow([['On we go →', closeModal, 'primary']]);
}
function sideQuest() {
  typeText(
    $('#speech'),
    '“Bring me four pieces of sea glass from the shore. I’ll dye your scarf the colour of the sea. A house is a fine dream—but looking dashing along the way can’t hurt.”',
  );
  actionRow([
    [
      'Give 4 sea glass',
      () => {
        if (quantity(state, 'shell') < 4) {
          sound.fail();
          toast(
            'You need four sea glass. Look along the southern beaches.',
            true,
          );
          return;
        }
        const a = state.inventory.find((a) => a.id === 'shell');
        a.qty -= 4;
        state.inventory = state.inventory.filter((a) => a.qty > 0);
        state.sidequests.push('glass');
        sound.success();
        changed();
        closeModal();
        toast('Sea-silk scarf unlocked. A little ocean, wherever you go.');
      },
      'primary',
    ],
  ]);
}
function interact() {
  if (!started || scene || $('#dialog').open) return;
  const e = world.nearest();
  if (!e) {
    toast('Waddle a little closer to a neighbour or something sparkling.');
    return;
  }
  if (e.type === 'npc') talk(e);
  else if (e.type === 'fishing') startFishing();
  else if (e.type === 'resource') {
    if (!addItem(state, e.resource)) {
      sound.fail();
      toast(
        'All six pockets are full. Store something in your travel trunk.',
        true,
      );
      return;
    }
    state.gathered.push(e.id);
    sound.pickup();
    changed();
    toast(`${nameOf(e.resource)} tucked into your pocket.`);
  } else if (e.type === 'note') {
    state.notes.push(e.id);
    sound.pickup();
    changed();
    modal(
      `<div class="eyebrow">THE KEEPER’S POSTCARDS · ${state.notes.length} / 12</div><h2>A note, left for someone</h2><p class="postcard">${e.text}</p>${state.notes.length === 12 ? '<p>You found every postcard. Orin’s story is yours now. You are the island’s Memory Keeper.</p>' : ''}`,
    );
    actionRow([['Keep this little story', closeModal, 'primary']]);
  } else if (e.type === 'chime') {
    sound.tone(e.note, 2, 0.15);
    if (state.step !== 18) {
      toast('A note drifts over the island. Perhaps this belongs to a song.');
      return;
    }
    if (state.chimes.length === 3) {
      toast('The song is complete. Orin is waiting.');
      return;
    }
    if (e.id === CHIMES[state.chimes.length].id) {
      state.chimes.push(e.id);
      changed();
      toast(
        state.chimes.length === 3
          ? 'The island answers. Bring the bell back to Orin.'
          : `${state.chimes.length} of 3 notes. ${CHIMES[state.chimes.length].name} is next.`,
      );
    } else {
      state.chimes = [];
      changed();
      sound.fail();
      toast(
        'The melody slips away. Begin again: Orchard → Pines → Rise.',
        true,
      );
    }
  }
}
function startFishing() {
  if (!quantity(state, 'lure')) {
    toast('Finn can trade you a silver lure. Follow your current trade first.');
    return;
  }
  if (state.inventory.length === 6 && !quantity(state, 'fish')) {
    toast('Free a pocket for your catch before fishing.', true);
    return;
  }
  modal(
    `<div class="eyebrow">LITTLEWAKE HARBOUR</div><h2>A little patience, a little luck</h2><p id="fish-instruction">Press <kbd>E</kbd>, <kbd>SPACE</kbd>, or the button when the float enters the gold patch. Land three good pulls to catch a moonfish.</p><div class="fishing-art">≈ <span>🐟</span> ≈</div><div class="fish-track"><div class="fish-zone"></div><i id="fish-float"></i></div><div class="fish-progress" id="fish-progress">○ ○ ○</div><button id="reel" class="primary full">Reel gently <kbd>E</kbd></button><p class="muted small">Missed? Nothing is lost. Take a breath and try again.</p>`,
  );
  fishGame = { time: 0, hits: 0, pos: 0, cooldown: 0 };
  $('#reel').onclick = reel;
}
function reel() {
  if (!fishGame || fishGame.cooldown > 0) return;
  const f = fishGame;
  if (f.pos >= 0.36 && f.pos <= 0.66) {
    f.hits++;
    sound.pickup();
    $('#fish-progress').textContent = Array.from({ length: 3 }, (_, i) =>
      i < f.hits ? '●' : '○',
    ).join(' ');
    f.cooldown = 0.5;
    if (f.hits === 3) {
      addItem(state, 'fish');
      sound.success();
      fishGame = null;
      changed();
      $('#fish-instruction').textContent =
        'A moonfish! You tuck the shimmering little catch into your pocket.';
      $('#reel').textContent = 'Cast again';
      $('#reel').onclick = startFishing;
      actionRow([['Back to the island', closeModal]]);
    }
  } else {
    sound.fail();
    toast('A little too soon or too late. Wait for the gold patch.');
    f.cooldown = 0.35;
  }
}
function playScene(id) {
  closeModal();
  keys.clear();
  scene = { id, ...SCENES[id] };
  sceneTime = 0;
  shotIndex = -1;
  $('#cinematic').classList.remove('hidden');
  $('#start-screen').classList.add('hidden');
  document.body.classList.add('in-scene');
  $('#scene-label').textContent = scene.label;
  $('#scene-dots').innerHTML = scene.shots.map(() => '<i></i>').join('');
  if (id === 'end') {
    state.x = 65;
    state.z = -77;
    world.player.rotation.y = 1.2;
  }
  sound.tone(196, 3, 0.1);
}
function finishScene() {
  if (!scene) return;
  const id = scene.id;
  if (!state.scenes.includes(id)) state.scenes.push(id);
  scene = null;
  $('#cinematic').classList.add('hidden');
  document.body.classList.remove('in-scene');
  persist();
  if (id === 'intro') help(true);
  if (id === 'end') ending();
}
function pendingScene() {
  if (!state.scenes.includes('intro')) return 'intro';
  if (state.step >= 1 && !state.scenes.includes('first')) return 'first';
  if (state.step >= 19 && !state.scenes.includes('middle')) return 'middle';
  if (state.retired && !state.scenes.includes('end')) return 'end';
  return null;
}
function begin() {
  sound
    .start()
    .catch(() => toast('Sound could not start. You can still play quietly.'));
  started = true;
  state.started = true;
  $('#start-screen').classList.add('hidden');
  document.body.classList.add('playing');
  changed();
  const pending = pendingScene();
  if (pending) playScene(pending);
}
function ending() {
  modal(
    `<div class="eyebrow">NARNAR · A WELL-EARNED RETIREMENT</div><h2>Welcome home, little neighbour.</h2><div class="ending-portrait">${portrait(state.sidequests.includes('glass') ? '#76babc' : '#d1614e')}</div><p>One pomegranate. Twenty-eight trades.<br>A whole island of friends.</p><div class="stats"><div><b>${Math.floor(state.playtime / 60)}</b><span>minutes wandering</span></div><div><b>${state.met.length}</b><span>neighbours met</span></div><div><b>${state.notes.length}/12</b><span>memories kept</span></div></div><p class="muted">${state.notes.length === 12 ? 'Orin’s chair was always meant for you. Memory Keeper, welcome home.' : 'The kettle will always be on. Keep exploring and find the rest of Orin’s postcards.'}</p>`,
  );
  actionRow([
    ['Stay a little longer', closeModal, 'primary'],
    ['Download my story', exportSave],
    ['Watch the ending again', () => playScene('end')],
  ]);
}
function help(first = false) {
  modal(
    `<div class="eyebrow">${first ? 'WELCOME TO NORTHLIGHT ISLE' : 'MAKE YOURSELF AT HOME'}</div><h2>A few little things</h2><div class="help-grid"><div><b>01 / Wander</b><p><kbd>W A S D</kbd> or arrows to walk.<br><kbd>Shift</kbd> to run. Click the ground to move. On touch screens, use the arrows.</p></div><div><b>02 / Say hello</b><p>Walk close and press <kbd>E</kbd>. Neighbours trade, share stories, and point you toward your next good thing.</p></div><div><b>03 / Travel lightly</b><p>Six pockets, always in view. Click an item to store it. Retrieve it from <kbd>J</kbd> → Travel trunk.</p></div><div><b>04 / Take your time</b><p><kbd>M</kbd> opens your map. “A little nudge” points toward what you need. <kbd>Esc</kbd> pauses. Progress saves automatically.</p></div></div><p class="muted">Your first neighbour is Mara, at the jam stall just north of the harbour. Look for the golden marker.</p>`,
  );
  actionRow([['Let’s go, little feet →', closeModal, 'primary']]);
}
function journal(tab = 'goal') {
  const t = currentTrade();
  modal(
    `<div class="eyebrow">NOTES FROM A LITTLE ADVENTURE</div><h2>Your island journal</h2><div class="tabs">${[
      ['goal', 'The next good thing'],
      ['history', 'Trades'],
      ['notes', 'Postcards'],
      ['trunk', 'Travel trunk'],
    ]
      .map(
        ([id, title]) =>
          `<button data-tab="${id}" class="${tab === id ? 'active' : ''}">${title}</button>`,
      )
      .join('')}</div><div id="journal-page"></div>`,
    true,
  );
  document
    .querySelectorAll('[data-tab]')
    .forEach((b) => (b.onclick = () => journal(b.dataset.tab)));
  const page = $('#journal-page');
  if (tab === 'goal') {
    page.innerHTML = `<div class="journal-goal"><span class="chapter-number">${state.retired ? '✦' : '0' + (CHAPTERS.indexOf(CHAPTER(state.step)) + 1)}</span><div><span class="eyebrow">${CHAPTER(state.step).title}</span><h3>${t ? t.title : 'Home, at last'}</h3><p>${t ? t.dialogue : 'The house is yours. Now you can simply enjoy being here.'}</p></div></div>${t ? `<h3>Your next exchange with ${NPCS.find((n) => n.id === t.npc).name}</h3><div class="needs-list">${[...new Set(t.needs)].map((id) => `<div>${itemHtml(id, t.needs.filter((a) => a === id).length)}<span>${quantity(state, id)} in pockets</span></div>`).join('')}</div>` : ''}<div class="side-note"><b>A little kindness on the side</b><p>${state.sidequests.includes('glass') ? '✓ Pearl made you a sea-silk scarf.' : 'Pearl can turn four pieces of sea glass into a scarf the colour of the ocean.'}</p><p>Keep an eye out for Orin’s 12 postcards. Tiny stories travel a long way.</p></div>`;
    actionRow([
      [
        'Show me the way',
        () => {
          closeModal();
          hint();
        },
        'primary',
      ],
    ]);
  }
  if (tab === 'history') {
    page.innerHTML = state.step
      ? `<div class="trade-history">${TRADES.slice(0, state.step)
          .reverse()
          .map(
            (t) =>
              `<article><span class="history-number">${String(t.id + 1).padStart(2, '0')}</span><div><h3>${t.title}</h3><p>${NPCS.find((n) => n.id === t.npc).name} · ${t.needs.map(iconOf).join(' ')} → ${t.gives.map(iconOf).join(' ') || '🏡'}</p></div><span class="check">✓</span></article>`,
          )
          .join('')}</div>`
      : '<p class="empty-note">Every adventure has a first page. Mara is waiting by the harbour.</p>';
  }
  if (tab === 'notes') {
    page.innerHTML = `<p class="muted">${state.notes.length} of 12 little memories found${state.notes.length === 12 ? ' · Memory Keeper' : ''}</p><div class="postcards">${NOTES.map((n) => `<article class="${state.notes.includes(n.id) ? 'found' : ''}">${state.notes.includes(n.id) ? n.text : '✉ A story still waiting to be found.'}</article>`).join('')}</div>`;
  }
  if (tab === 'trunk') {
    page.innerHTML = `<p class="muted">Safe keeping, wherever you wander. Stored items must be put back in your pockets before trading.</p><h3>In your pockets · ${state.inventory.length}/6</h3><div class="trunk-items" id="bag-items"></div><h3>In your travel trunk</h3><div class="trunk-items" id="stored-items"></div>`;
    for (const a of state.inventory) {
      const b = button('', () => {
        storeItem(state, a.id);
        changed();
        journal('trunk');
      });
      b.innerHTML = `${itemHtml(a.id, a.qty)}<small>Store ↓</small>`;
      $('#bag-items').append(b);
    }
    for (const a of state.storage) {
      const b = button('', () => {
        if (!retrieveItem(state, a.id)) {
          sound.fail();
          toast('All six pockets are full. Store something first.', true);
          return;
        }
        changed();
        journal('trunk');
      });
      b.innerHTML = `${itemHtml(a.id, a.qty)}<small>Retrieve ↑</small>`;
      $('#stored-items').append(b);
    }
    if (!state.storage.length)
      $('#stored-items').innerHTML =
        '<p class="empty-note">Nothing here yet. Room for future possibilities.</p>';
  }
}
function mapView() {
  modal(
    `<div class="eyebrow">SOMEWHERE GOOD TO GET LOST</div><h2>Northlight Isle</h2><p class="muted map-help">Choose a neighbour to point your compass their way. The gold dot is your next trade.</p><div class="map-layout"><div id="large-map"></div><div class="map-neighbours" id="map-neighbours"></div></div><div class="map-legend"><span>● You</span><span>◆ Next trade</span><span>♫ Wind chimes</span><span>✉ Postcards</span></div>`,
    true,
  );
  const people = NPCS.map((n) => ({
    ...n,
    x: world.npcPosition(n.id).x,
    z: world.npcPosition(n.id).z,
    role: world.cycle.night ? 'Sleeping until morning' : n.role,
  }));
  const outline = (inset) =>
    coastOutline(inset)
      .map((p) => `${p.x + 125},${p.z + 112}`)
      .join(' ');
  const x = (v) => v + 125,
    z = (v) => v + 112,
    t = currentTrade();
  const paths = world.paths
    .map(
      (p) =>
        `<polyline points="${p.map((a) => `${x(a[0])},${z(a[1])}`).join(' ')}" fill="none" stroke="#c0b389" stroke-width="3" stroke-linejoin="round"/>`,
    )
    .join('');
  $('#large-map').innerHTML =
    `<svg class="island-map" viewBox="-15 -15 280 255" role="img" aria-label="Map of Northlight Isle. You are shown in red. The next trade is gold."><rect x="-15" y="-15" width="280" height="255" fill="#86b5b4"/><polygon points="${outline(0)}" fill="#d3c7a5"/><polygon points="${outline(9)}" fill="#9fae86"/>${paths}${DISTRICTS.map((d) => `<text x="${x(d.x)}" y="${z(d.z) - 10}" text-anchor="middle" class="map-region">${d.short.toUpperCase()}</text>`).join('')}${NOTES.filter(
      (n) => !state.notes.includes(n.id),
    )
      .map((n) => `<text x="${x(n.x)}" y="${z(n.z)}" class="map-note">✉</text>`)
      .join(
        '',
      )}${CHIMES.map((c) => `<text x="${x(c.x)}" y="${z(c.z)}" class="map-chime">♫</text>`).join('')}${people.map((n) => `<g data-npc="${n.id}" role="button" tabindex="0" aria-label="Track ${n.name}"><circle cx="${x(n.x)}" cy="${z(n.z)}" r="${n.id === t?.npc ? 3.4 : 2.3}" fill="${n.id === t?.npc ? '#f9d078' : '#426467'}" stroke="#f1e4bd" stroke-width=".8"/><title>${n.name} — ${n.role}</title></g>`).join('')}<circle cx="${x(state.x)}" cy="${z(state.z)}" r="3" fill="#b84e40" stroke="white" stroke-width="1"/><text x="225" y="20" class="map-north">N ↑</text></svg>`;
  const track = (n) => {
    tracked = n;
    closeModal();
    toast(`Your compass now points to ${n.name}.`);
  };
  people.forEach((n) => {
    const b = button(
      '',
      () => track(n),
      'map-person' + (n.id === t?.npc ? ' current' : ''),
    );
    b.innerHTML = `<span class="person-dot" style="background:#${n.color.toString(16)}"></span><span>${n.name}<small>${n.role}</small></span>${n.id === t?.npc ? '<b>◆</b>' : ''}`;
    $('#map-neighbours').append(b);
  });
  document.querySelectorAll('[data-npc]').forEach((e) => {
    e.onclick = () => track(NPCS.find((n) => n.id === e.dataset.npc));
    e.onkeydown = (ev) => {
      if (ev.key === 'Enter') e.onclick();
    };
  });
}
function exportSave() {
  persist();
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `narnar-adventure-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your adventure, packed into a little save file.');
}
function settings() {
  modal(
    `<div class="eyebrow">TAKE A LITTLE BREATHER</div><h2>${started ? 'The island can wait.' : 'Make yourself at home.'}</h2><div class="settings-list"><label><span>Island sounds<small>Waves, footsteps, voices & little celebrations</small></span><input type="checkbox" id="setting-sound" ${state.settings.sound ? 'checked' : ''}></label><label><span>Gentle music<small>A quiet melody to wander to</small></span><input type="checkbox" id="setting-music" ${state.settings.music ? 'checked' : ''}></label><label><span>Volume</span><input type="range" min="0" max="1" step=".05" value="${state.settings.volume}" id="setting-volume" aria-label="Volume"></label><label><span>Less motion<small>Steady story cameras and instant dialogue</small></span><input type="checkbox" id="setting-motion" ${state.settings.reducedMotion ? 'checked' : ''}></label></div><div class="save-tools"><button id="manual-save" class="secondary">Save progress</button><button id="export-save" class="secondary">Download save</button><button id="import-save" class="secondary">Load save file</button></div><p class="muted small">Autosaves stay in this browser. Download a save to keep a backup or continue on another device. ${Math.floor(state.playtime / 60)} minutes played · ${state.step} trades made.</p><div class="menu-bottom"><button id="controls-help" class="text-button">How to play ↗</button><button id="new-game" class="text-button danger">Start a new adventure</button></div>`,
  );
  for (const [id, key] of [
    ['sound', 'sound'],
    ['music', 'music'],
    ['motion', 'reducedMotion'],
  ])
    $('#setting-' + id).onchange = (e) => {
      state.settings[key] = e.target.checked;
      sound.apply();
      persist();
      updateSoundIcon();
    };
  $('#setting-volume').oninput = (e) => {
    state.settings.volume = Number(e.target.value);
    sound.apply();
    persist();
  };
  $('#manual-save').onclick = () => persist(true);
  $('#export-save').onclick = exportSave;
  $('#import-save').onclick = () => $('#import-file').click();
  $('#controls-help').onclick = () => help();
  $('#new-game').onclick = () => {
    modal(
      '<div class="eyebrow">A FRESH LITTLE BEGINNING</div><h2>Start from the pomegranate?</h2><p>This replaces the adventure saved in this browser. Download your current save first if you would like to keep it.</p>',
    );
    actionRow([
      ['Download current save', exportSave],
      ['Keep this adventure', settings, 'primary'],
      [
        'Start new adventure',
        () => {
          state = initialState();
          world.state = state;
          sound.settings = state.settings;
          tracked = null;
          lastDreamDay = -1;
          dreamUntil = 0;
          world.sync();
          closeModal();
          begin();
        },
      ],
    ]);
  };
  actionRow([
    [
      started ? 'Back to the island' : 'Ready when you are',
      closeModal,
      'primary',
    ],
  ]);
}
function updateSoundIcon() {
  $('#sound-btn').textContent = state.settings.sound ? '♫' : '♪';
  $('#sound-btn').classList.toggle('muted-sound', !state.settings.sound);
  $('#sound-btn').setAttribute(
    'aria-label',
    state.settings.sound ? 'Mute sound' : 'Enable sound',
  );
}
$('#import-file').onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 100000) throw Error();
    const s = JSON.parse(await file.text());
    if (!validSave(s)) throw Error();
    modal(
      `<div class="eyebrow">AN ADVENTURE IN A FILE</div><h2>Continue this little story?</h2><p>The save contains ${s.step} trades and ${Math.floor(s.playtime / 60)} minutes of wandering. Loading it replaces your current browser save.</p>`,
    );
    actionRow([
      ['Download current save', exportSave],
      [
        'Load this adventure',
        () => {
          state = s;
          if (!walkable(state.x, state.z)) {
            state.x = -33;
            state.z = 62;
          }
          world.state = state;
          sound.settings = state.settings;
          tracked = null;
          lastDreamDay = -1;
          dreamUntil = 0;
          closeModal();
          begin();
          sound.apply();
          updateSoundIcon();
          toast('Welcome back, little traveller.');
        },
        'primary',
      ],
      ['Keep current adventure', settings],
    ]);
  } catch {
    toast(
      'That file is not a valid NarNar save. Your adventure is unchanged.',
      true,
    );
  }
};
try {
  world = new World($('#world'), state, () => {
    persist();
    modal(
      '<h2>The island needs a moment.</h2><p>Your graphics connection was interrupted. Your progress is saved; reload the page to return.</p>',
    );
    actionRow([
      ['Reload island', () => location.reload(), 'primary'],
      ['Download save', exportSave],
    ]);
  });
} catch (error) {
  $('#start-screen').innerHTML =
    '<div class="start-card"><h2>The island needs WebGL.</h2><p>Try a current Chrome, Edge, Firefox, or Safari browser with hardware acceleration enabled, then reload.</p><button class="primary" onclick="location.reload()">Try again</button></div>';
  console.error(error);
  throw error;
}
$('#begin-btn').onclick = begin;
$('#start-options').onclick = settings;
$('#journal-btn').onclick = () => journal();
$('#map-btn').onclick = mapView;
$('#minimap-btn').onclick = mapView;
$('#compass').onclick = mapView;
$('#settings-btn').onclick = settings;
$('#hint-btn').onclick = hint;
$('#interact-btn').onclick = interact;
$('#touch-action').onclick = interact;
$('#sound-btn').onclick = () => {
  state.settings.sound = !state.settings.sound;
  sound.start().catch(() => {});
  sound.apply();
  updateSoundIcon();
  persist();
};
$('#skip-scene').onclick = finishScene;
$('#next-shot').onclick = () => {
  if (sceneTime >= scene.shots.length * 8 - 8) finishScene();
  else sceneTime = (Math.floor(sceneTime / 8) + 1) * 8;
};
$('#dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});
$('#world').addEventListener('pointerdown', (e) => {
  if (started && !scene && !$('#dialog').open)
    world.clickPoint(e.clientX, e.clientY);
});
addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (
    ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) &&
    (!$('#dialog').open || fishGame)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (scene) {
    if (key === 'escape') finishScene();
    else if (key === ' ' || key === 'enter') $('#next-shot').click();
    return;
  }
  if ($('#dialog').open) {
    if (fishGame && (key === 'e' || key === ' ')) {
      reel();
      e.preventDefault();
    }
    return;
  }
  if (!started) {
    if (key === 'enter') begin();
    return;
  }
  if (key === 'e') interact();
  else if (key === 'j') journal();
  else if (key === 'm') mapView();
  else if (key === 'escape') settings();
  else if (key === 'h') hint();
  else if (/^[1-6]$/.test(key))
    state.inventory[Number(key) - 1] &&
      itemDetail(state.inventory[Number(key) - 1].id);
  else keys.add(key);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => {
  keys.clear();
  if (started) persist();
});
document.addEventListener('visibilitychange', () => {
  keys.clear();
  if (document.hidden) {
    if (started) persist();
    sound.suspend();
  } else {
    last = performance.now();
    sound.resume();
  }
});
addEventListener('pagehide', () => {
  if (started) persist();
});
addEventListener('resize', () => world.resize());
for (const b of document.querySelectorAll('[data-key]')) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.key);
}
function minimap() {
  const c = $('#minimap'),
    ctx = c.getContext('2d'),
    w = c.width,
    h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#d9cbab';
  ctx.beginPath();
  coastOutline(0).forEach((p, i) =>
    ctx[i ? 'lineTo' : 'moveTo'](w / 2 + p.x * 0.5, h / 2 + p.z * 0.5),
  );
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a5b28c';
  ctx.beginPath();
  coastOutline(9).forEach((p, i) =>
    ctx[i ? 'lineTo' : 'moveTo'](w / 2 + p.x * 0.5, h / 2 + p.z * 0.5),
  );
  ctx.closePath();
  ctx.fill();
  const pos = (x, z) => [w / 2 + x * 0.5, h / 2 + z * 0.5];
  ctx.strokeStyle = '#d4c7a0';
  ctx.lineWidth = 2;
  for (const p of world.paths) {
    ctx.beginPath();
    p.forEach(([x, z], i) => ctx[i ? 'lineTo' : 'moveTo'](...pos(x, z)));
    ctx.stroke();
  }
  for (const n of NPCS) {
    ctx.beginPath();
    ctx.fillStyle = world.cycle.night
      ? '#989782'
      : n.id === currentTrade()?.npc
        ? '#f8d38a'
        : '#55736b';
    ctx.arc(
      ...pos(world.npcPosition(n.id).x, world.npcPosition(n.id).z),
      n.id === currentTrade()?.npc ? 3.4 : 1.7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = '#b65043';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(...pos(state.x, state.z), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#496767';
  ctx.font = '9px sans-serif';
  ctx.fillText('N', w / 2 - 3, 8);
}
function updateHud() {
  const region = DISTRICTS.reduce((a, b) =>
    Math.hypot(a.x - state.x, a.z - state.z) <
    Math.hypot(b.x - state.x, b.z - state.z)
      ? a
      : b,
  );
  if (currentRegion !== region.name) {
    currentRegion = region.name;
    $('#region').textContent = region.name;
  }
  const cycle = world.cycle;
  $('#time-of-day').textContent = `${cycle.label} · ${cycle.clock}`;
  if (lastAvailability !== cycle.available) {
    lastAvailability = cycle.available;
    renderQuest();
  }
  if (!cycle.available && !state.retired)
    $('#quest-detail').textContent = cycle.night
      ? 'Neighbours are sleeping. Gather, fish, and explore until morning.'
      : 'Neighbours are heading home or waking up. Take a little wander.';
  const n = tracked || NPCS.find((n) => n.id === currentTrade()?.npc);
  $('#compass').classList.toggle('hidden', !n || !started);
  if (n) {
    const target = world.npcMeshes.has(n.id) ? world.npcPosition(n.id) : n;
    const dx = target.x - state.x,
      dz = target.z - state.z,
      angle =
        (Math.atan2((dx + dz) * 0.707, (dx - dz) * 0.707) * 180) / Math.PI;
    $('#direction').style.transform = `rotate(${angle}deg)`;
    $('#destination-label').innerHTML =
      `${n.name || nameOf(n.type)}<small>${world.npcMeshes.has(n.id) && cycle.night ? 'Sleeping until morning' : Math.round(Math.hypot(dx, dz)) + ' steps away'}</small>`;
  }
  nearest = !scene && !$('#dialog').open && started ? world.nearest() : null;
  $('#nearby').classList.toggle('hidden', !nearest);
  if (nearest) {
    $('#nearby-label').textContent =
      nearest.type === 'npc'
        ? nearest.name
        : nearest.type === 'resource'
          ? nameOf(nearest.resource)
          : nearest.type === 'note'
            ? 'A keeper’s postcard'
            : nearest.name;
    $('#interact-btn span').textContent =
      nearest.type === 'npc'
        ? 'Talk'
        : nearest.type === 'fishing'
          ? 'Fish'
          : nearest.type === 'chime'
            ? 'Play'
            : 'Pick up';
  }
  minimap();
}
function updateThought(paused) {
  const bubble = $('#thought-bubble'),
    cycle = world.cycle;
  if (!paused && cycle.night && lastDreamDay !== cycle.day) {
    lastDreamDay = cycle.day;
    dreamUntil = world.time + 11;
    bubble.textContent = state.retired
      ? 'A warm window of my own. I still can’t quite believe it.'
      : 'One day, I’ll have a little home too… with a warm window waiting for me.';
  }
  const visible = !paused && cycle.night && world.time < dreamUntil;
  bubble.classList.toggle('hidden', !visible);
  if (visible) {
    const p = world.project(state.x, ground(state.x, state.z) + 4.1, state.z);
    bubble.style.left = `${Math.max(140, Math.min(innerWidth - 140, p.x))}px`;
    bubble.style.top = `${p.y}px`;
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) {
    last = now;
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;
  let cine = null;
  if (scene) {
    sceneTime += dt;
    const index = Math.floor(sceneTime / 8);
    if (index >= scene.shots.length) {
      finishScene();
    } else {
      const shot = scene.shots[index];
      cine = {
        ...shot,
        angle:
          shot.angle +
          (state.settings.reducedMotion ? 0 : (sceneTime % 8) * 0.012),
      };
      if (index !== shotIndex) {
        shotIndex = index;
        $('#scene-text').textContent = shot.text;
        $('#scene-text').classList.remove('appear');
        void $('#scene-text').offsetWidth;
        $('#scene-text').classList.add('appear');
        [...$('#scene-dots').children].forEach((e, i) =>
          e.classList.toggle('active', i === index),
        );
        $('#next-shot').innerHTML =
          index === scene.shots.length - 1
            ? 'Back to our story →'
            : 'Continue →';
      }
    }
  } else if (!started) cine = { x: -25, z: 44, y: 2, zoom: 21, angle: 0.78 };
  const paused = !started || !!scene || $('#dialog').open;
  const moving = world.update(dt, keys, paused, cine);
  if (moving) sound.footstep(world.wading, keys.has('shift'));
  updateThought(paused);
  if (started && !paused) state.playtime += dt;
  if (fishGame) {
    fishGame.time += dt;
    fishGame.cooldown = Math.max(0, fishGame.cooldown - dt);
    fishGame.pos =
      (Math.sin(
        fishGame.time * (state.settings.reducedMotion ? 1.35 : 1.8) -
          Math.PI / 2,
      ) +
        1) /
      2;
    $('#fish-float').style.left = `${fishGame.pos * 100}%`;
  }
  sound.update();
  if (started && (saveTimer += dt) > 15) {
    saveTimer = 0;
    persist();
  }
  if ((hudTimer += dt) > 0.12) {
    hudTimer = 0;
    updateHud();
  }
}
renderInventory();
renderQuest();
updateSoundIcon();
requestAnimationFrame(frame);
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  for (const tool of [
    {
      name: 'read_narnar_progress',
      description:
        'Read current NarNar progress, pockets, storage, and next trade.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        trades: state.step,
        retired: state.retired,
        inventory: state.inventory,
        storage: state.storage,
        nextTrade: currentTrade()?.title,
        minutes: Math.floor(state.playtime / 60),
      }),
    },
    {
      name: 'save_narnar_progress',
      description:
        'Save the current NarNar adventure in this browser using the visible save action.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: () => ({ saved: persist(true), trades: state.step }),
    },
  ])
    try {
      Promise.resolve(
        document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
