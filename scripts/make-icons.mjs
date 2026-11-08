// Renders the PNG app icons from design/prototype/icon.svg (owned by the design role) with Playwright Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT, SITE_DIR } from './paths.mjs';

const svg = fs.readFileSync(path.join(ROOT, 'design', 'prototype', 'icon.svg'), 'utf8');
const targets = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['icon-512-maskable.png', 512]];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(SITE_DIR, 'icons', name) });
}
await browser.close();
console.log('Icons written to docs/icons/ from design/prototype/icon.svg.');
