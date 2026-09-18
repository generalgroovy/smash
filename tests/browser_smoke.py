"""Optional real-browser QA. Requires Python Playwright and Chromium; no runtime dependencies.
Run: python tests/browser_smoke.py. Set CHROMIUM to an alternative executable.
"""
import json
import os
import pathlib
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('QA_OUTPUT', str(ROOT / 'qa-output')))
OUT.mkdir(parents=True, exist_ok=True)
checks = []
# Some managed Chromium environments disallow localhost/file:// navigation.
# Exercise the exact runtime bytes inline; verify the actual HTTP server separately.
def load(page):
    html = (ROOT/'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
    html = html.replace('<script src="engine.js" defer></script>', '').replace('<script src="game.js" defer></script>', '').replace('<script src="animation.js" defer></script>', '')
    scripts = '<script>'+(ROOT/'engine.js').read_text(encoding='utf-8')+'</script><script>'+(ROOT/'animation.js').read_text(encoding='utf-8')+'</script><script>'+(ROOT/'game.js').read_text(encoding='utf-8')+'</script>'
    page.set_content(html.replace('</body>', scripts+'</body>'), wait_until='load')
    page.wait_for_function('window.smashLab')

def check(name, condition):
    assert condition, name
    checks.append(name)

server = subprocess.Popen(['node', 'serve.cjs'], cwd=ROOT, env={**os.environ, 'PORT':'8765'}, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    time.sleep(.35)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'), headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width':1366,'height':900}, device_scale_factor=1)
        errors=[]
        page.on('pageerror', lambda err: errors.append(str(err)))
        for filename in ['index.html','engine.js','animation.js','game.js','style.css']:
            with urllib.request.urlopen('http://127.0.0.1:8765/'+filename) as response:
                check('HTTP serves '+filename,response.status==200 and response.read()==(ROOT/filename).read_bytes())
        load(page)
        check('starts safely in a menu',page.evaluate('smashLab.paused && smashLab.state.tick === 0'))
        page.wait_for_timeout(100);draws=page.evaluate('smashLab.diagnostics().draws');page.wait_for_timeout(80)
        check('paused canvas avoids redundant redraws',page.evaluate('smashLab.diagnostics().draws')==draws)
        page.screenshot(path=str(OUT/'desktop-menu.png'),full_page=True)
        page.click('#startBtn'); page.wait_for_timeout(180)
        check('CPU match starts and advances',page.evaluate('!smashLab.paused && smashLab.state.tick > 0'))
        check('timer has no minute-boundary formatting error',page.locator('#clockLabel').inner_text()=='4:00')
        x=page.evaluate('smashLab.state.fighters[0].x')
        page.keyboard.down('d');page.wait_for_timeout(100);page.keyboard.up('d')
        check('keyboard moves the player',page.evaluate('smashLab.state.fighters[0].x')>x)
        page.keyboard.press('Escape');page.wait_for_timeout(20);frame=page.evaluate('smashLab.state.tick');page.wait_for_timeout(80)
        check('pause freezes simulation',page.evaluate('smashLab.state.tick')==frame)
        page.click('#startBtn');page.keyboard.down('d');page.evaluate("window.dispatchEvent(new Event('blur'))")
        check('focus loss pauses match',page.evaluate('smashLab.paused'))
        page.keyboard.up('d');page.click('#startBtn');page.wait_for_timeout(70)
        check('blur clears held keyboard input',page.evaluate('smashLab.state.fighters[0].previous.x === 0'))
        page.select_option('#opponent','training');page.wait_for_timeout(30)
        check('training exposes practice controls',page.locator('#trainingTools').is_visible())
        page.click('#stepBtn');frame=page.evaluate('smashLab.state.tick');page.click('#stepBtn')
        check('single-frame advance advances exactly once',page.evaluate('smashLab.state.tick')==frame+1)
        check('frame advance remains paused',page.evaluate('smashLab.paused'))
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f'}))")
        page.click('#stepBtn')
        check('frame advance can inspect a queued player action',page.evaluate('smashLab.state.fighters[0].attack?.kind === \"jab\"'))
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f'}))")
        page.locator('#dummyDamage').fill('100');page.locator('#dummyDamage').dispatch_event('input')
        check('dummy damage control applies',page.evaluate('smashLab.state.fighters[1].damage')==100)
        page.evaluate('smashLab.reset({begin:true,opponent:"training"})')
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f'}))")
        page.wait_for_timeout(60)
        check('sub-frame keyboard tap is latched',page.evaluate('smashLab.state.fighters[0].attack?.kind === "jab"'))
        page.click('[data-rules="flow"]');check('Flow preset applies',page.evaluate('smashLab.state.options.rules === "flow"'))
        page.click('[data-rules="alchemy"]');check('Alchemy exposes chemistry panel',page.locator('#chemistryPanel').is_visible())
        page.click('#seedMaterialsBtn');check('reaction demo populates bounded materials',page.evaluate('smashLab.state.cells.length >= 8'))
        page.check('#hitboxes');page.click('#pauseBtn');page.evaluate("document.getElementById('overlay').hidden=true")
        page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(30)
        page.screenshot(path=str(OUT/'desktop-alchemy.png'),full_page=True)
        page.click('[data-rules="duel"]');check('Duel reset clears all hazards',page.evaluate('smashLab.state.cells.length === 0'))
        page.click('#helpBtn');check('controls disclosure opens',page.locator('#controlsHelp').get_attribute('open') is not None)
        page.click('#helpBtn')
        page.evaluate('smashLab.reset({begin:true,opponent:"local"})');page.keyboard.down('ArrowRight');page.wait_for_timeout(90);page.keyboard.up('ArrowRight')
        check('second player keyboard works',page.evaluate('smashLab.state.fighters[1].x > 600'))
        page.evaluate('smashLab.state.fighters.forEach(f=>{f.stocks=1;f.y=900;f.onGround=false})');page.wait_for_timeout(60)
        check('simultaneous final KOs show draw result',page.evaluate('smashLab.state.winner === "draw" && smashLab.paused'))
        page.click('#startBtn');check('runback resets stocks and state',page.evaluate('smashLab.state.fighters.every(f=>f.stocks===3 && f.damage===0)'))
        check('desktop has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        check('desktop has no uncaught JavaScript errors',not errors)

        mobile=browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile_errors=[];mobile.on('pageerror',lambda err:mobile_errors.append(str(err)))
        load(mobile);mobile.screenshot(path=str(OUT/'mobile-menu.png'),full_page=True)
        check('mobile has no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        check('touch controls are exposed',mobile.locator('#touchControls').is_visible())
        mobile.click('#trainingBtn');mobile.locator('[data-touch="jump"]').tap();mobile.wait_for_timeout(90)
        check('short touch tap triggers a jump',mobile.evaluate('!smashLab.state.fighters[0].onGround'))
        mobile.screenshot(path=str(OUT/'mobile-training.png'),full_page=True)
        check('mobile has no uncaught JavaScript errors',not mobile_errors)

        offline=browser.new_page(viewport={'width':1000,'height':800})
        offline_errors=[];offline.on('pageerror',lambda err:offline_errors.append(str(err)))
        offline.context.set_offline(True);load(offline);offline.click('#trainingBtn');offline.wait_for_timeout(50)
        check('self-contained runtime plays with browser offline',offline.evaluate('smashLab.state.tick > 0') and not offline_errors)

        pad=browser.new_page(viewport={'width':1100,'height':800})
        pad.evaluate("""window.fakePad={connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
          Object.defineProperty(navigator,'getGamepads',{value:()=>[window.fakePad]});""")
        load(pad);pad.click('#trainingBtn')
        pad.evaluate('fakePad.axes[0]=1');pad.wait_for_timeout(100)
        check('standard gamepad axis mapping moves Blue',pad.evaluate('smashLab.state.fighters[0].x > 320'))
        pad.evaluate('fakePad.axes[0]=0;fakePad.buttons[0].pressed=true');pad.wait_for_timeout(90)
        check('standard gamepad jump button works',pad.evaluate('!smashLab.state.fighters[0].onGround'))
        browser.close()
    print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
    (OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2))
finally:
    server.terminate();server.wait(timeout=5)
