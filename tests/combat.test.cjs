const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../combat.js');
const neutral=()=>({});
function arena(mode='versus') {const s=E.createGame({mode,stage:'duel'});s.fighters[1].x=370;return s;}
function run(s,n,a={},b={}) {const events=[];for(let i=0;i<n;i++){E.step(s,[typeof a==='function'?a(i,s):a,typeof b==='function'?b(i,s):b]);events.push(...s.events);}return events;}
function activeHit(input,options={}) {
  const s=arena();Object.assign(s.fighters[0],options.attacker);Object.assign(s.fighters[1],options.victim);
  const events=run(s,options.frames||90,(i)=>i===0?input:(input.strong && i<(options.charge||1)?input:{}));
  return {s,events,hits:events.filter(e=>e.type==='hit')};
}

test('quick attacks have startup, one hit per swing and punishable recovery',()=>{
  const s=arena();E.step(s,[{light:true},{}]);assert.equal(s.fighters[1].damage,0);assert.equal(s.fighters[0].move.id,'jab');
  E.step(s,[{light:true},{}]);assert.equal(s.fighters[1].damage,0);
  E.step(s,[{light:true},{}]);assert.equal(s.fighters[1].damage,5);
  assert.ok(s.fighters[0].move);run(s,45,{light:true});assert.equal(s.fighters[1].damage,5,'holding cannot repeat an attack');
  assert.equal(s.fighters[0].move,null);
});
test('direction selects real grounded attacks with distinct launch vectors',()=>{
  const expected=[['jab',{}],['side',{x:1}],['up',{y:-1}],['sweep',{y:1}]];
  const results=[];
  for(const [id,dir] of expected){const s=arena();E.step(s,[{light:true,...dir},{}]);assert.equal(s.fighters[0].move.id,id);
    for(let t=0;t<20 && s.fighters[1].damage===0;t++)E.step(s,[{},{}]);
    assert.ok(s.fighters[1].damage>0,id);results.push([id,s.fighters[1].vx,s.fighters[1].vy]);}
  assert.ok(Math.abs(results[2][2])>Math.abs(results[2][1])*5,'up is a vertical launcher');
  assert.ok(results[1][1]>results[0][1],'side hit spaces farther than jab');
});
test('aerial direction includes back kick without automatically turning the fighter',()=>{
  for(const [id,dir] of [['nair',{}],['fair',{x:1}],['bair',{x:-1}],['uair',{y:-1}],['dair',{y:1}]]) {
    const s=arena();Object.assign(s.fighters[0],{y:170,onGround:false,jumps:1});E.step(s,[{light:true,...dir},{}]);
    assert.equal(s.fighters[0].move.id,id);assert.equal(s.fighters[0].facing,1);
  }
});
test('charged smash trades time for damage; charge is capped and auto-releases',()=>{
  const tap=activeHit({strong:true,x:1});const charge=activeHit({strong:true,x:1},{charge:40,frames:110});
  assert.equal(tap.hits.length,1);assert.equal(charge.hits.length,1);assert.ok(charge.hits[0].damage>tap.hits[0].damage*1.3);
  const s=arena();const ev=run(s,150,{strong:true});assert.equal(ev.filter(e=>e.type==='hit').length,1);assert.equal(s.fighters[0].move,null);
});
test('launch grows with damage and top, side and bottom blast zones count once',()=>{
  function launch(damage){const s=arena();s.fighters[1].damage=damage;run(s,3,{light:true});return Math.hypot(s.fighters[1].vx,s.fighters[1].vy);}
  assert.ok(launch(130)>launch(0));
  for(const pos of [{x:-210},{x:1120},{y:710},{y:-240}]) {const s=arena();Object.assign(s.fighters[1],pos);E.step(s,[{},{}]);assert.equal(s.fighters[1].stocks,2);assert.ok(s.fighters[1].invuln>0);E.step(s,[{},{}]);assert.equal(s.fighters[1].stocks,2);}
});
test('simultaneous active attacks trade without iteration-order priority',()=>{
  const s=arena();s.fighters[1].x=369;run(s,3,{light:true},{light:true});
  assert.equal(s.fighters[0].damage,5);assert.equal(s.fighters[1].damage,5);
});
test('parry rewards timing and leaves a failed attempt punishable',()=>{
  const s=arena();E.step(s,[{light:true},{}]);E.step(s,[{}, {dodge:true}]);E.step(s,[{},{}]);
  assert.equal(s.fighters[1].damage,0);assert.ok(s.fighters[0].hitstun>=30);assert.ok(s.events.some(e=>e.type==='parry'));
  const miss=arena();run(miss,10,{},(i)=>i===0?{dodge:true}:{});run(miss,4,(i)=>i===0?{light:true}:{});
  assert.ok(miss.fighters[1].damage>0,'late defense recovery can be hit');
});
test('roll has a protected window, recovery and no held-button repetition',()=>{
  const s=arena();E.step(s,[{}, {x:1,dodge:true}]);assert.equal(s.fighters[1].defense.type,'roll');
  run(s,60,{}, {dodge:true});assert.equal(s.fighters[1].defense,null);
});
test('one projectile per fighter and each projectile hits only once',()=>{
  const s=arena();s.fighters[1].x=470;const events=run(s,100,(i)=>i===0?{special:true}:{});
  const hits=events.filter(e=>e.type==='hit');assert.equal(hits.length,1);assert.equal(hits[0].move,'Pulse bolt');assert.equal(s.projectiles.length,0);
  const far=arena();far.fighters[1].x=900;for(let i=0;i<300;i++){E.step(far,[{special:i%40===0},{}]);assert.ok(far.projectiles.length<=1);}
});
test('projectile parry cancels the bolt without stunning its distant owner',()=>{
  const s=arena();s.projectiles.push({owner:0,x:370,y:397,w:18,h:14,vx:0,vy:0,life:40,color:'white'});
  s.fighters[1].defense={type:'parry',frame:1,dir:-1};E.step(s,[{},{}]);
  assert.equal(s.fighters[1].damage,0);assert.equal(s.projectiles.length,0);assert.equal(s.fighters[0].hitstun,0);
});
test('hitstun rejects jumps, movement overrides and new attacks',()=>{
  const s=arena();Object.assign(s.fighters[0],{x:300,y:100,vx:14,vy:-6,onGround:false,hitstun:20,jumps:1});
  E.step(s,[{x:-1,jump:true,light:true},{}]);assert.ok(s.fighters[0].vx>13);assert.ok(s.fighters[0].vy>-6);assert.equal(s.fighters[0].jumps,1);assert.equal(s.fighters[0].move,null);
});
test('short hops and deliberate second jump, with no auto-jump from a held key',()=>{
  const full=arena(),short=arena();run(full,12,{jump:true});run(short,12,(i)=>({jump:i===0}));assert.ok(full.fighters[0].y<short.fighters[0].y-25);
  const s=arena();run(s,1,{jump:true});assert.equal(s.fighters[0].jumps,1);run(s,2,{jump:true});assert.equal(s.fighters[0].jumps,1);
  E.step(s,[{},{}]);E.step(s,[{jump:true},{}]);assert.equal(s.fighters[0].jumps,0);
  run(s,130,{jump:true});assert.equal(s.fighters[0].onGround,true);assert.equal(s.fighters[0].jumps,2);
});
test('upper platform drop ignores that platform; main floor does not drop through',()=>{
  const s=arena();Object.assign(s.fighters[0],{x:420,y:246,onGround:true,platform:1});
  E.step(s,[{y:1,jump:true},{}]);assert.equal(s.fighters[0].onGround,false);assert.ok(s.fighters[0].y>246);run(s,10);assert.ok(s.fighters[0].y>270);
  const main=arena();E.step(main,[{y:1,jump:true},{}]);assert.ok(main.fighters[0].vy<0,'main floor uses jump');
});
test('air dodge and recovery are limited until landing, including ground-started recovery',()=>{
  const s=arena();Object.assign(s.fighters[0],{x:80,y:120,onGround:false,jumps:0});E.step(s,[{dodge:true,x:1},{}]);assert.equal(s.fighters[0].airDodgeUsed,true);
  s.fighters[0].defense=null;E.step(s,[{},{}]);E.step(s,[{dodge:true},{}]);assert.equal(s.fighters[0].defense,null);
  const recovery=arena();run(recovery,5,{y:-1,special:true});assert.equal(recovery.fighters[0].recoveryUsed,true);assert.equal(recovery.fighters[0].onGround,false);
  Object.assign(recovery.fighters[0],{move:null,specialCooldown:0,x:80,y:100,vy:0});E.step(recovery,[{},{}]);E.step(recovery,[{special:true,y:-1},{}]);assert.equal(recovery.fighters[0].move,null);
  Object.assign(recovery.fighters[0],{x:320,y:380,vy:3});E.step(recovery,[{},{}]);assert.equal(recovery.fighters[0].recoveryUsed,false);assert.equal(recovery.fighters[0].airDodgeUsed,false);
});
test('downward air dodge landing preserves a short slide; airborne attack adds landing recovery',()=>{
  const s=arena();Object.assign(s.fighters[0],{x:320,y:365,onGround:false,vy:2});E.step(s,[{x:1,y:1,dodge:true},{}]);run(s,3);
  assert.equal(s.fighters[0].onGround,true);assert.ok(s.fighters[0].sliding>0);assert.ok(s.fighters[0].vx>4);assert.ok(s.fighters[0].landingLag>0);
  const aerial=arena();Object.assign(aerial.fighters[0],{y:365,onGround:false,vy:6});E.step(aerial,[{light:true},{}]);run(aerial,2);assert.ok(aerial.fighters[0].landingLag>0);assert.equal(aerial.fighters[0].move,null);
});
test('pause input clearing cancels charge and buffers without firing on resume',()=>{
  const s=arena();run(s,20,{strong:true});assert.equal(s.fighters[0].move.charging,true);E.clearInputs(s);run(s,30);
  assert.equal(s.fighters[0].move,null);assert.equal(s.fighters[1].damage,0);
});
test('respawn preserves held-edge history and attacking ends spawn protection',()=>{
  const s=arena();Object.assign(s.fighters[0],{y:710});E.step(s,[{jump:true},{}]);run(s,2,{jump:true});assert.equal(s.fighters[0].jumps,2);
  E.step(s,[{light:true},{}]);assert.equal(s.fighters[0].invuln,0);assert.ok(s.fighters[0].move);
});
test('practice ignores target input, requires landed hits and keeps stocks unlimited',()=>{
  const s=arena('training');run(s,2,{x:1},{x:-1,light:true});assert.equal(s.practiceStep,1);assert.equal(s.fighters[1].x,370);
  E.step(s,[{jump:true},{}]);assert.equal(s.practiceStep,2);
  s.fighters[1].x=800;run(s,40,{light:true});assert.equal(s.practiceStep,2,'whiff does not advance');
  Object.assign(s.fighters[0],{x:320,y:381,vx:0,vy:0,onGround:true,move:null,landingLag:0});Object.assign(s.fighters[1],{x:370,y:381});
  E.clearInputs(s);run(s,3,{light:true});assert.equal(s.practiceStep,3);
  s.fighters[1].y=710;s.hitstop=0;E.step(s,[{},{}]);assert.equal(s.fighters[1].stocks,3);assert.equal(s.winner,null);
});
test('a simultaneous last-stock knockout is a draw and completed games are frozen',()=>{
  const s=arena();for(const f of s.fighters){f.stocks=1;f.y=710;}E.step(s,[{},{}]);assert.equal(s.winner,'draw');
  const before=JSON.stringify({...s,events:[]});run(s,60,{jump:true,light:true});assert.equal(JSON.stringify({...s,events:[]}),before);
});
test('directional influence rotates but does not increase launch speed',()=>{
  const a=arena(),b=arena();run(a,3,{light:true},{});run(b,3,{light:true},{y:-1});
  const speed=s=>Math.hypot(s.fighters[1].vx,s.fighters[1].vy);
  assert.ok(Math.abs(speed(a)-speed(b))<1e-9);assert.notEqual(a.fighters[1].vy,b.fighters[1].vy);
});
test('buffered attack and dodge retain their pressed direction after release',()=>{
  for(const [action,dir,expected] of [['light',{y:-1},'up'],['special',{y:-1},'recover'],['dodge',{x:1},'roll']]) {
    const s=arena();s.fighters[0].landingLag=4;
    E.step(s,[{[action]:true,...dir},{}]);run(s,3);
    assert.equal(action==='dodge'?s.fighters[0].defense.type:s.fighters[0].move.id,expected);
  }
});
test('low-percent launcher can convert into a deliberate jump and up-air',()=>{
  const s=E.createGame({stage:'duel',mode:'versus'});s.fighters[0].x=400;s.fighters[1].x=420;
  const events=run(s,55,i=>({y:i===0||i===25?-1:0,light:i===0||i===25,jump:i>=19&&i<=30}));
  const hits=events.filter(e=>e.type==='hit');assert.ok(hits.length>=2);
  assert.equal(hits[0].move,'Rising palm');assert.equal(hits[1].move,'Sky arc');assert.equal(hits[1].combo,2);
});
test('a buffered tap jump stays a short hop after its button was released',()=>{
  const s=arena();s.fighters[1].x=800;
  let high=381;
  for(let i=0;i<55;i++){E.step(s,[{light:i===0,jump:i===11},{}]);high=Math.min(high,s.fighters[0].y);}
  assert.ok(381-high>20 && 381-high<55,`tap hop height ${381-high}`);
  const drop=arena();Object.assign(drop.fighters[0],{x:420,y:246,onGround:true,platform:1,landingLag:4});
  E.step(drop,[{y:1,jump:true},{}]);run(drop,5);assert.ok(drop.fighters[0].y>246);assert.ok(drop.fighters[0].vy>0);
});
test('airborne burst follows either requested direction without breaking back-air facing',()=>{
  for(const dir of [-1,1]) {
    const s=arena();Object.assign(s.fighters[0],{x:480,y:110,onGround:false,jumps:0,facing:-dir});s.fighters[1].x=800;
    run(s,9,{x:dir,special:true});assert.equal(s.fighters[0].move.id,'burst');assert.equal(Math.sign(s.fighters[0].vx),dir);assert.ok(Math.abs(s.fighters[0].vx)>10);
    assert.equal(s.fighters[0].airBurstUsed,true);
  }
});
test('meteor hits launch downward and charge directions select distinct finishers',()=>{
  const s=arena();Object.assign(s.fighters[0],{x:320,y:160,vy:-3,onGround:false});Object.assign(s.fighters[1],{x:325,y:238,onGround:false,vy:-3});
  E.step(s,[{light:true,y:1},{}]);
  for(let i=0;i<25 && s.fighters[1].damage===0;i++)E.step(s,[{},{}]);
  assert.ok(s.fighters[1].damage>0);assert.ok(s.fighters[1].vy>0);assert.equal(s.lastHit.move,'Meteor heel');
  for(const [y,id] of [[-1,'strongUp'],[0,'strongSide'],[1,'strongDown']]){const a=arena();E.step(a,[{strong:true,y},{}]);assert.equal(a.fighters[0].move.id,id);}
});
