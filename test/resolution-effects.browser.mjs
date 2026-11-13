// Optional real-browser regression: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
// node test/resolution-effects.browser.mjs (or install playwright externally).
// Uses an ephemeral preview server without storagePath; never touches .local.
import assert from "node:assert/strict";
import { createPreviewServer } from "../preview/server.js";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = createPreviewServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1100,height:800}});
const origin = `http://127.0.0.1:${server.address().port}`;
await page.route(origin + "/", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><link rel="stylesheet" href="/style.css">' }));
await page.goto(origin + "/");
const result = await page.evaluate(async () => {
  const {createResolutionEffects} = await import('/resolution-effects.js');
  document.body.innerHTML = `<div id="fixture"><div class="flight-layout" style="width:800px;height:300px"><div class="ship-vessel" style="position:absolute;left:0;top:0;width:800px;height:300px"><div data-station="white-upper"></div><div data-station="blue-upper"></div><span data-crew="0" style="position:absolute;left:100px;top:100px;width:32px;height:32px;background:cyan;border-radius:50%">A</span></div></div></div>`;
  const root = document.querySelector('#fixture'), pawn=root.querySelector('[data-crew]');
  const before={logEnd:0,turn:1,ship:{crew:[{id:0,station:'white-upper'}]},threats:[]};
  const after={...before,logEnd:1,ship:{crew:[{id:0,station:'blue-upper'}]}};
  const resolution={frames:[before,after],log:[{type:'move',crew:0,from:'white-upper',to:'blue-upper'}]};
  const effects=createResolutionEffects(root,()=>{});
  const next=()=>new Promise(requestAnimationFrame);
  let total=0;
  const failures=[];
  for(let run=0;run<15;run++) {
    effects.reset(); pawn.style.left='100px'; effects.afterRender(resolution,0); effects.beforeRender(); pawn.style.left='500px'; effects.afterRender(resolution,1);
    let last=100, sawClone=false, finished=false;
    for(let i=0;i<42;i++) {
      const clone=root.querySelector('.fx-pawn');
      const visible=getComputedStyle(pawn).visibility !== 'hidden';
      if (clone) {
        sawClone=true;
        const x=clone.getBoundingClientRect().left-root.getBoundingClientRect().left;
        if(visible) failures.push({run,i,error:'destination visible with clone'});
        if(x<last-.5) failures.push({run,i,error:'source snap',last,x});
        last=x;
      } else {
        if(!visible) failures.push({run,i,error:'no pawn visible'});
        if(sawClone) finished=true;
      }
      total++;
      await next();
    }
    if(!finished) failures.push({run,error:'did not finish'});
  }
  effects.destroy();
  return {runs:15,samples:total,failures};
});
console.log(JSON.stringify(result,null,2));
assert.deepEqual(result.failures, []);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
