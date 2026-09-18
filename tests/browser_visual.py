"""Kinetic Print integration checks. Real Chromium; exact offline bundle.
Run npm run build first. Python Playwright is optional test tooling.
"""
import json
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('QA_OUTPUT', str(ROOT/'qa-output')))
OUT.mkdir(parents=True, exist_ok=True)
BUNDLE = (ROOT/'dist/smash-movement-lab.html').read_text(encoding='utf-8')
checks = []
def check(name, condition):
    assert condition, name
    checks.append(name)

def load(context):
    page = context.new_page()
    page.set_content(BUNDLE, wait_until='load')
    page.wait_for_function('window.smashLab && window.SmashVisual')
    page.wait_for_timeout(80)
    return page

def toggle(page, id, value):
    page.evaluate('''([id,value])=>{const el=document.getElementById(id);
      if(el.type==='checkbox')el.checked=value;else el.value=value;
      el.dispatchEvent(new Event('change',{bubbles:true}));}''', [id,value])
    page.wait_for_timeout(35)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1366,'height':900},device_scale_factor=1)
    context.set_offline(True)
    errors=[]
    context.on('page',lambda p:p.on('pageerror',lambda err:errors.append(str(err))))
    page=load(context)
    check('Kinetic Print module and explicit system-motion default load offline',page.evaluate('SmashVisual.VERSION===1 && smashLab.presentation.motion==="system"'))
    page.screenshot(path=str(OUT/'v04-menu.png'),full_page=True)
    page.evaluate('smashLab.reset({begin:true,opponent:"training"});smashLab.setPaused(true);document.getElementById("overlay").hidden=true')
    page.locator('#viewSettings').evaluate('(el)=>el.open=true')
    page.wait_for_timeout(60)
    digest=page.evaluate('Smash.digest(smashLab.state)')
    for id,value in [('focusView',True),('phaseCues',False),('motionMode','reduced'),('motionMode','full'),('focusView',False),('phaseCues',True)]:
        toggle(page,id,value)
        check(f'{id}={value} never mutates or resets a paused match',page.evaluate('Smash.digest(smashLab.state)')==digest)
    # Follow system changes in a currently mounted app, not only at first load.
    toggle(page,'motionMode','system')
    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(50)
    check('runtime OS preference changes activate reduced motion',page.evaluate('smashLab.presentation.reducedMotion && document.documentElement.dataset.motion==="reduced"'))
    check('reduced motion fixes the camera',page.evaluate('JSON.stringify(smashLab.view)===JSON.stringify({x:480,y:265,scale:1})'))
    toggle(page,'motionMode','full')
    check('Full is an explicit override of the OS preference',page.evaluate('!smashLab.presentation.reducedMotion'))
    toggle(page,'motionMode','system');page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(50)
    check('returning system preference restores normal presentation',page.evaluate('!smashLab.presentation.reducedMotion'))
    page.evaluate('smashLab.startDemo("fsmash");smashLab.setPaused(true);document.getElementById("overlay").hidden=true;for(let i=0;i<23;i++)smashLab.stepFrame()')
    page.wait_for_timeout(50)
    check('phase cues and training meter use the actual engine phase',page.evaluate('SmashVisual.cue(smashLab.state.fighters[0],Smash.movePhase(smashLab.state.fighters[0])).pattern==="solid" && document.getElementById("attackMeter").dataset.phase==="active"'))
    page.locator('#viewSettings').evaluate('(el)=>el.open=false')
    page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(40)
    page.screenshot(path=str(OUT/'v04-combat.png'),full_page=True)
    # One cached backdrop should service arbitrarily many non-dirty paused callbacks.
    a=page.evaluate('smashLab.diagnostics()');page.wait_for_timeout(100);b=page.evaluate('smashLab.diagnostics()')
    check('unchanged paused view neither redraws nor rebuilds the backdrop',a['draws']==b['draws'] and a['backdropBuilds']==b['backdropBuilds'])
    toggle(page,'focusView',True)
    c=page.evaluate('smashLab.diagnostics()')
    check('Focus invalidates the static backdrop cache',c['backdropBuilds']>b['backdropBuilds'])
    check('Focus immediately clears existing impact particles and rings',c['particles']==0 and c['rings']==0)
    page.wait_for_timeout(75)
    check('the Focus backdrop is reused after repaint',page.evaluate('smashLab.diagnostics().backdropBuilds')==c['backdropBuilds'])
    page.screenshot(path=str(OUT/'v04-focus.png'),full_page=True)
    toggle(page,'motionMode','reduced')
    page.evaluate('smashLab.startDemo("fsmash");smashLab.setPaused(true);document.getElementById("overlay").hidden=true;for(let i=0;i<40;i++)smashLab.stepFrame()')
    check('essential combat still resolves without reduced-motion particles',page.evaluate('smashLab.state.fighters[1].damage>0 && smashLab.diagnostics().particles===0 && smashLab.diagnostics().rings===0'))
    toggle(page,'focusView',False)
    page.select_option('#stage','triad');page.select_option('#opponent','training');page.click('[data-rules="alchemy"]');page.click('#seedMaterialsBtn')
    page.evaluate('smashLab.setPaused(true);document.getElementById("overlay").hidden=true');page.wait_for_timeout(50)
    digest=page.evaluate('Smash.digest(smashLab.state)');toggle(page,'focusView',True)
    check('Focus preserves all material state and hazards',page.evaluate('Smash.digest(smashLab.state)')==digest and page.evaluate('smashLab.state.cells.length')>=8)
    toggle(page,'focusView',False)
    page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/'v04-alchemy.png'),full_page=True)
    # Rendering helpers draw genuinely different silhouettes even with identical paint.
    shapes=page.evaluate('''()=>[0,1].map(id=>{const c=document.createElement('canvas');c.width=c.height=32;SmashVisual.mark(c.getContext('2d'),16,16,10,id,'white');return c.toDataURL();})''')
    check('player geometry differs even with identical monochrome color',shapes[0]!=shapes[1])
    # Check the alpha silhouette, not colored RGB bytes, for six different surface symbols.
    silhouettes=page.evaluate('''()=>Object.keys(SmashVisual.MATERIALS).map(material=>{
      const c=document.createElement('canvas');c.width=30;c.height=90;const ctx=c.getContext('2d');
      SmashVisual.coating(ctx,{material,index:0,ttl:80},{x:0,y:85,w:24},0,true);
      const data=ctx.getImageData(0,0,30,90).data;return Array.from(data).filter((_,i)=>i%4===3).join(',');})''')
    check('all six material patterns differ independently of their RGB hue',len(set(silhouettes))==6)
    for width,height in [(320,740),(390,844),(540,900),(800,900),(1024,768),(1366,900),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(70)
        check(f'no horizontal page overflow at {width}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check(f'arena remains 16:9 at {width}px',page.evaluate('Math.abs(document.getElementById("game").getBoundingClientRect().width/document.getElementById("game").getBoundingClientRect().height-16/9)<.015'))
    # Directly exercise the backing-store cap even on an oversized CSS canvas.
    page.evaluate('document.getElementById("game").style.width="4000px"');page.wait_for_timeout(60)
    check('oversized canvas keeps its backing-store and cache within 1920x1080',page.evaluate('document.getElementById("game").width<=1920 && document.getElementById("game").height<=1080 && smashLab.diagnostics().backdropPixels<=1920*1080'))
    page.evaluate('document.getElementById("game").style.width=""')
    # A new reduced-motion mobile session exercises start state and real touch input.
    mobile_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    mobile_context.set_offline(True);mobile=load(mobile_context)
    check('reduced-motion preference is honored at initial load',mobile.evaluate('smashLab.presentation.reducedMotion'))
    mobile.screenshot(path=str(OUT/'v04-mobile.png'),full_page=True)
    mobile.click('#trainingBtn');mobile.locator('[data-touch="jump"]').tap();mobile.wait_for_timeout(100)
    check('reduced-motion touch still performs an essential jump',mobile.evaluate('!smashLab.state.fighters[0].onGround'))
    check('touch actions have at least 44px target height',mobile.locator('[data-touch]').evaluate_all('(els)=>els.every(e=>e.getBoundingClientRect().height>=44)'))
    # Storage is intentionally denied on set_content's opaque origin; the app must survive it.
    check('blocked opaque-origin storage does not prevent game startup',page.evaluate('!!smashLab.state'))
    stored=browser.new_page()
    stored.evaluate('''()=>{window.savedItems={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>savedItems[k]??null,setItem:(k,v)=>savedItems[k]=v}})}''')
    stored.set_content(BUNDLE,wait_until='load');stored.wait_for_function('window.smashLab')
    toggle(stored,'focusView',True);toggle(stored,'motionMode','reduced');toggle(stored,'phaseCues',False)
    prefs=stored.evaluate('JSON.parse(savedItems["smash-view-v1"])')
    check('view preferences persist separately from match settings',prefs=={'focus':True,'cues':False,'motion':'reduced'})
    reopened=browser.new_page();reopened.evaluate('''prefs=>{Object.defineProperty(window,'localStorage',{value:{getItem:k=>k==='smash-view-v1'?JSON.stringify(prefs):null,setItem:()=>{}}})}''',prefs)
    reopened.set_content(BUNDLE,wait_until='load');reopened.wait_for_function('window.smashLab')
    check('saved view preferences restore without starting a match',reopened.evaluate('smashLab.presentation.focus && !smashLab.presentation.cues && smashLab.presentation.reducedMotion && smashLab.state.tick===0 && smashLab.paused'))
    check('no uncaught runtime errors in the main visual checks',not errors)
    browser.close()
print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
(OUT/'browser-visual-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2)+'\n')
