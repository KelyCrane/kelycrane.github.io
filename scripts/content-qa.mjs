import { build } from 'astro';
import { cp,mkdir,writeFile,readFile,symlink,realpath } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(process.cwd());const fixture=resolve(root,`.storage/qa/empty-fixture-${Date.now()}`);if(root.toLowerCase().startsWith('c:'))throw new Error('测试目录必须在 D 盘');
await mkdir(fixture,{recursive:true});await cp(resolve(root,'src'),join(fixture,'src'),{recursive:true,filter:source=>!source.replaceAll('\\','/').includes('/src/content/')});
await mkdir(join(fixture,'src/content/posts'),{recursive:true});await mkdir(join(fixture,'src/content/projects'),{recursive:true});await writeFile(join(fixture,'src/content/albums.json'),'[]');
await writeFile(join(fixture,'src/content/posts/hidden-fixture.md'),'---\ntitle: DRAFT_SENTINEL\ndescription: test fixture only\ndate: 2026-10-13\ndraft: true\n---\nThis draft must not be rendered.');
await cp(resolve(root,'public'),join(fixture,'public'),{recursive:true});await writeFile(join(fixture,'package.json'),'{"type":"module"}');
await symlink(resolve(root,'node_modules'),join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');assert.ok(!(await realpath(join(fixture,'node_modules'))).toLowerCase().startsWith('c:'));
await build({root:fixture,configFile:false,site:'https://kelycrane.github.io',devToolbar:{enabled:false},vite:{cacheDir:join(fixture,'.cache')}});
const home=await readFile(join(fixture,'dist/index.html'),'utf8');assert.match(home,/第一篇文章，还在酝酿中/);assert.match(home,/新的作品，会在这里慢慢出现/);assert.match(home,/相册等待第一张照片/);assert.ok(!home.includes('DRAFT_SENTINEL'));
for(const route of ['blog','work','albums','archive','categories','tags']){const source=await readFile(join(fixture,`dist/${route}/index.html`),'utf8');assert.ok(!source.includes('DRAFT_SENTINEL'));}
console.log('PASS: empty collections and draft exclusion, isolated fixture at '+fixture);