// screenshots.js — capture README and social-preview images with headless Chrome.
// Usage: npm start (in another terminal), then: node tools/screenshots.js
// Needs playwright-core (devDependency) and Google Chrome (or set CHROME=/path/to/chrome).
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const OUT = path.join(__dirname, '..', 'assets');
const URL = process.env.URL || 'http://localhost:4747';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#splash');
  await page.waitForTimeout(500);
  await page.fill('#coName', 'Lighthouse AI');
  await page.click('[data-action=pickArch][data-arg=defectors]');
  await page.click('[data-action=found]');
  // Play a plausible opening so the board has something going on.
  await page.evaluate(() => {
    const E = FL.Engine, S = FL.UI.state();
    S.bandwidth = 60;
    for (const [id, l] of [['consumerApp', 0.6], ['api', 0.5], ['pretrain', 0.5], ['datacenters', 0.4], ['marketing', 0.4], ['creators', 0.3]]) E.changePolicy(S, id, l);
    for (let i = 0; i < 9 && !S.ended; i++) { FL.Bots.adaptive(S); E.endTurn(S); while (S.pendingDilemma) FL.Bots.decide(S); }
    FL.UI.refresh({ ok: true });
  });
  await page.addStyleTag({ content: '#toasts, #bridgePill, #clock { display: none !important; }' });
  await page.waitForTimeout(600);
  const shot = (name, opts) => page.screenshot({ path: path.join(OUT, name), ...opts });
  await page.hover('.node[data-id=safety]');
  await page.waitForTimeout(300);
  await shot('screenshot-board.png');
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.waitForTimeout(400);
  await shot('social-preview.png', { clip: { x: 0, y: 0, width: 1280, height: 640 } });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('[data-action=hiring]');
  await page.waitForTimeout(300);
  await shot('screenshot-recruiting.png');
  await page.click('#modal [data-action=closeModal]');
  await page.click('[data-action=endTurn]');
  await page.waitForSelector('[data-action=afterReport]');
  await page.waitForTimeout(1600);
  await shot('screenshot-report.png');
  await browser.close();
  console.log('Saved screenshots to assets/');
})();
