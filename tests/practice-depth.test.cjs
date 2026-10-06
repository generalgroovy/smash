const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../combat.js');
const { setup } = require('./game-harness.cjs');

function frames(s, count, input = () => ({})) {
  const events = [];
  for (let i = 0; i < count; i++) { E.step(s, [input(i, s), {}]); events.push(...s.events); }
  return events;
}

test('practice focus is validated and never changes a regular match', () => {
  for (const mode of ['cpu', 'versus']) {
    assert.deepEqual(E.createGame({ mode, practiceFocus: 'recoveryLeft' }), E.createGame({ mode }));
  }
  for (const practiceFocus of [null, '', 'invalid', 3, {}, ['combos']]) {
    assert.equal(E.createGame({ mode: 'training', practiceFocus }).practiceFocus, 'basics');
  }
});

test('a real launcher and up-air connects against the escape-testing dummy', () => {
  const s = E.createGame({ mode: 'training', practiceFocus: 'combos', stage: 'duel' });
  const hits = frames(s, 60, i => ({ y: i === 0 || i === 25 ? -1 : 0,
    light: i === 0 || i === 25, jump: i >= 19 && i <= 30 })).filter(e => e.type === 'hit');
  assert.equal(hits.length, 2);
  assert.equal(hits[1].combo, 2);
  assert.equal(hits[1].comboDamage, hits[0].damage + hits[1].damage);
  assert.equal(s.practiceBest, 2);
  assert.match(s.practiceText, /2-hit combo/);
  assert.match(s.practiceText, /Target can act/);
});

test('dummy uses a buffered normal dodge after hitstun, not during it', () => {
  const s = E.createGame({ mode: 'training', practiceFocus: 'combos' });
  let hit = false, escaped = false;
  for (let i = 0; i < 65; i++) {
    E.step(s, [{ light: i === 0, y: i === 0 ? -1 : 0 }, { special: true }]);
    const dummy = s.fighters[1];
    if (dummy.damage > 0) hit = true;
    if (dummy.hitstun > 0) assert.equal(dummy.defense, null);
    if (dummy.defense) { escaped = true; assert.equal(dummy.defense.type, 'air'); assert.equal(dummy.airDodgeUsed, true); }
    assert.equal(dummy.move, null, 'external P2 inputs stay ignored in Practice');
  }
  assert.ok(hit && escaped);
  assert.match(s.practiceText, /Escape window/);
});

test('a hit after one legal action frame starts a new chain despite the HUD grace period', () => {
  const s = E.createGame({ mode: 'versus', stage: 'duel' });
  const [a, b] = s.fighters;
  b.x = 370;
  frames(s, 3, () => ({ light: true }));
  assert.equal(s.lastHit.combo, 1);
  while (s.hitstop || b.hitstun) E.step(s, [{}, {}]);
  assert.ok(a.comboTimer > 0, 'old counter still visible');
  assert.equal(b.comboOwner, undefined);
  Object.assign(a, { x: 320, y: 381, vx: 0, vy: 0, onGround: true, move: null });
  Object.assign(b, { x: 370, y: 381, vx: 0, vy: 0, onGround: true });
  E.clearInputs(s);
  frames(s, 3, () => ({ light: true }));
  assert.equal(s.lastHit.combo, 1);
  assert.equal(s.lastHit.comboDamage, s.lastHit.damage);
});

test('both recovery drills can be completed with ordinary jump and rise on both stages', () => {
  for (const stage of ['triad', 'duel']) for (const practiceFocus of ['recoveryLeft', 'recoveryRight']) {
    const s = E.createGame({ mode: 'training', stage, practiceFocus }), f = s.fighters[0];
    const direction = practiceFocus === 'recoveryLeft' ? 1 : -1;
    assert.equal(f.jumps, 1); assert.equal(f.onGround, false);
    const events = frames(s, 100, i => ({ x: i < 48 ? direction : 0,
      jump: i < 10, special: i === 22, y: i === 22 ? -1 : 0 }));
    assert.ok(events.some(e => e.type === 'attack' && e.move === 'recover'));
    assert.ok(s.practiceComplete, `${stage}/${practiceFocus}`);
    assert.equal(events.filter(e => e.type === 'practice-success').length, 1);
    assert.equal(events.filter(e => e.type === 'ko').length, 0);
    assert.equal(f.stocks, 3);
    assert.equal(f.jumps, 2); assert.equal(f.recoveryUsed, false);
    assert.match(s.practiceText, /Recovered/);
  }
});

test('missed recovery restarts the same offstage setup without consuming stocks', () => {
  const s = E.createGame({ mode: 'training', practiceFocus: 'recoveryRight' });
  const start = { x: s.fighters[0].x, y: s.fighters[0].y };
  let lost = false;
  for (let i = 0; i < 100; i++) {
    E.step(s, [{}, {}]);
    if (s.events.some(e => e.type === 'ko' && e.fighter === 0)) { lost = true; break; }
  }
  assert.ok(lost);
  assert.equal(s.fighters[0].x, start.x); assert.equal(s.fighters[0].y, start.y);
  assert.equal(s.fighters[0].jumps, 1); assert.equal(s.fighters[0].stocks, 3);
  assert.equal(s.practiceComplete, false); assert.match(s.practiceText, /Try again/);
});

test('focus changes wait for Play; Retry clears inputs and restarts without changing modes', () => {
  const app = setup({ mode: 'training' });
  app.change('practiceSelect', 'combos'); assert.equal(app.run('started'), false);
  assert.equal(app.elements.get('practiceControl').hidden, false);
  app.start(); app.key('keydown', 'KeyG'); app.touch('right', 'pointerdown', 1); app.step(3);
  app.click('resetBtn');
  assert.equal(app.run('paused'), false); assert.equal(app.run('state.fighters[0].move'), null);
  assert.equal(app.run('keys.size + touchPointers.size + pendingPresses[0].size'), 0);
  assert.equal(app.run('state.practiceBest'), 0); assert.equal(app.document.activeElement.id, 'game');
  app.change('practiceSelect', 'recoveryLeft'); assert.equal(app.run('paused'), true);
  assert.equal(app.run('started'), false); assert.match(app.elements.get('matchStatus').textContent, /Return from the left edge/);
  assert.equal(app.run('state.fighters[0].jumps'), 1);
  app.start(); app.click('pauseBtn'); assert.match(app.elements.get('matchStatus').textContent, /Paused\. Return from the left edge/);
  app.events.blur(); app.change('practiceSelect', 'recoveryRight'); assert.equal(app.run('paused'), true);
  app.change('modeSelect', 'versus'); assert.equal(app.elements.get('practiceControl').hidden, true);
  assert.equal(app.run('state.practiceFocus'), 'basics'); assert.equal(app.run('state.fighters[0].onGround'), true);
  assert.equal(app.run('started'), false);
});
