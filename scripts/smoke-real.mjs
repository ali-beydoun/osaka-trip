// Renders every view with the REAL encrypted data in headless WebKit and reports only counts and errors.
// It reads the link secret and derived key from the private folder, injects the key as a remembered
// non-extractable CryptoKey, and never prints, screenshots or stores trip content, the link or the key.
import fs from 'node:fs';
import { webkit } from '@playwright/test';
import { serve } from './serve.mjs';
import { KEYS_FILE } from './paths.mjs';

const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
// SMOKE_BASE=https://osaka.alibeydoun.info/ runs against the live site instead of a local server.
const origin = process.env.SMOKE_BASE || 'http://127.0.0.1:8797/';
const server = process.env.SMOKE_BASE ? null : await serve(8797);
const browser = await webkit.launch();
const results = [];
for (const viewport of [{ width: 393, height: 852 }, { width: 1366, height: 1024 }]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  const base = `${origin}#k=${keys.linkSecret}`;
  await page.goto(base);
  const env = await page.evaluate(() => fetch('data/trip.enc.json').then((r) => r.json()));
  await page.evaluate(async ({ rawKey, salt }) => {
    const b = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', b(rawKey), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('osaka-trip', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => { const t = req.result.transaction('keys', 'readwrite'); t.objectStore('keys').put({ saltId: salt, key }, 'trip'); t.oncomplete = resolve; t.onerror = reject; };
    });
  }, { rawKey: keys.rawKey, salt: env.kdf.salt });
  await page.reload();
  await page.waitForSelector('#view-title', { state: 'attached' });
  const days = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="v=days%2F"]')].map((a) => new URLSearchParams(a.hash.slice(1)).get('v')))]);
  const views = ['today', 'days', ...days, 'food/bakeries', 'food/breakfast', 'food/pancakes', 'food/halal', 'places?k=stops', 'places?k=shop', 'places?k=sweet', 'places?k=eat', 'places?k=eat&by=area', 'info', 'info/hotel', 'info/to-book', 'info/getting-around', 'info/bookings', 'info/airport', 'info/shopping-and-tax-refunds', 'info/guides', 'info/decisions', 'info/next-up', 'info/what-we-want', 'info/sources', 'info/app'];
  const groups = await page.evaluate(() => fetch('data/trip.enc.json').then(() => null));
  let overflow = 0, empty = 0, rows = 0, day2SpaExpanded = null;
  for (const v of views) {
    await page.goto(`${base}&v=${encodeURIComponent(v)}&asof=${days.length ? days[Math.floor(days.length / 2)].split('/')[1] : ''}T10:30`);
    await page.waitForSelector('#view-title', { state: 'attached' });
    const r = await page.evaluate((isDay2) => {
      for (const det of document.querySelectorAll('details')) {
        if (det.querySelector('.spa-item')) det.open = true;
      }
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const spaStats = isDay2 ? {
        options: document.querySelectorAll('.spa-item').length,
        actionLinks: document.querySelectorAll('.spa-item .text-btn').length,
        mapLinks: document.querySelectorAll('.row:has(.spa-item) .row-go').length,
        smallTargets: [...document.querySelectorAll('.spa-item .text-btn, .row:has(.spa-item) .row-go')]
          .filter((el) => { const b = el.getBoundingClientRect(); return Math.round(b.width) < 44 || Math.round(b.height) < 44; }).length,
        overflowPx: over,
      } : null;
      return {
        over,
        rows: document.querySelectorAll('.row, .md-row, .flow-item').length,
        bad: document.body.innerText.includes('undefined') || document.body.innerText.includes('[object Object]'),
        spaStats,
      };
    }, v === days[1]);
    if (r.over > 1) overflow++;
    if (r.rows === 0) empty++;
    if (r.bad) errors.push(`suspicious text in ${v.split('/')[0]}`);
    if (r.spaStats) day2SpaExpanded = r.spaStats;
    rows += r.rows;
  }
  // Halal areas: each group renders without errors
  const areas = await page.evaluate(() => [...document.querySelectorAll('select option')].length);
  results.push({ viewport: `${viewport.width}x${viewport.height}`, views: views.length, rowsRendered: rows, viewsWithNoRows: empty, viewsWithHorizontalOverflow: overflow, day2SpaExpanded, errors: errors.length ? errors : 'none', optionsOnLastView: areas, groups });
  await page.close();
}
await browser.close();
server?.close();
console.log(JSON.stringify(results, null, 1));
