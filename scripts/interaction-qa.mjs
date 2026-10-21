import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('.storage/qa/gestures');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disk-cache-dir=' + resolve('.storage/cache/chrome'), '--disable-crash-reporter', '--disable-breakpad'] });
const report = { checks: [], errors: [], physicalDevices: 'Not tested: physical phones, tablets and Safari. Chromium real multi-touch input with device emulation tested below.' };
const base = process.env.QA_BASE || 'http://127.0.0.1:4321/';
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const pose = page => page.evaluate(() => { const d = document.querySelector('#piano-stage').pianoDebug; return { camera: d.camera.position.toArray(), target: d.controls.target.toArray(), distance: d.controls.getDistance(), angle: [d.controls.getAzimuthalAngle(), d.controls.getPolarAngle()], notes: [...d.active].filter(([, sources]) => [...sources].some(s => s.startsWith('pointer:'))).map(([m]) => m) }; });
async function check(name, fn) { await fn(); report.checks.push(name); console.log('PASS ' + name); }
async function home(page) { await page.locator('#piano-home').click(); await page.waitForTimeout(800); }
async function drag(page, from, to, options = {}) {
  if (options.shift) await page.keyboard.down('Shift');
  await page.mouse.move(from.x, from.y); await page.mouse.down({ button: options.button || 'left' });
  await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up({ button: options.button || 'left' });
  if (options.shift) await page.keyboard.up('Shift');
}
async function blank(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#piano-stage'), canvas = stage.querySelector('canvas'), r = canvas.getBoundingClientRect();
    for (let y = Math.max(100, r.top + 25); y < Math.min(innerHeight - 160, r.bottom - 60); y += 25) {
      for (let x = Math.max(30, r.left + 30); x < Math.min(innerWidth - 120, r.right - 120); x += 25) {
        if ([0, 90].every(dx => document.elementFromPoint(x + dx, y) === canvas && stage.pianoDebug.keyAt({ clientX: x + dx, clientY: y }) === undefined)) return [{ x, y, id: 1 }, { x: x + 90, y, id: 2 }];
      }
    }
    throw new Error('No accessible blank pair');
  });
}
async function keyPoint(page, midi) {
  return page.evaluate(midi => {
    const stage = document.querySelector('#piano-stage'), d = stage.pianoDebug, p = d.keyScreen(midi);
    for (let dy = 0; dy < 20; dy += 2) {
      const point = { clientX: p.x, clientY: p.y + dy };
      if (document.elementFromPoint(point.clientX, point.clientY) === stage.querySelector('canvas') && d.keyAt(point) === midi) return { x: point.clientX, y: point.clientY };
    }
    throw new Error('Key inaccessible: ' + midi + ' ' + JSON.stringify(p));
  }, midi);
}
async function touchInput(context, page) {
  const cdp = await context.newCDPSession(page);
  let previous = [];
  return async (points, type = 'touchMove') => {
    // CDP touchEnd identifies contacts being lifted, whereas callers pass the remaining contacts.
    const sent = type === 'touchEnd' && points.length ? previous.filter(p => !points.some(left => left.id === p.id)) : points;
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: sent.map(p => ({ x: p.x, y: p.y, id: p.id, radiusX: 2, radiusY: 2, force: 1 })) });
    previous = points; await page.waitForTimeout(35);
  };
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base); await page.waitForSelector('.scene-ready'); await page.waitForTimeout(150);
  const initial = await pose(page);
  await check('Desktop right-drag and Shift-left-drag pan, including starting on a key, without rotation or notes', async () => {
    for (const options of [{ button: 'right' }, { shift: true }]) {
      await home(page); const before = await pose(page), key = await keyPoint(page, 60);
      await drag(page, key, { x: key.x + 75, y: key.y + 35 }, options);
      const after = await pose(page); assert.ok(dist(before.target, after.target) > .1); assert.ok(dist(before.angle, after.angle) < 1e-8); assert.deepEqual(after.notes, []);
      await page.waitForTimeout(100); assert.ok(dist(after.camera, (await pose(page)).camera) < 1e-8);
    }
  });
  await check('Desktop blank-drag rotates while white and black key holds remain stationary and release', async () => {
    await home(page); const [p] = await blank(page), before = await pose(page);
    await drag(page, p, { x: p.x + 75, y: p.y + 40 }); assert.ok(dist(before.angle, (await pose(page)).angle) > .05);
    await home(page);
    for (const midi of [60, 61]) {
      const key = await keyPoint(page, midi), before = await pose(page);
      await page.mouse.move(key.x, key.y); await page.mouse.down(); assert.deepEqual((await pose(page)).notes, [midi]);
      await page.mouse.move(key.x + 50, key.y + 25); assert.ok(dist(before.camera, (await pose(page)).camera) < 1e-8);
      await page.mouse.up(); assert.deepEqual((await pose(page)).notes, []);
    }
  });
  await check('Wheel zoom applies only over piano; scene blank and outside scene keep page scrolling', async () => {
    await home(page); const key = await keyPoint(page, 60), before = await pose(page);
    await page.mouse.move(key.x, key.y); await page.mouse.wheel(0, -180); await page.waitForTimeout(100);
    assert.ok((await pose(page)).distance < before.distance); assert.equal(await page.evaluate(() => scrollY), 0);
    for (const p of [(await blank(page))[0], { x: 50, y: 600 }]) {
      const before = await pose(page); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 250); await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => scrollY) > 0); assert.ok(Math.abs(before.distance - (await pose(page)).distance) < 1e-8);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    }
  });
  await check('Target bounds, distance and pitch limits; reset restores complete original pose', async () => {
    await home(page); const [p] = await blank(page);
    for (let i = 0; i < 12; i++) await drag(page, p, { x: p.x + 450, y: p.y + 400 }, { button: 'right' });
    const limited = await pose(page); assert.ok(limited.target.every((v, i) => v >= [-3.2, .6, -3.8][i] - 1e-8 && v <= [3.2, 3.2, 2.8][i] + 1e-8));
    await home(page); assert.ok(dist(initial.camera, (await pose(page)).camera) < 1e-8); assert.ok(dist(initial.target, (await pose(page)).target) < 1e-8);
    await page.locator('.gesture-help summary').click(); assert.ok(await page.locator('#piano-gesture-help').isVisible());
    await page.screenshot({ path: resolve(output, 'desktop-help.png') }); await page.locator('.gesture-help summary').click();
  });
  await check('Panning during automatic music leaves transport and song voices playing', async () => {
    await page.locator('#music-toggle').click(); await page.locator('#music-play').click();
    await page.waitForFunction(() => document.querySelector('#music-panel').dataset.state === 'playing');
    await page.locator('#music-close').click();
    const position = await page.evaluate(() => document.querySelector('#piano-stage').pianoDebug.player.transport.position);
    const [p] = await blank(page); await drag(page, p, { x: p.x + 65, y: p.y + 30 }, { button: 'right' });
    assert.equal(await page.evaluate(() => document.querySelector('#piano-stage').pianoDebug.player.transport.state), 'playing');
    assert.ok(await page.evaluate(() => document.querySelector('#piano-stage').pianoDebug.player.transport.position) > position);
    await page.locator('#music-toggle').click(); await page.locator('#music-stop').click(); await page.locator('#music-close').click();
  });
  await desktop.close();

  for (const [name, device] of [['phone', devices['iPhone 13']], ['tablet', devices['iPad Pro 11']], ['phone-landscape', devices['iPhone 13 landscape']]]) {
    const context = await browser.newContext({ ...device }); const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(name + ': ' + e.message));
    await page.goto(base); await page.waitForSelector('.scene-ready');
    // Bring the mobile scene into the viewport while keeping the controls reachable by the helpers.
    if (name === 'phone-landscape') await page.evaluate(() => scrollTo({ top: 240, behavior: 'instant' }));
    const touch = await touchInput(context, page);
    await check(name + ': genuine two-contact pinch and pan, then 2-to-1 transition and stable release', async () => {
      let [a, b] = await blank(page); const before = await pose(page);
      await touch([a], 'touchStart'); await touch([a, b], 'touchStart');
      b = { ...b, x: b.x + 70 }; await touch([a, b]);
      const zoomed = await pose(page); assert.ok(zoomed.distance < before.distance * .8); assert.deepEqual(zoomed.notes, []);
      const prior = await pose(page); a = { ...a, x: a.x + 25, y: a.y + 35 }; b = { ...b, x: b.x + 25, y: b.y + 35 }; await touch([a, b]);
      const panned = await pose(page); assert.ok(dist(prior.target, panned.target) > .05, JSON.stringify({ prior, panned, a, b })); assert.ok(dist(prior.angle, panned.angle) < 1e-8);
      await touch([a], 'touchEnd'); const one = await pose(page); await touch([a]); assert.ok(dist(one.camera, (await pose(page)).camera) < 1e-8);
      a = { ...a, x: a.x + 18 }; await touch([a]); assert.ok(dist(one.angle, (await pose(page)).angle) > .01);
      await touch([], 'touchEnd'); const ended = await pose(page); await page.waitForTimeout(120); assert.ok(dist(ended.camera, (await pose(page)).camera) < 1e-8);
    });
    await home(page);
    if (name === 'phone-landscape') await page.evaluate(() => scrollTo({ top: 240, behavior: 'instant' }));
    await check(name + ': white/black multi-finger chord, mixed contacts freeze camera until all lift', async () => {
      const a = { ...await keyPoint(page, 60), id: 1 }, b = { ...await keyPoint(page, 61), id: 2 }, [blankPoint] = await blank(page);
      const before = await pose(page); await touch([a], 'touchStart'); await touch([a, b], 'touchStart');
      assert.deepEqual((await pose(page)).notes.sort(), [60, 61]);
      await touch([a, b, { ...blankPoint, id: 3 }], 'touchStart');
      await touch([a, b, { ...blankPoint, x: blankPoint.x + 40, id: 3 }]); assert.ok(dist(before.camera, (await pose(page)).camera) < 1e-8);
      await touch([{ ...blankPoint, x: blankPoint.x + 40, id: 3 }], 'touchEnd'); assert.deepEqual((await pose(page)).notes, []);
      await touch([{ ...blankPoint, x: blankPoint.x + 60, id: 3 }]); assert.ok(dist(before.camera, (await pose(page)).camera) < 1e-8);
      await touch([], 'touchEnd');
    });
    await check(name + ': blank-first/key-second cancels camera; touch cancellation and blur release all ownership', async () => {
      const [a] = await blank(page), b = { ...await keyPoint(page, 61), id: 2 };
      await touch([a], 'touchStart'); const before = await pose(page); await touch([a, b], 'touchStart');
      await touch([{ ...a, x: a.x + 35 }, b]); assert.ok(dist(before.camera, (await pose(page)).camera) < 1e-8); assert.deepEqual((await pose(page)).notes, [61]);
      await touch([], 'touchCancel'); assert.deepEqual((await pose(page)).notes, []);
      await touch([b], 'touchStart'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.deepEqual((await pose(page)).notes, []); await touch([], 'touchEnd');
    });
    await check(name + ': close keyboard chords stay independent of camera; reset and help fit viewport', async () => {
      await page.locator('#piano-close').click(); await page.waitForTimeout(800);
      const keys = [];
      for (const midi of [60, 64]) { const r = await page.locator(`[data-piano-note="${midi}"]`).boundingBox(); keys.push({ x: r.x + 14, y: r.y + 95, id: keys.length + 1 }); }
      const before = await pose(page); await touch(keys, 'touchStart');
      const active = await page.evaluate(() => [...document.querySelector('#piano-stage').pianoDebug.active.keys()]); assert.ok(active.includes(60) && active.includes(64));
      assert.ok(dist(before.camera, (await pose(page)).camera) < 1e-8); await touch([], 'touchEnd');
      await page.locator('#keyboard-close').click(); await home(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: resolve(output, name + '.png') });
    });
    await check(name + ': zoom limits and panning low/high keyboard regions into the screen center', async () => {
      await page.locator('#piano-close').click(); await page.waitForTimeout(800); await page.locator('#keyboard-close').click();
      if (name === 'phone-landscape') await page.evaluate(() => scrollTo({ top: 240, behavior: 'instant' }));
      let [a, b] = await blank(page); await touch([a, b], 'touchStart');
      b = { ...b, x: a.x + 500 }; await touch([a, b]); assert.ok(Math.abs((await pose(page)).distance - 2.4) < 1e-8);
      b = { ...b, x: a.x + 5 }; await touch([a, b]); assert.ok(Math.abs((await pose(page)).distance - 21) < 1e-8);
      await touch([], 'touchEnd');
      for (const midi of [36, 84]) {
        await page.locator('#piano-close').click(); await page.waitForTimeout(800); await page.locator('#keyboard-close').click();
        if (name === 'phone-landscape') await page.evaluate(() => scrollTo({ top: 240, behavior: 'instant' }));
        const screen = await page.evaluate(m => document.querySelector('#piano-stage').pianoDebug.keyScreen(m), midi);
        const width = page.viewportSize().width;
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = await page.evaluate(m => document.querySelector('#piano-stage').pianoDebug.keyScreen(m), midi);
          if (Math.abs(current.x - width / 2) < 8) break;
          [a, b] = await blank(page); await touch([a, b], 'touchStart');
          const dx = width / 2 - current.x;
          a = { ...a, x: a.x + dx }; b = { ...b, x: b.x + dx }; await touch([a, b]); await touch([], 'touchEnd');
        }
        const moved = await keyPoint(page, midi); assert.ok(Math.abs(moved.x - width / 2) < 12, JSON.stringify({ midi, screen, moved, width }));
      }
      await page.screenshot({ path: resolve(output, name + '-keyboard-position.png') });
    });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = String(error); throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
