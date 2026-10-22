import {chromium,devices} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.QA_BASE || 'http://127.0.0.1:4322/';
const output=resolve('.storage/qa/content-refresh');await mkdir(output,{recursive:true});
const album=JSON.parse(await readFile('src/content/albums.json','utf8')).find(a=>a.id==='yinjiao-dawang');
const updates=JSON.parse(await readFile('src/data/updates.json','utf8'));
const report={base,checks:[],errors:[],externalRequests:[],devices:'Chromium desktop and device emulation; physical phones, tablets and Safari not tested'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disk-cache-dir='+resolve('.storage/cache/chrome'),'--disable-crash-reporter','--disable-breakpad']});
const url=path=>new URL(path,base).href;
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
function watch(page){page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.externalRequests.push(r.url());});}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
try{
 for(const [name,options] of [['desktop',{viewport:{width:1334,height:879}}],['phone',devices['iPhone 13']],['tablet',devices['iPad Pro 11']],['small-phone',{viewport:{width:320,height:740},isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext(options),page=await context.newPage();watch(page);
  await check(name+': readable homepage, visible navigation and controls without overflow',async()=>{
   await page.goto(url(''));await page.waitForSelector('.scene-ready');await noOverflow(page);
   const nav=page.getByRole('navigation',{name:'主导航'});assert.equal(await nav.getByRole('link',{name:'日志',exact:true}).count(),1);
   const boxes=await nav.locator('a').evaluateAll(links=>links.map(a=>{const r=a.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom};}));
   const viewportWidth=await page.evaluate(()=>innerWidth);
   for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].x>=0&&boxes[i].right<=viewportWidth+1);for(let j=i+1;j<boxes.length;j++)assert.ok(boxes[i].right<=boxes[j].x||boxes[j].right<=boxes[i].x||boxes[i].bottom<=boxes[j].y||boxes[j].bottom<=boxes[i].y);}
   assert.ok(await page.locator('.hero-description').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=13);
   assert.equal(await page.locator('#latest .entry-card').count(),1);assert.equal(await page.locator('.album-card').count(),1);
   assert.equal(await page.locator('.demo-badge').count(),0);
   await page.locator('#music-toggle').click();await page.locator('#music-track').selectOption({index:2});assert.equal(await page.locator('#music-track option').count(),25);
   await noOverflow(page);await page.locator('#music-close').click();
   const controls=await page.locator('.piano-controls').boundingBox(),copy=await page.locator('.hero-copy').boundingBox();assert.ok(controls.y>copy.y+copy.height||controls.x>copy.x+copy.width,'Controls must not cover the copy');
   await page.locator('.album-card').scrollIntoViewIfNeeded();await page.locator('.album-card img').evaluate(i=>i.decode());
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(700);
   await page.screenshot({path:resolve(output,name+'-home.png'),fullPage:true});
  });
  await check(name+': album preserves all 22 photos and captions; full-size navigation and article link work',async()=>{
   await page.goto(url('albums/yinjiao-dawang/'));await page.reload();await noOverflow(page);
   const links=page.locator('.gallery .article-photo');assert.equal(await links.count(),22);assert.equal(await page.locator('.photo-album h2').count(),3);
   assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(a=>({full:new URL(a.href).pathname,alt:a.querySelector('img').alt,caption:a.dataset.caption}))),album.images.map(i=>({full:'/'+i.full,alt:i.alt,caption:i.caption})));
   const sourceSets=await links.locator('img').evaluateAll(nodes=>nodes.map(i=>i.srcset));assert.ok(sourceSets.every(s=>s.includes('480w')));
   assert.ok(await page.locator('.gallery img').first().evaluate(async i=>{await i.decode();return i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain';}));
   assert.equal(await page.locator('.gallery').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),name.includes('phone')?1:2);
   await links.first().click();await page.waitForFunction(()=>{const i=document.querySelector('.article-photo-viewer>img');return !i.hidden&&i.complete&&i.naturalWidth>0;});
   await page.getByRole('button',{name:'下一张照片'}).click();await page.waitForFunction(()=>document.querySelector('.photo-viewer-caption').textContent.startsWith('2 / 22'));
   await page.keyboard.press('ArrowLeft');assert.match(await page.locator('.photo-viewer-caption').textContent(),/^1 \/ 22/);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.article-photo-viewer').evaluate(d=>d.open),false);
   assert.equal(await links.first().evaluate(a=>document.activeElement===a),true);
   await page.screenshot({path:resolve(output,name+'-album.png')});
   await page.getByRole('link',{name:'读一读他的故事'}).click();assert.ok(page.url().includes('/blog/yinjiao-dawang/'));assert.equal(await page.locator('.article-photo').count(),22);
  });
  await check(name+': actual piano cover, technical article and dated update links',async()=>{
   await page.goto(url('work/void-piano/'));await page.reload();await noOverflow(page);
   await page.locator('.article-cover').evaluate(i=>i.decode());assert.ok(await page.locator('.article-cover').evaluate(i=>i.naturalWidth===1200));
   assert.equal(await page.locator('.demo-badge').count(),0);assert.ok(await page.locator('.toc a').count()>=7);
   await page.locator('.toc a').nth(2).click();assert.ok(page.url().includes('#'));
   const body=await page.locator('.prose').innerText();for(const text of ['fBm','12 层','64 个','26 个采样','CC BY 3.0','@tonejs/midi','感谢'])assert.ok(body.includes(text));
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(400);
   await page.screenshot({path:resolve(output,name+'-project.png')});
   await page.getByRole('link',{name:'日志',exact:true}).click();assert.equal(await page.locator('.update-entry').count(),updates.length);await noOverflow(page);
   assert.deepEqual(await page.locator('.update-entry time').evaluateAll(nodes=>nodes.map(n=>n.dateTime)),updates.map(u=>u.date));
   for(const link of await page.locator('.update-links a').evaluateAll(nodes=>nodes.map(a=>a.href)))assert.ok(link.startsWith(new URL(base).origin));
   await page.screenshot({path:resolve(output,name+'-updates.png')});
  });
  await context.close();
 }
 const page=await browser.newPage();watch(page);
 await check('Removed examples return 404 and are absent from search; new album and project are indexed',async()=>{
  for(const path of ['blog/first-note/','blog/piano-notes/','albums/quiet-shapes/']){const response=await page.goto(url(path));assert.equal(response.status(),404);}
  for(const [query,paths] of [['银角大王',['blog/yinjiao-dawang/','albums/yinjiao-dawang/']],['fBm',['work/void-piano/']]]){
   await page.goto(url('search/'));await page.waitForSelector('#search-input[data-ready=true]');await page.locator('#search-input').fill(query);await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('找到'));
   for(const path of paths)await page.waitForFunction(path=>[...document.querySelectorAll('.search-result')].some(a=>a.href.includes(path)),path);
  }
  for(const query of ['第一段记录','一点逆重力','光与形']){
   await page.locator('#search-input').fill(query);await page.waitForTimeout(250);await page.waitForFunction(()=>/^(找到|没有找到)/.test(document.querySelector('#search-status').textContent));
   const hits=await page.locator('.search-result').evaluateAll(nodes=>nodes.map(n=>({url:n.href,title:n.querySelector('h2').textContent})));
   assert.ok(hits.every(hit=>!['blog/first-note/','blog/piano-notes/','albums/quiet-shapes/'].some(path=>hit.url.includes(path))));
   assert.ok(hits.every(hit=>!['第一段记录，从这里开始','一架钢琴，一点逆重力','光与形 · 示例相册'].includes(hit.title)));
  }
 });
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
}finally{await browser.close();await writeFile(resolve(output,new URL(base).hostname==='127.0.0.1'?'report.json':'public-report.json'),JSON.stringify(report,null,2));}
