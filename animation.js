/* Original articulated animation rig. Presentation only: never writes simulation state.
 * Keyframes follow authoritative startup/active/recovery phases; root positions are
 * never delayed/interpolated. Fractional sampling smooths limbs, not gameplay.
 */
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.Smash);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmashAnimation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(S) {
  'use strict';
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const ease = t => {t=clamp(t,0,1);return t*t*(3-2*t);};
  const REST = Object.freeze({ lean: -.06, bob: 0, crouch: 0, spin: 0, sx: 1, sy: 1,
    frontHand: [19,29], backHand: [-15,28], frontFoot: [10,54], backFoot: [-9,54] });
  // Purposeful silhouettes: anticipate -> extend -> follow through -> recover.
  const CLIPS = Object.freeze({
    jab: [{lean:-.25,frontHand:[4,24]}, {lean:.48,frontHand:[40,22],backHand:[-9,31]}, {lean:.22,frontHand:[30,25]}],
    jab2: [{lean:-.16,backHand:[-12,19],frontHand:[25,28]}, {lean:.52,backHand:[36,17],frontHand:[12,36]}, {lean:.26,backHand:[25,25]}],
    jab3: [{lean:.25,crouch:7,frontFoot:[7,44]}, {lean:-.32,frontFoot:[36,11],backFoot:[-7,54],frontHand:[18,29]}, {lean:-.16,frontFoot:[35,24]}],
    tilt: [{lean:-.38,frontHand:[-1,29],backFoot:[-15,54]}, {lean:.62,frontHand:[46,26],backFoot:[-22,54],frontFoot:[18,54]}, {lean:.38,frontHand:[38,27]}],
    up: [{crouch:8,lean:.15,frontHand:[6,40]}, {lean:-.1,sy:1.08,frontHand:[14,-12],backHand:[-8,29]}, {frontHand:[15,-3],lean:.06}],
    sweep: [{crouch:10,frontFoot:[2,51],lean:-.2}, {crouch:14,frontFoot:[40,53],backFoot:[-8,52],frontHand:[18,35],lean:.32}, {crouch:11,frontFoot:[31,53],lean:.1}],
    dashAttack: [{lean:-.24,crouch:7,frontHand:[5,30]}, {lean:.72,crouch:5,frontHand:[27,24],backHand:[5,28],backFoot:[-28,35],frontFoot:[15,53]}, {lean:.48,backFoot:[-23,49],frontFoot:[24,54]}],
    slideKick: [{crouch:13,lean:-.38,frontFoot:[17,53]}, {crouch:19,lean:-.55,frontFoot:[42,53],backFoot:[5,53],backHand:[-15,38],frontHand:[13,34]}, {crouch:15,lean:-.4,frontFoot:[36,54]}],
    nair: [{crouch:4,frontFoot:[7,42],frontHand:[7,23],spin:-.2}, {frontFoot:[36,29],backFoot:[-25,40],frontHand:[23,6],backHand:[-19,19],spin:0}, {frontFoot:[33,26],backFoot:[-24,38],frontHand:[19,12],spin:Math.PI*2}],
    fair: [{lean:.16,crouch:5,frontFoot:[6,39],backFoot:[-7,49]}, {lean:-.35,frontFoot:[33,35],backFoot:[-19,53],frontHand:[25,12],backHand:[-18,19]}, {lean:-.2,frontFoot:[26,44],frontHand:[23,19]}],
    bair: [{lean:.25,frontHand:[20,20],backFoot:[-6,46]}, {lean:.52,backFoot:[-40,29],frontFoot:[11,52],frontHand:[27,22],backHand:[-8,14]}, {lean:.25,backFoot:[-31,37]}],
    uair: [{crouch:5,frontFoot:[8,37],backFoot:[-7,38]}, {bob:-3,lean:.04,frontFoot:[20,9],backFoot:[-16,15],frontHand:[27,32],backHand:[-26,30]}, {frontFoot:[16,18],backFoot:[-18,24],frontHand:[22,26]}],
    dair: [{crouch:7,frontFoot:[10,38],backFoot:[-5,40],frontHand:[11,17]}, {sy:1.1,lean:-.08,frontFoot:[6,66],backFoot:[-12,43],frontHand:[23,14],backHand:[-18,17]}, {sy:1.04,frontFoot:[4,64],backFoot:[-10,44]}],
    fsmash: [{lean:-.6,crouch:4,frontHand:[-17,17],backHand:[8,28],backFoot:[-15,54]}, {lean:.83,frontHand:[47,24],backHand:[13,31],frontFoot:[24,54],backFoot:[-23,54]}, {lean:.62,frontHand:[40,32],frontFoot:[23,54],backFoot:[-18,54]}],
    usmash: [{crouch:12,lean:-.3,frontHand:[-7,40],backHand:[-15,35]}, {sy:1.1,frontHand:[13,-16],backHand:[-14,2],lean:-.12,frontFoot:[9,53]}, {frontHand:[-11,-4],backHand:[-18,15],lean:-.25}],
    dsmash: [{crouch:11,lean:-.2,frontFoot:[2,50],frontHand:[5,30]}, {crouch:14,frontFoot:[41,53],backFoot:[-24,52],frontHand:[-5,30],backHand:[-25,25]}, {crouch:12,frontFoot:[23,53],backFoot:[-39,53],frontHand:[30,25],backHand:[5,32]}],
    grab: [{lean:-.18,frontHand:[6,22]}, {lean:.5,frontHand:[37,23],backHand:[26,31],frontFoot:[18,54]}, {lean:-.25,frontHand:[-3,18],backHand:[-15,29]}],
    rise: [{crouch:8,frontHand:[8,37],backHand:[-6,33]}, {sy:1.12,frontHand:[12,-9],backHand:[-16,24],frontFoot:[9,61],backFoot:[-8,49],lean:.18}, {sy:1.03,frontHand:[14,1],backHand:[-16,18],backFoot:[-15,43],lean:.28}],
    vector: [{crouch:8,lean:-.42,frontHand:[5,22],backHand:[-15,28]}, {lean:.88,frontHand:[43,25],backHand:[6,29],frontFoot:[4,52],backFoot:[-29,41],sx:1.06}, {lean:.54,frontHand:[33,26],backFoot:[-22,48]}],
    flux: [{crouch:9,frontHand:[3,28],backHand:[-2,20]}, {crouch:2,frontHand:[29,17],backHand:[-28,25],frontFoot:[15,54],backFoot:[-14,54],lean:0}, {frontHand:[26,20],backHand:[-24,27]}]
  });
  function pose(overrides={}) { return {...REST,...overrides}; }
  function blend(a,b,t) {
    t=ease(t); const p={};
    for (const key of Object.keys(REST)) p[key]=Array.isArray(a[key]) ? a[key].map((v,i)=>v+(b[key][i]-v)*t) : a[key]+(b[key]-a[key])*t;
    return p;
  }
  function sample(f, fraction=0) {
    const sub = f.hitlag || f.respawn ? 0 : clamp(Number.isFinite(fraction)?fraction:0,0,.999);
    const time=(f.animTick||0)+sub, gait=(f.stride||0)/8 + (f.onGround ? Math.abs(f.vx)*sub/8 : 0);
    let p=pose(), phase=S.movePhase(f), ribbon=0;
    if (f.attack && CLIPS[f.attack.kind]) {
      const m=S.MOVES[f.attack.kind], [wind,strike,follow]=CLIPS[f.attack.kind];
      let age=f.attack.age+sub;
      // Fractional samples cannot visually activate a hit before its simulation frame.
      if (phase.phase==='startup') age=Math.min(age,m.start-.001);
      if (phase.phase==='active') age=Math.min(age,m.start+m.active-.001);
      const rest = f.attack.kind==='nair' ? pose({spin:Math.PI*2}) : pose();
      const keys=[[0,pose()], [Math.max(1,m.start*.55),pose(wind)], [m.start,pose(strike)],
        [m.start+m.active-1,pose(follow)], [m.end,rest]];
      for(let i=1;i<keys.length;i++) if(age<=keys[i][0]) {p=blend(keys[i-1][1],keys[i][1],(age-keys[i-1][0])/(keys[i][0]-keys[i-1][0]));break;}
      ribbon = phase.phase==='active' ? 1 : phase.phase==='recovery' ? Math.max(0,1-(age-m.start-m.active)/5) : 0;
    } else if(f.charge) {
      p=pose(CLIPS[f.charge.kind][0]);p.crouch+=Math.min(3,f.charge.frames/15);p.bob=Math.sin(time*.6)*.35;
    } else if(f.hitstun || f.hitlag && f.pending) {
      p=pose({lean:clamp(-f.vx*.07,-.7,.7),spin:!f.onGround&&f.hitstun>8 ? Math.sin(time*.13)*.35 : 0,
        frontHand:[-5,7],backHand:[-22,17],frontFoot:[18,44],backFoot:[-17,48],sx:f.hitlag?1.1:1,sy:f.hitlag?.9:1});
    } else if(f.state==='ledge') {
      p=pose({frontHand:[15,13],backHand:[6,23],frontFoot:[13,55],backFoot:[-4,51],lean:.15});
    } else if(f.state==='roll' || f.state==='tech') {
      p=pose({crouch:14,spin:(1-f.timer/(f.state==='roll'?25:18))*Math.PI*2,frontHand:[9,35],backHand:[-10,34],frontFoot:[8,47],backFoot:[-8,47],sx:.9,sy:.94});
    } else if(f.state==='spotDodge') {
      p=pose({lean:-.5,crouch:9,sx:.75,frontHand:[4,16],backHand:[-5,21]});
    } else if(f.state==='airDodge') {
      p=pose({spin:clamp(f.vx*.06,-.8,.8),frontHand:[13,19],backHand:[-13,20],frontFoot:[14,41],backFoot:[-12,42],sx:.93});
    } else if(f.state==='jumpSquat') {
      p=pose({crouch:9*(1-f.timer/4),frontHand:[-5,34],backHand:[-19,32],frontFoot:[13,54],backFoot:[-12,54]});
    } else if(f.state==='shield') {
      p=pose({crouch:4,lean:-.15,frontHand:[17,13],backHand:[9,27],frontFoot:[13,54],backFoot:[-13,54]});
    } else if(f.state==='special') {
      const wind=f.timer>18;
      p=pose(wind?{lean:-.3,frontHand:[-3,23]}:{lean:.35,frontHand:[34,24],backHand:[-11,32]});
    } else if(f.onGround && f.glide>0) {
      p=pose({crouch:15,lean:-.45,frontFoot:[28,54],backFoot:[2,54],frontHand:[13,34],backHand:[-14,27]});
    } else if(f.onGround && f.previous.y>.5) {
      p=pose({crouch:14,frontFoot:[15,54],backFoot:[-13,54],frontHand:[23,35],backHand:[-11,33]});
    } else if(f.onGround && Math.abs(f.vx)>.7) {
      const stride=Math.sin(gait), bstride=Math.sin(gait+Math.PI), amount=clamp(Math.abs(f.vx)/6.4,0,1.3);
      p=pose({lean:.12+amount*.32,bob:-Math.abs(Math.cos(gait))*.9,
        frontFoot:[stride*18*amount,54-Math.max(0,Math.cos(gait))*12*amount],
        backFoot:[bstride*18*amount,54-Math.max(0,Math.cos(gait+Math.PI))*12*amount],
        frontHand:[10-stride*15,28+stride*4],backHand:[-7+stride*14,30-stride*4]});
    } else if(!f.onGround) {
      const fall=f.vy>0;
      p=pose({lean:clamp(f.vx*.03,-.25,.25),frontHand:fall?[24,13]:[12,21],backHand:fall?[-23,19]:[-20,26],
        frontFoot:fall?[13,49]:[15,41],backFoot:fall?[-10,56]:[-11,53],bob:Math.sin(time*.07)*.3});
      if(f.helpless) {p.frontHand=[24,9];p.backHand=[-22,14];}
    } else {p.bob=Math.sin(time*.045)*.5;p.lean=-.06+Math.sin(time*.034)*.025;}
    if(f.landSquash && !f.attack) {const amount=f.landSquash/7;p.sy*=1-.11*amount;p.sx*=1+.07*amount;}
    if(f.takeoffStretch && !f.onGround && !f.attack) {const amount=f.takeoffStretch/7;p.sy*=1+.08*amount;p.sx*=1-.04*amount;}
    return {...p, phase:phase.phase, kind:phase.kind, time, ribbon};
  }
  // Analytic two-bone IK: fixed-length limbs, finite even for coincident endpoints.
  function limb(start,target,a,b,bend=1) {
    let dx=target[0]-start[0],dy=target[1]-start[1];const raw=Math.hypot(dx,dy);
    const length=clamp(raw,Math.abs(a-b)+.001,a+b-.001),angle=raw?Math.atan2(dy,dx):Math.PI/2;
    const end=[start[0]+Math.cos(angle)*length,start[1]+Math.sin(angle)*length];
    const turn=Math.acos(clamp((a*a+length*length-b*b)/(2*a*length),-1,1))*bend;
    return [start,[start[0]+Math.cos(angle+turn)*a,start[1]+Math.sin(angle+turn)*a],end];
  }
  return Object.freeze({sample,limb,CLIPS,blend});
});
