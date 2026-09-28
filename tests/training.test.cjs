const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');

test('practice follows engine actions, preserves stocks and resets cleanly for a match', () => {
  const app = setup({ mode: 'training' }); app.start(); app.key('keydown', 'KeyD'); app.step(2); app.key('keyup', 'KeyD');
  assert.equal(app.run('state.practiceStep'), 1); assert.match(app.elements.get('matchStatus').textContent, /Jump/);
  app.key('keydown', 'Space'); app.key('keyup', 'Space'); app.step(); assert.equal(app.run('state.practiceStep'), 2); app.step(50);
  app.run('state.fighters[1].x=state.fighters[0].x+45; state.fighters[1].y=state.fighters[0].y');
  app.key('keydown', 'KeyF'); app.key('keyup', 'KeyF'); app.step(6);
  assert.equal(app.run('state.practiceStep'), 3); assert.ok(app.run('state.fighters[1].damage') > 0); assert.match(app.elements.get('matchStatus').textContent, /strong/);
  app.run('state.hitstop=0;state.fighters[0].y=1000'); app.step(); assert.equal(app.run('state.fighters[0].stocks'), 3);
  app.change('modeSelect', 'versus'); assert.equal(app.run('state.practiceStep'), 0); assert.equal(app.run('state.fighters[1].damage'), 0);
  assert.equal(app.run('state.fighters[1].x'), 600); assert.equal(app.run('started'), false);
});

test('winner index zero freezes simulation, focuses Rematch and starts a fresh round', () => {
  const app = setup(); app.start(); app.run('state.fighters[1].stocks=1;state.fighters[1].y=1000'); app.step(); assert.equal(app.run('state.winner'), 0);
  assert.equal(app.elements.get('resetBtn').textContent, 'Rematch'); assert.equal(app.document.activeElement.id, 'resetBtn'); assert.equal(app.elements.get('pauseBtn').disabled, true);
  const before = app.run('JSON.stringify(state)'); app.step(100); assert.equal(app.run('JSON.stringify(state)'), before);
  app.click('resetBtn'); assert.equal(app.run('state.winner'), null); assert.equal(app.run('paused'), false);
  assert.equal(app.run('state.fighters[0].stocks'), 3); assert.equal(app.document.activeElement.id, 'game');
});

test('simultaneous final stocks show a draw', () => {
  const app = setup(); app.start(); app.run('for(const f of state.fighters){f.stocks=1;f.y=1000}'); app.step();
  assert.equal(app.run('state.winner'), 'draw'); assert.match(app.elements.get('matchStatus').textContent, /Double knockout/);
});
