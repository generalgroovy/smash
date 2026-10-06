(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlatformFighter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const actions = ["jump", "light", "strong", "special", "dodge"];
  const emptyInput = () => ({x:0, y:0, jump:false, light:false, strong:false, special:false, dodge:false});
  const box = (x, y, w, h) => ({x,y,w,h});
  const move = (name, kind, startup, active, recovery, damage, base, growth, angle, color, shape, boxes, extra={}) =>
    ({name,kind,startup,active,recovery,damage,base,growth,angle,color,shape,boxes,...extra});
  const MOVES = {
    jab: move("Jab", "light", 3,3,9, 5,3.8,.025,25,"#a5f3fc","slash",[box(14,-13,42,27)]),
    side: move("Arc slash", "light", 6,4,13, 8,6,.052,32,"#a5f3fc","slash",[box(12,-22,59,39)]),
    dash: move("Dash strike", "light", 7,5,18, 9,6.8,.058,42,"#67e8f9","slash",[box(12,-14,53,32)]),
    up: move("Rising palm", "light", 5,5,10, 7,9,.035,87,"#c4b5fd","rise",[box(-23,-58,56,56)]),
    sweep: move("Sweep", "light", 5,4,13, 6,5,.03,65,"#6ee7b7","wave",[box(5,9,65,23)],{trip:true}),
    nair: move("Orbit", "light", 5,7,12, 7,5.7,.043,55,"#a5f3fc","ring",[box(-40,-39,80,74)],{outward:true,landing:6}),
    fair: move("Air slash", "light", 7,5,15, 10,7.2,.065,35,"#67e8f9","slash",[box(8,-28,65,52)],{landing:8}),
    bair: move("Back kick", "light", 6,4,17, 12,8,.077,30,"#f9a8d4","slash",[box(-73,-16,66,37)],{reverse:true,landing:9}),
    uair: move("Sky arc", "light", 5,5,12, 7,6.6,.05,86,"#c4b5fd","rise",[box(-32,-63,64,45)],{landing:7}),
    dair: move("Meteor heel", "light", 11,5,20, 12,7.7,.075,-78,"#fca5a5","spike",[box(-20,13,45,65)],{landing:13,spike:true}),
    strongSide: move("Comet smash", "strong", 11,4,25, 15,10,.12,27,"#fbbf24","slash",[box(8,-27,83,54)]),
    strongUp: move("Star breaker", "strong", 10,5,25, 14,10,.105,88,"#fbbf24","rise",[box(-34,-84,68,88)]),
    strongDown: move("Fault line", "strong", 13,5,27, 13,9,.105,28,"#fbbf24","wave",[box(-89,2,178,29)],{outward:true}),
    bolt: move("Pulse bolt", "special", 12,1,20, 7,5,.043,25,"#93c5fd","bolt",[],{projectile:true}),
    burst: move("Vector burst", "special", 9,8,25, 11,8.2,.076,34,"#2dd4bf","slash",[box(8,-19,58,39)]),
    recover: move("Sky rise", "special", 4,12,23, 8,7,.05,80,"#c4b5fd","rise",[box(-28,-48,56,77)]),
    pulse: move("Repulse", "special", 16,5,24, 10,7.8,.072,72,"#f9a8d4","ring",[box(-76,-40,152,79)],{outward:true})
  };
  const STAGES = {
    triad: {name:"Skyline",platforms:[{x:170,y:435,w:620,h:28,solid:true},{x:255,y:325,w:155,h:16},{x:550,y:325,w:155,h:16},{x:415,y:225,w:130,h:16}]},
    duel: {name:"Crossroads",platforms:[{x:145,y:435,w:670,h:28,solid:true},{x:390,y:300,w:180,h:16}]}
  };
  const practicePrompts = ["Move with A / D, or the direction pad.","Jump. Release early for a short hop.","Land a light attack on P2.","Land a strong attack. Hold to charge; release to strike.","Land a special. Direction changes its effect.","Try a parry or directional dodge.","Mix launchers, aerials and finishers. Unlimited stocks; reset any time."];
  const practiceFocuses = ["basics","combos","recoveryLeft","recoveryRight"];
  const recoveryPractice = s => s.mode==="training" && s.practiceFocus.startsWith("recovery");

  function placePractice(s,f) {
    if (s.mode!=="training") return;
    if (s.practiceFocus==="combos" && f.id===1) f.x=358;
    if (recoveryPractice(s) && f.id===0) {
      const floor=s.platforms.find(p=>p.solid),left=s.practiceFocus==="recoveryLeft";
      Object.assign(f,{x:left?floor.x-100:floor.x+floor.w+62,y:floor.y-65,vx:0,vy:1,
        onGround:false,platform:-1,jumps:1,coyote:0,facing:left?1:-1});
    }
  }
  function practiceInput(s) {
    const f=s.fighters[1],input=emptyInput();
    // Buffer a normal dodge near the end of hitstun. No invulnerability or
    // reaction shortcut is granted: the ordinary controls resolve the escape.
    if (s.practiceFocus==="combos" && f.comboOwner===0 && f.hitstun<=7 && (f.onGround || !f.airDodgeUsed)) {
      input.x=f.x>=s.fighters[0].x?1:-1;input.dodge=true;
    }
    return input;
  }

  function makeFighter(id, training) {
    return {id,name:id ? "Ember" : "Nova",color:id ? "#fb7185" : "#67e8f9",x:id ? (training ? 430 : 600) : 320,y:381,w:38,h:54,
      vx:0,vy:0,facing:id ? -1 : 1,damage:0,stocks:3,onGround:true,platform:0,jumps:2,hitstun:0,hitFlash:0,invuln:0,landingLag:0,
      fastFall:false,airDodgeUsed:false,recoveryUsed:false,specialCooldown:0,move:null,defense:null,combo:0,comboTimer:0,
      lastMove:"",labelTimer:0,lastDamage:0,prev:emptyInput(),input:emptyInput(),buffer:{},bufferIntent:{},dropTimer:0,coyote:5,sliding:0,
      recentDodge:99,history:[],airBurstUsed:false,jumpCut:false,pendingCut:false,comboDamage:0};
  }
  function createGame(options={}) {
    const mode = ["cpu","versus","training"].includes(options.mode) ? options.mode : "cpu";
    const stageId = STAGES[options.stage] ? options.stage : "triad";
    const practiceFocus=mode==="training" && practiceFocuses.includes(options.practiceFocus)?options.practiceFocus:"basics";
    const s={width:960,height:540,frame:0,mode,stageId,practiceFocus,platforms:STAGES[stageId].platforms.map(p=>({...p})),
      fighters:[makeFighter(0,mode==="training"),makeFighter(1,mode==="training")],projectiles:[],effects:[],events:[],
      winner:null,hitstop:0,shake:0,practiceStep:0,practiceBest:0,practiceComplete:false,practiceText:practicePrompts[0],lastHit:null};
    if (practiceFocus==="combos") s.practiceText="Up + Light, then Jump + Up + Light. The target tries to dodge gaps.";
    if (recoveryPractice(s)) s.practiceText=`Return from the ${practiceFocus==="recoveryLeft"?"left":"right"} edge: steer inward, Jump, then Up + Special.`;
    s.fighters.forEach(f=>placePractice(s,f));
    return s;
  }
  function effect(s,type,x,y,color,text="",life=18,direction=1) {
    s.effects.push({type,x,y,color,text,life,maxLife:life,direction});
    if (s.effects.length>80) s.effects.shift();
  }
  function event(s,type,details={}) { s.events.push({type,...details}); }
  function progress(s,index) {
    if (s.mode!=="training" || s.practiceFocus!=="basics" || s.practiceStep!==index) return;
    s.practiceStep++; s.practiceText=practicePrompts[s.practiceStep];
  }
  function normalize(input={}) {
    const v=emptyInput();
    v.x=Number.isFinite(input.x) ? clamp(input.x,-1,1) : 0;
    v.y=Number.isFinite(input.y) ? clamp(input.y,-1,1) : 0;
    for (const key of actions) v[key]=!!input[key];
    return v;
  }
  function sample(f, input) {
    f.input=normalize(input);
    for (const key of actions) if (f.input[key] && !f.prev[key]) {f.buffer[key]=7;f.bufferIntent[key]={x:f.input.x,y:f.input.y};}
    if (f.input.dodge && !f.prev.dodge) f.recentDodge=0;
    if (f.input.y>.5 && f.prev.y<=.5) f.buffer.down=7;
    if (!f.input.jump && f.prev.jump) f.pendingCut=true;
    f.prev={...f.input};
  }
  function clearInputs(s) {
    for (const f of s.fighters) {
      f.prev=emptyInput();f.input=emptyInput();f.buffer={};f.bufferIntent={};f.pendingCut=false;
      if (f.move?.charging) {f.move=null;f.landingLag=Math.max(f.landingLag,6);}
    }
  }
  function overlapping(a,b) {return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
  function attackBoxes(f) {
    const a=f.move,d=a && MOVES[a.id];
    if (!d || a.charging || a.frame<d.startup || a.frame>=d.startup+d.active) return [];
    const cx=f.x+f.w/2,cy=f.y+f.h/2;
    return d.boxes.map(b=>({x:cx+(f.facing>0?b.x:-b.x-b.w),y:cy+b.y,w:b.w,h:b.h}));
  }
  function chooseMove(f,kind,intent=f.input) {
    const {x,y}=intent;
    if (kind==="special") return y<-.5 ? "recover" : y>.5 ? "pulse" : Math.abs(x)>.4 ? "burst" : "bolt";
    if (!f.onGround) return y<-.5 ? "uair" : y>.5 ? "dair" : Math.abs(x)<.4 ? "nair" : Math.sign(x)===f.facing ? "fair" : "bair";
    if (kind==="strong") return y<-.5 ? "strongUp" : y>.5 ? "strongDown" : "strongSide";
    return y<-.5 ? "up" : y>.5 ? "sweep" : Math.abs(x)<.4 ? "jab" : Math.abs(f.vx)>5.3 ? "dash" : "side";
  }
  function startMove(s,f,kind,intent=f.input) {
    const id=chooseMove(f,kind,intent),d=MOVES[id];
    if (id==="recover" && f.recoveryUsed || id==="burst" && !f.onGround && f.airBurstUsed || kind==="special" && f.specialCooldown>0) return false;
    // Ground attacks may turn on input; aerial facing stays stable for back airs.
    if ((f.onGround || id==="burst") && Math.abs(intent.x)>.4) f.facing=Math.sign(intent.x);
    f.move={id,frame:0,charge:0,charging:d.kind==="strong" && f.input.strong,hit:new Set()};
    f.invuln=0;
    f.lastMove=d.name;f.labelTimer=55;
    if (d.kind==="strong") f.vx*=.25;
    if (id==="recover") {f.recoveryUsed=true;f.fastFall=false;}
    if (id==="burst" && !f.onGround) f.airBurstUsed=true;
    if (kind==="special") f.specialCooldown=id==="bolt"?55:24;
    event(s,"attack",{fighter:f.id,move:id});
    return true;
  }
  function jump(s,f,intent=f.input) {
    if (intent.y>.5 && f.onGround && !s.platforms[f.platform]?.solid) {
      f.dropTimer=16;f.y+=4;f.onGround=false;f.platform=-1;f.coyote=0;f.jumps=Math.min(f.jumps,1);f.vy=2;
      return true;
    }
    if (f.jumps<=0) return false;
    f.vy=f.onGround || f.coyote>0 ? -12.9 : -12.2;f.jumps--;f.onGround=false;f.platform=-1;f.coyote=0;
    f.fastFall=false;f.jumpCut=false;f.pendingCut=!f.input.jump;
    effect(s,"jump",f.x+f.w/2,f.y+f.h,f.color,"",14);event(s,"jump",{fighter:f.id});
    if (f.id===0) progress(s,1);
    return true;
  }
  function defend(s,f,intent=f.input) {
    if (!f.onGround && f.airDodgeUsed) return false;
    const x=Math.abs(intent.x)>.3 ? Math.sign(intent.x) : 0;
    const y=Math.abs(intent.y)>.3 ? Math.sign(intent.y) : 0;
    const type=f.onGround ? (x ? "roll" : "parry") : "air";
    f.defense={type,frame:0,dir:x||f.facing};f.recentDodge=0;
    if (type==="roll") f.vx=x*9;
    if (type==="air") {
      const dx=x || (!y?f.facing:0),len=Math.hypot(dx,y)||1;
      f.vx=dx/len*12;f.vy=y/len*12;f.airDodgeUsed=true;f.fastFall=false;
    }
    f.lastMove=type==="parry"?"Parry":type==="roll"?"Roll":"Air dodge";f.labelTimer=30;
    effect(s,"dodge",f.x+f.w/2,f.y+f.h/2,"#e0e7ff", "",14);
    if (f.id===0) progress(s,5);
    return true;
  }
  function controls(s,f) {
    if (f.hitstun>0 || f.landingLag>0 || f.move || f.defense || f.stocks<=0) return;
    if (f.buffer.dodge>0 && defend(s,f,f.bufferIntent.dodge)) {f.buffer.dodge=0;return;}
    if (f.buffer.jump>0 && jump(s,f,f.bufferIntent.jump)) f.buffer.jump=0;
    for (const kind of ["special","strong","light"]) {
      if (f.buffer[kind]>0 && startMove(s,f,kind,f.bufferIntent[kind])) {f.buffer[kind]=0;break;}
    }
  }
  function advanceMove(s,f) {
    if (!f.move) return;
    const a=f.move,d=MOVES[a.id];
    if (a.charging) {
      if (f.input.strong && a.charge<60) {
        a.charge++;
        if (a.charge===60) event(s,"charge",{fighter:f.id});
        return;
      }
      a.charging=false;
    }
    a.frame++;
    if (a.frame===d.startup) {
      if (a.id==="burst") {f.vx=f.facing*12;f.vy*=.35;}
      if (a.id==="recover") {f.vy=-17;f.vx=f.input.x*4;f.onGround=false;f.platform=-1;f.jumps=0;f.recoveryUsed=true;}
      if (a.id==="dash") f.vx=f.facing*9;
      if (d.projectile && !s.projectiles.some(p=>p.owner===f.id)) {
        s.projectiles.push({owner:f.id,x:f.x+f.w/2+f.facing*30-9,y:f.y+20,w:18,h:14,vx:f.facing*8,vy:0,life:75,color:d.color,damage:d.damage,base:d.base,growth:d.growth,angle:d.angle});
      }
    }
    if (a.frame>=d.startup+d.active+d.recovery) f.move=null;
  }
  function invincible(f) {
    const d=f.defense;
    return f.invuln>0 || !!(d && ((d.type==="roll" && d.frame>=3 && d.frame<=14) || (d.type==="air" && d.frame>=2 && d.frame<=10)));
  }
  function parrying(f) {return f.defense?.type==="parry" && f.defense.frame>=1 && f.defense.frame<=6;}
  function physics(s,f) {
    const prevBottom=f.y+f.h,wasGround=f.onGround;
    if (f.pendingCut) {
      if (!f.jumpCut && f.vy<-5.8 && !f.hitstun && f.move?.id!=="recover") {f.vy=-5.8;f.jumpCut=true;}
      f.pendingCut=false;
    }
    if (!f.hitstun && !f.defense && !f.move?.charging && f.move?.id!=="recover" && f.input.y>.5 && f.vy>0 && f.buffer.down>0) f.fastFall=true;
    const free=!f.hitstun && !f.defense && !f.landingLag && !f.move?.charging;
    if (free && (!f.move || !wasGround)) {
      const acceleration=wasGround?1.15:.46,max=wasGround?6.4:5.7;
      if (f.input.x) {
        if (Math.abs(f.vx)<=max) f.vx=clamp(f.vx+f.input.x*acceleration,-max,max);
        else if (Math.sign(f.input.x)!==Math.sign(f.vx)) f.vx+=f.input.x*acceleration;
        if (wasGround && !f.move) f.facing=Math.sign(f.input.x);
        if (f.id===0) progress(s,0);
      }
    }
    const airDodge=f.defense?.type==="air" && f.defense.frame<10;
    if (!airDodge) f.vy=Math.min(f.hitstun>0?30:(f.fastFall?20:14),f.vy+(f.fastFall?1.3:.58));
    f.x+=f.vx;f.y+=f.vy;f.onGround=false;f.platform=-1;
    if (f.vy>=0) for (let i=0;i<s.platforms.length;i++) {
      const p=s.platforms[i];
      if ((!p.solid && f.dropTimer>0) || prevBottom>p.y+1 || f.y+f.h<p.y || f.x+f.w<=p.x || f.x>=p.x+p.w) continue;
      const impact=f.vy;
      f.y=p.y-f.h;f.vy=0;f.onGround=true;f.platform=i;f.jumps=2;f.coyote=5;
      f.airDodgeUsed=false;f.recoveryUsed=false;f.airBurstUsed=false;f.fastFall=false;f.jumpCut=false;
      if (!wasGround) {
        if (f.hitstun>0 && impact>10) {
          if (f.recentDodge<=7) {f.hitstun=0;f.landingLag=8;f.invuln=Math.max(f.invuln,12);f.vx*=.5;effect(s,"tech",f.x+19,p.y,"#6ee7b7","TECH",25);event(s,"tech",{fighter:f.id});}
          else {f.vy=-impact*.56;f.onGround=false;f.platform=-1;f.hitstun=Math.max(f.hitstun,14);effect(s,"land",f.x+19,p.y,"#fca5a5","",16);}
        } else {
          if (f.move && MOVES[f.move.id].landing) {f.landingLag=MOVES[f.move.id].landing;f.move=null;}
          if (f.defense?.type==="air") {f.defense=null;f.sliding=14;f.landingLag=7;}
          effect(s,"land",f.x+19,p.y,f.color,"",12);
        }
      }
      break;
    }
    if (!f.onGround && wasGround && f.vy>=0) f.coyote=5;
    if (!f.onGround && !f.coyote && f.jumps===2) f.jumps=1;
    if (f.hitstun>0) f.vx*=.993;
    else if (airDodge) f.vx*=.985;
    else if (f.onGround) f.vx*=f.sliding>0?.965:(!f.input.x || f.move || f.defense?.type==="parry")?.77:.93;
    else f.vx*=.993;
    if (Math.abs(f.vx)<.025) f.vx=0;
  }
  function applyHit(s,attacker,victim,descriptor,source) {
    // Read this before replacing hitstun. A combo must connect before the
    // defender has a legal action frame; the HUD grace period is display only.
    const connected=victim.hitstun>0 && victim.comboOwner===attacker.id && attacker.combo>0;
    const repeated=attacker.history.filter(id=>id===source.id).length;
    const stale=1-Math.min(3,repeated)*.07;
    const charged=source.charge ? source.charge/60 : 0;
    const damage=Math.round(descriptor.damage*(1+.6*charged)*stale*10)/10;
    const direction=descriptor.outward ? (victim.x+victim.w/2>=attacker.x+attacker.w/2?1:-1) : (descriptor.reverse?-1:1)*source.facing;
    let angle=descriptor.angle*Math.PI/180;
    // A modest perpendicular input changes launch angle, never raw launch power.
    const dx=direction*Math.cos(angle),dy=-Math.sin(angle);
    const influence=clamp(victim.input.x*(-dy)+victim.input.y*dx,-1,1)*.17;
    const worldAngle=Math.atan2(dy,dx)+influence;
    victim.damage=Math.round((victim.damage+damage)*10)/10;
    const force=(descriptor.base+victim.damage*descriptor.growth)*(1+.38*charged)*(.94+.06*stale);
    victim.vx=Math.cos(worldAngle)*force;victim.vy=Math.sin(worldAngle)*force;
    victim.hitstun=clamp(Math.round(9+force*1.35+(descriptor.trip && victim.onGround?7:0)),12,46);
    victim.hitFlash=16;victim.lastDamage=damage;victim.move=null;victim.defense=null;victim.landingLag=0;
    victim.fastFall=false;victim.onGround=false;victim.platform=-1;victim.coyote=0;victim.jumps=Math.min(victim.jumps,1);
    victim.buffer={};victim.pendingCut=false;
    attacker.combo=connected?attacker.combo+1:1;
    attacker.comboDamage=Math.round((connected?attacker.comboDamage+damage:damage)*10)/10;
    attacker.comboTimer=victim.hitstun+18;victim.comboOwner=attacker.id;
    attacker.history.push(source.id);if(attacker.history.length>3)attacker.history.shift();
    s.lastHit={attacker:attacker.id,victim:victim.id,move:descriptor.name,damage,combo:attacker.combo,comboDamage:attacker.comboDamage};
    s.hitstop=Math.max(s.hitstop,descriptor.kind==="strong"?8:5);s.shake=Math.max(s.shake,descriptor.kind==="strong"?7:3);
    effect(s,"hit",victim.x+victim.w/2,victim.y+victim.h/2,descriptor.color,`+${damage}`,24,direction);
    event(s,"hit",{...s.lastHit,kind:descriptor.kind});
    if(attacker.id===0) {
      if(s.mode==="training" && s.practiceFocus==="combos") {
        s.practiceBest=Math.max(s.practiceBest,attacker.combo);
        s.practiceText=attacker.combo>1?`${attacker.combo}-hit combo · ${attacker.comboDamage} damage. Best: ${s.practiceBest}. Retry to repeat.`:"Hit! Follow before the target can dodge.";
      }
      if(descriptor.kind==="light")progress(s,2);
      else if(descriptor.kind==="strong")progress(s,3);
      else if(descriptor.kind==="special")progress(s,4);
    }
  }
  function collisions(s) {
    // Snapshot contacts first: simultaneous active attacks trade without P1 priority.
    const contacts=[];
    for (const attacker of s.fighters) {
      if (!attacker.move || attacker.stocks<=0) continue;
      const a=attacker.move,d=MOVES[a.id],boxes=attackBoxes(attacker);
      for (const victim of s.fighters) if(victim!==attacker && victim.stocks>0 && !a.hit.has(victim.id) && boxes.some(b=>overlapping(b,victim)))
        contacts.push({attacker,victim,d,source:{id:a.id,charge:a.charge,facing:attacker.facing},swing:a});
    }
    for(const p of s.projectiles) {
      if(p.life<=0)continue;
      const victim=s.fighters[1-p.owner];
      if(victim.stocks>0 && overlapping(p,victim))contacts.push({attacker:s.fighters[p.owner],victim,d:MOVES.bolt,source:{id:"bolt",charge:0,facing:Math.sign(p.vx)},projectile:p});
    }
    const parried=new Set();
    for(const c of contacts) {
      if(!parrying(c.victim) || invincible(c.victim))continue;
      c.parried=true;parried.add(c.attacker.id);
      if(c.swing)c.swing.hit.add(c.victim.id);
      if(c.projectile)c.projectile.life=0;
      else {c.attacker.hitstun=Math.max(c.attacker.hitstun,30);c.attacker.move=null;c.attacker.buffer={};c.attacker.vx*=.35;}
      c.victim.defense=null;c.victim.invuln=Math.max(c.victim.invuln,12);
      s.hitstop=Math.max(s.hitstop,8);
      effect(s,"parry",c.victim.x+19,c.victim.y+27,"#fef08a","PARRY",30);event(s,"parry",{fighter:c.victim.id});
    }
    for(const c of contacts) {
      if(c.parried || parried.has(c.attacker.id) || invincible(c.victim))continue;
      if(c.swing)c.swing.hit.add(c.victim.id);
      if(c.projectile)c.projectile.life=0;
      applyHit(s,c.attacker,c.victim,c.d,c.source);
    }
  }
  function respawn(s,f) {
    const stocks=f.stocks,history=f.history,held={...f.input};
    Object.assign(f,makeFighter(f.id,s.mode==="training"),{stocks,history,y:s.mode==="training"?381:140,onGround:s.mode==="training",platform:s.mode==="training"?0:-1,invuln:s.mode==="training"?24:100});
    placePractice(s,f);
    if(recoveryPractice(s) && f.id===0) {s.practiceComplete=false;s.practiceText="Try again: steer inward, Jump, then Up + Special. Land to refill both.";}
    // Neutralize held actions through the respawn; a new press is needed.
    f.prev=held;f.input=held;
    s.projectiles=s.projectiles.filter(p=>p.owner!==f.id);
  }
  function knockouts(s) {
    for(const f of s.fighters) {
      if(f.stocks<=0 || !(f.x+f.w<-155 || f.x>s.width+155 || f.y>s.height+155 || f.y+f.h<-180))continue;
      effect(s,"ko",clamp(f.x+19,15,s.width-15),clamp(f.y+27,70,s.height-12),f.color,"KO",40);
      event(s,"ko",{fighter:f.id});s.shake=9;
      if(s.mode!=="training")f.stocks--;
      f.move=null;f.defense=null;f.buffer={};
      if(f.stocks>0)respawn(s,f);
    }
    if(s.mode!=="training" && s.fighters.some(f=>f.stocks<=0)) {
      s.winner=s.fighters.every(f=>f.stocks<=0)?"draw":s.fighters[0].stocks>0?0:1;
      clearInputs(s);event(s,"win",{winner:s.winner});
    }
  }
  function step(s,inputs=[]) {
    s.events=[];
    if(s.winner!==null)return s;
    s.frame++;
    s.effects=s.effects.filter(e=>--e.life>0);s.shake=Math.max(0,s.shake-.6);
    for(let i=0;i<2;i++)sample(s.fighters[i],s.mode==="training"&&i===1?practiceInput(s):inputs[i]);
    if(s.hitstop>0){s.hitstop--;return s;}
    for(const f of s.fighters) {
      if(f.stocks<=0)continue;
      for(const key of ["hitstun","hitFlash","invuln","landingLag","specialCooldown","dropTimer","coyote","sliding","labelTimer","comboTimer"])if(f[key]>0)f[key]--;
      if(!f.comboTimer)f.combo=0;
      if(!f.hitstun && f.comboOwner!==undefined) {
        if(s.mode==="training" && s.practiceFocus==="combos" && f.id===1) {
          const chain=s.fighters[0];
          s.practiceText=chain.combo>1?`${chain.combo}-hit combo · ${chain.comboDamage} damage. Target can act now. Retry to repeat.`:`Escape window. Best: ${s.practiceBest} hit${s.practiceBest===1?"":"s"}. Retry, then follow sooner.`;
        }
        delete f.comboOwner;
      }
      f.recentDodge++;
      if(f.defense) {
        f.defense.frame++;
        if(f.defense.frame>=(f.defense.type==="parry"?28:f.defense.type==="roll"?30:27))f.defense=null;
      }
      controls(s,f);advanceMove(s,f);physics(s,f);
      if(recoveryPractice(s) && f.id===0 && f.onGround && !s.practiceComplete) {
        s.practiceComplete=true;s.practiceText="Recovered! Landing refills Jump, Dodge and Up + Special. Retry to repeat.";
        event(s,"practice-success",{fighter:0});
      }
      for(const key of Object.keys(f.buffer))if(f.buffer[key]>0)f.buffer[key]--;
    }
    for(const p of s.projectiles){p.x+=p.vx;p.y+=p.vy;p.life--;}
    knockouts(s);
    if(s.winner===null)collisions(s);
    s.projectiles=s.projectiles.filter(p=>p.life>0 && p.x>-180 && p.x<s.width+180);
    return s;
  }
  return {createGame,step,clearInputs,attackBoxes,MOVES,STAGES};
});
