// CI-only composed UI regression. Engine-result fixtures exercise the route;
// the Node suites separately verify that ordinary actions earn these results.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.'), output=resolve('test-results');
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch(), results=[];
try{
  for(const [width,height] of [[1366,900],[390,844],[320,740],[844,420]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#stageSelect').selectOption('duel');
    await page.getByRole('button',{name:'First steps',exact:true}).click();
    // Fast-forward only prior progress; the final dodge runs through real input.
    await page.evaluate(()=>{state.practiceStep=5;});
    await page.keyboard.press('r');
    await page.waitForFunction(()=>practiceMilestoneReached);
    assert.equal(await page.locator('#matchState').innerText(),'Goal met');
    assert.equal(await page.locator('#game').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.getByRole('button',{name:'Next: Combos',exact:true}).isVisible(),true);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:resolve(output,`goal-met-${width}.png`),fullPage:true});
    if(height===420){
      for(const selector of ['#game','#learnBtn','#pauseBtn','#touchControls']){
        const box=await page.locator(selector).boundingBox();
        assert.ok(box.y>=0&&box.y+box.height<=height,`${selector} stays visible in landscape: ${JSON.stringify(box)}`);
      }
    }
    for(const [button,focus] of [['Next: Combos','combos'],['Next: Left edge','recoveryLeft'],['Next: Right edge','recoveryRight']]){
      await page.getByRole('button',{name:button,exact:true}).click();
      assert.equal(await page.locator('#practiceSelect').inputValue(),focus);
      assert.equal(await page.locator('#stageSelect').inputValue(),'duel');
      assert.equal(await page.evaluate(()=>started),false);
      assert.equal(await page.locator('#pauseBtn').evaluate(el=>el===document.activeElement),true);
      await page.getByRole('button',{name:'Start practice',exact:true}).click();
      await page.evaluate(()=>{if(state.practiceFocus==='combos')state.practiceBest=2;else state.practiceComplete=true;update();});
    }
    await page.getByRole('button',{name:'Next: Easy CPU',exact:true}).click();
    assert.equal(await page.locator('#modeSelect').inputValue(),'cpu');
    assert.equal(await page.locator('#difficultySelect').inputValue(),'easy');
    assert.equal(await page.locator('#matchState').innerText(),'Ready');
    assert.equal(await page.locator('#pauseBtn').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(()=>paused),true);
    const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(metrics.width,metrics.scroll);assert.deepEqual(errors,[]);
    results.push({width,height,passed:true,metrics,errors,route:'engine-result fixtures; final basics dodge via keyboard'});
    await context.close();
  }
  await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
