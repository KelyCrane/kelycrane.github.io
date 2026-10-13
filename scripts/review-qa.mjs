import { chromium } from 'playwright';
import { mkdir,writeFile,lstat,realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve('.storage/design-review/2026-10-13');await mkdir(directory,{recursive:true});assert.ok(!(await realpath(directory)).toLowerCase().startsWith('c:'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disk-cache-dir='+resolve('.storage/cache/chrome'),'--disable-crash-reporter','--disable-breakpad']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report={checks:[],images:[]};
try{
await page.goto('http://127.0.0.1:4321/');await page.waitForSelector('.scene-ready');await page.waitForTimeout(300);
const key=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.keyScreen(60));
const before=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.camera.position.toArray());
await page.mouse.move(key.x,key.y);await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
const after=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.camera.position.toArray());assert.notDeepEqual(after,before);assert.equal(await page.evaluate(()=>window.scrollY),0);assert.equal(await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.active.size),0);report.checks.push('Wheel on actual piano moves camera without scrolling or sounding');
await page.mouse.move(1400,100);await page.mouse.wheel(0,450);await page.waitForTimeout(220);assert.ok(await page.evaluate(()=>window.scrollY)>0);report.checks.push('Wheel over blank canvas scrolls page normally');
await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.move(100,350);await page.mouse.wheel(0,400);await page.waitForTimeout(220);assert.ok(await page.evaluate(()=>window.scrollY)>0);report.checks.push('Wheel outside scene scrolls normally');
await page.evaluate(()=>window.scrollTo(0,0));await page.locator('#piano-home').click();await page.waitForTimeout(800);const beforeZoom=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.camera.position.toArray());const center=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.keyScreen(60));await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-240);await page.waitForTimeout(120);await page.locator('#piano-home').click();await page.waitForTimeout(800);const reset=await page.evaluate(()=>document.querySelector('#piano-stage').pianoDebug.camera.position.toArray());for(let i=0;i<3;i++)assert.ok(Math.abs(reset[i]-beforeZoom[i])<0.01);report.checks.push('Reset restores original camera after zoom');
assert.match(await page.locator('.brand').textContent(),/斜方肌战神/);assert.match(await page.locator('.brand').textContent(),/KelyCrane/);assert.equal(await page.locator('.brand-symbol svg').count(),1);assert.equal(await page.locator('#piano-stage').getAttribute('data-style'),'reference');report.checks.push('Dual names shown; chosen keys icon applied and confirmed reference effect applied');
for(const [variant,name] of [['crystal','A-crystal'],['mercury','B-mercury'],['silk','C-silk']]){
  await page.goto(`http://127.0.0.1:4321/design-review/${variant}/`);await page.waitForSelector('.scene-ready');await page.waitForTimeout(1900);await page.screenshot({path:resolve(directory,`${name}.png`),clip:{x:540,y:170,width:840,height:660}});report.images.push(`${name}.png`);
  if(variant==='crystal'){await page.locator('.review-icons').screenshot({path:resolve(directory,'piano-icons.png')});report.images.push('piano-icons.png');}
}
await page.goto('http://127.0.0.1:4322/');await page.waitForSelector('.scene-ready');await page.waitForTimeout(800);await page.screenshot({path:resolve(directory,'updated-home.png')});
assert.deepEqual(errors,[]);report.checks.push('All three live effect variants render without browser errors');
report.files=await Promise.all(report.images.map(async name=>({path:resolve(directory,name),bytes:(await lstat(resolve(directory,name))).size})));
await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}