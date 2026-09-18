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
    'Offstage: keep your air jump. Up + special recovers, but leaves you helpless until you land.',
    'Fast fall after the apex. Aerial movement keeps your facing, so attacking backward gives a back air.',
    'Tech a hard landing with a timely shield press. Add a direction to roll out.'
  ];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('smash-lab-v2') || '{}'); } catch (_) { /* Storage can be disabled. */ }
  let opts = S.settings(saved), world = S.createGame(opts), clock = new S.FixedClock();
  let started = false, paused = true, speed = 1, hitboxes = false, sound = false, dirty = true, draws = 0;
  let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => { reducedMotion = e.matches; });
  let lastTime = 0, lastPerf = 0, fps = 60, feedbackUntil = 0, hudTick = -1, audio = null, voices = 0;
  let view = { x: 480, y: 265, scale: 1 }, shake = 0, particles = [], rings = [], trail = [[], []];
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
    try { return Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected && p.mapping === 'standard'); }
    catch (_) { return []; }
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
    const inputs = readInputs(); latched.clear(); touchLatched.clear(); S.step(world, inputs); consumeEvents();
    for (const f of world.fighters) {
      trail[f.id].push({ x: f.x, y: f.y, speed: Math.abs(f.vx) });
      if (trail[f.id].length > 7) trail[f.id].shift();
    }
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
    $('inputStatus').textContent = getPads().length ? `${getPads().length} STANDARD PAD${getPads().length === 1 ? '' : 'S'} CONNECTED` : 'KEYBOARD READY';
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
    dirty = true; opts = S.settings({ ...opts, opponent }); world = S.createGame(opts); clock.reset(); clearInput();
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
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); setPaused(!paused); return; }
    if (e.code === 'Backspace' && !e.repeat) { e.preventDefault(); reset({ begin: true }); return; }
    if (e.code === 'KeyN' && paused && opts.opponent === 'training' && !e.repeat) { e.preventDefault(); stepFrame(); return; }
    if (e.code === 'Enter' && !e.repeat && (!started || paused)) { e.preventDefault(); $('startBtn').click(); return; }
    const codes = [e.code]; if (e.key === '/') codes.push('SlashCharacter');
    if (codes.some(code => mappedCodes.has(code)) && started && (!paused || (opts.opponent === 'training' && $('overlay').hidden))) {
      e.preventDefault();
      for (const code of codes) { if (!held.has(code) && !e.repeat) latched.add(code); held.add(code); }
    }
  });
  window.addEventListener('keyup', e => { held.delete(e.code); if (e.key === '/' || e.code === 'Digit7' || e.code === 'Slash') held.delete('SlashCharacter'); });
  window.addEventListener('blur', () => { clearInput(); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); setPaused(true); } lastTime = 0; });
  for (const b of document.querySelectorAll('[data-touch]')) {
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!started || (paused && !(opts.opponent === 'training' && $('overlay').hidden))) return;
      b.setPointerCapture(e.pointerId); touch.set(e.pointerId, b.dataset.touch); touchLatched.add(b.dataset.touch); b.classList.add('held');
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
  function drawFighter(f) {
    if (!f.stocks || f.respawn) return;
    // Render the newest combat state: interpolation would add a frame of input
    // latency and misalign visible bodies with authoritative attack boxes.
    const x = f.x, y = f.y, color = COLORS[f.id];
    ctx.save();
    if (f.invuln && Math.floor(world.tick / 4) % 2) ctx.globalAlpha = .55;
    if (!reducedMotion && Math.abs(f.vx) > 6) for (let k = 0; k < trail[f.id].length - 1; k += 2) {
      const t = trail[f.id][k]; ctx.save(); ctx.globalAlpha = (k + 1) * .025; rounded(t.x + 5, t.y + 6, 22, 39, 7, color); ctx.restore();
    }
    if (f.onGround) { ctx.save(); ctx.translate(x + 16, y + 57); ctx.scale(1, .23); circle(0, 0, 24, '#07132166'); ctx.restore(); }
    const cx = x + 16, dir = f.facing, moving = Math.abs(f.vx) > .8, phase = world.tick * .26;
    const crouch = f.onGround && (f.previous.y > .5 || f.glide > 0), offset = crouch ? 10 : 0;
    const swing = f.onGround && moving && !crouch ? Math.sin(phase) * 8 : 0;
    const lean = f.hitstun ? -Math.sign(f.vx) * .18 : moving ? dir * .1 : 0;
    ctx.translate(cx, y + 30); ctx.rotate(lean); ctx.translate(-cx, -y - 30);
    // Art is an original 56px pilot silhouette; collision remains the outlined body box.
    ctx.lineCap = 'round';
    line(cx - 5, y + 33 + offset, cx - 7 - swing, y + 48, '#233f53', 7);
    line(cx - 7 - swing, y + 48, cx - 9 - swing, y + 54, '#496577', 7);
    line(cx + 5, y + 33 + offset, cx + 7 + swing, y + 47, color, 7);
    line(cx + 7 + swing, y + 47, cx + 11 + swing, y + 53, '#aac6d1', 7);
    rounded(cx - 10, y + 15 + offset, 20, 25 - offset / 2, 6, color);
    rounded(cx - 7, y + 22 + offset, 14, 13 - offset / 3, 3, '#1b3649');
    line(cx - dir * 8, y + 22 + offset, cx - dir * 15, y + 33 + offset, '#365e72', 7);
    let armX = cx + dir * 17, armY = y + 31 + offset;
    if (f.attack && S.moveBox(f)) { armX += dir * 13; armY -= f.attack.kind.includes('up') || f.attack.kind === 'uair' ? 25 : 8; }
    line(cx + dir * 7, y + 21 + offset, armX, armY, color, 7); circle(armX, armY, 5, '#e6f3ed');
    rounded(cx - 9, y + 1 + offset, 18, 17, 6, color);
    rounded(cx + (dir > 0 ? -1 : -10), y + 5 + offset, 12, 5, 2, '#092130');
    line(cx + (dir > 0 ? 2 : -8), y + 6 + offset, cx + (dir > 0 ? 9 : -2), y + 6 + offset, '#d8fff7', 1.5);
    ctx.lineCap = 'butt';
    if (f.state === 'shield') { const radius = 22 + f.shieldHP * .15; circle(cx, y + 26, radius, color + '17', f.shieldAge <= 3 ? '#e4fff4' : color + 'bb', f.shieldAge <= 3 ? 3 : 1.5); }
    if (f.state === 'airDodge') circle(cx, y + 28, 33, null, '#b1efd9aa', 2);
    if (f.charge) { const r = 19 + f.charge.frames * .22; circle(cx, y + 26, r, color + '12', color + 'bb', 1.5); circle(cx + dir * 18, y + 25, 3 + f.charge.frames / 9, '#fff1c8'); }
    if (f.hitlag) { circle(cx, y + 24, 22, '#ffffff35'); }
    ctx.restore();
    text(`P${f.id + 1}`, x + 16, y - 13, 8, color, 'center', 700);
    if (opts.rules === 'alchemy') { circle(x + 29, y - 16, 2.5, MAT[f.element]); }
    const box = S.moveBox(f);
    if (box) {
      ctx.save(); ctx.globalAlpha = .24; rounded(box.x, box.y, box.w, box.h, 12, color); ctx.restore();
      line(box.x + 5, box.y + box.h / 2, box.x + box.w - 5, box.y + box.h / 2, '#ebfff0b0', 2);
    }
    if (hitboxes) {
      ctx.lineWidth = 1; ctx.strokeStyle = f.invuln ? '#eeeeee' : color; ctx.strokeRect(f.x, f.y, f.w, f.h);
      if (box) { ctx.fillStyle = '#ff415c35'; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeStyle = '#ff6c80'; ctx.strokeRect(box.x, box.y, box.w, box.h); }
      line(f.x + 16, f.y + 28, f.x + 16 + f.vx * 4, f.y + 28 + f.vy * 4, '#e4dc91', 1);
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
    for (const f of world.fighters) drawFighter(f);
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
    if (!paused || dirty || particles.length || rings.length) { render(alpha, Math.min(.05, dt), now); dirty = false; draws++; }
    if (now > feedbackUntil) $('feedback').classList.remove('visible');
    updateHUD();
    if (now - lastPerf > 500) { lastPerf = now; $('performance').textContent = `${Math.round(fps)} FPS · 60 Hz${speed !== 1 ? ' · ' + speed + '×' : ''}`; }
    requestAnimationFrame(frame);
  }
  // Explicit test/practice seam. No network calls, privileged access or hidden autoplay.
  window.smashLab = Object.freeze({ get state() { return world; }, get paused() { return paused; },
    get view() { return { ...view }; }, reset, setPaused, stepFrame,
    diagnostics: () => ({ particles: particles.length, rings: rings.length, droppedTicks: clock.dropped, draws, fps, version: S.VERSION }) });
  reset({ begin: false }); requestAnimationFrame(frame);
})();
