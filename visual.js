/* Kinetic Print: presentation-only palette, marks and arena drawing.
 * No engine writes, random numbers, timers, DOM access or collision decisions.
 * A detached canvas in game.js caches the static backdrop at display resolution.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SmashVisual=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const INK='#172924', PAPER='#eee9da', ACCENT='#d1eb72';
  const PLAYERS=Object.freeze([
    Object.freeze({color:'#70d9ec',shadow:'#367782',mark:'diamond',label:'01'}),
    Object.freeze({color:'#ff927e',shadow:'#975b51',mark:'circle',label:'02'})
  ]);
  const MATERIALS=Object.freeze({
    fire:Object.freeze({color:'#ffaf6f',glyph:'teeth',label:'Fire'}),
    water:Object.freeze({color:'#7ddcf0',glyph:'wave',label:'Water'}),
    oil:Object.freeze({color:'#b6a0ed',glyph:'beads',label:'Oil'}),
    spark:Object.freeze({color:'#f4e296',glyph:'zigzag',label:'Spark'}),
    charged:Object.freeze({color:'#f4e296',glyph:'double-zigzag',label:'Charged water'}),
    steam:Object.freeze({color:'#d0e4d8',glyph:'updraft',label:'Steam'})
  });
  const PHASES=Object.freeze({startup:Object.freeze({label:'WINDUP',pattern:'outline'}),
    active:Object.freeze({label:'ACTIVE',pattern:'solid'}),
    recovery:Object.freeze({label:'RECOVER',pattern:'dotted'})});
  function preferences(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    return {focus:raw.focus===true,cues:raw.cues!==false,
      motion:['system','reduced','full'].includes(raw.motion)?raw.motion:'system'};
  }
  function reduced(prefs,system=false){return prefs.motion==='reduced'||prefs.motion==='system'&&system;}
  function cue(f,phase){
    // A freeze is not a new attack phase: retain the authoritative phase pattern.
    if(f.respawn||f.stocks<=0)return null;
    if(f.helpless)return {label:'NO ACTION',pattern:'dotted'};
    if(!f.attack||!Object.hasOwn(PHASES,phase?.phase))return null;
    return {...PHASES[phase.phase],label:f.hitlag?'FREEZE':PHASES[phase.phase].label};
  }
  const player=id=>PLAYERS[id===1?1:0];
  const material=name=>Object.hasOwn(MATERIALS,name)?MATERIALS[name]:null;
  function path(ctx,points,fill,stroke=null,width=1,close=true){
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(close)ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function line(ctx,x,y,xx,yy,color,width=1){path(ctx,[[x,y],[xx,yy]],null,color,width,false);}
  function ring(ctx,x,y,r,fill,stroke=null,width=1){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function mark(ctx,x,y,r,id,fill=null,stroke=null,width=1){
    if(id===1)ring(ctx,x,y,r,fill,stroke,width);
    else path(ctx,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]],fill,stroke,width);
  }
  function label(ctx,value,x,y,size,color,align='left'){
    ctx.font=`600 ${size}px ui-monospace,monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);
  }
  function backdrop(ctx,{stage='triad',focus=false}={}){
    ctx.save();ctx.fillStyle=INK;ctx.fillRect(0,0,960,540);
    if(!focus){
      // A single cut eclipse, registration marks and carved contours; no generic grid.
      const cx=stage==='flat'?566:480,cy=stage==='flat'?219:209,r=stage==='flat'?153:167;
      ring(ctx,cx,cy,r,'#435044');
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
      path(ctx,[[cx-210,cy+94],[cx+185,cy-104],[cx+210,cy+150],[cx-165,cy+170]],'#293b32');
      for(let i=0;i<10;i++)line(ctx,cx-170,cy+111+i*8,cx+170,cy-59+i*8,'#626b502e');
      ctx.restore();
      ctx.save();ctx.translate(cx,cy);ctx.rotate(-.38);ctx.scale(1,.32);
      ring(ctx,0,0,r+63,null,'#82936538',2);ring(ctx,0,0,r+71,null,'#82936520');ctx.restore();
      // A broken contour field sits in the margins, away from the playable ledges.
      for(let side=0;side<2;side++){
        ctx.save();if(side){ctx.translate(960,0);ctx.scale(-1,1);}
        for(let i=0;i<7;i++){
          ctx.beginPath();ctx.moveTo(-30,90+i*15);
          ctx.bezierCurveTo(200,175+i*14,-70,270+i*16,195,520+i*10);
          ctx.strokeStyle='#8f9b7630';ctx.lineWidth=i===0?2:.8;ctx.stroke();
        }ctx.restore();
      }
      path(ctx,[[0,440],[70,411],[111,419],[153,490],[214,540],[0,540]],'#10231f');
      path(ctx,[[735,540],[824,445],[866,433],[895,454],[960,434],[960,540]],'#10231f');
      for(let i=0;i<22;i++){
        const x=28+i*43;line(ctx,x,501,x,501+(i%5===0?10:4),'#9fa78a35');
      }
      label(ctx,stage==='triad'?'I / TRIAD':'II / FLATLINE',30,38,10,'#b4b9a0');
      label(ctx,'MOVEMENT STUDIES',930,38,9,'#b4b9a0','right');
      for(const [x,y] of [[24,58],[936,58],[24,480],[936,480]]){
        line(ctx,x-4,y,x+4,y,'#9aa78870');line(ctx,x,y-4,x,y+4,'#9aa78870');
      }
    }
    ctx.restore();
  }
  function platforms(ctx,platforms,{focus=false}={}){
    ctx.save();
    for(const [index,p] of platforms.entries()){
      // The visible top, underside and endcaps match the actual collision rectangle.
      path(ctx,[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]],'#263c34');
      if(!focus){
        path(ctx,[[p.x,p.y+4],[p.x+p.w,p.y+4],[p.x+p.w-13,p.y+p.h],[p.x+21,p.y+p.h]],'#4a5545');
        path(ctx,[[p.x+21,p.y+p.h],[p.x+p.w*.46,p.y+7],[p.x+p.w*.79,p.y+p.h]],'#314337');
        // Strata / inlay detail stays strictly inside the visible platform body.
        ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
        for(let x=p.x+29;x<p.x+p.w;x+=47)path(ctx,[[x,p.y+8],[x+13,p.y+13],[x+2,p.y+p.h]],null,'#c6c99f25');
        line(ctx,p.x+8,p.y+p.h-4,p.x+p.w-8,p.y+p.h-4,'#99aa7466');ctx.restore();
      }
      // Solid basalt: continuous edge. Drop-through plates: separated bright edge.
      ctx.setLineDash(p.solid?[]:[15,3]);line(ctx,p.x,p.y,p.x+p.w,p.y,PAPER,3);ctx.setLineDash([]);
      line(ctx,p.x,p.y+3,p.x,p.y+p.h,'#b7c098',2);
      line(ctx,p.x+p.w,p.y+3,p.x+p.w,p.y+p.h,'#b7c098',2);
      if(p.solid){
        for(const x of [p.x+8,p.x+p.w-8]){
          path(ctx,[[x-4,p.y+8],[x+4,p.y+8],[x,p.y+14]],ACCENT);
        }
        label(ctx,'S / '+(platforms.length>1?'TRIAD':'FLATLINE'),p.x+p.w/2,p.y+21,8,'#d7d8b4','center');
      } else {
        label(ctx,`0${index}`,p.x+p.w/2,p.y+12,7,'#c5ccb1','center');
      }
    }
    ctx.restore();
  }
  function coating(ctx,c,p,tick=0,quiet=false){
    const info=material(c.material);if(!info||!p)return;
    const x=p.x+c.index*24,w=Math.min(24,p.x+p.w-x),y=p.y;
    if(w<=0)return;
    ctx.save();ctx.globalAlpha=Math.min(1,c.ttl/30);ctx.fillStyle=info.color+'38';ctx.fillRect(x,y-5,w,7);
    line(ctx,x,y-3,x+w,y-3,info.color,2);
    // Distinct monochrome-recognizable material marks, not just different tints.
    const phase=quiet?0:tick*.09;
    if(info.glyph==='teeth'){
      for(let k=0;k<3;k++){const xx=x+k*8;path(ctx,[[xx,y-4],[xx+4,y-12-Math.sin(phase+k)*2],[xx+8,y-4]],info.color);}
    } else if(info.glyph==='wave'){
      ctx.beginPath();ctx.moveTo(x,y-8);ctx.bezierCurveTo(x+8,y-13,x+16,y-3,x+w,y-8);ctx.strokeStyle=info.color;ctx.lineWidth=1.5;ctx.stroke();
    } else if(info.glyph==='beads'){
      for(let k=0;k<3;k++)ring(ctx,x+4+k*8,y-9,k===1?2.5:1.5,null,info.color,1.3);
    } else if(info.glyph==='updraft'){
      const lift=quiet?0:(tick*.35)%22;
      for(let k=0;k<3;k++){const yy=y-12-k*19-lift;path(ctx,[[x+5,yy+4],[x+12,yy],[x+19,yy+4]],null,info.color+'70',1.5,false);}
    } else {
      const passes=info.glyph==='double-zigzag'?2:1;
      for(let k=0;k<passes;k++)path(ctx,[[x,y-8-k*5],[x+6,y-12-k*5],[x+12,y-7-k*5],[x+18,y-12-k*5],[x+w,y-8-k*5]],null,info.color,1.5,false);
    }
    ctx.restore();
  }
  function fighterMark(ctx,f,phase,showCues=true){
    const info=player(f.id),cx=f.x+f.w/2,y=f.y-16;
    ctx.save();mark(ctx,cx-10,y-3,3,f.id,info.color);
    label(ctx,'P'+(f.id+1),cx+1,y,9,info.color,'center');
    const state=showCues?cue(f,phase):null;
    if(state){
      const xx=cx-17,yy=y-21;ctx.strokeStyle=info.color;ctx.lineWidth=1;
      if(state.pattern==='solid'){ctx.fillStyle=info.color;ctx.fillRect(xx,yy,34,3);}
      else if(state.pattern==='outline')ctx.strokeRect(xx,yy,34,3);
      else {ctx.setLineDash([2,3]);line(ctx,xx,yy+1.5,xx+34,yy+1.5,info.color,1.5);ctx.setLineDash([]);}
    }
    ctx.restore();
  }
  function helmet(ctx,head,id){
    const {color}=player(id),[x,y]=head;ctx.save();
    if(id===0){
      path(ctx,[[x-10,y-5],[x-5,y-10],[x+8,y-8],[x+12,y-1],[x+8,y+10],[x-9,y+8]],color,INK,2);
      path(ctx,[[x-2,y-4],[x+11,y-4],[x+8,y+3],[x-4,y+3]],INK);
      line(ctx,x-8,y-4,x-4,y-7,PAPER,2);line(ctx,x,y-2,x+8,y-2,PAPER,1.5);
    }else{
      ring(ctx,x,y,10,color,INK,2);path(ctx,[[x-1,y-5],[x+11,y-3],[x+10,y+3],[x-1,y+3]],INK);
      line(ctx,x-6,y-8,x-6,y-2,PAPER,3);line(ctx,x+2,y-1,x+9,y-1,PAPER,1.5);
      path(ctx,[[x-9,y-7],[x-2,y-12],[x+3,y-10]],PAPER);
    }
    ctx.restore();
  }
  return Object.freeze({VERSION:1,INK,PAPER,ACCENT,PLAYERS,MATERIALS,PHASES,
    preferences,reduced,cue,player,material,backdrop,platforms,coating,fighterMark,helmet,mark});
});
