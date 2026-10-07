const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');

test('First steps launches ordinary basics practice directly and keeps the selected stage', () => {
  const app = setup({ mode: 'cpu', practiceFocus: 'combos' });
  app.change('stageSelect', 'duel');
  assert.equal(app.elements.get('learnBtn').hidden, false);
  assert.equal(app.elements.get('resetBtn').hidden, true);
  assert.equal(app.elements.get('pauseBtn').textContent, 'Play CPU');
  app.click('learnBtn');
  assert.equal(app.run('state.mode'), 'training');
  assert.equal(app.run('state.practiceFocus'), 'basics');
  assert.equal(app.run('state.stageId'), 'duel');
  assert.equal(app.run('paused'), false);
  assert.equal(app.document.activeElement.id, 'game');
  assert.equal(app.elements.get('matchState').textContent, 'Practice');
  assert.equal(app.elements.get('learnBtn').hidden, true);
  assert.equal(app.elements.get('resetBtn').textContent, 'Retry');
  app.key('keydown', 'KeyD'); app.step(2); app.key('keyup', 'KeyD');
  assert.equal(app.run('state.practiceStep'), 1);
  assert.match(app.elements.get('matchStatus').textContent, /Jump/);
});

test('ready, active, paused and finished controls agree; changing setup retains native focus', () => {
  const app = setup({ mode: 'cpu' });
  assert.equal(app.elements.get('matchState').textContent, 'Ready');
  app.start();
  assert.equal(app.elements.get('matchState').textContent, 'Playing');
  app.click('pauseBtn');
  assert.equal(app.elements.get('matchState').textContent, 'Paused');
  assert.equal(app.elements.get('pauseBtn').textContent, 'Resume');
  app.elements.get('modeSelect').focus();
  app.change('modeSelect', 'versus');
  assert.equal(app.document.activeElement.id, 'modeSelect');
  assert.equal(app.elements.get('matchState').textContent, 'Ready');
  assert.equal(app.elements.get('pauseBtn').textContent, 'Play 2P');
  assert.match(app.elements.get('matchStatus').textContent, /Share a keyboard/);
  app.start();
  app.run('state.fighters[1].stocks=1; state.fighters[1].y=1000'); app.step();
  assert.equal(app.elements.get('matchState').textContent, 'Complete');
  assert.equal(app.elements.get('pauseBtn').attributes['aria-pressed'], 'false');
  assert.equal(app.elements.get('pauseBtn').disabled, true);
  assert.equal(app.document.activeElement.id, 'resetBtn');
  app.click('resetBtn');
  assert.equal(app.elements.get('matchState').textContent, 'Playing');
});

test('offstage advice points inward and never suggests spent resources', () => {
  for (const [focus, direction] of [['recoveryLeft', 'right'], ['recoveryRight', 'left']]) {
    const app = setup({ mode: 'training', practiceFocus: focus }); app.start();
    assert.match(app.run('playHint()'), new RegExp(`steer ${direction}.*Jump, then Up \\+ Special`));
    app.run('state.fighters[0].jumps=0');
    assert.doesNotMatch(app.run('playHint()'), /Jump/);
    assert.match(app.run('playHint()'), /Up \+ Special/);
    app.run('state.fighters[0].recoveryUsed=true');
    assert.match(app.run('playHint()'), new RegExp(`Recovery used.*${direction}`));
    assert.doesNotMatch(app.run('playHint()'), /Up \+ Special/);
    app.run('state.fighters[0].hitstun=10');
    assert.match(app.run('playHint()'), /Launched!/);
    app.run('state.fighters[0].hitstun=0; state.fighters[0].x=350; state.fighters[0].onGround=true');
    assert.equal(app.run('playHint()'), app.run('state.practiceText'));
  }
});

test('context hints do not capture focus and native controls keep game shortcuts', () => {
  const app = setup({ mode: 'training', practiceFocus: 'recoveryLeft' }); app.start();
  app.elements.get('practiceSelect').focus();
  let prevented = false;
  app.key('keydown', 'KeyP', { target: { closest() { return {}; } }, preventDefault() { prevented = true; } });
  app.key('keydown', 'KeyF', { target: { closest() { return {}; } } });
  app.step();
  assert.equal(prevented, false);
  assert.equal(app.run('paused'), false);
  assert.equal(app.run('state.fighters[0].move'), null);
  assert.equal(app.document.activeElement.id, 'practiceSelect');
  assert.match(app.elements.get('matchStatus').textContent, /Offstage/);
  app.events.blur();
  assert.equal(app.elements.get('matchState').textContent, 'Paused');
  assert.match(app.elements.get('matchStatus').textContent, /Paused/);
});
