'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../engine.js'), A=require('../animation.js');
const game=options=>S.createGame({opponent:'local',stage:'flat',...options});
const run=(g,n,a={},b={})=>{for(let i=0;i<n;i++)S.step(g,[a,b]);};
const air=(f,x=400,y=100)=>Object.assign(f,{x,y,px:x,py:y,onGround:false,state:'air',vx:0,vy:0});
const attack=(f,kind,age)=>{f.attack={kind,age,hit:[]};f.state='attack';};
const pulse=(g,owner=1,x=530,y=397,vx=-40)=>g.projectiles.push({id:g.nextId++,owner,x,y,px:x,py:y,vx,vy:0,ttl:60,w:10,h:10,material:'pulse'});

test('all move definitions have readable names and valid timing',()=>{
  for(const [id,m]of Object.entries(S.MOVES)){assert.ok(S.MOVE_INFO[id]?.name);assert.ok(m.start>0&&m.active>0&&m.end>m.start+m.active);assert.ok(A.CLIPS[id],id);}
});
test('jab chain needs a fresh deliberate press inside its branch window',()=>{
  const g=game(),f=g.fighters[0];S.step(g,[{attack:true}]);run(g,6);S.step(g,[{attack:true}]);assert.equal(f.attack.kind,'jab2');
  run(g,7);S.step(g,[{attack:true}]);assert.equal(f.attack.kind,'jab3');
});
test('early jab re-press does not bypass the branch window with zero buffer',()=>{
  const g=game({buffer:0});S.step(g,[{attack:true}]);S.step(g,[{}]);S.step(g,[{attack:true}]);assert.equal(g.fighters[0].attack.kind,'jab');
});
test('jab finisher does not create an infinite automatic chain',()=>{
  const g=game(),f=g.fighters[0];attack(f,'jab3',7);run(g,50,{attack:true});assert.equal(f.attack,null);
});
test('running attack selects a committed shoulder drive rather than a planted tilt',()=>{
  const g=game();run(g,4,{x:1});S.step(g,[{x:1,attack:true}]);assert.equal(g.fighters[0].attack.kind,'dashAttack');assert.ok(g.fighters[0].vx>5);
});
test('fresh direction+attack still permits a stationary tilt',()=>{
  const g=game();S.step(g,[{x:1,attack:true}]);assert.equal(g.fighters[0].attack.kind,'tilt');
});
test('Flow slide branches into a low sweep; a Duel waveland does not',()=>{
  const g=game({rules:'flow'}),f=g.fighters[0];f.vx=6;S.step(g,[{x:1,slide:true}]);S.step(g,[{attack:true}]);assert.equal(f.attack.kind,'slideKick');
  const d=game(),df=d.fighters[0];df.glide=20;df.vx=6;S.step(d,[{attack:true}]);assert.equal(df.attack.kind,'jab');
});
test('clean and late Comet Knee contacts use different damage/launch profiles',()=>{
  const g=game(),f=g.fighters[0];attack(f,'fair',7);assert.equal(S.effectiveMove(f).damage,11);
  f.attack.age=9;assert.equal(S.effectiveMove(f).damage,6);assert.ok(S.effectiveMove(f).sour);
});
test('side special has visible startup before its fixed burst',()=>{
  const g=game(),f=g.fighters[0];S.step(g,[{x:1,special:true}]);assert.equal(f.attack.kind,'vector');assert.ok(Math.abs(f.vx)<1);
  run(g,7);assert.equal(f.attack.age,8);assert.ok(f.vx>10);assert.equal(S.movePhase(f).phase,'active');
});
test('air Vector Burst exhausts its action and cannot refill recovery resources',()=>{
  const g=game(),f=g.fighters[0];air(f,450,-80);f.airJumps=0;S.step(g,[{x:1,special:true}]);assert.ok(f.sideUsed);
  run(g,36);assert.ok(f.helpless);assert.equal(f.airJumps,0);assert.equal(f.attack,null);
});
test('grounded burst does not leave a standing fighter permanently helpless',()=>{
  const g=game(),f=g.fighters[0];f.x=350;S.step(g,[{x:1,special:true}]);run(g,40);assert.ok(f.onGround);assert.equal(f.helpless,false);
  S.step(g,[{jump:true}]);assert.equal(f.state,'jumpSquat');
});
test('Turbo cannot cancel a committed recovery move on hit',()=>{
  const g=game({turbo:true}),[a,b]=g.fighters;a.x=400;b.x=450;attack(a,'vector',7);S.step(g);assert.ok(b.damage>0);assert.equal(a.cancel,false);
});
test('Flux Field reflects an incoming projectile and changes its ownership',()=>{
  const g=game(),f=g.fighters[0];f.x=400;attack(f,'flux',4);pulse(g,1,490,398,-42);S.step(g);
  assert.equal(f.damage,0);assert.equal(g.projectiles[0].owner,0);assert.ok(g.projectiles[0].vx>0);assert.equal(g.projectiles[0].reflections,1);
});
test('reflection only works during actual active frames',()=>{
  const g=game(),f=g.fighters[0];f.x=400;attack(f,'flux',15);pulse(g,1,440,398,-32);S.step(g);assert.equal(f.damage,6);
});
test('reflection has a hard ricochet cap',()=>{
  const g=game(),f=g.fighters[0];f.x=400;attack(f,'flux',4);pulse(g,1,490,398,-42);g.projectiles[0].reflections=3;S.step(g);assert.equal(g.projectiles.length,0);
});
test('Flux Field is not melee armor',()=>{
  const g=game(),[a,b]=g.fighters;a.x=400;b.x=444;a.facing=1;b.facing=-1;attack(a,'flux',4);attack(b,'jab',2);S.step(g);assert.equal(a.damage,5);
});
test('Flux air brake is available once per airborne sequence, not every cast',()=>{
  const g=game(),f=g.fighters[0];air(f);f.vy=8;S.step(g,[{y:1,special:true}]);assert.ok(f.fluxUsed);assert.ok(f.vy<2);
  f.attack=null;f.state='air';f.specialCooldown=0;f.previous=S.input();f.vy=8;S.step(g,[{y:1,special:true}]);assert.ok(f.vy>8);
});
test('Alchemy down special keeps its surface coating functionality',()=>{
  const g=game({rules:'alchemy'});S.step(g,[{y:1,special:true}]);run(g,7);assert.ok(g.cells.length>0);assert.equal(g.cells[0].material,'fire');
});
test('projectile owner receives hit credit without remote hitlag or Turbo cancel',()=>{
  const g=game({turbo:true}),[a,b]=g.fighters;a.x=400;attack(b,'jab',1);pulse(g,1,440,398,-32);S.step(g);
  assert.equal(a.lastHitBy,1);assert.equal(b.stats.hits,1);assert.equal(b.stats.damage,6);assert.equal(b.hitlag,0);assert.equal(b.cancel,false);
});
test('respawn protection ends immediately on normal, charged or neutral special offense',()=>{
  for(const controls of [{attack:true},{smash:true},{special:true}]){
    const g=game(),f=g.fighters[0];f.invuln=100;f.spawnGrace=true;S.step(g,[controls]);assert.equal(f.invuln,0);assert.equal(f.spawnGrace,false);
  }
});
test('ordinary movement does not discard respawn protection',()=>{
  const g=game(),f=g.fighters[0];f.invuln=100;f.spawnGrace=true;S.step(g,[{x:1}]);assert.equal(f.invuln,99);assert.equal(f.spawnGrace,true);
});
test('a blocked hit that exhausts shield breaks it in the same tick',()=>{
  const g=game(),[a,b]=g.fighters;a.x=400;b.x=448;b.state='shield';b.shieldAge=10;b.shieldHP=1;b.previous=S.input({shield:true});attack(a,'tilt',5);
  S.step(g,[{}, {shield:true}]);assert.equal(b.state,'hitstun');assert.ok(b.hitstun>=100);
});
test('hit freeze also freezes invulnerability and animation clocks',()=>{
  const g=game(),f=g.fighters[0];f.hitlag=5;f.invuln=12;f.animTick=45;S.step(g);assert.equal(f.invuln,12);assert.equal(f.animTick,45);assert.equal(f.hitlag,4);
});
test('overlapping steam cells do not multiply lift acceleration',()=>{
  const g=game({rules:'alchemy'}),f=g.fighters[0];air(f,440,310);f.vy=0;
  for(const x of [434,458,482]){S.paint(g,0,x,'fire');S.paint(g,0,x,'water');}
  S.step(g);assert.ok(f.vy>=-.28);assert.ok(f.vy<0);
});
test('rapid repeated oil ignition respects the per-fighter hazard lockout',()=>{
  const g=game({rules:'alchemy'}),f=g.fighters[0];S.paint(g,0,330,'oil');S.paint(g,0,330,'fire');const damage=f.damage;
  S.paint(g,0,330,'oil');S.paint(g,0,330,'fire');assert.equal(f.damage,damage);assert.ok(damage>0);
});
test('meteor rebound requires a hit, held jump, and an unspent airborne rebound',()=>{
  const g=game(),[a,b]=g.fighters;air(a,400,308);b.x=400;attack(a,'dair',8);S.step(g,[{jump:true}]);
  assert.ok(b.damage>0);assert.ok(a.reboundUsed);assert.equal(a.vy,-8.4);assert.equal(a.airJumps,1);
});
test('meteor miss does not grant a rebound',()=>{
  const g=game(),a=g.fighters[0];air(a,400,230);attack(a,'dair',8);S.step(g,[{jump:true}]);assert.equal(a.reboundUsed,false);assert.ok(a.vy>0);
});
test('right-stick attack aim does not reverse air drift or facing',()=>{
  const g=game(),f=g.fighters[0];air(f);f.facing=1;S.step(g,[{x:1,aimX:-1,attack:true}]);assert.equal(f.attack.kind,'bair');assert.equal(f.facing,1);assert.ok(f.vx>0);
});
test('quick right-stick smash releases without holding a charge',()=>{
  const g=game();S.step(g,[{smash:true,quickSmash:true,aimY:-1}]);assert.equal(g.fighters[0].attack.kind,'usmash');
});
test('an analog outward input releases a ledge without requiring exactly 1.0',()=>{
  const g=game(),f=g.fighters[0];Object.assign(f,{state:'ledge',ledge:-1,timer:90,x:148,y:415,onGround:false});S.step(g,[{x:-.7}]);assert.equal(f.ledge,null);
});
test('all keyframe poses remain finite across every move and subframe',()=>{
  const g=game(),f=g.fighters[0];
  for(const [kind,m]of Object.entries(S.MOVES))for(let t=0;t<=m.end;t++)for(const fraction of [0,.5,.999]){
    attack(f,kind,t);const p=A.sample(f,fraction);
    for(const [key,value]of Object.entries(p))if(typeof value==='number')assert.ok(Number.isFinite(value),kind+key);else if(Array.isArray(value))assert.ok(value.every(Number.isFinite));
  }
});
test('animation sampling never mutates gameplay or changes the active phase',()=>{
  const g=game(),f=g.fighters[0];attack(f,'fair',6);const before=S.digest(g);const p=A.sample(f,.999);assert.equal(S.digest(g),before);assert.equal(p.phase,'startup');
});
test('hit-freeze pose ignores interpolation fraction',()=>{
  const g=game(),f=g.fighters[0];attack(f,'fsmash',12);f.hitlag=5;assert.deepEqual(A.sample(f,0),A.sample(f,.999));
});
test('new strike silhouettes are distinct from each other',()=>{
  const g=game(),f=g.fighters[0];const poses=new Set();for(const [kind,m]of Object.entries(S.MOVES)){attack(f,kind,m.start);const p=A.sample(f);delete p.kind;delete p.phase;poses.add(JSON.stringify(p));}
  assert.equal(poses.size,Object.keys(S.MOVES).length);
});
test('analytic limbs preserve both segment lengths even at unreachable targets',()=>{
  for(const target of [[0,0],[100,100],[-30,-10],[.0001,0]])for(const bend of [-1,1]){
    const [a,b,c]=A.limb([0,0],target,12,13,bend);assert.ok(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-12)<1e-8);assert.ok(Math.abs(Math.hypot(c[0]-b[0],c[1]-b[1])-13)<1e-8);
  }
});
test('expanded moves and specials retain deterministic replay under seeded input',()=>{
  const a=game({rules:'alchemy',opponent:'training',turbo:true}),b=game({rules:'alchemy',opponent:'training',turbo:true});let seed=46;
  const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let t=0;t<6000;t++) {const input={x:r()<.5?-1:1,y:r()<.4?-1:r()<.5?1:0,jump:r()<.1,smash:r()<.08,special:r()<.08,attack:r()<.2,slide:r()<.1,shield:r()<.06,cycle:r()<.04};S.step(a,[input]);S.step(b,[input]);}
  assert.equal(S.digest(a),S.digest(b));
});

test('a shielded meteor does not grant rebound from an old hit-credit value',()=>{
  const g=game(),[a,b]=g.fighters;air(a,400,308);b.x=400;b.state='shield';b.shieldAge=20;b.lastHitBy=0;b.previous=S.input({shield:true});attack(a,'dair',8);
  S.step(g,[{jump:true},{shield:true}]);assert.equal(a.reboundUsed,false);assert.equal(b.damage,0);
});
test('the deliberate three-beat jab string connects at close range without Turbo',()=>{
  const g=game(),[a,b]=g.fighters;a.x=390;b.x=435;
  for(let t=0;t<70;t++)S.step(g,[{attack:t===0||!!(a.attack&&a.attack.age>=S.MOVES[a.attack.kind].chainStart&&!a.previous.attack&&['jab','jab2'].includes(a.attack.kind))}]);
  assert.equal(a.stats.hits,3);assert.equal(b.damage,17);
});
