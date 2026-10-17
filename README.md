# KelyCrane 的虚空钢琴博客

中文静态博客：Astro + Three.js + Tone.js + Pagefind。首页可弹奏完整 88 键白色三角钢琴，配有悬浮琴盖、蓝紫色虚空和向上的液滴。

## 本地启动（Windows / D 盘）

已有依赖时，在项目目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

打开终端显示的本地地址。第一次弹奏会加载音色；加载完成后再次点击琴键即可发声。拖动非琴键区域旋转。点击“靠近键盘”使用可横向滚动的 88 键键盘；键盘获得焦点后也可用空格或回车演奏。

需要重新安装依赖时：

```powershell
$env:TEMP = 'D:\workspace\Projects\Personal_Blog\.storage\tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\workspace\Projects\Personal_Blog\.storage\cache\npm'
$env:ASTRO_TELEMETRY_DISABLED = '1'
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:npm_config_cache | Out-Null
npm.cmd ci --no-fund --no-audit
```

所有可配置缓存和临时输出位于 `.storage/`，依赖位于本项目 `node_modules/`，构建输出位于 `dist/`，均在 D 盘。不要将这些目录链接到 C 盘。已有 Node、Chrome 与 Git 程序从其现有位置读取；操作系统或应用自行管理的缓存不在此项目控制范围内。

## 写作与相册

- `src/site.ts`：网站名称、简介、昵称和正式发布开关。
- `src/content/posts/*.md`：文章。填写 `title`、`description`、`date`，可填 `category`、`tags`。`draft: true` 不生成页面，也不进入搜索。
- `src/content/projects/*.md`：作品。`featured: true` 出现在首页，可选 `url` 指向外部作品。
- `src/content/albums.json`：相册。每个相册填写唯一 `id`、标题、说明、日期和有序 `images`；每张图片填写本地 `src`、`alt`、尺寸和可选说明。
- `public/images/`：网站自己保存的图片。JPEG/WebP 等照片建议先压缩；不要提交原始相机大文件。

当前文章、作品与插画均明确标为示例。删除示例文章/作品、将相册数组设为 `[]` 后，页面会显示空状态。替换示例后将 `demo` 改为 `false`。照片链接应写成 `images/your-photo.webp`，不写外部 CDN 地址。

文章示例：

```yaml
---
title: 我的第一篇文章
description: 一句话介绍这篇文章
date: 2026-10-13
category: 随笔
tags: [生活, 记录]
draft: false
demo: false
---
```

正文用 Markdown 写。二、三级标题自动生成文章目录，代码块自动高亮。

## 构建与检查

先按上面的命令设置 D 盘环境，然后：

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
node scripts/verify-build.mjs
npm.cmd run preview
```

搜索索引随构建生成，开发服务器内不会自动提供 Pagefind 索引；测试搜索请打开 `npm run preview` 显示的地址。

浏览器验收脚本 `scripts/browser-qa.mjs` 使用 4321 端口的开发预览，`scripts/production-qa.mjs` 使用 4322 端口的正式构建预览，复用已安装的 Chrome。截图和报告保存在 `.storage/qa/`。手机测试为 Chrome 的设备模拟，不等同于实体手机或 Safari 验收。

## GitHub Pages 免费发布

目标公开仓库：`KelyCrane/kelycrane.github.io`。默认网站地址：`https://kelycrane.github.io/`。

1. 确认页面展示内容，填写 `src/site.ts` 的简介等身份信息。
2. 确认可以正式公开后，将 `readyToPublish` 改为 `true`。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. 推送到 `main`，自动检查、构建、验证并发布。

发布开关为 `false` 时仍可检查与构建，但自动发布会跳过。工作流会自动计算用户站点或项目站点的地址前缀，不需要购买域名或租服务器。GitHub 免费托管要求仓库公开；请勿提交密码、私密笔记和未经允许公开的照片。

中国大陆访问需要上线后分别用宽带和手机流量实测，免费托管不能保证各地区和运营商都稳定直连。

## 音色和 MIDI 自动演奏

`public/audio/piano/` 含 26 个必要 MP3 采样，总计约 1.84 MiB，未下载完整音源库。采样由 Alexander Holm 创作，使用 CC BY 3.0，见站内素材致谢及该目录的 `CREDITS.txt`。`scripts/fetch-samples.mjs` 可补齐缺失采样；其所有输出保存在项目目录中。

`PianoAudio` 与场景驱动统一按 MIDI 音高、力度和来源标识触发/释放音符，并接受音频时间参数；取消交互会释放所有声音。自动演奏与手动弹奏复用同一组琴键与采样，分别管理可取消的音符声部。首页已内置 10 首 MIDI 自动演奏曲目，支持播放/暂停、停止、进度跳转和单曲循环。没有 MP3 转谱、评论或统计。
## 内置钢琴曲目

点击首页“曲目”展开播放器。可以在自动演奏时一起弹奏；下滑首页继续播放，切到后台自动暂停，返回后手动继续。音符和踏板以各曲原始 MIDI 为准。

曲库清单位于 src/data/music.json，原始 MIDI 与转换数据位于 public/music。新增或替换乐谱后运行 npm run import:music，再运行检查、测试和构建。制谱者与各版本许可见网站素材致谢及 public/music/CREDITS.json。浏览器不需要 MIDI 解析依赖，也不从外部音乐 CDN 获取资源。