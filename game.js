/* Browser shell: input, presentation and optional audio. The engine owns gameplay. */
(() => {
  'use strict';
  const S = window.Smash, $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  if (!S || !ctx) { $('overlayTitle').textContent = 'Unable to start'; $('overlayCopy').textContent = 'Canvas 2D and JavaScript are required.'; return; }
  const COLORS = ['#65cfff', '#ff8a79'];
  const MAT = { fire: '#ff9d64', water: '#60c7ee', spark: '#f3df85', oil: '#ab92df', steam: '#acd7d9', charged: '#f3df85' };
  const RULES = {
    duel: ['The fundamentals. Fast movement, deliberate attacks, no stage hazards.', 'PURE PLATFORM COMBAT'],
    flow: ['Carry your speed. Slides, slide jumps and one wall kick per airtime extend the core.', 'MOMENTUM IS YOUR ADVANTAGE'],
    alchemy: ['Flow movement meets surface chemistry. Create routes, chain reactions, take risks.', 'SMALL REACTIONS. BIG POSSIBILITIES.']
  };
  const HINTS = [
    'Try a short hop: tap jump, then release before takeoff. Hold it for a full jump.',
    'Wavedash: jump, then shield + diagonally down. Land with momentum, not another dash button.',
    'Defend with direction: during hit freeze, hold a direction to alter your launch angle.',
    'Landing an aerial? Tap shield within 7 frames before touching down to halve landing lag.',
    'Grabs beat shields. Move + attack tilts; hold T to charge a stronger, more punishable smash.',
    'Offstage: keep your air jump. Up + special climbs; side + special bursts. Air recovery ends helpless.',
    'Fast fall after the apex. Aerial movement keeps your facing, so attacking backward gives a back air.',
    'Tech a hard landing with a timely shield press. Add a direction to roll out.'
  ];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('smash-lab-v2') || '{}'); } catch (_) { /* Storage can be disabled. */ }
  let opts = S.settings(saved), world = S.createGame(opts), clock = new S.FixedClock();
  let demo = null;
  let started = false, paused = true, speed = 1, hitboxes = false, sound = false, dirty = true, draws = 0;
  let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => { reducedMotion = e.matches; });
  let lastTime = 0, lastPerf = 0, fps = 60, feedbackUntil = 0, hudTick = -1, audio = null, voices = 0;
  let view = { x: 480, y: 265, scale: 1 }, shake = 0, particles = [], rings = [], trail = [[], []];
  const padSlots = [null, null], padStickMode = [null, null];
  const held = new Set(), latched = new Set(), touch = new Map(), touchLatched = new Set();
  const maps = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['KeyW', 'Space'],
      attack: ['KeyF', 'KeyJ'], smash: ['KeyT', 'KeyI'], shield: ['KeyG', 'KeyL'], special: ['KeyR', 'KeyK'],
      grab: ['KeyE', 'KeyH'], slide: ['KeyC'], cycle: ['KeyV'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['ArrowUp'],
      attack: ['Slash', 'SlashCharacter'], smash: ['Semicolon', 'Numpad1'], shield: ['ShiftRight'], special: ['Period', 'Numpad2'],
      grab: ['Comma', 'Numpad3'], slide: ['ControlRight'], cycle: ['Numpad0'] }
  ];
  const mappedCodes = new Set(maps.flatMap(m => Object.values(m).flat()));
  const editable = e => e.target instanceof Element && !!e.target.closest('input,select,textarea,[contenteditable=true]');
  const clearInput = () => { held.clear(); latched.clear(); touch.clear(); touchLatched.clear(); document.querySelectorAll('[data-touch]').forEach(b => b.classList.remove('held')); };
  function getPads() {
    // Keep slot identity: disconnecting Blue must never hand Red's controller to Blue.
    try {
      const all=Array.from(navigator.getGamepads?.() || []);
      const standard=all.map((pad,index)=>({pad,index})).filter(({pad})=>pad?.connected && pad.mapping==='standard');
      for(const {pad,index} of standard) {
        if(padSlots.some(slot=>slot?.index===index && slot.id===(pad.id||'')))continue;
        const free=padSlots.findIndex(slot=>slot===null || !all[slot.index]?.connected || (all[slot.index].id||'')!==slot.id);
        if(free>=0) {padSlots[free]={index,id:pad.id||''};padStickMode[free]=null;}
      }
      return padSlots.map(slot=>slot && all[slot.index]?.connected && all[slot.index].mapping==='standard' && (all[slot.index].id||'')===slot.id ? all[slot.index] : null);
    } catch (_) { return [null,null]; }
  }
  function readInputs() {
    const pads = getPads();
    const inputs = maps.map((mapping, index) => {
      const touched = action => index === 0 && ([...touch.values()].includes(action) || touchLatched.has(action));
      const pressed = action => touched(action) || mapping[action].some(code => held.has(code) || latched.has(code));
      const out = { x: Number(pressed('right')) - Number(pressed('left')), y: Number(pressed('down')) - Number(pressed('up')) };
      for (const action of ['jump', 'attack', 'smash', 'shield', 'special', 'grab', 'slide', 'cycle']) out[action] = pressed(action);
      const pad = pads[index];
      if (pad) {
        const button = i => !!pad.buttons[i]?.pressed;
        const x = Math.abs(pad.axes[0] || 0) > .18 ? pad.axes[0] : 0;
        const y = Math.abs(pad.axes[1] || 0) > .18 ? pad.axes[1] : 0;
        if (x) out.x = x; if (y) out.y = y;
        out.jump ||= button(0); out.attack ||= button(2); out.special ||= button(1); out.grab ||= button(3);
        out.smash ||= button(5); out.shield ||= button(6) || button(7); out.slide ||= button(4); out.cycle ||= button(15);
        const rx=pad.axes[2]||0, ry=pad.axes[3]||0, stick=Math.hypot(rx,ry)>.55;
        if(!stick)padStickMode[index]=null;
        else {
          padStickMode[index] ||= world.fighters[index].onGround ? 'smash' : 'attack';
          out[padStickMode[index]]=true;out.aimX=rx;out.aimY=ry;out.quickSmash=true;
        }
      }
      return S.input(out);
    });
    return inputs;
  }
  function notify(text, milliseconds = 1250) {
    dirty = true; $('feedback').textContent = text; feedbackUntil = performance.now() + milliseconds;
    $('feedback').classList.add('visible');
  }
  function tone(type) {
    if (!sound || !audio || voices >= 8) return;
    const pitches = { hit: [160, 48, .11], parry: [900, 1400, .12], ko: [180, 34, .35], tech: [440, 760, .08], shot: [450, 160, .06], burst: [120, 35, .22] };
    const p = pitches[type]; if (!p) return;
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.type = type === 'parry' || type === 'tech' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(p[0], now); osc.frequency.exponentialRampToValueAtTime(p[1], now + p[2]);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.07, now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + p[2]);
    osc.connect(gain); gain.connect(audio.destination); voices++;
    osc.onended = () => { voices--; osc.disconnect(); gain.disconnect(); };
    osc.start(now); osc.stop(now + p[2] + .02);
  }
  function visualHash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function consumeEvents() {
    for (const e of world.events) {
      tone(e.type);
      if (['tech', 'parry', 'reaction', 'break', 'burst'].includes(e.type)) notify(`${e.id >= 0 ? world.fighters[e.id].name + ' · ' : ''}${e.text}`);
      if (e.type === 'confirm' && e.text.includes('COMBO')) notify(e.text);
      if (['hit', 'ko', 'burst', 'parry', 'tech', 'land'].includes(e.type)) {
        const color = e.type === 'parry' || e.type === 'tech' ? '#a5f4d5' : COLORS[e.id] || '#ffe4ad';
        if (rings.length < 24) rings.push({ x: e.x, y: e.y + 24, radius: e.type === 'ko' ? 30 : 8, age: 0, color, big: e.type === 'ko' || e.type === 'burst' });
        if (!reducedMotion) {
          const count = e.type === 'ko' ? 25 : e.type === 'hit' || e.type === 'burst' ? 12 : 5;
          for (let n = 0; n < count && particles.length < 160; n++) {
            const r = visualHash(world.tick * 631 + n * 17 + (e.id + 1) * 119), a = r * Math.PI * 2;
            particles.push({ x: e.x, y: e.y + 25, vx: Math.cos(a) * (80 + r * 200), vy: Math.sin(a) * (80 + r * 160), age: 0, life: .22 + r * .25, color });
          }
          if (['hit', 'ko', 'burst'].includes(e.type)) shake = Math.max(shake, e.type === 'ko' ? 9 : 4);
        }
      }
    }
  }
  function tick() {
    if (world.winner !== null) return;
    const liveInputs = readInputs();
    if (demo && liveInputs.some(i => i.x || i.y || i.jump || i.attack || i.smash || i.special || i.shield || i.grab || i.slide)) demo = null;
    const inputs = demo ? [demoInput(), S.input()] : liveInputs; latched.clear(); touchLatched.clear(); S.step(world, inputs); consumeEvents();
    for (const f of world.fighters) {
      trail[f.id].push({ x: f.x, y: f.y, speed: Math.abs(f.vx) });
      if (trail[f.id].length > 7) trail[f.id].shift();
    }
    if (demo && ++demo.age >= 110) { demo = null; setPaused(true); $('overlay').hidden = true; notify('DEMO COMPLETE · PAUSED FOR INSPECTION', 2200); }
    if (world.winner !== null) endMatch();
  }
  function updateHUD(force = false) {
    if (!force && hudTick === Math.floor(world.tick / 5)) return;
    hudTick = Math.floor(world.tick / 5);
    for (const f of world.fighters) {
      const id = f.id ? 'red' : 'blue';
      $(id + 'Damage').innerHTML = `${Math.round(f.damage)}<span>%</span>`;
      $(id + 'State').textContent = f.respawn ? 'respawn' : f.helpless ? 'helpless' : f.attack?.kind || f.state;
      $(id + 'Shield').style.width = `${f.shieldHP}%`;
      $(id + 'Stocks').innerHTML = Array.from({ length: world.options.stocks }, (_, i) => `<i class="stock${i >= f.stocks ? ' lost' : ''}"></i>`).join('');
      $(id + 'Stocks').setAttribute('aria-label', `${f.name}: ${f.stocks} stocks`);
      if (document.activeElement !== $(id + 'Element')) $(id + 'Element').value = f.element;
    }
    const f = world.fighters[0];
    const remainingSeconds = Math.ceil(world.time / 60);
    $('clockLabel').textContent = world.options.opponent === 'training' ? '∞' : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
    $('stateReadout').textContent = f.hitlag ? `hit freeze · ${f.hitlag}f` : f.hitstun ? `hitstun · ${f.hitstun}f` : `${f.attack?.kind || f.state}${f.timer ? ' · ' + f.timer + 'f' : ''}`;
    $('velocityReadout').textContent = `${f.vx.toFixed(1)} / ${f.vy.toFixed(1)}`;
    $('comboReadout').textContent = f.stats.maxCombo ? `${f.stats.maxCombo} hit${f.stats.maxCombo === 1 ? '' : 's'}` : '—';
    $('frameReadout').textContent = String(world.tick).padStart(5, '0');
    $('blueRole').textContent = 'YOU'; $('redRole').textContent = { cpu: 'CPU', local: 'PLAYER 2', training: 'DUMMY' }[opts.opponent];
    const count=getPads().filter(Boolean).length;
    $('inputStatus').textContent = count ? `${count} STANDARD PAD${count === 1 ? '' : 'S'} CONNECTED` : 'KEYBOARD READY';
    $('practiceHint').textContent = HINTS[Math.floor(world.tick / 1200) % HINTS.length];
  }
  function syncSettings() {
    for (const id of ['opponent', 'stage', 'seed', 'buffer']) $(id).value = opts[id];
    for (const id of ['autoCancel', 'turbo']) $(id).checked = opts[id];
    document.querySelectorAll('[data-rules]').forEach(b => { const active = b.dataset.rules === opts.rules; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    $('rulesDescription').textContent = RULES[opts.rules][0]; $('ruleCaption').textContent = RULES[opts.rules][1];
    $('matchLabel').textContent = opts.rules.toUpperCase() + (opts.turbo ? ' + TURBO' : '');
    $('stageLabel').textContent = opts.stage === 'triad' ? 'TRIAD' : 'FLATLINE';
    $('trainingTools').hidden = opts.opponent !== 'training'; $('chemistryPanel').hidden = opts.rules !== 'alchemy';
    $('seedMaterialsBtn').disabled = opts.opponent !== 'training'; $('paintHint').hidden = opts.opponent !== 'training';
    $('stepBtn').disabled = opts.opponent !== 'training';
  }
  function reset({ begin = started, opponent = opts.opponent } = {}) {
    demo = null; dirty = true; opts = S.settings({ ...opts, opponent }); world = S.createGame(opts); clock.reset(); clearInput();
    particles = []; rings = []; trail = [[], []]; shake = 0; feedbackUntil = 0; hudTick = -1;
    $('feedback').classList.remove('visible'); $('dummyDamage').value = 0; $('dummyValue').textContent = '0%';
    started = begin; paused = !begin; view = { x: 480, y: 265, scale: 1 };
    $('overlay').hidden = begin; $('pauseBtn').textContent = begin ? 'Ⅱ' : '▶';
    $('pauseBtn').setAttribute('aria-label', begin ? 'Pause match' : 'Resume match');
    syncSettings(); updateHUD(true);
    try { localStorage.setItem('smash-lab-v2', JSON.stringify(opts)); } catch (_) { /* Offline/private mode is supported. */ }
    if (begin) canvas.focus({ preventScroll: true }); else showIntro();
  }
  function showIntro() {
    $('overlayEyebrow').textContent = 'A PLATFORM FIGHTER. A MOVEMENT PLAYGROUND.';
    $('overlayTitle').textContent = 'Own the space.';
    $('overlayCopy').innerHTML = 'Build momentum. Find an opening.<br>Send your rival beyond the edge.';
    $('startBtn').innerHTML = 'Play vs CPU <span>↗</span>';
    $('localBtn').textContent = 'Two players'; $('trainingBtn').textContent = 'Training lab';
    $('localBtn').hidden = $('trainingBtn').hidden = false;
  }
  function setPaused(value) {
    if (!started || world.winner !== null) return;
    dirty = true; paused = value; clearInput(); clock.reset();
    $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ'; $('pauseBtn').setAttribute('aria-label', paused ? 'Resume match' : 'Pause match');
    $('overlay').hidden = !paused;
    if (paused) {
      $('overlayEyebrow').textContent = 'TAKE A BREATH.'; $('overlayTitle').textContent = 'Paused.';
      $('overlayCopy').textContent = 'Your match is right where you left it.';
      $('startBtn').innerHTML = 'Resume <span>↗</span>'; $('localBtn').textContent = 'Restart'; $('trainingBtn').hidden = true;
    } else canvas.focus({ preventScroll: true });
  }
  function endMatch() {
    dirty = true; paused = true; clearInput();
    $('overlay').hidden = false; $('overlayEyebrow').textContent = 'THAT’S THE ROUND.';
    $('overlayTitle').textContent = world.winner === 'draw' ? 'A dead heat.' : `${world.fighters[world.winner].name} takes it.`;
    const best = Math.max(...world.fighters.map(f => f.stats.maxCombo));
    $('overlayCopy').textContent = `${world.tick} frames played${best ? ' · Best combo: ' + best + ' hits' : ''}. Ready for the runback?`;
    $('startBtn').innerHTML = 'Run it back <span>↗</span>'; $('localBtn').textContent = 'Two players'; $('trainingBtn').textContent = 'Training lab';
    $('localBtn').hidden = $('trainingBtn').hidden = false; updateHUD(true);
  }
  $('startBtn').addEventListener('click', () => {
    if (!started) reset({ begin: true, opponent: 'cpu' });
    else if (world.winner !== null) reset({ begin: true }); else setPaused(false);
  });
  $('localBtn').addEventListener('click', () => reset({ begin: true, opponent: started && paused && world.winner === null ? opts.opponent : 'local' }));
  $('trainingBtn').addEventListener('click', () => reset({ begin: true, opponent: 'training' }));
  $('pauseBtn').addEventListener('click', () => started ? setPaused(!paused) : reset({ begin: true }));
  $('resetBtn').addEventListener('click', () => reset({ begin: true }));
  document.querySelectorAll('[data-rules]').forEach(b => b.addEventListener('click', () => { opts.rules = b.dataset.rules; reset(); }));
  for (const id of ['opponent', 'stage', 'seed', 'buffer', 'autoCancel', 'turbo']) $(id).addEventListener('change', () => {
    opts[id] = ['autoCancel', 'turbo'].includes(id) ? $(id).checked : ['seed', 'buffer'].includes(id) ? Number($(id).value) : $(id).value;
    reset();
  });
  $('hitboxes').addEventListener('change', () => { hitboxes = $('hitboxes').checked; dirty = true; });
  $('speed').addEventListener('change', () => { speed = Number($('speed').value); clock.reset(); });
  $('helpBtn').addEventListener('click', () => { $('controlsHelp').open = !$('controlsHelp').open; $('helpBtn').setAttribute('aria-expanded', String($('controlsHelp').open)); });
  $('controlsHelp').addEventListener('toggle', () => $('helpBtn').setAttribute('aria-expanded', String($('controlsHelp').open)));
  $('soundBtn').addEventListener('click', async () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') await audio.resume();
      sound = !sound; $('soundBtn').textContent = sound ? 'Sound on' : 'Sound off'; $('soundBtn').setAttribute('aria-pressed', String(sound));
      if (sound) tone('tech');
    } catch (_) { notify('Audio is unavailable in this browser.'); }
  });
  $('fullscreenBtn').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('arenaPanel').requestFullscreen(); }
    catch (_) { notify('Fullscreen is unavailable. The arena still scales to your window.'); }
  });
  function stepFrame() {
    if (opts.opponent !== 'training') return;
    if (!started) reset({ begin: true, opponent: 'training' });
    if (!paused) setPaused(true);
    $('overlay').hidden = true; tick(); dirty = true; updateHUD(true);
  }
  $('stepBtn').addEventListener('click', stepFrame);
  $('resetPositionsBtn').addEventListener('click', () => {
    const wasPaused = paused; reset({ begin: true }); if (wasPaused) { setPaused(true); $('overlay').hidden = true; }
  });
  $('dummyDamage').addEventListener('input', () => { const v = Number($('dummyDamage').value); world.fighters[1].damage = v; $('dummyValue').textContent = `${v}%`; updateHUD(true); });
  for (const [id, index] of [['blueElement', 0], ['redElement', 1]]) $(id).addEventListener('change', () => { world.fighters[index].element = $(id).value; dirty = true; });
  $('seedMaterialsBtn').addEventListener('click', () => {
    if (opts.opponent !== 'training' || opts.rules !== 'alchemy') return;
    world.events = [];
    for (const x of [270, 294, 318]) S.paint(world, 0, x, 'oil');
    for (const x of [558, 582, 606, 630]) S.paint(world, 0, x, 'water');
    S.paint(world, 1, 360, 'fire'); S.paint(world, 1, 360, 'water'); consumeEvents();
    notify('OIL LEFT · WATER RIGHT · STEAM ABOVE', 2200); canvas.focus({ preventScroll: true });
  });
  window.addEventListener('keydown', e => {
    if ((e.target instanceof Element && e.target.closest('button,summary,a') && ['Space', 'Enter'].includes(e.code)) || editable(e) || e.metaKey || e.altKey || (e.ctrlKey && e.code !== 'ControlRight')) return;
    if (e.key === '?' && !e.repeat) { e.preventDefault(); $('helpBtn').click(); return; }
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); setPaused(!paused); return; }
    if (e.code === 'Backspace' && !e.repeat) { e.preventDefault(); reset({ begin: true }); return; }
    if (e.code === 'KeyN' && paused && opts.opponent === 'training' && !e.repeat) { e.preventDefault(); stepFrame(); return; }
    if (e.code === 'Enter' && !e.repeat && (!started || paused)) { e.preventDefault(); $('startBtn').click(); return; }
    const codes = [e.code]; if (e.key === '/') codes.push('SlashCharacter');
    if (codes.some(code => mappedCodes.has(code)) && started && (!paused || (opts.opponent === 'training' && $('overlay').hidden))) {
      e.preventDefault(); demo = null;
      for (const code of codes) { if (!held.has(code) && !e.repeat) latched.add(code); held.add(code); }
    }
  });
  window.addEventListener('keyup', e => { held.delete(e.code); if (e.key === '/' || e.code === 'Digit7' || e.code === 'Slash') held.delete('SlashCharacter'); });
  window.addEventListener('blur', () => { clearInput(); setPaused(true); });
  window.addEventListener('gamepaddisconnected', () => { setPaused(true); hudTick = -1; notify('CONTROLLER DISCONNECTED · MATCH PAUSED', 2000); });
  window.addEventListener('gamepadconnected', () => { hudTick = -1; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); setPaused(true); } lastTime = 0; });
  for (const b of document.querySelectorAll('[data-touch]')) {
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!started || (paused && !(opts.opponent === 'training' && $('overlay').hidden))) return;
      demo = null; b.setPointerCapture(e.pointerId); touch.set(e.pointerId, b.dataset.touch); touchLatched.add(b.dataset.touch); b.classList.add('held');
    });
    const release = e => { touch.delete(e.pointerId); b.classList.remove('held'); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, release);
  }
  canvas.addEventListener('pointerdown', e => {
    canvas.focus({ preventScroll: true });
    if (opts.rules !== 'alchemy' || opts.opponent !== 'training' || !started || e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width * 960 - 480) / view.scale + view.x;
    const y = ((e.clientY - r.top) / r.height * 540 - 270) / view.scale + view.y;
    let nearest = -1, distance = 38;
    world.platforms.forEach((p, i) => { const d = Math.abs(y - p.y); if (x >= p.x && x < p.x + p.w && d < distance) { nearest = i; distance = d; } });
    if (nearest >= 0) { dirty = true; world.events = []; S.paint(world, nearest, x, world.fighters[0].element); consumeEvents(); }
  });
  for (const [kind,info] of Object.entries(S.MOVE_INFO)) {
    const option=document.createElement('option');option.value=kind;option.textContent=info.name;
    $('moveSelect').appendChild(option);
  }
  $('moveSelect').value='vector';
  function updateMoveBook() {
    const kind=$('moveSelect').value, info=S.MOVE_INFO[kind], m=S.MOVES[kind];
    $('moveCommand').textContent=info.command;$('moveTip').textContent=info.tip;
    $('moveTiming').textContent=m?`${m.start} / ${m.active} / ${m.end-m.start-m.active} f`:'6f release · 24f total';
    $('moveTiming').title='Startup / active / recovery frames. Hit freeze extends real elapsed time.';
  }
  $('moveSelect').addEventListener('change',updateMoveBook);updateMoveBook();
  function startDemo(kind) {
    if(!Object.hasOwn(S.MOVE_INFO,kind))return;
    opts.stage='flat';if(kind==='slideKick' && opts.rules==='duel')opts.rules='flow';
    reset({begin:true,opponent:'training'});
    const [f,v]=world.fighters;f.x=390;v.x=435;f.px=f.x;v.px=v.x;
    if(['nair','fair','bair','uair'].includes(kind)) {
      Object.assign(f,{y:270,py:270,onGround:false,state:'air'});
      Object.assign(v,{y:kind==='uair'?224:270,py:270,onGround:false,state:'air'});
      if(kind==='bair')v.x=340;
    }
    if(kind==='dair') {Object.assign(f,{y:285,py:285,onGround:false,state:'air'});v.x=f.x+4;}
    if(kind==='vector'){f.x=330;v.x=458;}
    if(kind==='dashAttack'){f.x=365;v.x=450;}
    if(kind==='slideKick'){f.vx=6;v.x=478;}
    if(kind==='pulse')v.x=555;
    if(kind==='rise'){Object.assign(f,{y:360,py:360,onGround:false,state:'air'});Object.assign(v,{x:f.x+8,y:280,py:280,onGround:false,state:'air'});}
    if(kind==='flux') {
      v.x=630;
      world.projectiles.push({id:world.nextId++,owner:1,x:f.x+118,y:397,px:f.x+118,py:397,vx:-9,vy:0,w:10,h:10,ttl:75,material:'pulse'});
    }
    demo={kind,age:0};$('moveSelect').value=kind;updateMoveBook();
    notify(`DEMO · ${S.MOVE_INFO[kind].name.toUpperCase()}`,1800);updateHUD(true);
  }
  function demoInput() {
    const {kind,age}=demo,f=world.fighters[0],o={};
    if(['jab','jab2','jab3'].includes(kind)) {
      o.attack=age===0 || !!(f.attack && f.attack.age>=S.MOVES[f.attack.kind].chainStart && !f.previous.attack &&
        ((f.attack.kind==='jab'&&kind!=='jab') || (f.attack.kind==='jab2'&&kind==='jab3')));
    } else if(kind==='dashAttack') {o.x=age<5?1:0;o.attack=age===3;}
    else if(kind==='slideKick') {o.x=age<4?1:0;o.slide=age===0;o.attack=age===2;}
    else if(['fsmash','usmash','dsmash'].includes(kind)) {o.smash=age<12;o.y=kind==='usmash'?-1:kind==='dsmash'?1:0;}
    else if(['rise','vector','flux','pulse'].includes(kind)) {o.special=age===0;o.y=age===0?(kind==='rise'?-1:kind==='flux'?1:0):0;o.x=age===0&&kind==='vector'?1:0;}
    else if(kind==='grab'){o.grab=age===0;o.x=age===0?1:0;}
    else {
      o.attack=age===0;
      o.y=age===0?(['up','uair'].includes(kind)?-1:['sweep','dair'].includes(kind)?1:0):0;
      o.x=age===0?(kind==='bair'?-1:['tilt','fair'].includes(kind)?1:0):0;
      if(kind==='dair')o.jump=age>=4&&age<18;
    }
    return S.input(o);
  }
  $('demoMoveBtn').addEventListener('click',()=>startDemo($('moveSelect').value));
  let phaseKey='';
  function updateAttackGuide() {
    const f=world.fighters[0], phase=S.movePhase(f), visible=(opts.opponent==='training'||hitboxes)&&!!f.attack;
    $('attackGuide').hidden=!visible;if(!visible)return;
    const m=S.MOVES[phase.kind],key=`${phase.kind}:${phase.frame}:${f.hitlag}`;if(key===phaseKey)return;phaseKey=key;
    $('attackReadout').textContent=`${S.MOVE_INFO[phase.kind].name.toUpperCase()} · ${f.hitlag?'FREEZE':phase.phase.toUpperCase()} ${phase.frame}f`;
    $('attackMeter').dataset.phase=phase.phase;
    $('attackMeter').innerHTML=`<span class="startup" style="width:${m.start/m.end*100}%"></span><span class="active" style="width:${m.active/m.end*100}%"></span><span class="recovery" style="width:${(m.end-m.start-m.active)/m.end*100}%"></span><i style="left:${phase.frame/m.end*100}%"></i>`;
  }
  function resize() {
    const r = canvas.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * ratio)), h = Math.max(1, Math.round(r.height * ratio));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  }
  new ResizeObserver(resize).observe(canvas); resize();
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circle(x, y, r, fill, stroke = null, width = 1) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function rounded(x, y, w, h, radius, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
  function text(value, x, y, size, color, align = 'left', weight = 500) { ctx.fillStyle = color; ctx.font = `${weight} ${size}px ui-monospace, monospace`; ctx.textAlign = align; ctx.fillText(value, x, y); }
  function background() {
    const sky = ctx.createLinearGradient(0, 0, 0, 540); sky.addColorStop(0, '#102433'); sky.addColorStop(.58, '#172b3b'); sky.addColorStop(1, '#0c1824');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
    const glow = ctx.createRadialGradient(480, 240, 10, 480, 240, 410); glow.addColorStop(0, '#31516455'); glow.addColorStop(1, '#1a354000'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 960, 540);
    for (let x = 0; x <= 960; x += 60) line(x, 0, x, 540, '#7490a00a');
    for (let y = 0; y <= 540; y += 60) line(0, y, 960, y, '#7490a00a');
    ctx.save(); ctx.globalAlpha = .12; circle(480, 264, 215, null, '#86b0c0'); circle(480, 264, 156, null, '#86b0c0');
    line(250, 264, 710, 264, '#86b0c0'); line(480, 34, 480, 494, '#86b0c0'); ctx.restore();
    text('KINETIC TEST FACILITY', 26, 31, 8, '#597e94'); text('SECTOR 0' + (opts.stage === 'triad' ? '1' : '2'), 934, 31, 8, '#597e94', 'right');
    // Far-field silhouettes use a fixed seed and never touch the simulation RNG.
    for (let i = 0; i < 20; i++) { const x = i * 55 - 20, h = 20 + visualHash(i + 78) * 90; ctx.fillStyle = '#0c182349'; ctx.fillRect(x, 505 - h, 42, h + 40); line(x + 5, 506 - h, x + 37, 506 - h, '#608ca419'); }
  }
  function drawStage() {
    world.platforms.forEach((p, index) => {
      ctx.save();
      if (p.solid) {
        const g = ctx.createLinearGradient(0, p.y, 0, p.y + 55); g.addColorStop(0, '#293e4d'); g.addColorStop(1, '#101e2c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.lineTo(p.x + p.w, p.y + 26); ctx.lineTo(p.x + p.w - 34, p.y + 44); ctx.lineTo(p.x + 34, p.y + 44); ctx.lineTo(p.x, p.y + 26); ctx.closePath(); ctx.fill();
        line(p.x, p.y + 6, p.x + p.w, p.y + 6, '#476779');
        for (let x = p.x + 22; x < p.x + p.w - 20; x += 38) line(x, p.y + 13, x + 17, p.y + 31, '#88a9b328', 2);
        rounded(p.x + p.w / 2 - 37, p.y + 17, 74, 13, 3, '#0d1b24');
        text('S M A S H', p.x + p.w / 2, p.y + 26, 7, '#81b9bd', 'center');
        line(p.x + 32, p.y + 44, p.x + p.w - 32, p.y + 44, '#5cc0be44', 2);
      } else {
        rounded(p.x, p.y, p.w, p.h, 3, '#253d4e');
        ctx.fillStyle = '#142737'; ctx.beginPath(); ctx.moveTo(p.x + 15, p.y + p.h); ctx.lineTo(p.x + p.w - 15, p.y + p.h); ctx.lineTo(p.x + p.w - 29, p.y + p.h + 9); ctx.lineTo(p.x + 29, p.y + p.h + 9); ctx.fill();
        line(p.x + 9, p.y + 8, p.x + p.w - 9, p.y + 8, '#5e8b9b44');
      }
      line(p.x + 3, p.y, p.x + p.w - 3, p.y, '#b3e8da', 3);
      for (const x of [p.x + 5, p.x + p.w - 5]) { circle(x, p.y, 3, '#aff1d8'); line(x, p.y - 5, x, p.y - 11, '#aff1d866'); }
      if (hitboxes) { ctx.strokeStyle = p.solid ? '#84e3c6' : '#9eabfb'; ctx.lineWidth = 1; ctx.strokeRect(p.x, p.y, p.w, p.h); text(String(index), p.x + 8, p.y + 13, 8, '#c1e8dd'); }
      ctx.restore();
    });
    for (const c of world.cells) {
      const p = world.platforms[c.platform], x = p.x + c.index * 24, width = Math.min(24, p.x + p.w - x);
      ctx.save(); ctx.globalAlpha = Math.min(1, c.ttl / 30); rounded(x, p.y - 4, width, 6, 2, MAT[c.material]);
      if (c.material === 'steam') {
        for (let k = 0; k < 4; k++) { const phase = ((world.tick * .45 + k * 19) % 75); ctx.globalAlpha = (1 - phase / 80) * .2; circle(x + 12 + Math.sin(k + phase / 15) * 5, p.y - phase, 8 + phase * .1, '#c3eaf0'); }
      }
      if (c.material === 'fire') {
        ctx.fillStyle = '#ffc074'; ctx.globalAlpha = .8;
        for (let k = 0; k < 3; k++) { const h = 9 + Math.sin(world.tick * .2 + k) * 5; ctx.beginPath(); ctx.moveTo(x + k * 8, p.y); ctx.lineTo(x + k * 8 + 4, p.y - h); ctx.lineTo(x + k * 8 + 8, p.y); ctx.fill(); }
      }
      if (c.material === 'charged') line(x, p.y - 7, x + width, p.y - 9 + Math.sin(world.tick) * 3, '#fff6b6', 2);
      ctx.restore();
    }
  }
  function drawFighter(f, fraction = 0) {
    if (!f.stocks || f.respawn) return;
    const A = window.SmashAnimation, pose = A.sample(f, fraction), color = COLORS[f.id];
    const x=f.x, y=f.y, cx=x+16, flip=f.facing;
    // The collision root is authoritative. Only limb keyframes use fractional time.
    if (f.onGround) {ctx.save();ctx.translate(cx,y+57);ctx.scale(1,.2);circle(0,0,26,'#06111c70');ctx.restore();}
    if (!reducedMotion && Math.abs(f.vx)>6) for (let i=0;i<trail[f.id].length-1;i+=2) {
      const t=trail[f.id][i];ctx.save();ctx.globalAlpha=(i+1)*.019;
      rounded(t.x+6,t.y+8,20,38,8,color);ctx.restore();
    }
    ctx.save(); ctx.translate(cx,y);ctx.scale(flip,1);
    ctx.translate(0,28);ctx.rotate(pose.spin);ctx.translate(0,-28);
    ctx.translate(0,54+pose.bob);ctx.scale(pose.sx,pose.sy);ctx.translate(0,-54);
    if (f.invuln && Math.floor(f.animTick/4)%2) ctx.globalAlpha=.58;
    const hip=[0,34+pose.crouch*.65], chest=[Math.sin(pose.lean)*14,21+pose.crouch];
    const head=[chest[0]+Math.sin(pose.lean)*9,8+pose.crouch];
    const shoulderF=[chest[0]+6,chest[1]+1],shoulderB=[chest[0]-6,chest[1]+1];
    const legF=A.limb([hip[0]+4,hip[1]],pose.frontFoot,13,14,1);
    const legB=A.limb([hip[0]-4,hip[1]],pose.backFoot,13,14,1);
    const armF=A.limb(shoulderF,pose.frontHand,12,13,-1);
    const armB=A.limb(shoulderB,pose.backHand,12,13,1);
    const drawLimb=(points,upper,lower,thickness,boot=false)=>{
      const [a,b,c]=points;ctx.lineCap='round';
      line(a[0],a[1],b[0],b[1],'#091824',thickness+2.5);
      line(b[0],b[1],c[0],c[1],'#091824',thickness+2.5);
      line(a[0],a[1],b[0],b[1],upper,thickness);line(b[0],b[1],c[0],c[1],lower,thickness-1);
      circle(b[0],b[1],thickness*.46,'#bddbe4');
      if(boot) {line(c[0]-2,c[1],c[0]+5,c[1]-1,'#d5e8e8',thickness-1);line(c[0]-3,c[1]+3,c[0]+6,c[1]+2,'#142536',2);}
      else {circle(c[0],c[1],4.1,color);line(c[0],c[1]-2,c[0]+2,c[1]-2,'#f3fff5',1.5);}
    };
    // Lightweight scarf follows velocity analytically; no independent physics authority.
    const scarfLength=13+Math.min(15,Math.abs(f.vx)*1.7), lag=-Math.sign(f.vx*flip||1);
    ctx.lineCap='round';
    let last=[chest[0]-5,chest[1]-6];
    for(let k=1;k<=5;k++) {
      const ratio=k/5, point=[chest[0]-5+lag*scarfLength*ratio,
        chest[1]-6+ratio*4+Math.sin(pose.time*.17-k*.9)*ratio*(reducedMotion?.4:2.4)-f.vy*.12*ratio];
      line(last[0],last[1],point[0],point[1],k<4?color:'#d6f6e5',4-ratio*2);last=point;
    }
    drawLimb(armB,'#315266','#567b8d',5);
    drawLimb(legB,'#253f54','#50778a',7,true);
    // Armored torso joins an articulated shoulder line and pelvis.
    ctx.fillStyle='#101f31';ctx.beginPath();ctx.moveTo(chest[0]-10,chest[1]-5);ctx.lineTo(chest[0]+10,chest[1]-5);
    ctx.lineTo(hip[0]+9,hip[1]+5);ctx.lineTo(hip[0]-8,hip[1]+5);ctx.closePath();ctx.fill();
    line(chest[0]-6,chest[1]-2,hip[0]-4,hip[1]-1,color,7);
    line(chest[0]+6,chest[1]-2,hip[0]+4,hip[1]-1,color,7);
    line(chest[0]-4,chest[1],chest[0]+5,chest[1]-1,'#e2f3ee',2);
    line(hip[0]-7,hip[1]+1,hip[0]+8,hip[1]+1,'#bad7dc',3);
    drawLimb(legF,color,'#5b899d',7,true);
    rounded(head[0]-10,head[1]-7,20,19,6,'#0a1927');
    rounded(head[0]-9,head[1]-6,18,16,5,color);
    rounded(head[0]-1,head[1]-2,12,6,2,'#071e2a');
    line(head[0]+1,head[1]-1,head[0]+9,head[1]-1,'#e5fff5',1.5);
    line(head[0]-7,head[1]-5,head[0]+4,head[1]-5,'#e8fff075',1.2);
    drawLimb(armF,color,'#9ccad3',6);
    if(f.hitlag && f.hitstun) circle(chest[0],chest[1],17,'#ffffff30');
    ctx.restore();
    // Effects follow the move's active region; never substitute for authoritative boxes.
    const box=S.moveBox(f),kind=f.attack?.kind,m=kind&&S.MOVES[kind];
    if(m && pose.ribbon>0 && kind!=='flux') {
      const active=f.attack.age-m.start, direction=kind==='bair'?-flip:flip;
      const originX=cx,originY=y+27,reach=Math.min(68,Math.max(m.w*.7,32));
      ctx.save();ctx.translate(originX,originY);ctx.scale(direction,1);
      ctx.globalAlpha=pose.ribbon*.75;ctx.lineCap='round';
      if(['nair','dsmash','up','uair','usmash'].includes(kind)) {
        const up=['up','uair','usmash'].includes(kind), start=up?Math.PI*1.05:-.3;
        const end=up?Math.PI*1.9:Math.PI*1.55;
        ctx.save();ctx.scale(1,kind==='dsmash'?.38:1);
        if(kind==='dsmash')ctx.translate(0,34);
        for(let j=0;j<3;j++){ctx.strokeStyle=j===0?color+'26':j===1?color:'#ecfff6';ctx.lineWidth=[10,4,1.3][j];ctx.beginPath();ctx.arc(0,0,reach-6+j,start,end);ctx.stroke();}
        ctx.restore();
      } else {
        let angle=kind==='dair'?Math.PI/2:kind==='rise'?-Math.PI/2:kind==='slideKick'?.32:kind==='jab3'?-.55:-.12;
        ctx.rotate(angle);
        for(let j=0;j<3;j++){
          ctx.strokeStyle=j===0?color+'22':j===1?color:'#e9fff5';ctx.lineWidth=[11,4,1.2][j];ctx.beginPath();
          ctx.moveTo(12,12);ctx.quadraticCurveTo(reach-5,17,reach+5,-9);ctx.stroke();
        }
        if(kind==='vector')for(let j=-1;j<=1;j++)line(-47, j*9,6,j*9,color+'66',2);
      }
      ctx.restore();
    }
    if(kind==='flux' && box) {
      ctx.save();ctx.translate(cx,y+27);ctx.rotate((f.attack.age+fraction)*.14);
      for(let j=0;j<2;j++) {ctx.beginPath();for(let k=0;k<=6;k++){const a=k*Math.PI/3,r=36+j*4;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.strokeStyle=j?'#d5fff475':color;ctx.lineWidth=j?1:2;ctx.stroke();}
      ctx.restore();
    }
    if(f.state==='shield') {const r=22+f.shieldHP*.15;circle(cx,y+27,r,color+'13',f.shieldAge<=3?'#e4fff4':color+'bb',f.shieldAge<=3?3:1.5);}
    if(f.state==='airDodge') circle(cx,y+27,32,null,'#b1efd97a',1.4);
    if(f.charge) {const r=19+f.charge.frames*.2;circle(cx,y+25,r,color+'10',color+'aa',1);circle(cx+flip*15,y+27,3+f.charge.frames/10,'#fff0c2');}
    text(`P${f.id+1}`,cx,y-13,8,color,'center',700);
    if(opts.rules==='alchemy')circle(x+29,y-16,2.5,MAT[f.element]);
    if(hitboxes) {
      ctx.lineWidth=1;ctx.strokeStyle=f.invuln?'#eeeeee':color;ctx.strokeRect(f.x,f.y,f.w,f.h);
      if(box){ctx.fillStyle='#ff415c25';ctx.fillRect(box.x,box.y,box.w,box.h);ctx.strokeStyle='#ff6c80';ctx.strokeRect(box.x,box.y,box.w,box.h);}
      line(cx,y+28,cx+f.vx*4,y+28+f.vy*4,'#e4dc91',1);
    }
  }
  function render(alpha, dt, now) {
    ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0); background();
    const active = world.fighters.filter(f => f.stocks > 0 && !f.respawn);
    if (active.length && started && !reducedMotion) {
      const minX = Math.min(180, ...active.map(f => f.x - 70)), maxX = Math.max(780, ...active.map(f => f.x + 100));
      const minY = Math.min(80, ...active.map(f => f.y - 60)), maxY = Math.max(475, ...active.map(f => f.y + 100));
      const targetScale = Math.max(.63, Math.min(1.12, 860 / (maxX - minX), 460 / (maxY - minY)));
      const k = 1 - Math.exp(-dt * 5);
      view.x += ((minX + maxX) / 2 - view.x) * k; view.y += ((minY + maxY) / 2 - view.y) * k; view.scale += (targetScale - view.scale) * k;
    }
    ctx.save();
    const sx = reducedMotion ? 0 : Math.sin(now * .13) * shake, sy = reducedMotion ? 0 : Math.cos(now * .09) * shake * .5;
    ctx.translate(480 + sx, 270 + sy); ctx.scale(view.scale, view.scale); ctx.translate(-view.x, -view.y);
    drawStage();
    for (const p of world.projectiles) { const color = MAT[p.material] || '#c7eee5'; line(p.x - p.vx * 2, p.y - p.vy * 2, p.x, p.y, color + '50', 5); circle(p.x, p.y, 5, color); circle(p.x, p.y, 2, '#f5fff4'); }
    for (const f of world.fighters) drawFighter(f, paused ? 0 : alpha);
    for (const r of rings) { r.age += dt; const life = r.big ? .5 : .25; ctx.globalAlpha = Math.max(0, 1 - r.age / life); circle(r.x, r.y, r.radius + r.age * (r.big ? 180 : 90), null, r.color, r.big ? 3 : 1.5); }
    ctx.globalAlpha = 1; rings = rings.filter(r => r.age < (r.big ? .5 : .25));
    for (const p of particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 250 * dt; ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); line(p.x, p.y, p.x - p.vx * .02, p.y - p.vy * .02, p.color, 2); }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.age < p.life); shake = Math.max(0, shake - dt * 28);
    if (hitboxes) { const b = S.C.blast; ctx.strokeStyle = '#fa798777'; ctx.setLineDash([8, 8]); ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top); ctx.setLineDash([]); }
    ctx.restore();
    // Readable offscreen pointers when the bounded camera cannot fit a launched player.
    for (const f of active) {
      const x = (f.x + 16 - view.x) * view.scale + 480, y = (f.y + 28 - view.y) * view.scale + 270;
      if (x < 12 || x > 948 || y < 14 || y > 513) { const px = Math.max(18, Math.min(942, x)), py = Math.max(22, Math.min(501, y)); circle(px, py, 12, '#102535', COLORS[f.id], 2); text(String(f.id + 1), px, py + 4, 10, COLORS[f.id], 'center'); }
    }
    if (now > feedbackUntil) $('feedback').classList.remove('visible');
  }
  function frame(now) {
    const dt = lastTime ? Math.min(.25, (now - lastTime) / 1000) : 0; lastTime = now;
    if (dt > 0) fps += (1 / dt - fps) * .025;
    let alpha = 1;
    if (started && !paused) alpha = clock.advance(dt * speed, tick);
    if (!paused || dirty) { render(alpha, paused ? 0 : Math.min(.05, dt) * speed, now); dirty = false; draws++; }
    if (now > feedbackUntil) $('feedback').classList.remove('visible');
    updateHUD(); updateAttackGuide();
    if (now - lastPerf > 500) { lastPerf = now; $('performance').textContent = `${Math.round(fps)} FPS · 60 Hz${speed !== 1 ? ' · ' + speed + '×' : ''}`; }
    requestAnimationFrame(frame);
  }
  // Explicit test/practice seam. No network calls, privileged access or hidden autoplay.
  window.smashLab = Object.freeze({ get state() { return world; }, get paused() { return paused; },
    get view() { return { ...view }; }, get demo() { return demo ? { ...demo } : null; }, reset, setPaused, stepFrame, startDemo,
    diagnostics: () => ({ particles: particles.length, rings: rings.length, droppedTicks: clock.dropped, draws, fps, version: S.VERSION }) });
  reset({ begin: false }); requestAnimationFrame(frame);
})();
