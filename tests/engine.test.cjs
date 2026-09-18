'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engine.js');
const game = opts => S.createGame({ opponent: 'local', ...opts });
const run = (g, n, a = {}, b = {}) => { for (let i = 0; i < n; i++) S.step(g, [a, b]); return g; };
function air(f, x = 420, y = 100) { Object.assign(f, { x, y, px: x, py: y, onGround: false, state: 'air', vx: 0, vy: 0 }); }
function face(g, distance = 54) { const [a, b] = g.fighters; a.x = 380; b.x = a.x + distance; a.facing = 1; b.facing = -1; return [a,b]; }

test('defaults preserve Blue, Red, three stocks and original four-platform stage', () => {
  const g = S.createGame(); assert.deepEqual(g.fighters.map(f => [f.name, f.stocks]), [['Blue',3],['Red',3]]);
  assert.equal(g.platforms.length, 4); assert.equal(g.platforms[0].y,430);
});
test('invalid external options and controls are normalized', () => {
  const g = game({ stage: 'bad', rules: 'bad', stocks: NaN, seconds: Infinity, buffer: 100, seed: 0 });
  assert.equal(g.options.stage,'triad'); assert.equal(g.options.rules,'duel'); assert.equal(g.options.stocks,3);
  assert.equal(g.options.buffer,6); assert.deepEqual(S.input({x:NaN,y:999,jump:1}), S.input({y:1}));
});
test('independent matches do not share mutable fighter or platform state', () => {
  const a=game(), b=game(); a.platforms[0].x=0; a.fighters[0].buffer.jump=2;
  assert.equal(b.platforms[0].x,180); assert.equal(b.fighters[0].buffer.jump,undefined);
});
test('idle fighters stay supported without jitter', () => {
  const g=run(game(),600); for(const f of g.fighters) { assert.equal(f.y,374); assert.equal(f.vy,0); assert.ok(f.onGround); }
});
test('fixed-clock outcomes match at 30, 60, 120 and 144 Hz', () => {
  const outcomes=[];
  for(const hz of [30,60,120,144]) {
    const g=game(), clock=new S.FixedClock();
    for(let i=0;i<hz*8;i++) clock.advance(1/hz,()=>S.step(g,[{x:Math.floor(g.tick/25)%2 ? 1:-1,jump:g.tick%65<8},{}]));
    outcomes.push(S.digest(g)); assert.equal(g.tick,480);
  }
  assert.ok(outcomes.every(v=>v===outcomes[0]));
});
test('fixed-clock catch-up is bounded and reset clears accumulated time', () => {
  const clock=new S.FixedClock(); let n=0; clock.advance(20,()=>n++);
  assert.equal(n,8); assert.ok(clock.dropped>0); clock.reset(); assert.equal(clock.accumulator,0);
});
test('seeded CPU replay is deterministic', () => {
  const a=S.createGame({seed:483}),b=S.createGame({seed:483});
  for(let t=0;t<5000;t++) { const i={x:Math.sin(t/60)>.5?1:-1,attack:t%18===0,jump:t%71===0,shield:t%87===0}; S.step(a,[i]);S.step(b,[i]); }
  assert.equal(S.digest(a),S.digest(b));
});
test('render events are excluded from deterministic digest', () => {
  const g=game(), before=S.digest(g);g.events.push({type:'visual'});assert.equal(S.digest(g),before);
});
test('jump squat lasts three frames and held jump does not consume the air jump', () => {
  const g=game();S.step(g,[{jump:true}]); assert.equal(g.fighters[0].state,'jumpSquat');
  run(g,2,{jump:true});assert.ok(g.fighters[0].onGround);
  run(g,4,{jump:true});assert.equal(g.fighters[0].airJumps,1);assert.ok(g.fighters[0].vy<0);
});
test('short hop is lower than full hop', () => {
  function height(hold){const g=game({stage:'flat'});let min=374;for(let t=0;t<40;t++){S.step(g,[{jump:t<hold}]);min=Math.min(min,g.fighters[0].y);}return min;}
  assert.ok(height(1)>height(10)+35);
});
test('a new jump edge permits one air jump, not unlimited jumps', () => {
  const g=game();air(g.fighters[0]);S.step(g,[{jump:true}]);assert.equal(g.fighters[0].airJumps,0);
  S.step(g,[{}]);S.step(g,[{jump:true}]);assert.equal(g.fighters[0].airJumps,0);assert.ok(g.fighters[0].vy>-S.C.doubleJump);
});
test('jump and attacks cannot escape hitstun', () => {
  const g=game(),f=g.fighters[0];air(f);f.hitstun=20;f.state='hitstun';
  S.step(g,[{jump:true,attack:true,special:true}]);assert.ok(f.vy>0);assert.equal(f.airJumps,1);assert.equal(f.attack,null);assert.equal(f.hitstun,19);
});
test('short input buffer expires rather than attacking arbitrarily later', () => {
  const g=game(),f=g.fighters[0];f.state='landing';f.timer=12;
  S.step(g,[{attack:true}]);run(g,14);assert.equal(f.attack,null);
});
test('buffered attack executes when landing lock ends within the buffer', () => {
  const g=game(),f=g.fighters[0];f.state='landing';f.timer=3;
  S.step(g,[{attack:true}]);run(g,2);assert.equal(f.attack.kind,'jab');
});
test('holding attack does not auto-repeat indefinitely', () => {
  const g=game();run(g,100,{attack:true});assert.equal(g.fighters[0].attack,null);
});
test('jump -> diagonal air dodge produces momentum-preserving waveland', () => {
  const g=game({stage:'flat'}),f=g.fighters[0];S.step(g,[{jump:true}]);
  S.step(g,[{shield:true,x:1,y:1}]);run(g,12,{x:1,y:1});
  assert.ok(f.stats.wavedashes>=1);assert.ok(f.glide>0);assert.ok(f.vx>5);assert.ok(f.onGround);
});
test('air dodge cannot be reused without landing', () => {
  const g=game(),f=g.fighters[0];air(f,400,-100);S.step(g,[{shield:true,x:1}]);
  run(g,24);S.step(g,[{shield:true,x:-1}]);assert.ok(f.dodgeUsed);assert.ok(f.helpless);assert.notEqual(f.state,'airDodge');
});
test('slides are gated behind flow/alchemy rules', () => {
  const duel=game(),flow=game({rules:'flow'}); for(const g of [duel,flow]) {g.fighters[0].vx=6;S.step(g,[{slide:true,x:1}]);}
  assert.equal(duel.fighters[0].glide,0);assert.ok(flow.fighters[0].glide>0);
});
test('wall kick is bounded to one per airtime and unavailable in duel', () => {
  for(const rules of ['duel','flow']) {const g=game({rules}),f=g.fighters[0];air(f,148,453);f.wall=1;f.airJumps=0;
    S.step(g,[{jump:true,x:1}]);assert.equal(f.wallJumps,rules==='flow'?0:1);if(rules==='flow')assert.ok(f.vx<0);}
});
test('fast fall requires a fresh down input while descending', () => {
  const g=game(),f=g.fighters[0];air(f);f.vy=1;S.step(g,[{y:1}]);assert.ok(f.fast);
});
test('one-way platforms can be dropped through without dropping through the main floor', () => {
  const g=game(),f=g.fighters[0];Object.assign(f,{x:310,y:274,onGround:true,platform:1});S.step(g,[{y:1}]);assert.ok(f.y>274);assert.ok(f.drop>0);
  const main=game();S.step(main,[{y:1}]);assert.equal(main.fighters[0].y,374);
});
test('swept falling collision catches high-speed landing, nearest platform first', () => {
  const g=game(),f=g.fighters[0];air(f,430,0);f.vy=500;f.hitstun=25;
  S.step(g,[{}]);assert.equal(f.y,245-f.h); // first upper platform, not the main floor
});
test('solid main platform blocks upward passage; upper platforms do not', () => {
  const g=game(),f=g.fighters[0];air(f,400,480);f.vy=-40;S.step(g,[{}]);assert.equal(f.y,462);assert.equal(f.vy,0);
  air(f,310,350);f.vy=-30;S.step(g,[{}]);assert.ok(f.y<350);
});
test('solid stage walls stop horizontal tunnelling', () => {
  const g=game(),f=g.fighters[0];air(f,100,450);f.vx=130;f.hitstun=10;S.step(g,[{y:1}]);assert.equal(f.x,148);
});
test('attack startup has no hit, active frames hit exactly once', () => {
  const g=game();const[a,b]=face(g,48);S.step(g,[{attack:true},{}]);assert.equal(b.damage,0);
  run(g,20,{attack:true});assert.equal(b.damage,S.MOVES.jab.damage);assert.equal(a.stats.hits,1);
});
test('higher percent produces more launch velocity and hitstun', () => {
  function hit(damage){const g=game();const[a,b]=face(g,48);b.damage=damage;run(g,4,{attack:true});return b.pending.power;}
  assert.ok(hit(100)>hit(0)*2);
});
test('DI reads the defender input at the end of hitlag', () => {
  function hit(y){const g=game();const[a,b]=face(g,48);run(g,4,{attack:true});run(g,5,{}, {y});return [b.vx,b.vy];}
  const up=hit(-1),down=hit(1);assert.notDeepEqual(up,down);assert.ok(up[1]<down[1]);
});
test('simultaneous active attacks trade rather than favoring player one', () => {
  const g=game();const[a,b]=face(g,46);run(g,3,{attack:true},{attack:true});assert.equal(a.damage,5);assert.equal(b.damage,5);
});
test('held shield blocks without percent damage, while grab beats it', () => {
  const g=game();const[a,b]=face(g,45);run(g,8,{}, {shield:true});run(g,10,{attack:true},{shield:true});assert.equal(b.damage,0);assert.ok(b.shieldHP<97);
  run(g,25,{}, {shield:true});run(g,7,{grab:true},{shield:true});assert.ok(b.damage>0);
});
test('fresh shield can parry a hit', () => {
  const g=game();const[a,b]=face(g,48);run(g,2,{attack:true},{});S.step(g,[{attack:true},{shield:true}]);assert.ok(g.events.some(e=>e.type==='parry'));assert.equal(b.damage,0);
});
test('shield depletion has a finite shield-break penalty', () => {
  const g=game(),f=g.fighters[0];f.shieldHP=.1;S.step(g,[{shield:true}]);assert.ok(f.hitstun>=90);assert.equal(f.state,'hitstun');
});
test('shield edge in the landing window enables a tech', () => {
  const g=game({stage:'flat'}),f=g.fighters[0];air(f,410,362);f.hitstun=25;f.state='hitstun';f.vy=13;
  S.step(g,[{shield:true}]);assert.equal(f.hitstun,0);assert.equal(f.state,'tech');assert.equal(f.stats.techs,1);
});
test('late shield does not retroactively tech a bounce', () => {
  const g=game({stage:'flat'}),f=g.fighters[0];air(f,410,362);f.hitstun=25;f.state='hitstun';f.vy=13;S.step(g,[{}]);assert.ok(f.vy<0);assert.ok(f.hitstun>0);
});
test('manual L-cancel halves aerial landing lag; auto-cancel is opt-in', () => {
  function landing(shield,autoCancel){const g=game({stage:'flat',autoCancel}),f=g.fighters[0];air(f,410,360);f.vy=8;
    f.attack={kind:'fair',age:12,hit:[]};f.state='attack';run(g,2,{shield});return f;}
  assert.equal(landing(true,false).timer,8);assert.equal(landing(false,false).timer,16);assert.equal(landing(false,true).timer,8);
});
test('turbo cancel requires an actual unshielded hit and a different move', () => {
  const g=game({turbo:true});const[a,b]=face(g,46);run(g,9,{attack:true});assert.ok(a.cancel);
  S.step(g,[{}]);S.step(g,[{attack:true,y:-1}]);assert.equal(a.attack.kind,'up');
  const miss=game({turbo:true});run(miss,9,{attack:true});assert.equal(miss.fighters[0].cancel,false);
});
test('ledge grab prevents grabbing an occupied ledge', () => {
  const g=game();const[a,b]=g.fighters;air(a,148,423);air(b,148,423);a.vy=b.vy=1;S.step(g,[{},{}]);
  assert.equal(a.state,'ledge');assert.notEqual(b.state,'ledge');assert.equal(a.invuln,30);
});
test('ledge regrab does not refresh intangibility', () => {
  const g=game(),f=g.fighters[0];air(f,148,423);f.ledgeGrabs=1;f.vy=1;S.step(g,[{}]);assert.equal(f.state,'ledge');assert.equal(f.invuln,0);
});
test('ledge jump is usable and sets a regrab lockout', () => {
  const g=game(),f=g.fighters[0];air(f,148,423);f.vy=1;S.step(g,[{}]);S.step(g,[{jump:true}]);assert.equal(f.ledge,null);assert.ok(f.vy<0);assert.ok(f.ledgeLock>0);
});
test('up special is a limited recovery and finishes helpless', () => {
  const g=game(),f=g.fighters[0];air(f,90,300);S.step(g,[{special:true,y:-1,x:1}]);assert.equal(f.attack.kind,'rise');assert.ok(f.recoveryUsed);
  run(g,35);assert.ok(f.helpless || f.onGround || f.state==='ledge');
});
test('all four blast-zone directions remove a stock once', () => {
  for(const [x,y] of [[-250,100],[1200,100],[400,-400],[400,900]]) {const g=game(),f=g.fighters[0];air(f,x,y);S.step(g);assert.equal(f.stocks,2);run(g,30);assert.equal(f.stocks,2);}
});
test('respawn is protected, movable, and clears stale attack state', () => {
  const g=game(),f=g.fighters[0];air(f,400,900);S.step(g);run(g,65);assert.ok(f.invuln>0);assert.equal(f.hitstun,0);assert.equal(f.attack,null);
  const x=f.x;run(g,5,{x:1});assert.ok(f.x>x);
});
test('simultaneous last-stock KOs are a draw and match state then freezes', () => {
  const g=game({stocks:1});for(const f of g.fighters)air(f,400,900);S.step(g);assert.equal(g.winner,'draw');const end=S.digest(g);
  run(g,100,{jump:true,attack:true});assert.equal(S.digest(g),end);
});
test('timeout compares stocks, then percent, then draw', () => {
  for(const [a,b,winner] of [[0,1,0],[3,1,1],[0,0,'draw']]){const g=game({seconds:1});g.fighters[0].damage=a;g.fighters[1].damage=b;run(g,60);assert.equal(g.winner,winner);}
});
test('training has an inactive dummy, infinite timer, and unlimited respawns', () => {
  const g=S.createGame({opponent:'training',seconds:1});run(g,80,{}, {attack:true,jump:true,x:1});assert.equal(g.fighters[1].x,600);assert.equal(g.time,60);
  air(g.fighters[0],400,900);S.step(g);assert.equal(g.fighters[0].stocks,3);assert.equal(g.winner,null);
});
test('element reactions have explicit order-independent pairs', () => {
  for(const [a,b,result] of [['oil','fire','burst'],['fire','water','steam'],['water','spark','charged']]){assert.equal(S.react(a,b),result);assert.equal(S.react(b,a),result);}
});
test('competitive and flow matches cannot acquire material hazards', () => {
  for(const rules of ['duel','flow']){const g=game({rules});assert.equal(S.paint(g,0,400,'fire'),false);assert.equal(g.cells.length,0);}
});
test('alchemy water and spark conduct only through a bounded connected puddle', () => {
  const g=game({rules:'alchemy'});for(let n=0;n<7;n++)S.paint(g,0,200+n*24,'water');S.paint(g,0,272,'spark');
  assert.equal(g.cells.filter(c=>c.material==='charged').length,5);
});
test('oil ignition can damage either player, including its creator', () => {
  const g=game({rules:'alchemy'});const[a,b]=face(g,36);S.paint(g,0,410,'oil');S.paint(g,0,410,'fire');assert.ok(a.damage>0);assert.ok(b.damage>0);
});
test('water extinguishes fire into a finite-lived steam updraft', () => {
  const g=game({rules:'alchemy'});S.paint(g,0,500,'fire');S.paint(g,0,500,'water');assert.equal(g.cells[0].material,'steam');run(g,181);assert.equal(g.cells.length,0);
});
test('material storage is bounded by actual platform cell count', () => {
  const g=game({rules:'alchemy'});for(let i=0;i<5000;i++)S.paint(g,0,i*5,'oil');assert.ok(g.cells.length<=25);
});
test('projectile segment collision detects a fast crossing', () => {
  assert.notEqual(S.segmentBox(0,10,300,10,{x:100,y:0,w:10,h:20}),null);
  assert.equal(S.segmentBox(0,30,300,30,{x:100,y:0,w:10,h:20}),null);
});
test('projectile collision respects the first obstruction', () => {
  const g=game(),f=g.fighters[1];air(f,500,445);g.projectiles.push({id:1,owner:0,x:130,y:445,vx:500,vy:0,ttl:10,w:10,h:10,material:'pulse'});
  S.step(g);assert.equal(f.damage,0);assert.equal(g.projectiles.length,0);
});
test('long seeded input fuzz stays finite and within resource budgets', () => {
  for(const rules of ['duel','flow','alchemy']) {
    const g=game({rules,opponent:'training',turbo:true});let seed=89;
    const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let t=0;t<12000;t++) {
      S.step(g,[{x:r()<.45?-1:r()<.5?1:0,y:r()<.2?-1:r()<.3?1:0,jump:r()<.08,attack:r()<.15,shield:r()<.1,special:r()<.06,grab:r()<.05,slide:r()<.1,cycle:r()<.03}]);
      for(const f of g.fighters) for(const key of ['x','y','vx','vy','damage','shieldHP']) assert.ok(Number.isFinite(f[key]),`${rules}:${key}@${t}`);
      assert.ok(g.projectiles.length<=32);assert.ok(g.cells.length<=46);assert.ok(g.events.length<=64);
    }
  }
});

test('air drift does not flip facing and back air hits behind the fighter', () => {
  const g=game(), [a,b]=g.fighters;air(a,450,100);air(b,400,100);a.facing=1;
  run(g,5,{x:-1,attack:true},{});assert.equal(a.facing,1);assert.equal(a.attack.kind,'bair');assert.equal(b.damage,12);assert.equal(b.pending.direction,-1);
});
test('charged smashes are stronger, have startup, and cannot be jump-canceled', () => {
  function hit(hold) {const g=game();const[a,b]=face(g,65);run(g,hold,{smash:true,jump:false});
    assert.equal(b.damage,0);assert.equal(a.state,'charge');S.step(g,[{smash:true,jump:true}]);assert.equal(a.state,'charge');
    run(g,15,{});return b.damage;}
  assert.ok(hit(30)>hit(1));
});
test('a slide jump carries momentum instead of hard-resetting speed', () => {
  const g=game({rules:'flow',stage:'flat'}),f=g.fighters[0];f.vx=6;
  S.step(g,[{slide:true,x:1}]);S.step(g,[{jump:true,x:1}]);run(g,5,{jump:true,x:1});
  assert.ok(!f.onGround);assert.ok(f.vx>6);
});
test('newly actionable opponents reset the true-combo counter', () => {
  const g=game();const[a,b]=face(g,48);run(g,3,{attack:true});
  a.hitlag=0;a.attack=null;a.state='idle';a.combo=4;a.comboTimer=50;b.hitlag=0;b.hitstun=0;b.pending=null;b.state='idle';b.x=428;b.y=374;b.onGround=true;b.vx=b.vy=0;
  S.step(g,[{},{}]);run(g,3,{attack:true},{});assert.equal(a.combo,1);
});

test('null inputs and inherited stage names cannot crash initialization', () => {
  assert.equal(S.createGame(null).options.stage,'triad');assert.equal(S.createGame({stage:'__proto__'}).options.stage,'triad');
  assert.equal(S.createGame({stage:'toString'}).options.stage,'triad');assert.equal(S.input(null).x,0);assert.doesNotThrow(()=>S.step(game(),null));
});
test('diagonal high-speed wall crossings cannot tunnel under the stage', () => {
  const g=game(),f=g.fighters[0];air(f,100,435);f.vx=200;f.vy=55;f.hitstun=20;S.step(g,[{y:1}]);assert.equal(f.x,148);
});
test('landing lag cannot be bypassed by dropping through a platform', () => {
  const g=game(),f=g.fighters[0];Object.assign(f,{x:310,y:274,onGround:true,platform:1,state:'landing',timer:12});
  S.step(g,[{y:1}]);assert.equal(f.y,274);assert.equal(f.drop,0);
});
test('a new down-shield is a spot dodge, while down from held shield drops', () => {
  const g=game(),f=g.fighters[0];Object.assign(f,{x:310,y:274,onGround:true,platform:1});
  S.step(g,[{y:1,shield:true}]);assert.equal(f.drop,0);assert.equal(f.state,'spotDodge');
  run(g,30);S.step(g,[{shield:true}]);S.step(g,[{y:1,shield:true}]);assert.ok(f.drop>0);
});
