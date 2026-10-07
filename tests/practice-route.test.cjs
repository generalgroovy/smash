const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./game-harness.cjs');

test('First steps completion earns a next goal without stopping play or stealing focus',()=>{
  const app=setup({mode:'training'});app.start();
  app.run('state.practiceStep=5');app.key('keydown','KeyR');app.step();app.key('keyup','KeyR');
  assert.equal(app.run('state.practiceStep'),6);
  assert.equal(app.elements.get('matchState').textContent,'Goal met');
  assert.match(app.elements.get('matchStatus').textContent,/First steps complete/);
  assert.equal(app.elements.get('learnBtn').textContent,'Next: Combos');
  assert.equal(app.elements.get('learnBtn').hidden,false);
  assert.equal(app.run('paused'),false);assert.equal(app.document.activeElement.id,'game');
  app.click('pauseBtn');assert.match(app.elements.get('matchStatus').textContent,/Paused\. First steps complete/);
  assert.equal(app.elements.get('learnBtn').hidden,false);
});

test('next goal clears held inputs, preserves stage and waits focused on Start practice',()=>{
  const app=setup({mode:'training'});app.change('stageSelect','duel');app.start();
  app.run('state.practiceStep=6');app.step();
  app.key('keydown','KeyD');app.touch('strong','pointerdown',7);
  app.click('learnBtn');
  assert.equal(app.run('state.practiceFocus'),'combos');assert.equal(app.run('state.stageId'),'duel');
  assert.equal(app.run('started'),false);assert.equal(app.run('paused'),true);
  assert.equal(app.run('keys.size + touchPointers.size + pendingPresses[0].size'),0);
  assert.equal(app.document.activeElement.id,'pauseBtn');
  assert.equal(app.elements.get('pauseBtn').textContent,'Start practice');
  assert.equal(app.elements.get('learnBtn').hidden,true);
  assert.match(app.elements.get('matchStatus').textContent,/target tries to dodge gaps.*Start practice/);
});

test('combo and both recovery achievements lead to the next drill, then an Easy CPU ready state',()=>{
  const app=setup({mode:'training',practiceFocus:'combos'});app.change('stageSelect','duel');app.start();
  app.run('state.practiceBest=1');app.step();assert.equal(app.elements.get('learnBtn').hidden,true);
  app.run('state.practiceBest=2');app.step();assert.equal(app.elements.get('learnBtn').textContent,'Next: Left edge');
  app.click('learnBtn');assert.equal(app.run('state.practiceFocus'),'recoveryLeft');
  app.start();app.run('state.practiceComplete=true');app.step();assert.equal(app.elements.get('learnBtn').textContent,'Next: Right edge');
  app.click('learnBtn');assert.equal(app.run('state.practiceFocus'),'recoveryRight');
  app.start();app.run('state.practiceComplete=true');app.step();assert.equal(app.elements.get('learnBtn').textContent,'Next: Easy CPU');
  app.click('learnBtn');
  assert.equal(app.run('state.mode'),'cpu');assert.equal(app.run('state.stageId'),'duel');
  assert.equal(app.elements.get('difficultySelect').value,'easy');assert.equal(app.run('started'),false);
  assert.equal(app.elements.get('pauseBtn').textContent,'Play CPU');assert.equal(app.document.activeElement.id,'pauseBtn');
  assert.equal(app.run('state.fighters[0].stocks'),3);
});

test('an earned route stays available during free practice but Retry and setup changes clear it',()=>{
  const app=setup({mode:'training',practiceFocus:'recoveryLeft'});app.start();
  app.run('state.practiceComplete=true');app.step();
  app.run('state.practiceComplete=false;state.fighters[0].y=1000');app.step();
  assert.equal(app.elements.get('learnBtn').hidden,false);
  assert.match(app.run('playHint()'),/Offstage/);
  app.click('resetBtn');assert.equal(app.elements.get('learnBtn').hidden,true);
  assert.equal(app.run('practiceMilestoneReached'),false);
  app.run('state.practiceComplete=true');app.step();
  app.change('practiceSelect','combos');assert.equal(app.elements.get('learnBtn').hidden,true);
  assert.equal(app.run('practiceMilestoneReached'),false);
});

test('unmet goals cannot skip and regular matches never earn practice controls',()=>{
  const app=setup({mode:'training'});app.start();app.click('learnBtn');
  assert.equal(app.run('state.practiceFocus'),'basics');assert.equal(app.run('paused'),false);
  app.change('modeSelect','versus');app.start();
  app.run('state.practiceStep=6;state.practiceBest=3;state.practiceComplete=true');app.step();
  assert.equal(app.elements.get('learnBtn').hidden,true);assert.equal(app.run('practiceMilestoneReached'),false);
});
