import { readFile } from 'node:fs/promises';
const site=await readFile('src/site.ts','utf8');
if(!/readyToPublish:\s*true/.test(site))throw new Error('暂未批准正式公开：请先替换身份占位内容、确认页面，再将 readyToPublish 设置为 true。');
if(/待填写/.test(site))throw new Error('请先填写网站名称、昵称与简介。');