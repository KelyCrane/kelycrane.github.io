import { chromium } from 'playwright';
import { mkdir,writeFile,realpath,lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve('.storage/design-review/reference-2026-10-13');await mkdir(directory,{recursive:true});assert.ok(!(await realpath(directory)).toLowerCase().startsWith('c:'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disk-cache-dir='+resolve('.storage/cache/chrome'),'--disable-crash-reporter','--disable-breakpad']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4322/design-review/reference/');await page.waitForSelector('.scene-ready');await page.waitForTimeout(1400);
 const clip={x:540,y:170,width:840,height:660};
 const first=await page.screenshot({path:resolve(directory,'reference-effect.png'),clip});await page.waitForTimeout(600);const second=await page.screenshot({clip});assert.equal(first.equals(second),false,'Effect must visibly animate');
 await page.screenshot({path:resolve(directory,'reference-home.png')});
 await page.goto('http://127.0.0.1:4321/design-review/reference/?view=detail');await page.waitForSelector('.scene-ready');await page.waitForTimeout(300);
 await page.evaluate(()=>{const camera=document.querySelector('#piano-stage').pianoDebug.camera;camera.position.set(5.8,6.9,7.5);camera.lookAt(0,1.4,-0.35);});await page.waitForTimeout(700);
 await page.screenshot({path:resolve(directory,'reference-detail.png'),clip:{x:540,y:180,width:840,height:660}});
 await page.setViewportSize({width:817,height:879});await page.goto('http://127.0.0.1:4322/');await page.waitForSelector('.scene-ready');assert.equal(await page.locator('.brand-symbol svg').count(),1);assert.equal(await page.locator('#piano-stage').getAttribute('data-style'),'reference');assert.equal(await page.locator('.brand-symbol').textContent(),'');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(directory,'chosen-icon-header.png'),clip:{x:0,y:0,width:817,height:100}});
 assert.deepEqual(errors,[]);
 const files=await Promise.all(['reference-effect.png','reference-home.png','reference-detail.png','chosen-icon-header.png'].map(async name=>({path:resolve(directory,name),bytes:(await lstat(resolve(directory,name))).size})));
 const report={checks:['Reference effect renders and animates without browser errors','Chosen keys icon applied in page header','Confirmed reference effect is applied to the homepage','817px layout has no horizontal overflow'],files};await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}