"""v0.3 integration checks against the exact reproducibly built standalone HTML.
Requires Python Playwright and Chromium. Run: python tests/browser_expansion.py
Top-level local navigation remains subject to browser policy; see VALIDATION.md.
"""
import json
import os
import pathlib
import subprocess
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('QA_OUTPUT', str(ROOT / 'qa-output')))
OUT.mkdir(parents=True, exist_ok=True)
subprocess.run(['node', 'scripts/build.cjs'], cwd=ROOT, check=True, capture_output=True)
BUNDLE = (ROOT/'dist/smash-movement-lab.html').read_text(encoding='utf-8')
checks = []

def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':1366,'height':900})
    context.set_offline(True)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(BUNDLE, wait_until='load')
    page.wait_for_function('window.smashLab')
    check('built bundle contains no external runtime script dependencies', '<script src=' not in BUNDLE)
    check('versioned engine and articulated rig load offline', page.evaluate('Smash.VERSION === 3 && typeof SmashAnimation.sample === "function"'))
    check('move workshop enumerates all 21 documented moves', page.locator('#moveSelect option').count()==21)
    page.select_option('#moveSelect','dair')
    check('move selection exposes input and resource constraints', 'rebound' in page.locator('#moveTip').inner_text())
    check('inspecting a move does not start or reset a match', page.evaluate('smashLab.state.tick === 0 && smashLab.paused'))
    page.select_option('#moveSelect','vector')
    page.click('#demoMoveBtn')
    page.evaluate("smashLab.setPaused(true);document.getElementById('overlay').hidden=true")
    check('move demonstration enters a real training scene', page.evaluate('smashLab.demo.kind === "vector" && smashLab.state.options.opponent === "training"'))
    results = page.evaluate('''() => Object.keys(Smash.MOVE_INFO).map(kind=>{
      smashLab.startDemo(kind);smashLab.setPaused(true);document.getElementById('overlay').hidden=true;
      const moves=new Set(), events=[];
      for(let n=0;n<110;n++) {
        smashLab.stepFrame();const f=smashLab.state.fighters[0];
        if(f.attack)moves.add(f.attack.kind);
        events.push(...smashLab.state.events.map(e=>e.text));
      }
      return {kind,moves:[...moves],hits:smashLab.state.fighters[0].stats.hits,
        damage:smashLab.state.fighters[1].damage,reflected:events.includes('REFLECT'),
        rebound:events.includes('METEOR REBOUND'),paused:smashLab.paused,
        demoFinished:smashLab.demo===null,finite:smashLab.state.fighters.every(f=>[f.x,f.y,f.vx,f.vy,f.damage].every(Number.isFinite))};
    })''')
    for result in results:
        kind=result['kind']
        check('playable move demonstration: '+kind,
              result['finite'] and result['hits']>0 and result['paused'] and result['demoFinished'] and
              (kind=='pulse' or kind in result['moves']))
    check('jab-chain demo connects all three distinct strikes', next(r for r in results if r['kind']=='jab3')['hits']==3)
    check('reflection demo returns a projectile through normal collision', next(r for r in results if r['kind']=='flux')['reflected'])
    check('meteor demo earns an actual hit-confirmed rebound', next(r for r in results if r['kind']=='dair')['rebound'])
    page.evaluate('''() => {smashLab.startDemo('fsmash');smashLab.setPaused(true);document.getElementById('overlay').hidden=true;
      for(let i=0;i<16;i++)smashLab.stepFrame();}''')
    page.wait_for_timeout(30)
    check('training frame guide shows startup from engine state', page.locator('#attackMeter').get_attribute('data-phase')=='startup')
    page.evaluate('''() => {for(let n=0;n<20 && (!smashLab.state.fighters[0].attack || Smash.movePhase(smashLab.state.fighters[0]).phase!=='active');n++)smashLab.stepFrame();}''')
    page.wait_for_timeout(40)
    check('frame guide transitions to active at the actual hit frame', page.locator('#attackMeter').get_attribute('data-phase')=='active')
    pose = page.evaluate('JSON.stringify(SmashAnimation.sample(smashLab.state.fighters[0],0))')
    draws = page.evaluate('smashLab.diagnostics().draws')
    page.wait_for_timeout(100)
    check('paused strike freezes its animation pose', pose==page.evaluate('JSON.stringify(SmashAnimation.sample(smashLab.state.fighters[0],0))'))
    check('paused active effects do not force redundant canvas redraws', draws==page.evaluate('smashLab.diagnostics().draws'))
    page.screenshot(path=str(OUT/'v03-desktop-strike.png'),full_page=True)
    page.evaluate("smashLab.startDemo('nair')")
    page.keyboard.down('a');page.wait_for_timeout(40);page.keyboard.up('a')
    check('keyboard movement takes over from scripted demo', page.evaluate('smashLab.demo===null'))
    page.locator('#game').focus();page.keyboard.press('?')
    check('question-mark shortcut opens the controls disclosure', page.locator('#controlsHelp').get_attribute('open') is not None)
    page.keyboard.press('?')
    for width,height in [(800,900),(390,844),(360,740)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(40)
        check(f'expanded layout has no horizontal overflow at {width}px', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.evaluate("smashLab.startDemo('flux');smashLab.setPaused(true);document.getElementById('overlay').hidden=true;for(let i=0;i<7;i++)smashLab.stepFrame();")
    page.wait_for_timeout(40);page.screenshot(path=str(OUT/'v03-mobile-reflect.png'),full_page=True)
    check('offline workshop has no uncaught runtime errors',not errors)

    pad = context.new_page()
    pad_errors=[];pad.on('pageerror',lambda e:pad_errors.append(str(e)))
    pad.evaluate('''() => {
      const make=id=>({id,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
      window.padA=make('Blue pad');window.padB=make('Red pad');window.fakePads=[padA,padB];
      Object.defineProperty(navigator,'getGamepads',{value:()=>fakePads});
    }''')
    pad.set_content(BUNDLE, wait_until='load')
    pad.evaluate('smashLab.reset({begin:true,opponent:"local"});padA.axes[3]=-1')
    pad.wait_for_timeout(60)
    check('standard right stick performs a quick directional grounded smash',pad.evaluate('smashLab.state.fighters[0].attack?.kind === "usmash"'))
    check('right-stick attack does not move the left movement axis',pad.evaluate('smashLab.state.fighters[0].previous.x===0'))
    pad.evaluate('padA.axes=[0,0,0,0]');pad.wait_for_timeout(30)
    pad.evaluate('''() => {const f=smashLab.state.fighters[0];Object.assign(f,{x:400,y:150,onGround:false,state:'air',attack:null,charge:null,hitstun:0,hitlag:0,facing:1});padA.axes=[1,0,-1,0];}''')
    pad.wait_for_timeout(40)
    check('right-stick back aerial retains opposing left-stick drift',pad.evaluate('smashLab.state.fighters[0].attack?.kind === "bair" && smashLab.state.fighters[0].vx>0'))
    pad.evaluate('padA.axes=[0,0,0,0];padB.axes=[1,0,0,0];fakePads[0]=null;padA.connected=false;window.dispatchEvent(new Event("gamepaddisconnected"))')
    check('controller disconnect explicitly pauses the match',pad.evaluate('smashLab.paused'))
    pad.evaluate('smashLab.setPaused(false)');pad.wait_for_timeout(40)
    check('Red controller does not migrate to Blue after disconnect',pad.evaluate('smashLab.state.fighters[0].previous.x===0 && smashLab.state.fighters[1].previous.x===1'))
    pad.evaluate('padB.axes=[0,0,0,0];padA.connected=true;fakePads[0]=padA;padA.axes=[0,0,0,0];smashLab.startDemo("vector")')
    pad.wait_for_timeout(20);pad.evaluate('padA.axes[0]=-1');pad.wait_for_timeout(40)
    check('gamepad input can take over a move demonstration',pad.evaluate('smashLab.demo===null'))
    check('controller expansion has no uncaught runtime errors',not pad_errors)
    browser.close()

result={'passed':len(checks),'checks':checks,'demos':results}
(OUT/'browser-expansion-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
