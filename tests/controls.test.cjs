const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');

test('ready waits for Play; simulation matches at 60 and 144 Hz', () => {
  const app = setup(); app.run('loop(0); loop(10000)'); assert.equal(app.run('state.frame'), 0);
  const simulate = hz => {
    const app = setup(); app.start();
    for (let i = 0; i <= hz * 10; i++) app.run(`loop(${i * 1000 / hz})`);
    return app.run('state.frame');
  };
  assert.equal(simulate(60), 600); assert.equal(simulate(144), 600);
});

test('held jump and OS repeat never consume another jump or autojump on landing', () => {
  const app = setup(); app.start(); app.key('keydown', 'Space'); app.step();
  assert.equal(app.run('state.fighters[0].jumps'), 1);
  app.key('keydown', 'Space', { repeat: true }); app.step(100);
  assert.equal(app.run('state.fighters[0].onGround'), true); assert.equal(app.run('state.fighters[0].jumps'), 2);
  app.key('keyup', 'Space'); app.step(); app.key('keydown', 'Space'); app.step(); assert.equal(app.run('state.fighters[0].jumps'), 1);
});

test('between-frame taps preserve direction, execute once and cut short hops', () => {
  const app = setup(); app.start();
  app.key('keydown', 'KeyW'); app.key('keydown', 'KeyF'); app.key('keyup', 'KeyF'); app.key('keyup', 'KeyW'); app.step();
  assert.equal(app.run('state.fighters[0].move.id'), 'up'); app.step(30); assert.equal(app.run('state.fighters[0].move'), null);
  app.key('keydown', 'Space'); app.key('keyup', 'Space'); app.step(); assert.equal(app.run('state.fighters[0].jumps'), 1);
  app.step(); assert.ok(app.run('state.fighters[0].vy') > -6);
});

test('rapid jump then up-light chord retains attack direction in the same sample', () => {
  const app = setup(); app.start(); app.key('keydown', 'Space'); app.key('keydown', 'KeyW'); app.key('keydown', 'KeyF'); app.step();
  assert.equal(app.run('state.fighters[0].move.id'), 'uair');
});

test('blur clears charge and pending inputs; resume has no catch-up or held-repeat action', () => {
  const app = setup(); app.start(); app.key('keydown', 'KeyG'); app.step(6);
  assert.equal(app.run('state.fighters[0].move.charging'), true); app.events.blur(); assert.equal(app.run('state.fighters[0].move'), null);
  assert.equal(app.run('keys.size + pendingPresses[0].size + touchPointers.size'), 0);
  const frame = app.run('state.frame'); app.run('loop(1000);loop(9000)'); assert.equal(app.run('state.frame'), frame);
  app.key('keydown', 'KeyG', { repeat: true }); app.click('pauseBtn'); app.key('keydown', 'KeyG', { repeat: true });
  app.run('loop(12000)'); assert.equal(app.run('state.frame'), frame); app.run('loop(12020)'); assert.equal(app.run('state.frame'), frame + 1);
  assert.equal(app.run('state.fighters[0].move'), null);
});

test('hidden tab pauses; keyboard events on form controls never become fighter input', () => {
  const app = setup(); app.start(); app.key('keydown', 'Space', { target: { closest() { return {}; } } }); app.step();
  assert.equal(app.run('state.fighters[0].jumps'), 2);
  app.document.hidden = true; app.documentEvents.visibilitychange(); assert.equal(app.run('paused'), true);
  app.key('keydown', 'KeyF'); assert.equal(app.run('keys.size'), 0);
});

test('multitouch aims and attacks, quick release samples once, cancellation never sticks', () => {
  const app = setup(); app.start(); app.touch('up', 'pointerdown', 1); app.touch('light', 'pointerdown', 2);
  app.touch('light', 'pointerup', 2); app.touch('light', 'lostpointercapture', 2); app.touch('up', 'pointerup', 1);
  app.step(); assert.equal(app.run('state.fighters[0].move.id'), 'up'); app.step(30);
  app.touch('strong', 'pointerdown', 3); app.touch('strong', 'pointercancel', 3); app.step(); assert.equal(app.run('state.fighters[0].move'), null);
  app.touch('right', 'pointerdown', 4); app.events.blur(); assert.equal(app.run('inputFor(0).x'), 0);
  assert.equal(app.elements.get('touch-right').classList.contains('held'), false);
});

test('touch strong charges until release; assistive activation is a single tap', () => {
  const app = setup(); app.start(); app.touch('strong', 'pointerdown', 4); app.step(10);
  assert.equal(app.run('state.fighters[0].move.charge'), 10);
  app.touch('strong', 'pointerup', 4); app.step(); assert.equal(app.run('state.fighters[0].move.charging'), false);
  app.step(45); assert.equal(app.run('state.fighters[0].move'), null);
  app.elements.get('touch-jump').handlers.click({ detail: 0 }); app.step(100);
  assert.equal(app.run('state.fighters[0].onGround'), true); assert.equal(app.run('state.fighters[0].jumps'), 2);
});

test('P2 letter alternatives work without US punctuation layout', () => {
  const app = setup(); app.start(); app.key('keydown', 'KeyJ'); app.key('keyup', 'KeyJ'); app.step();
  assert.equal(app.run('state.fighters[1].move.id'), 'jab'); app.step(20);
  app.key('keydown', 'ArrowUp'); app.key('keydown', 'KeyL'); app.step(); assert.equal(app.run('state.fighters[1].move.id'), 'recover');
});

test('mode and stage changes discard old inputs/combat and return to ready', () => {
  const app = setup({ mode: 'cpu' }); app.start(); app.key('keydown', 'KeyF'); app.change('modeSelect', 'training');
  assert.equal(app.run('state.mode'), 'training'); assert.equal(app.run('paused'), true); assert.equal(app.run('pendingPresses[0].size'), 0);
  assert.equal(app.elements.get('difficultyControl').hidden, true);
  app.change('stageSelect', 'duel'); assert.equal(app.run('state.platforms.length'), 2);
  app.change('modeSelect', 'versus'); assert.equal(app.elements.get('touchControls').hidden, true);
});

test('renderer never changes physics and respects reduced-motion preference and user override', () => {
  const app = setup({ reducedMotion: true }); app.start(); app.key('keydown', 'KeyG'); app.step(3);
  const before = app.run('JSON.stringify(state)'); app.run('draw()'); assert.equal(app.run('JSON.stringify(state)'), before);
  assert.equal(app.run('reducedMotion'), true); assert.ok(app.drawings.includes('5%'));
  app.elements.get('motionToggle').checked = false; app.elements.get('motionToggle').handlers.change();
  app.preference.change({ matches: true }); assert.equal(app.run('reducedMotion'), false);
});

test('sound is opt-in, voice count is bounded and mute stops old tones rather than replaying them', () => {
  const notes = []; let contexts = 0;
  class AudioContext {
    constructor() { contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createOscillator() {
      const note = { stops: 0, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() { this.stops++; } };
      notes.push(note); return note;
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const app = setup({ window: { AudioContext } });
  app.run('playEvents([{type:"hit"}])'); assert.equal(contexts, 0);
  app.click('soundBtn'); assert.equal(contexts, 1);
  app.run('playEvents(Array.from({length:30},()=>({type:"hit"})))'); assert.equal(notes.length, 10);
  app.click('soundBtn'); assert.ok(notes.every(note => note.stops === 2));
  notes.forEach(note => note.onended()); assert.equal(app.run('activeVoices'), 0);
  app.click('soundBtn'); assert.equal(notes.length, 10);
  app.run('playEvents([{type:"parry"}])'); assert.equal(notes.length, 11);
});
