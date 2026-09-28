const { test } = require('node:test');
const assert = require('node:assert/strict');
const CPU = require('../cpu.js');
const Engine = require('../combat.js');

function fighter(id, x) {
  return { id, x, y: 381, w: 38, h: 54, vx: 0, vy: 0, facing: id ? -1 : 1,
    damage: 0, stocks: 3, onGround: true, platform: 0, jumps: 2,
    hitstun: 0, landingLag: 0, move: null, defense: null,
    recoveryUsed: false, airDodgeUsed: false, specialCooldown: 0 };
}
function game() {
  return { frame: 0, mode: 'cpu', winner: null,
    platforms: [{ x: 170, y: 435, w: 620, h: 28, solid: true }],
    fighters: [fighter(0, 320), fighter(1, 600)], projectiles: [] };
}
function run(state, frames, difficulty = 'normal') {
  const outputs = [];
  for (let i = 0; i < frames; i++, state.frame++) outputs.push(CPU.input(state, 1, difficulty));
  return outputs;
}

test('CPU is deterministic, returns independent inputs and never mutates world state', () => {
  const a = game(), b = game();
  const before = JSON.stringify(a);
  const first = CPU.input(a, 1);
  first.x = 900;
  assert.notEqual(CPU.input(a, 1).x, 900);
  assert.equal(JSON.stringify(a), before);
  assert.deepEqual(run(a, 360), run(b, 360));
});

test('difficulty gives a measurable initial reaction delay and unknown difficulty is safe', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const s = game();
    const delay = CPU.DIFFICULTIES[level].reaction;
    const outputs = run(s, delay + 1, level);
    assert.ok(outputs.slice(0, delay).every(o => !o.x && !o.light && !o.special));
    assert.notDeepEqual(outputs[delay], outputs[0]);
  }
  assert.deepEqual(run(game(), 90, 'missing'), run(game(), 90, 'normal'));
});

test('decisions use delayed visible observations and never inspect opponent inputs', () => {
  const a = game(), b = game();
  for (const s of [a, b]) Object.defineProperty(s.fighters[0], 'input', {
    get() { throw new Error('Opponent input is private'); }
  });
  run(a, 10); run(b, 10);
  b.fighters[0].x = 780;
  // First decision at frame 10 still sees the original frame-zero position.
  assert.deepEqual(CPU.input(a, 1), CPU.input(b, 1));
  const aa = run(a, 50), bb = run(b, 50);
  assert.ok(aa.some((o, i) => o.x !== bb[i].x));
});

test('actions release between presses and strong attacks have a bounded charge', () => {
  const s = game();
  s.fighters[0].x = 550;
  s.fighters[0].damage = 110;
  const outputs = run(s, 1500);
  let longestCharge = 0, charge = 0;
  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    assert.ok([-1, 0, 1].includes(o.x) && [-1, 0, 1].includes(o.y));
    for (const key of ['light', 'special', 'dodge']) {
      if (o[key]) assert.ok(!outputs[i + 1]?.[key], key + ' must release after its press');
    }
    charge = o.strong ? charge + 1 : 0;
    longestCharge = Math.max(longestCharge, charge);
  }
  assert.ok(outputs.some(o => o.light));
  assert.ok(outputs.some(o => o.special));
  assert.ok(longestCharge > 1 && longestCharge <= CPU.DIFFICULTIES.normal.charge);
  const earlyPercent = game();
  earlyPercent.fighters[0].x = 550;
  const earlyAttacks = run(earlyPercent, 600);
  assert.ok(earlyAttacks.some(o => o.light && o.y === -1));
  assert.ok(earlyAttacks.some(o => o.light && o.y === 1));
});

test('recovery steers toward stage, uses a jump then the single up special', () => {
  const s = game(), me = s.fighters[1];
  Object.assign(me, { x: 880, y: 450, onGround: false, platform: -1, vy: 3, jumps: 1 });
  let o = CPU.input(s, 1);
  assert.equal(o.x, -1);
  assert.equal(o.jump, true);
  me.jumps = 0;
  s.frame = 20;
  o = CPU.input(s, 1);
  assert.equal(o.x, -1);
  assert.equal(o.y, -1);
  assert.equal(o.special, true);
  me.recoveryUsed = true;
  s.frame = 100;
  assert.equal(CPU.input(s, 1).special, false);
});

test('grounded CPU will not chase an opponent into the abyss', () => {
  const s = game();
  s.fighters[1].x = 746;
  s.fighters[0].x = 900;
  s.fighters[0].y = 480;
  for (const o of run(s, 300)) assert.ok(o.x <= 0);
});

test('hitstun forbids actions, match end is inert and reset discards held charges', () => {
  const s = game();
  s.fighters[0].x = 550;
  s.fighters[0].damage = 110;
  for (let i = 0; i < 600; i++, s.frame++) if (CPU.input(s, 1).strong) break;
  assert.ok(CPU.input(s, 1).strong);
  s.fighters[1].hitstun = 20;
  s.frame++;
  let o = CPU.input(s, 1);
  assert.ok(!o.jump && !o.light && !o.strong && !o.special && !o.dodge);
  s.fighters[1].hitstun = 0;
  CPU.reset(s);
  assert.equal(CPU.input(s, 1).strong, false);
  s.winner = 0;
  o = CPU.input(s, 1);
  assert.ok(Object.values(o).every(value => !value));
  s.winner = null;
  s.mode = 'training';
  assert.ok(Object.values(CPU.input(s, 1)).every(value => !value));
});

test('aerial decisions aim above, below and to the side without consuming recovery', () => {
  for (const offset of [-60, 60, 0]) {
    const s = game();
    Object.assign(s.fighters[1], { x: 450, y: 220, onGround: false, platform: -1 });
    Object.assign(s.fighters[0], { x: 490, y: 220 + offset, onGround: false, platform: -1 });
    const attacks = run(s, 150).filter(o => o.light);
    assert.ok(attacks.some(o => o.y === Math.sign(offset)));
    assert.ok(attacks.every(o => !o.special));
  }
});

test('defensive responses leave long punishable gaps instead of a permanent dodge', () => {
  const s = game();
  s.fighters[0].x = 550;
  s.fighters[0].move = { id: 'side', frame: 1 };
  const presses = run(s, 1500, 'hard').flatMap((o, i) => o.dodge ? [i] : []);
  assert.ok(presses.length >= 2);
  assert.ok(presses.every((frame, i) => i === 0 || frame - presses[i - 1] >= 58));
});

test('all difficulty levels engage, hit and finish an idle opponent on both stages', () => {
  const allMoves = new Set();
  for (const stage of ['triad', 'duel']) for (const level of ['easy', 'normal', 'hard']) {
    const s = Engine.createGame({ stage });
    let hits = 0;
    for (let i = 0; i < 7200 && s.winner === null; i++) {
      Engine.step(s, [{}, CPU.input(s, 1, level)]);
      for (const event of s.events) {
        if (event.type === 'attack' && event.fighter === 1) allMoves.add(event.move);
        if (event.type === 'hit' && event.attacker === 1) hits++;
      }
    }
    assert.equal(s.winner, 1, `${stage}/${level}: CPU must finish a passive opponent`);
    assert.ok(hits >= 6, `${stage}/${level}: finish must come from combat`);
    assert.equal(s.fighters[1].stocks, 3, `${stage}/${level}: CPU must not walk offstage unprovoked`);
  }
  assert.ok(allMoves.has('up'), 'uses a launcher');
  assert.ok([...allMoves].some(id => Engine.MOVES[id].landing), 'uses aerial attacks');
  assert.ok([...allMoves].some(id => Engine.MOVES[id].kind === 'strong'), 'uses finishers');
  assert.ok([...allMoves].some(id => Engine.MOVES[id].kind === 'special'), 'uses specials');
  assert.ok(allMoves.size >= 10, 'combat offers distinct choices, not a one-move loop');
});

test('engine recovery returns from either edge with zero or one jump on both stages', () => {
  for (const stage of ['triad', 'duel']) for (const side of [-1, 1]) for (const jumps of [0, 1]) {
    const s = Engine.createGame({ stage }), f = s.fighters[1], floor = s.platforms[0];
    Object.assign(f, { x: side < 0 ? floor.x - 95 : floor.x + floor.w + 57,
      y: floor.y - 35, onGround: false, platform: -1, vy: 3, vx: side * 2, jumps });
    const moves = [];
    let landed = false;
    for (let i = 0; i < 180 && f.stocks === 3; i++) {
      Engine.step(s, [{}, CPU.input(s, 1)]);
      moves.push(...s.events.filter(e => e.type === 'attack').map(e => e.move));
      if (f.onGround) { landed = true; break; }
    }
    assert.ok(landed, `${stage}/${side}/${jumps}: recover without losing a stock`);
    assert.ok(moves.includes('recover'), 'recovery uses the engine up-special');
    assert.equal(f.stocks, 3);
  }
});

test('two reactive CPUs complete bounded matches with meaningful combat', () => {
  for (const stage of ['triad', 'duel']) {
    const s = Engine.createGame({ stage });
    let hits = 0, knockouts = 0;
    const moves = new Set();
    for (let i = 0; i < 21600 && s.winner === null; i++) {
      Engine.step(s, [CPU.input(s, 0), CPU.input(s, 1)]);
      for (const event of s.events) {
        if (event.type === 'hit') hits++;
        if (event.type === 'ko') knockouts++;
        if (event.type === 'attack') moves.add(event.move);
      }
      assert.ok(s.fighters.every(f => Number.isFinite(f.x + f.y + f.damage)));
    }
    assert.notEqual(s.winner, null, `${stage}: no endless spacing or recovery stalemate`);
    assert.ok(hits > 20 && knockouts >= 3 && moves.size >= 10);
  }
});
