const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const source=readFileSync(require('node:path').join(__dirname,'..','game.js'),'utf8');
function setup(){
 const events={};let ticks=0,jumps=0;
 const context=vm.createContext({paused:false,pauseBtn:{textContent:'Pause',setAttribute(){},addEventListener(){}},document:{addEventListener(){}},window:{addEventListener(k,f){events[k]=f;}},keys:new Set(),fighters:[{stocks:3,controls:{jump:'w'}}],resetBtn:{addEventListener(){}},resetMatch(){},update(){ticks++;},draw(){},jump(){jumps++;},requestAnimationFrame(){}});
 vm.runInContext(source.slice(source.indexOf('let previousFrame')),context);
 return {events,context,ticks:()=>ticks,jumps:()=>jumps,run:code=>vm.runInContext(code,context)};
}
test('physics advances equally at 60 and 144 Hz',()=>{
 const simulate=hz=>{const app=setup();for(let i=0;i<=hz*10;i++)app.run(`loop(${i*1000/hz})`);return app.ticks();};
 const sixty=simulate(60),fast=simulate(144);
 assert.ok(Math.abs(sixty-fast)<=1);assert.ok(sixty>=599&&sixty<=600);
});
test('holding jump does not consume a second jump through keyboard repeat',()=>{
 const app=setup();app.events.keydown({key:'w',repeat:false});app.events.keydown({key:'w',repeat:true});assert.equal(app.jumps(),1);
 app.events.blur();assert.equal(app.context.keys.size,0);
});


test('focus loss pauses simulation until deliberate resume, without catch-up',()=>{
 const app=setup();app.run('loop(0);loop(20)');const before=app.ticks();
 app.events.blur();app.run('loop(1000);loop(2000)');assert.equal(app.ticks(),before);
 app.events.keydown({key:'w',repeat:false});assert.equal(app.jumps(),0);
 app.events.keydown({key:'p',repeat:false,preventDefault(){}});
 app.run('loop(3000)');assert.equal(app.ticks(),before);
 app.run('loop(3020)');assert.equal(app.ticks(),before+1);
});
