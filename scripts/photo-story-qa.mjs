import { chromium, devices } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.QA_BASE || 'http://127.0.0.1:4322/';
const output = resolve('.storage/qa/yinjiao-article');
await mkdir(output, { recursive: true });
const publicRun = new URL(base).hostname !== '127.0.0.1';
const manifest = JSON.parse(await readFile(resolve('.storage/qa/yinjiao-article/photo-manifest.json'), 'utf8'));
const report = { base, checks: [], errors: [], externalRequests: [], physicalDevices: 'Not tested: physical phone, tablet and Safari. Chromium device emulation only.' };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disk-cache-dir=' + resolve('.storage/cache/chrome'), '--disable-crash-reporter', '--disable-breakpad'] });
const article = new URL('blog/yinjiao-dawang/', base).href;
const url = path => new URL(path, base).href;
async function check(name, fn) { await fn(); report.checks.push(name); console.log('PASS ' + name); }
function watch(page) {
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) report.externalRequests.push(r.url()); });
}
async function opened(page, number) {
  await page.waitForFunction(number => {
    const dialog = document.querySelector('.article-photo-viewer'), image = dialog.querySelector('img');
    return dialog.open && !image.hidden && image.complete && image.naturalWidth > 0 && dialog.querySelector('.photo-viewer-caption').textContent.startsWith(number + ' / 22');
  }, number);
}
try {
  for (const [name, options] of [['desktop', { viewport: { width: 1440, height: 1000 } }], ['phone', devices['iPhone 13']], ['tablet', devices['iPad Pro 11']]]) {
    const context = await browser.newContext(options), page = await context.newPage(); watch(page);
    await page.goto(article); await page.reload();
    await check(name + ': article opens directly and refreshes, all 22 photos/captions appear once with correct text and responsive layout', async () => {
      assert.equal(await page.locator('h1').textContent(), '银角大王的日常');
      assert.equal(await page.locator('.article-header time').getAttribute('datetime'), '2026-10-22T00:00:00.000Z');
      assert.equal(await page.locator('.article-header .demo-badge').count(), 0);
      assert.equal(await page.locator('.photo-story-grid').count(), 3);
      const photos = page.locator('.photo-story-grid figure'); assert.equal(await photos.count(), 22);
      const actual = await photos.evaluateAll(figures => figures.map(f => ({ caption: f.querySelector('figcaption').textContent, alt: f.querySelector('img').alt, href: new URL(f.querySelector('a').href).pathname })));
      assert.equal(new Set(actual.map(p => p.href)).size, 22);
      assert.deepEqual(actual, manifest.photos.map(p => ({ caption: p.caption, alt: p.alt, href: p.versions.at(-1).src })));
      const text = await page.locator('article').innerText();
      assert.ok(text.includes('银角大王走丢了') && text.includes('我很想他。希望银角大王平安，也希望他能回家。'));
      for (const source of manifest.photos) assert.ok(!text.includes(source.filename));
      const grid = await page.locator('.photo-story-grid').first().evaluate(g => ({ width: g.clientWidth, columns: getComputedStyle(g).gridTemplateColumns.split(' ').length, leadWidth: g.firstElementChild.getBoundingClientRect().width }));
      assert.equal(grid.columns, name === 'phone' ? 1 : 2); assert.ok(Math.abs(grid.width - grid.leadWidth) < 1);
      assert.equal(await photos.nth(0).locator('img').getAttribute('loading'), 'eager');
      assert.equal(await page.locator('.photo-story-grid img[loading=lazy]').count(), 21);
      for (let i = 0; i < 22; i++) {
        const image = photos.nth(i).locator('img'); await image.scrollIntoViewIfNeeded();
        await image.evaluate(image => image.decode());
        const sizing = await image.evaluate(image => ({ display: image.getBoundingClientRect().width / image.getBoundingClientRect().height, natural: image.naturalWidth / image.naturalHeight, src: image.currentSrc }));
        assert.ok(Math.abs(sizing.display - sizing.natural) < .005, 'Photo must not be cropped');
        assert.ok(sizing.src.endsWith('.webp'));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: resolve(output, `${publicRun ? 'live-' : ''}${name}-article.png`) });
    });
    await check(name + ': large-photo navigation, looping, keyboard Escape and focus restoration', async () => {
      const first = page.locator('.article-photo').first(); await first.click(); await opened(page, 1);
      const dialog = page.locator('.article-photo-viewer'); assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await dialog.getByRole('button', { name: '上一张照片', exact: true }).click(); await opened(page, 22);
      await page.keyboard.press('ArrowRight'); await opened(page, 1);
      await page.keyboard.press('ArrowRight'); await opened(page, 2);
      await page.screenshot({ path: resolve(output, `${publicRun ? 'live-' : ''}${name}-large-photo.png`) });
      await page.keyboard.press('Escape'); assert.equal(await dialog.evaluate(d => d.open), false);
      assert.equal(await first.evaluate(a => a === document.activeElement), true);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await first.click(); await opened(page, 1); await dialog.getByRole('button', { name: '关闭大图' }).click();
      assert.equal(await dialog.evaluate(d => d.open), false);
    });
    if (name === 'desktop') {
      await check('All 66 hosted WebP variants have the exact generated bytes', async () => {
        const assets = manifest.photos.flatMap(p => p.versions);
        const hashes = await page.evaluate(async assets => {
          const results = [];
          for (let i = 0; i < assets.length; i += 6) {
            const batch = await Promise.all(assets.slice(i, i + 6).map(async asset => {
              const response = await fetch(asset.src); if (!response.ok) throw new Error('Photo unavailable: ' + asset.src);
              const buffer = await response.arrayBuffer(), digest = await crypto.subtle.digest('SHA-256', buffer);
              return { src: asset.src, bytes: buffer.byteLength, sha256: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') };
            })); results.push(...batch);
          }
          return results;
        }, assets);
        assert.deepEqual(hashes, assets.map(({ src, bytes, sha256 }) => ({ src, bytes, sha256 })));
      });
    }
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage(); watch(page);
  await check('Image download failure shows recovery; retry loads the same photo successfully', async () => {
    let fail = true;
    await page.route('**' + manifest.photos[0].versions.at(-1).src, route => fail ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());
    await page.goto(article); await page.locator('.article-photo').first().click();
    await page.waitForFunction(() => !document.querySelector('.photo-viewer-feedback>div').hidden);
    assert.ok(await page.locator('.photo-viewer-feedback').innerText().then(t => t.includes('照片暂时未能加载')));
    fail = false; await page.getByRole('button', { name: '重试', exact: true }).click(); await opened(page, 1);
    await page.keyboard.press('Escape');
  });
  await check('Homepage, article list, taxonomy, archive and real content remain available', async () => {
    await page.goto(url('')); await page.waitForSelector('.scene-ready');
    assert.equal(await page.locator('#latest .entry-card').first().locator('h3').innerText().then(t => t.trim().replace(/\s*↗$/, '')), '银角大王的日常');
    await page.locator('#latest .entry-card').first().click(); assert.equal(page.url(), article);
    await page.goto(url('blog/')); const count = await page.locator('.entry-card').count(); assert.ok(count >= 1);
    await page.goto(url('archive/')); assert.equal(await page.locator('.archive-row').count(), count);
    for (const path of ['categories/生活/', 'tags/银角大王/', 'tags/猫/', 'tags/思念/']) { await page.goto(url(path)); assert.ok(await page.getByRole('heading', { name: '银角大王的日常', exact: false }).count()); }
    await page.goto(url('work/void-piano/')); assert.ok(await page.locator('.toc a').count()); assert.equal(await page.locator('.article-cover').count(), 1);
    await page.goto(url('albums/yinjiao-dawang/')); await page.locator('.article-photo').first().click();
    assert.equal(await page.locator('.lightbox').evaluate(d => d.open), true); await page.keyboard.press('Escape');
  });
  await check('Chinese search finds the article and photo captions; no-result handling remains normal', async () => {
    for (const query of ['银角大王', '琴键', '前爪']) {
      await page.goto(url('search/')); await page.waitForSelector('#search-input[data-ready=true]');
      await page.locator('#search-input').fill(query); await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('找到'));
      await page.waitForFunction(() => [...document.querySelectorAll('.search-result')].some(a => a.href.includes('/blog/yinjiao-dawang/')));
    }
    await page.locator('#search-input').fill('zzqvxx987654321'); await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('没有找到'));
  });
  await context.close();
  await check('Without JavaScript all article photos, captions and direct large-image links remain usable', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false }), page = await context.newPage();
    await page.goto(article); assert.equal(await page.locator('.article-photo').count(), 22);
    assert.equal(await page.locator('figcaption').count(), 22); const link = page.locator('.article-photo').first(), target = await link.getAttribute('href');
    await link.click(); assert.equal(new URL(page.url()).pathname, target); await context.close();
  });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally { await writeFile(resolve(output, publicRun ? 'live-report.json' : 'browser-report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
