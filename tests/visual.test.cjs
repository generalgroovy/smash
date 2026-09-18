'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const V=require('../visual.js'),S=require('../engine.js');
const root=path.resolve(__dirname,'..');
const deepFreeze=obj=>{if(obj&&typeof obj==='object'){Object.values(obj).forEach(deepFreeze);Object.freeze(obj);}return obj;};
function drawingContext(){
  const calls=[];let depth=0;
  const ctx=new Proxy({}, {get:(_,key)=> (...args)=>{
    args.forEach(v=>{if(typeof v==='number')assert.ok(Number.isFinite(v),`${key} ${v}`);});
    if(key==='save')depth++;if(key==='restore'){depth--;assert.ok(depth>=0);}
    calls.push([key,...args]);
  }});
  return {ctx,calls,check:()=>assert.equal(depth,0)};
}
test('view defaults respect the system without enabling a quiet theme implicitly',()=>{
  assert.deepEqual(V.preferences(),{focus:false,cues:true,motion:'system'});
  for(const bad of [null,12,'string',[],{motion:'__proto__',focus:'yes',cues:0}])assert.deepEqual(V.preferences(bad),V.preferences());
});
test('motion settings have explicit precedence',()=>{
  for(const system of [false,true]){
    assert.equal(V.reduced(V.preferences({motion:'system'}),system),system);
    assert.equal(V.reduced(V.preferences({motion:'reduced'}),system),true);
    assert.equal(V.reduced(V.preferences({motion:'full'}),system),false);
  }
});
test('player identification does not rely only on hue',()=>{
  assert.notEqual(V.player(0).mark,V.player(1).mark);assert.notEqual(V.player(0).label,V.player(1).label);
  assert.notEqual(V.player(0).color,V.player(1).color);assert.equal(V.player(NaN),V.player(0));
});
test('all six materials have distinct named non-color patterns and safe lookup',()=>{
  const all=Object.values(V.MATERIALS);assert.equal(all.length,6);assert.equal(new Set(all.map(m=>m.glyph)).size,6);
  assert.equal(V.material('__proto__'),null);assert.equal(V.material('unknown'),null);
  assert.ok(Object.isFrozen(V.MATERIALS.fire));assert.ok(Object.isFrozen(V.PLAYERS[0]));
});
test('attack timing marks distinguish windup, contact phase and recovery',()=>{
  const f={stocks:1,attack:{}};
  assert.equal(V.cue(f,{phase:'startup'}).pattern,'outline');
  assert.equal(V.cue(f,{phase:'active'}).pattern,'solid');
  assert.equal(V.cue(f,{phase:'recovery'}).pattern,'dotted');
  assert.equal(V.cue({...f,attack:null},null),null);
});
test('freeze retains the timing pattern and eliminated fighters receive no marks',()=>{
  assert.deepEqual(V.cue({stocks:1,attack:{},hitlag:5},{phase:'active'}),{label:'FREEZE',pattern:'solid'});
  for(const f of [{stocks:0},{stocks:1,respawn:50}])assert.equal(V.cue(f,{phase:'active'}),null);
  assert.equal(V.cue({stocks:1,helpless:true},null).label,'NO ACTION');
});
test('procedural backdrop is deterministic and keeps balanced canvas state',()=>{
  for(const stage of ['triad','flat'])for(const focus of [true,false]){
    const a=drawingContext(),b=drawingContext(),opts=deepFreeze({stage,focus});
    V.backdrop(a.ctx,opts);V.backdrop(b.ctx,opts);a.check();b.check();assert.deepEqual(a.calls,b.calls);
    if(focus)assert.equal(a.calls.length,3); // save, solid fill, restore
  }
});
test('drawing every platform and coating cannot mutate gameplay or consume RNG',()=>{
  const g=S.createGame({rules:'alchemy'});
  for(const [i,name]of Object.keys(V.MATERIALS).entries())g.cells.push({platform:0,index:i,material:name,ttl:80});
  const before=S.digest(g);deepFreeze(g);
  for(const focus of [false,true]){
    const d=drawingContext();V.platforms(d.ctx,g.platforms,{focus});
    for(const c of g.cells)V.coating(d.ctx,c,g.platforms[c.platform],g.tick,focus);
    for(const f of g.fighters){V.fighterMark(d.ctx,f,S.movePhase(f));V.helmet(d.ctx,[12,5],f.id);}
    d.check();assert.equal(S.digest(g),before);
  }
});
test('reduced ambient material drawing is independent of presentation time',()=>{
  for(const name of Object.keys(V.MATERIALS)){
    const c={material:name,index:0,ttl:80},p={x:180,y:430,w:600};
    const a=drawingContext(),b=drawingContext();V.coating(a.ctx,c,p,0,true);V.coating(b.ctx,c,p,900,true);
    assert.deepEqual(a.calls,b.calls);a.check();b.check();
  }
});
test('selected text and player contrast pairs meet a 4.5:1 regression threshold',()=>{
  const luminance=hex=>{const v=hex.match(/[a-f0-9]{2}/gi).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  for(const [fg,bg]of [[V.INK,V.PAPER],['#546258','#f7f3e8'],[V.ACCENT,V.INK],...V.PLAYERS.map(p=>[p.color,V.INK])]){
    const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${fg}/${bg} = ${ratio}`);
  }
});
test('this presentation release preserves the combat and animation source blobs',()=>{
  // Git blob identity at v0.3 commit ec3a420, not an assertion of game balance.
  for(const [name,sha]of [['engine.js','4b444f2496c663cd81760448ba86a5601bc943ee'],['animation.js','f0992da2426c3648bcb22a58408a31ddc1fe4188']]){
    const bytes=fs.readFileSync(path.join(root,name));const actual=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(actual,sha);
  }
});
test('active documentation has valid local links and a short entry page',()=>{
  const files=['README.md','docs/PLAY.md','docs/DEVELOPMENT.md','docs/VISUALS.md','docs/VALIDATION.md'];
  for(const file of files){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
      const link=match[1];if(/^(https?:|#)/.test(link))continue;
      assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),link.split('#')[0])),`${file}: ${link}`);
    }
  }
  assert.ok(fs.readFileSync(path.join(root,'README.md'),'utf8').split(/\s+/).length<600);
});
