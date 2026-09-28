const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup() {
  const elements = new Map();
  const document = {addEventListener(){}, getElementById(id) {
    if (!elements.has(id)) elements.set(id, {width:960,height:540,textContent:'',focus(){document.activeElement=this;},getContext(){return {};},addEventListener(){},setAttribute(){}});
    return elements.get(id);
  }};
  const context = vm.createContext({document,window:{addEventListener(){}},requestAnimationFrame(){}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),context);
  return {elements,run:source=>vm.runInContext(source,context)};
}

test('practice follows performed actions, preserves stocks and leaves no match state behind',()=>{
  const app=setup();
  app.run('training=true;resetMatch();jump(fighters[0])');
  assert.equal(app.run('practiceStep'),0);
  app.run('keys.add("d");applyInput(fighters[0]);keys.clear();jump(fighters[0])');
  assert.equal(app.run('practiceStep'),2);
  app.run('fighters[1].x=fighters[0].x+50;fighters[1].y=fighters[0].y;attack(fighters[0])');
  assert.equal(app.run('practiceStep'),3);
  assert.equal(app.run('fighters[1].damage'),11);
  assert.equal(app.run('fighters[1].hitFlash'),18);
  app.run('fighters[0].y=1000;physics(fighters[0])');
  assert.equal(app.run('fighters[0].stocks'),3);
  app.run('training=false;resetMatch()');
  assert.equal(app.run('fighters[1].x'),600);
  assert.equal(app.run('fighters[1].damage'),0);
});

test('match end freezes simulation and offers one focused rematch',()=>{
  const app=setup();
  app.run('fighters[0].stocks=1;fighters[0].y=1000;update()');
  assert.equal(app.run('winner'),'Player 2 wins');
  assert.equal(app.elements.get('resetBtn').textContent,'Rematch');
  const before=app.run('fighters[1].y');
  app.run('update();update()');
  assert.equal(app.run('fighters[1].y'),before);
  app.run('resetMatch()');
  assert.equal(app.run('winner'),null);
  assert.equal(app.run('fighters[0].stocks'),3);
});
