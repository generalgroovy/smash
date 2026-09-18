/* SMASH Movement Lab. Fixed-frame simulation; no DOM, wall clock or render RNG.
 * UMD deliberately supports both a double-clicked index.html and Node tests.
 * Coordinates/velocities are logical pixels and pixels per 60 Hz simulation tick.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Smash = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 2, HZ = 60;
  const C = Object.freeze({ gravity: .58, fall: 12.5, fastFall: 18, run: 6.4,
    dash: 7.4, accel: .95, airAccel: .28, friction: .62, jump: 12.8,
    shortHop: 8.9, doubleJump: 11.7, jumpSquat: 3, dodgeSpeed: 12.4,
    blast: Object.freeze({ left: -170, right: 1130, top: -230, bottom: 740 }) });
  const STAGES = Object.freeze({
    triad: Object.freeze([
      { x: 180, y: 430, w: 600, h: 32, solid: true },
      { x: 290, y: 330, w: 160, h: 16, solid: false },
      { x: 510, y: 330, w: 160, h: 16, solid: false },
      { x: 405, y: 245, w: 150, h: 14, solid: false }
    ].map(Object.freeze)),
    flat: Object.freeze([{ x: 180, y: 430, w: 600, h: 32, solid: true }].map(Object.freeze))
  });
  const ELEMENTS = Object.freeze(['fire', 'water', 'spark', 'oil']);
  // sx/y are facing-relative offsets from the fighter's center/top. Angles point up.
  const MOVES = Object.freeze(Object.fromEntries(Object.entries({
    jab:   { start: 3, active: 3, end: 12, damage: 5, base: 3.8, growth: .045, angle: 28, sx: 12, y: 12, w: 42, h: 26, lag: 8 },
    tilt:  { start: 6, active: 4, end: 19, damage: 10, base: 5.4, growth: .085, angle: 34, sx: 13, y: 10, w: 53, h: 29, lag: 10 },
    up:    { start: 5, active: 5, end: 19, damage: 8, base: 5.7, growth: .06, angle: 86, sx: -25, y: -26, w: 58, h: 40, lag: 10 },
    sweep: { start: 5, active: 4, end: 18, damage: 7, base: 5.1, growth: .062, angle: 72, sx: 10, y: 33, w: 50, h: 20, lag: 10 },
    nair:  { start: 4, active: 7, end: 24, damage: 7, base: 4.8, growth: .06, angle: 42, sx: -37, y: 5, w: 74, h: 40, lag: 12 },
    fair:  { start: 7, active: 5, end: 27, damage: 11, base: 6.1, growth: .09, angle: 38, sx: 8, y: 0, w: 57, h: 40, lag: 16 },
    bair:  { start: 5, active: 4, end: 25, damage: 12, base: 6.2, growth: .088, angle: 35, sx: -66, y: 6, w: 53, h: 32, lag: 15, reverse: true },
    fsmash:{ start: 11, active: 4, end: 39, damage: 15, base: 7.6, growth: .10, angle: 32, sx: 9, y: 6, w: 65, h: 40, lag: 18 },
    usmash:{ start: 10, active: 5, end: 37, damage: 13, base: 7.3, growth: .095, angle: 87, sx: -30, y: -37, w: 65, h: 51, lag: 18 },
    dsmash:{ start: 9, active: 5, end: 36, damage: 12, base: 7, growth: .09, angle: 25, sx: -62, y: 30, w: 124, h: 29, lag: 18 },
    uair:  { start: 5, active: 5, end: 22, damage: 8, base: 5.9, growth: .073, angle: 85, sx: -28, y: -30, w: 58, h: 41, lag: 12 },
    dair:  { start: 9, active: 4, end: 30, damage: 10, base: 5.8, growth: .072, angle: -73, sx: -24, y: 35, w: 50, h: 35, lag: 18 },
    grab:  { start: 5, active: 2, end: 25, damage: 6, base: 6.9, growth: .078, angle: 42, sx: 9, y: 9, w: 37, h: 34, lag: 10, grab: true },
    rise:  { start: 3, active: 12, end: 34, damage: 8, base: 6, growth: .067, angle: 75, sx: -25, y: -15, w: 50, h: 52, lag: 22, recovery: true }
  }).map(([key, value]) => [key, Object.freeze(value)])));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const approach = (a, b, v) => a < b ? Math.min(a + v, b) : Math.max(a - v, b);
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function settings(raw = {}) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return { stage: ['triad', 'flat'].includes(raw.stage) ? raw.stage : 'triad',
      rules: ['duel', 'flow', 'alchemy'].includes(raw.rules) ? raw.rules : 'duel',
      opponent: ['cpu', 'local', 'training'].includes(raw.opponent) ? raw.opponent : 'cpu',
      stocks: clamp(Math.round(finite(raw.stocks, 3)), 1, 9),
      seconds: clamp(Math.round(finite(raw.seconds, 240)), 1, 1800),
      buffer: clamp(Math.round(finite(raw.buffer, 3)), 0, 6),
      autoCancel: raw.autoCancel === true, turbo: raw.turbo === true,
      seed: (finite(raw.seed, 1337) >>> 0) || 1337 };
  }
  function input(raw = {}) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const axis = v => Math.abs(finite(v)) < .18 ? 0 : clamp(finite(v), -1, 1);
    return { x: axis(raw.x), y: axis(raw.y), jump: raw.jump === true,
      attack: raw.attack === true, smash: raw.smash === true, special: raw.special === true,
      shield: raw.shield === true, grab: raw.grab === true,
      slide: raw.slide === true, cycle: raw.cycle === true };
  }
  function fighter(id, opts) {
    return { id, name: id ? 'Red' : 'Blue', x: id ? 600 : 320, y: 374,
      px: id ? 600 : 320, py: 374, w: 32, h: 56, vx: 0, vy: 0,
      facing: id ? -1 : 1, onGround: true, platform: 0,
      stocks: opts.stocks, damage: 0, shieldHP: 100, state: 'idle', timer: 0,
      airJumps: 1, dodgeUsed: false, recoveryUsed: false, helpless: false,
      wallJumps: 1, wall: 0, wallLock: 0, ledge: null, ledgeLock: 0, ledgeGrabs: 0,
      hitstun: 0, hitlag: 0, invuln: 0, pending: null, attack: null, charge: null,
      drop: 0, glide: 0, fast: false, lastShield: -100, techLock: 0,
      shieldAge: 0, shieldStun: 0, dashFrames: 0, lastX: 0,
      shortHop: false, releasedJump: false, specialCooldown: 0,
      element: id ? 'water' : 'fire', respawn: 0, hazardLock: 0,
      cancel: false, lastMove: '', buffer: {}, previous: input(),
      stats: { hits: 0, damage: 0, maxCombo: 0, wavedashes: 0, techs: 0, lCancels: 0 },
      combo: 0, comboTimer: 0, lastHitBy: -1 };
  }
  function createGame(raw) {
    const options = settings(raw);
    return { version: VERSION, options, tick: 0, rng: options.seed,
      platforms: STAGES[options.stage].map(p => ({ ...p })),
      fighters: [fighter(0, options), fighter(1, options)],
      projectiles: [], cells: [], events: [], time: options.seconds * HZ,
      winner: null, nextId: 1, cpu: { next: 0, input: input() } };
  }
  function random(g) {
    let x = g.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    g.rng = x >>> 0; return g.rng / 4294967296;
  }
  function emit(g, type, f, text, extra = {}) {
    if (g.events.length < 64) g.events.push({ type, x: f.x + (f.w || 0) / 2,
      y: f.y, id: f.id ?? -1, text, ...extra });
  }
  function setState(f, state, timer = 0) { f.state = state; f.timer = timer; }
  function canAct(f) { return f.stocks > 0 && !f.respawn && !f.hitlag && !f.hitstun && !f.helpless && !f.shieldStun; }
  function moveBox(f) {
    if (!f.attack) return null;
    const m = MOVES[f.attack.kind], age = f.attack.age;
    if (age < m.start || age >= m.start + m.active) return null;
    return { x: f.x + f.w / 2 + (f.facing > 0 ? m.sx : -m.sx - m.w),
      y: f.y + m.y, w: m.w, h: m.h };
  }
  function startMove(g, f, kind, controls) {
    if (f.onGround && controls.x) f.facing = Math.sign(controls.x);
    f.charge = null;
    f.attack = { kind, age: 0, hit: [], throwX: controls.x, throwY: controls.y };
    f.lastMove = kind; f.cancel = false; setState(f, 'attack');
    if (kind === 'rise') {
      f.onGround = false; f.recoveryUsed = true; f.vy = -14.6;
      f.vx = controls.x * 6; f.fast = false;
      emit(g, 'move', f, 'RISING RECOVERY');
    }
  }
  function launch(g, f, damage, power, angle, direction, source, hitlag = 5) {
    f.damage = Math.min(999, f.damage + damage);
    f.onGround = false; f.attack = null; f.charge = null; f.ledge = null; f.cancel = false;
    f.pending = { power, angle, direction };
    f.hitstun = Math.round(12 + power * 1.65); f.hitlag = hitlag;
    f.vx = 0; f.vy = 0; f.helpless = false; f.fast = false;
    setState(f, 'hitstun'); f.lastHitBy = source;
    emit(g, 'hit', f, `${damage}%`, { power });
  }
  // Directional influence is sampled at the END of hitlag, not at collision time.
  function releaseLaunch(f, controls) {
    if (!f.pending) return;
    const { power, angle, direction } = f.pending;
    const rad = angle * Math.PI / 180;
    let vx = Math.cos(rad) * direction, vy = -Math.sin(rad);
    const length = Math.hypot(controls.x, controls.y);
    const cross = length ? (vx * controls.y - vy * controls.x) / Math.max(1, length) : 0;
    const turn = clamp(cross, -1, 1) * Math.PI / 10;
    const nx = vx * Math.cos(turn) - vy * Math.sin(turn);
    vy = vx * Math.sin(turn) + vy * Math.cos(turn); vx = nx;
    f.vx = vx * power; f.vy = vy * power; f.pending = null;
  }
  function land(g, f, platform, controls) {
    const wasAir = !f.onGround, speed = f.vy;
    f.y = platform.y - f.h; f.vy = 0; f.onGround = true;
    f.platform = g.platforms.indexOf(platform); f.airJumps = 1;
    f.dodgeUsed = false; f.recoveryUsed = false; f.wallJumps = 1;
    f.helpless = false; f.fast = false; f.ledgeGrabs = 0;
    if (!wasAir) return;
    if (f.hitstun > 0 && speed > 3) {
      if (g.tick - f.lastShield <= 7 && !f.techLock) {
        f.hitstun = 0; f.pending = null; f.techLock = 35;
        f.vx = controls.x * 7; f.invuln = 14; f.stats.techs++;
        setState(f, 'tech', 18); emit(g, 'tech', f, controls.x ? 'TECH ROLL' : 'TECH');
      } else {
        f.vy = -Math.min(8, speed * .48); f.onGround = false;
        f.hitstun = Math.max(f.hitstun, 16); emit(g, 'land', f, 'MISSED TECH');
      }
      return;
    }
    if (f.state === 'airDodge') {
      f.glide = 28; setState(f, 'landing', 7); f.stats.wavedashes++;
      emit(g, 'tech', f, 'WAVELAND');
    } else if (f.attack) {
      const move = MOVES[f.attack.kind];
      const cancel = !move.recovery && (g.options.autoCancel || g.tick - f.lastShield <= 7);
      setState(f, 'landing', cancel ? Math.ceil(move.lag / 2) : move.lag);
      if (cancel) { f.stats.lCancels++; emit(g, 'tech', f, g.options.autoCancel ? 'AUTO L-CANCEL' : 'L-CANCEL'); }
      else emit(g, 'land', f, 'LANDING');
    } else if (!['roll', 'spotDodge', 'tech', 'landing'].includes(f.state)) setState(f, 'landing', 3);
    f.attack = null;
  }
  function collide(g, f, oldX, oldY, controls) {
    const newX = f.x, newY = f.y, dx = newX - oldX, dy = newY - oldY;
    let nearest = null, nearestT = 2;
    if (dy >= 0) {
      for (const p of g.platforms) {
        if (!p.solid && f.drop > 0) continue;
        if (oldY + f.h > p.y + .1 || newY + f.h < p.y) continue;
        const t = dy ? (p.y - oldY - f.h) / dy : 0, x = oldX + dx * t;
        if (x + f.w > p.x && x < p.x + p.w && t < nearestT) { nearest = p; nearestT = t; }
      }
    }
    const wasGround = f.onGround;
    f.onGround = false; f.wall = 0;
    if (nearest) { f.onGround = wasGround; land(g, f, nearest, controls); }
    for (const p of g.platforms) {
      if (!p.solid) continue;
      if (dy < 0 && oldY >= p.y + p.h && newY <= p.y + p.h) {
        const t = (p.y + p.h - oldY) / dy, x = oldX + dx * t;
        if (x + f.w > p.x && x < p.x + p.w) { f.y = p.y + p.h; f.vy = 0; }
      }
      // Evaluate side contact at the crossing time, not the final Y. This also
      // catches diagonal high-knockback crossings that finish below the platform.
      if (oldX + f.w <= p.x + .1 && f.x + f.w >= p.x) {
        const t = dx ? clamp((p.x - oldX - f.w) / dx, 0, 1) : 0;
        const y = oldY + dy * t;
        if (y + f.h > p.y + .1 && y < p.y + p.h) { f.x = p.x - f.w; f.vx = 0; }
      } else if (oldX >= p.x + p.w - .1 && f.x <= p.x + p.w) {
        const t = dx ? clamp((p.x + p.w - oldX) / dx, 0, 1) : 0;
        const y = oldY + dy * t;
        if (y + f.h > p.y + .1 && y < p.y + p.h) { f.x = p.x + p.w; f.vx = 0; }
      }
      if (f.y + f.h > p.y + .1 && f.y < p.y + p.h) {
        if (Math.abs(f.x + f.w - p.x) < 1) f.wall = 1;
        if (Math.abs(f.x - p.x - p.w) < 1) f.wall = -1;
      }
    }
    if (!nearest && wasGround) f.airJumps = 1;
    // Do not turn a swept top collision into floating over the edge at the final X.
    if (f.onGround) {
      const p = g.platforms[f.platform];
      if (f.x + f.w <= p.x || f.x >= p.x + p.w) f.onGround = false;
    }
  }
  function tryLedge(g, f, controls) {
    if (f.onGround || f.vy < 0 || f.hitstun || f.ledgeLock || controls.y > .5 || f.state === 'ledge') return;
    const p = g.platforms[0];
    if (f.y < p.y - 42 || f.y > p.y + 26) return;
    const side = Math.abs(f.x + f.w - p.x) < 19 ? -1 : Math.abs(f.x - p.x - p.w) < 19 ? 1 : 0;
    if (!side || g.fighters.some(o => o !== f && o.ledge === side)) return;
    f.ledge = side; f.x = side < 0 ? p.x - f.w : p.x + p.w;
    f.y = p.y - 15; f.vx = f.vy = 0; f.attack = null; f.airJumps = 1;
    f.helpless = false; f.recoveryUsed = false; f.dodgeUsed = false;
    f.invuln = f.ledgeGrabs++ === 0 ? 30 : 0;
    setState(f, 'ledge', 100); emit(g, 'move', f, 'LEDGE');
  }
  function dropLedge(f) { f.ledge = null; f.ledgeLock = 32; f.onGround = false; setState(f, 'air'); }
  function getCell(g, platform, index) { return g.cells.find(c => c.platform === platform && c.index === index); }
  function react(existing, incoming) {
    if (existing === 'oil' && incoming === 'fire' || existing === 'fire' && incoming === 'oil') return 'burst';
    if (existing === 'fire' && incoming === 'water' || existing === 'water' && incoming === 'fire') return 'steam';
    if (existing === 'water' && incoming === 'spark' || existing === 'charged' && incoming === 'water') return 'charged';
    if (existing === 'spark' && incoming === 'water' || existing === 'water' && incoming === 'charged') return 'charged';
    return incoming;
  }
  function paint(g, platformIndex, x, material) {
    if (g.options.rules !== 'alchemy' || !ELEMENTS.includes(material)) return false;
    const p = g.platforms[platformIndex]; if (!p || !Number.isFinite(x)) return false;
    const index = clamp(Math.floor((x - p.x) / 24), 0, Math.ceil(p.w / 24) - 1);
    let cell = getCell(g, platformIndex, index);
    const result = react(cell?.material || 'dry', material);
    if (!cell) { cell = { platform: platformIndex, index, material, ttl: 0 }; g.cells.push(cell); }
    cell.material = result === 'burst' ? 'fire' : result;
    cell.ttl = ['oil', 'water'].includes(cell.material) ? 600 : 180;
    if (result === 'burst') {
      const spot = { x: p.x + index * 24 + 12, y: p.y - 12 };
      emit(g, 'burst', spot, 'OIL + FIRE', { power: 10 });
      for (const f of g.fighters) if (f.stocks && !f.invuln && !f.respawn && Math.hypot(f.x + 16 - spot.x, f.y + 28 - spot.y) < 90) {
        launch(g, f, 9, 9 + f.damage * .04, 65, f.x + 16 < spot.x ? -1 : 1, -1, 4);
        f.hazardLock = 30;
      }
    }
    if (result === 'steam' || result === 'charged') emit(g, 'reaction', { x: p.x + index * 24, y: p.y }, result.toUpperCase());
    if (result === 'charged') {
      // At most two neighbors each way. No unbounded flood-fill or pixel simulation.
      for (const direction of [-1, 1]) for (let n = 1; n <= 2; n++) {
        const next = getCell(g, platformIndex, index + direction * n);
        if (!next || !['water', 'charged'].includes(next.material)) break;
        next.material = 'charged'; next.ttl = 180;
      }
    }
    return true;
  }
  function floorMaterial(g, f) {
    if (!f.onGround || g.options.rules !== 'alchemy') return 'dry';
    const p = g.platforms[f.platform];
    return getCell(g, f.platform, Math.floor((f.x + f.w / 2 - p.x) / 24))?.material || 'dry';
  }
  function spawnProjectile(g, f, controls) {
    if (g.projectiles.length >= 32) return;
    const downward = controls.y > .45;
    g.projectiles.push({ id: g.nextId++, owner: f.id, x: f.x + f.w / 2 + f.facing * 23,
      y: f.y + (downward ? 48 : 23), px: f.x, py: f.y,
      vx: f.facing * (downward ? 2.5 : 8.5), vy: downward ? 4 : .2,
      w: 10, h: 10, ttl: 75, material: g.options.rules === 'alchemy' ? f.element : 'pulse' });
    emit(g, 'shot', f, g.options.rules === 'alchemy' ? f.element.toUpperCase() : 'PULSE');
  }
  function tickFighter(g, f, controls) {
    f.px = f.x; f.py = f.y;
    const edge = key => controls[key] && !f.previous[key];
    for (const key of ['jump', 'attack', 'smash', 'special', 'shield', 'grab', 'slide']) {
      if (edge(key)) f.buffer[key] = g.tick + g.options.buffer;
      else if (f.buffer[key] < g.tick) delete f.buffer[key];
    }
    if (edge('shield')) f.lastShield = g.tick;
    if (edge('cycle') && g.options.rules === 'alchemy') f.element = ELEMENTS[(ELEMENTS.indexOf(f.element) + 1) % ELEMENTS.length];
    const ready = key => f.buffer[key] !== undefined && f.buffer[key] >= g.tick;
    const take = key => { delete f.buffer[key]; };
    for (const key of ['invuln', 'drop', 'glide', 'techLock', 'ledgeLock', 'wallLock', 'hazardLock', 'specialCooldown', 'comboTimer', 'dashFrames']) if (f[key] > 0) f[key]--;
    if (!f.comboTimer) f.combo = 0;
    if (f.stocks <= 0) { f.previous = controls; return; }
    if (f.respawn > 0) {
      if (--f.respawn === 0) {
        const stats = f.stats, stocks = f.stocks, element = f.element;
        Object.assign(f, fighter(f.id, g.options), { stocks, stats, element, y: 130, py: 130, onGround: false, invuln: 110, state: 'air' });
        emit(g, 'respawn', f, 'BACK IN');
      }
      f.previous = controls; return;
    }
    if (f.hitlag > 0) {
      if (--f.hitlag === 0) releaseLaunch(f, controls);
      f.previous = controls; return;
    }
    if (f.shieldStun > 0) f.shieldStun--;
    if (f.timer > 0 && --f.timer === 0) {
      if (f.state === 'jumpSquat') {
        f.vy = f.shortHop || !controls.jump ? -C.shortHop : -C.jump;
        f.onGround = false; f.fast = false; setState(f, 'air');
        emit(g, 'move', f, f.shortHop || !controls.jump ? 'SHORT HOP' : 'JUMP');
      } else if (f.state === 'airDodge') { f.helpless = true; setState(f, 'air'); }
      else if (f.state !== 'ledge') setState(f, f.onGround ? 'idle' : 'air');
    }
    if (f.state === 'jumpSquat' && !controls.jump) f.shortHop = true;
    if (f.state === 'ledge') {
      if (ready('jump')) {
        take('jump'); dropLedge(f); f.vy = -11.8; f.vx = -Math.sign(f.x - 480) * 3.5;
      } else if (controls.y > .5 || controls.x === f.ledge || !f.timer) { dropLedge(f); f.vy = 1; }
      else if (controls.x * f.ledge < -.4 || ready('attack')) {
        const side = f.ledge; dropLedge(f); const p = g.platforms[0];
        f.x = side < 0 ? p.x + 5 : p.x + p.w - f.w - 5; f.y = p.y - f.h;
        f.onGround = true; f.platform = 0; f.ledgeGrabs = 0; setState(f, 'landing', 12); take('attack');
      }
      f.previous = controls; return;
    }
    if (f.hitstun > 0) {
      f.hitstun--;
      if (!f.hitstun) setState(f, f.onGround ? 'idle' : 'air');
      // DI does not turn into full steering while being launched.
      f.vx *= .988;
    } else if (canAct(f)) {
      const locked = ['landing', 'roll', 'spotDodge', 'tech', 'jumpSquat', 'special', 'charge', 'airDodge'].includes(f.state);
      let actionable = !locked && !f.attack;
      if (g.options.turbo && f.cancel && ready('attack')) {
        const kind = chooseAttack(f, controls);
        if (kind !== f.lastMove) { f.attack = null; actionable = true; emit(g, 'tech', f, 'TURBO CANCEL'); }
      }
      if (ready('jump') && (actionable || f.state === 'shield')) {
        if (f.onGround) { f.shortHop = false; setState(f, 'jumpSquat', C.jumpSquat); take('jump'); }
        else if (g.options.rules !== 'duel' && f.wall && f.wallJumps && !f.wallLock) {
          f.vx = -f.wall * 9; f.vy = -11.2; f.wallJumps--; f.wallLock = 12;
          f.fast = false; take('jump'); emit(g, 'tech', f, 'WALL KICK');
        } else if (f.airJumps > 0) {
          f.airJumps--; f.vy = -C.doubleJump; f.fast = false; take('jump'); emit(g, 'move', f, 'DOUBLE JUMP');
        }
      }
      // A shield press inside jump squat is retained for a jump -> air dodge input.
      if (f.state === 'jumpSquat' && ready('shield')) f.buffer.shield = Math.max(f.buffer.shield, g.tick + f.timer + 1);
      actionable = !['landing', 'roll', 'spotDodge', 'tech', 'jumpSquat', 'special', 'charge', 'airDodge'].includes(f.state) && !f.attack;
      if (actionable && ready('shield') && !f.onGround && !f.dodgeUsed) {
        const length = Math.hypot(controls.x, controls.y);
        f.vx = length ? controls.x / length * C.dodgeSpeed : 0;
        f.vy = length ? controls.y / length * C.dodgeSpeed : 0;
        f.dodgeUsed = true; f.invuln = 9; f.fast = false; take('shield');
        setState(f, 'airDodge', 22); emit(g, 'move', f, 'AIR DODGE'); actionable = false;
      }
      if (actionable && f.onGround && controls.shield) {
        if (ready('shield') && (Math.abs(controls.x) > .5 || controls.y > .5)) {
          const roll = Math.abs(controls.x) > .5;
          setState(f, roll ? 'roll' : 'spotDodge', roll ? 25 : 23);
          f.vx = roll ? Math.sign(controls.x) * 7 : 0; f.invuln = 12; take('shield');
        } else { if (f.state !== 'shield') f.shieldAge = 0; setState(f, 'shield'); f.shieldAge++; take('shield'); }
      } else if (f.state === 'shield' && !controls.shield) setState(f, 'landing', 5);
      actionable = !['landing', 'roll', 'spotDodge', 'tech', 'jumpSquat', 'special', 'charge', 'airDodge', 'shield'].includes(f.state) && !f.attack;
      if ((actionable || f.state === 'shield') && ready('grab') && f.onGround) {
        take('grab'); startMove(g, f, 'grab', controls); actionable = false;
      }
      if (actionable && ready('smash') && f.onGround) {
        take('smash'); f.charge = { kind: controls.y < -.45 ? 'usmash' : controls.y > .45 ? 'dsmash' : 'fsmash', frames: 0 };
        if (controls.x) f.facing = Math.sign(controls.x);
        setState(f, 'charge'); actionable = false;
      }
      if (actionable && ready('attack')) { take('attack'); startMove(g, f, chooseAttack(f, controls), controls); actionable = false; }
      if (actionable && ready('special') && !f.specialCooldown) {
        if (controls.y < -.45 && !f.recoveryUsed) { startMove(g, f, 'rise', controls); f.specialCooldown = 35; }
        else if (controls.y >= -.45) { setState(f, 'special', 24); f.specialCooldown = 32; f.shot = { x: controls.x, y: controls.y }; }
        take('special'); actionable = false;
      }
      if (actionable && ready('slide') && f.onGround && g.options.rules !== 'duel' && Math.abs(f.vx) > 2) {
        f.glide = 30; f.vx = Math.sign(f.vx) * Math.min(10, Math.abs(f.vx) + 1.8);
        take('slide'); emit(g, 'tech', f, 'SLIDE');
      }
      const allowMove = ['idle', 'air', 'shield', 'attack'].includes(f.state) && f.state !== 'shield';
      if (allowMove && !f.attack?.kind.includes('rise')) {
        if (controls.x && !f.attack && f.onGround) f.facing = Math.sign(controls.x);
        if (f.onGround && !f.attack) {
          if (Math.abs(controls.x) > .65 && Math.sign(controls.x) !== Math.sign(f.lastX) && !f.glide) {
            f.vx = Math.sign(controls.x) * C.dash; f.dashFrames = 8;
            emit(g, 'move', f, 'DASH');
          } else if (controls.x && !f.glide) f.vx = approach(f.vx, controls.x * C.run, C.accel);
        } else if (!f.onGround) {
          const target = controls.x * C.run;
          if (!controls.x || Math.sign(f.vx) !== Math.sign(controls.x) || Math.abs(f.vx) < C.run) f.vx = approach(f.vx, target, C.airAccel * Math.abs(controls.x));
          f.vx *= .997;
        }
      }
      if (!f.onGround && f.vy > 0 && controls.y > .55 && f.previous.y <= .55 && f.state !== 'airDodge') { f.fast = true; emit(g, 'move', f, 'FAST FALL'); }
      if (f.onGround && controls.y > .6 && f.previous.y <= .6 && !g.platforms[f.platform].solid && ['idle', 'shield'].includes(f.state) && !f.attack) {
        f.drop = 16; f.y += 2; f.onGround = false; f.vy = 1; if (f.state === 'shield') setState(f, 'air');
      }
    }
    if (f.state === 'charge' && f.charge) {
      f.charge.frames++;
      if (!controls.smash || f.charge.frames >= 45) {
        const { kind, frames } = f.charge; startMove(g, f, kind, controls);
        f.attack.charge = 1 + frames / 90; emit(g, 'move', f, 'SMASH');
      }
    }
    if (f.state === 'special' && f.timer === 18) spawnProjectile(g, f, f.shot || controls);
    if (f.state === 'shield') {
      f.shieldHP = Math.max(0, f.shieldHP - .25);
      if (!f.shieldHP) { f.hitstun = 100; f.invuln = 0; f.vx = 0; setState(f, 'hitstun'); emit(g, 'break', f, 'SHIELD BREAK'); }
    } else f.shieldHP = Math.min(100, f.shieldHP + .13);
    if (f.attack) {
      f.attack.age++;
      if (f.attack.age >= MOVES[f.attack.kind].end) {
        if (MOVES[f.attack.kind].recovery) f.helpless = true;
        f.attack = null; f.cancel = false; setState(f, f.onGround ? 'idle' : 'air');
      }
    }
    const material = floorMaterial(g, f);
    if (f.onGround && !f.hitstun && (f.state !== 'idle' || !controls.x || f.glide)) {
      const friction = material === 'oil' ? .035 : f.glide ? .12 : C.friction;
      if (!['roll', 'tech'].includes(f.state)) f.vx = approach(f.vx, 0, friction);
    }
    if (f.onGround && material === 'water') f.vx *= .95;
    if (f.state === 'airDodge' && f.timer > 12) { f.vx *= .97; f.vy *= .97; }
    else {
      f.vy += f.fast ? C.gravity * 1.8 : C.gravity;
      // Do not clamp fresh knockback to normal terminal velocity.
      if (!f.hitstun) f.vy = Math.min(f.vy, f.fast ? C.fastFall : C.fall);
    }
    if (g.options.rules !== 'duel' && f.wall && controls.x * f.wall > .5 && !f.hitstun && !f.helpless && f.vy > 2) f.vy = 2;
    if (g.options.rules === 'alchemy' && !f.hitstun) for (const c of g.cells) {
      if (c.material !== 'steam') continue; const p = g.platforms[c.platform];
      if (Math.abs(f.x + 16 - (p.x + c.index * 24 + 12)) < 30 && f.y + f.h < p.y + 5 && f.y + f.h > p.y - 95 && !f.onGround) f.vy -= .85;
    }
    const ox = f.x, oy = f.y; f.x += f.vx; f.y += f.vy;
    collide(g, f, ox, oy, controls); tryLedge(g, f, controls);
    f.lastX = controls.x; f.previous = controls;
  }
  function chooseAttack(f, controls) {
    if (controls.y < -.45) return f.onGround ? 'up' : 'uair';
    if (controls.y > .45) return f.onGround ? 'sweep' : 'dair';
    if (Math.abs(controls.x) > .3) return f.onGround ? 'tilt' : controls.x * f.facing < 0 ? 'bair' : 'fair';
    return f.onGround ? 'jab' : 'nair';
  }
  function resolveHit(g, attacker, victim, move, direction, attackRef = null) {
    if (victim.invuln || victim.respawn || victim.stocks <= 0) return;
    if (!move.grab && victim.state === 'shield') {
      const parry = victim.shieldAge <= 3 && !victim.shieldStun;
      victim.shieldHP = Math.max(0, victim.shieldHP - (parry ? 0 : move.damage * 1.35));
      victim.shieldStun = parry ? 0 : 9; victim.vx = direction * (parry ? 0 : 2.6);
      if (attacker) { attacker.hitlag = parry ? 11 : 4; attacker.vx -= direction * 1.5; }
      emit(g, parry ? 'parry' : 'block', victim, parry ? 'PARRY' : 'BLOCK'); return;
    }
    const oldDamage = victim.damage;
    const linked = (victim.hitstun > 0 || victim.hitlag > 0) && victim.lastHitBy === attacker?.id;
    const charge = attackRef?.charge || 1;
    const damage = Math.round(move.damage * charge * 10) / 10;
    let angle = move.angle;
    if (move.grab && attackRef) {
      angle = attackRef.throwY < -.4 ? 86 : attackRef.throwY > .4 ? 60 : 32;
      if (attackRef.throwX) direction = Math.sign(attackRef.throwX);
    }
    const crouch = victim.onGround && victim.previous.y > .5 && victim.state === 'idle' ? .78 : 1;
    const power = (move.base + (victim.damage + damage) * move.growth) * crouch * charge;
    launch(g, victim, damage, power, angle, direction, attacker?.id ?? -1);
    if (attacker) {
      attacker.hitlag = 5; attacker.cancel = g.options.turbo;
      attacker.stats.hits++; attacker.stats.damage += victim.damage - oldDamage;
      attacker.combo = linked ? attacker.combo + 1 : 1; attacker.comboTimer = victim.hitstun + 8;
      attacker.stats.maxCombo = Math.max(attacker.stats.maxCombo, attacker.combo);
      emit(g, 'confirm', attacker, attacker.combo > 1 ? `${attacker.combo} HIT COMBO` : 'HIT CONFIRM');
    }
  }
  function combat(g) {
    // Snapshot all contacts before applying them: genuine simultaneous trades.
    const contacts = [];
    for (const a of g.fighters) {
      if (a.stocks <= 0 || a.respawn || a.hitlag) continue;
      const box = moveBox(a); if (!box) continue;
      for (const v of g.fighters) if (v !== a && v.stocks > 0 && !v.respawn && !v.invuln && !a.attack.hit.includes(v.id) && overlap(box, v)) {
        a.attack.hit.push(v.id); contacts.push({ a, v, m: MOVES[a.attack.kind], direction: MOVES[a.attack.kind].reverse ? -a.facing : a.facing, ref: a.attack });
      }
    }
    for (const h of contacts) resolveHit(g, h.a, h.v, h.m, h.direction, h.ref);
  }
  function segmentBox(x0, y0, x1, y1, box, radius = 0) {
    let lo = 0, hi = 1;
    for (const [p, d, min, max] of [[x0, x1 - x0, box.x - radius, box.x + box.w + radius], [y0, y1 - y0, box.y - radius, box.y + box.h + radius]]) {
      if (!d) { if (p < min || p > max) return null; }
      else {
        let a = (min - p) / d, b = (max - p) / d;
        if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b);
        if (lo > hi) return null;
      }
    }
    return lo;
  }
  function tickProjectiles(g) {
    for (const p of g.projectiles) {
      p.px = p.x; p.py = p.y; p.vy += .085; p.x += p.vx; p.y += p.vy; p.ttl--;
      let first = null, firstT = 2;
      for (const f of g.fighters) {
        if (f.id === p.owner || !f.stocks || f.respawn || f.invuln) continue;
        const t = segmentBox(p.px, p.py, p.x, p.y, f, 5);
        if (t !== null && t < firstT) { firstT = t; first = { fighter: f }; }
      }
      g.platforms.forEach((platform, index) => {
        const t = segmentBox(p.px, p.py, p.x, p.y, platform, 2);
        if (t !== null && t < firstT) { firstT = t; first = { platform: index }; }
      });
      if (first) {
        p.ttl = 0;
        if (first.fighter) resolveHit(g, null, first.fighter,
          { damage: p.material === 'oil' || p.material === 'water' ? 3 : 6, base: 4.3, growth: .035, angle: 32 }, Math.sign(p.vx));
        else if (p.material !== 'pulse') paint(g, first.platform, p.px + (p.x - p.px) * firstT, p.material);
      }
    }
    g.projectiles = g.projectiles.filter(p => p.ttl > 0 && p.x > -180 && p.x < 1140 && p.y < 750);
  }
  function tickMaterials(g) {
    if (g.options.rules !== 'alchemy') return;
    for (const c of g.cells) c.ttl--;
    g.cells = g.cells.filter(c => c.ttl > 0);
    for (const f of g.fighters) {
      if (!f.stocks || f.respawn || f.hazardLock || f.invuln || !f.onGround) continue;
      const type = floorMaterial(g, f);
      if (type === 'fire' || type === 'charged') {
        f.damage = Math.min(999, f.damage + (type === 'fire' ? 2 : 3)); f.hazardLock = 30;
        emit(g, 'hazard', f, type === 'fire' ? 'BURN +2%' : 'SHOCK +3%');
      }
    }
  }
  function cpuInput(g) {
    const f = g.fighters[1], other = g.fighters[0], p = g.platforms[0];
    if (g.tick < g.cpu.next) return g.cpu.input;
    g.cpu.next = g.tick + 5;
    const dx = other.x - f.x, dy = other.y - f.y, off = f.x < p.x - 10 || f.x + f.w > p.x + p.w + 10;
    const out = input();
    out.x = Math.abs(dx) > 48 ? Math.sign(dx) : 0;
    if (off) {
      out.x = f.x < 480 ? 1 : -1;
      out.jump = f.vy > 1 && f.airJumps > 0;
      if (!f.airJumps && f.y > 340) { out.y = -1; out.special = true; }
    } else {
      out.jump = dy < -65 && f.onGround && random(g) < .65;
      out.attack = Math.abs(dx) < 83 && Math.abs(dy) < 70 && random(g) < .8;
      out.y = Math.abs(dx) < 60 && dy < -28 ? -1 : 0;
      out.shield = !!other.attack && Math.abs(dx) < 95 && random(g) < .35;
      if (out.shield) out.x = 0;
      out.grab = other.state === 'shield' && Math.abs(dx) < 58;
      out.special = Math.abs(dx) > 190 && Math.abs(dy) < 45 && random(g) < .22;
      out.slide = g.options.rules !== 'duel' && Math.abs(dx) > 160 && random(g) < .2;
    }
    if (f.state === 'ledge') { out.x = -f.ledge; out.jump = random(g) > .5; }
    g.cpu.input = out; return out;
  }
  function step(g, rawInputs = []) {
    if (g.winner !== null) return g;
    rawInputs = Array.isArray(rawInputs) ? rawInputs : [];
    g.tick++; g.events = [];
    const controls = [input(rawInputs[0]), input(rawInputs[1])];
    if (g.options.opponent === 'cpu') controls[1] = cpuInput(g);
    if (g.options.opponent === 'training') controls[1] = input();
    for (let i = 0; i < 2; i++) tickFighter(g, g.fighters[i], controls[i]);
    combat(g); tickProjectiles(g); tickMaterials(g);
    for (const f of g.fighters) {
      if (!f.stocks || f.respawn) continue;
      if (f.x + f.w < C.blast.left || f.x > C.blast.right || f.y + f.h < C.blast.top || f.y > C.blast.bottom) {
        if (g.options.opponent !== 'training') f.stocks--;
        f.attack = null; f.charge = null; f.pending = null; f.hitlag = f.hitstun = 0;
        f.invuln = 0; f.ledge = null; f.respawn = 65; setState(f, 'respawn');
        emit(g, 'ko', f, f.stocks ? 'STOCK LOST' : 'KNOCKOUT', { player: f.id });
      }
    }
    if (g.options.opponent !== 'training') {
      g.time = Math.max(0, g.time - 1);
      const alive = g.fighters.filter(f => f.stocks > 0);
      if (alive.length < 2) g.winner = alive.length ? alive[0].id : 'draw';
      else if (!g.time) {
        const [a, b] = g.fighters;
        g.winner = a.stocks !== b.stocks ? (a.stocks > b.stocks ? 0 : 1) : a.damage !== b.damage ? (a.damage < b.damage ? 0 : 1) : 'draw';
      }
      if (g.winner !== null) emit(g, 'finish', { x: 480, y: 180 }, g.winner === 'draw' ? 'DRAW' : `${g.fighters[g.winner].name.toUpperCase()} WINS`);
    }
    return g;
  }
  class FixedClock {
    constructor() { this.accumulator = 0; this.dropped = 0; }
    reset() { this.accumulator = 0; }
    advance(seconds, callback) {
      this.accumulator += clamp(finite(seconds), 0, .25);
      let steps = 0;
      while (this.accumulator + 1e-10 >= 1 / HZ && steps < 8) {
        callback(); this.accumulator -= 1 / HZ; steps++;
      }
      if (this.accumulator >= 1 / HZ) { this.dropped += Math.floor(this.accumulator * HZ); this.accumulator %= 1 / HZ; }
      return clamp(this.accumulator * HZ, 0, 1);
    }
  }
  function digest(g) {
    // Stable snapshot, including future-affecting RNG/CPU/buffer state; excludes transient FX.
    const { events, ...state } = g;
    return JSON.stringify(state);
  }
  return Object.freeze({ VERSION, HZ, C, STAGES, ELEMENTS, MOVES, input, settings, createGame,
    step, FixedClock, digest, moveBox, overlap, segmentBox, paint, react, cpuInput });
});
