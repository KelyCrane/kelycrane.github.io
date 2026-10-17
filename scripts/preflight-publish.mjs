import { readFile } from 'node:fs/promises';
const site=await readFile('src/site.ts','utf8');
if(!/readyToPublish:\s*true/.test(site))throw new Error('暂未批准正式公开：请先替换身份占位内容、确认页面，再将 readyToPublish 设置为 true。');
if(/待填写/.test(site))throw new Error('请先填写网站名称、昵称与简介。');
const music=JSON.parse(await readFile('src/data/music.json','utf8'));
const release=JSON.parse(await readFile('src/data/music-release.json','utf8'));
const missing=release.requiredIds.filter(id=>!music.some(track=>track.id===id));
if(missing.length)throw new Error(`曲库扩充尚未齐备，禁止发布：${missing.join(', ')}`);
if(JSON.stringify(music.map(track=>track.id))!==JSON.stringify(release.requiredIds))throw new Error('发布曲目顺序与清单不符');