// Browser tests on the SYNTHETIC fixture (tests/fixtures). Never uses real data, keys or the real link.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_HASH, TEST_PASSWORD } from '../fixtures/build-fixture-site.mjs';

const EVIDENCE = process.env.OSAKA_EVIDENCE_DIR || path.resolve('..', 'osaka-trip-qa', 'evidence');
const DURING = 'asof=2030-05-08T10:30';
const url = (v = '', extra = DURING) => `/${TEST_HASH}${v ? `&v=${encodeURIComponent(v)}` : ''}${extra ? `&${extra}` : ''}`;

async function unlock(page, { remember = true } = {}) {
  await page.goto(url());
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  if (!remember) await page.getByRole('switch', { name: 'Keep unlocked on this device' }).uncheck();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#view-title')).toHaveText('Today');
  // Dismiss the one-time Add to Home Screen hint if present.
  const hint = page.getByRole('dialog', { name: 'Add to Home Screen' });
  if (await hint.isVisible().catch(() => false)) await hint.getByRole('button', { name: 'Got It' }).click();
}

async function shot(page, testInfo, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(EVIDENCE, `${testInfo.project.name}-${name}.png`), fullPage: false });
}

test.describe('lock screen', () => {
  test('missing link state offers paste and accepts a full link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Open this app from your private trip link')).toBeVisible();
    await page.getByLabel('Private trip link').fill('https://example.com/#k=short');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('status')).toContainText('isn’t a complete trip link');
    await page.getByLabel('Private trip link').fill(`https://osaka.example/${TEST_HASH}`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('wrong password shows one calm message, clears the field and keeps focus', async ({ page }, testInfo) => {
    await page.goto(url());
    const field = page.getByLabel('Password', { exact: true });
    await field.fill('not-the-password');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.locator('#lock-status')).toHaveText('That password didn’t work. Check it and try again.');
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await shot(page, testInfo, 'lock-error');
  });

  test('show password toggles the field type', async ({ page }) => {
    await page.goto(url());
    const field = page.getByLabel('Password', { exact: true });
    await field.fill('abc');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(field).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(field).toHaveAttribute('type', 'password');
  });

  test('keep unlocked survives reload; Lock now forgets it', async ({ page }) => {
    await unlock(page);
    await page.reload();
    await expect(page.locator('#view-title')).toHaveText('Today');
    await page.goto(url('info/app'));
    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('not remembered: reload asks for the password again', async ({ page }) => {
    await unlock(page, { remember: false });
    await page.reload();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('fresh-device sign-in: truncated link diagnosis, chat-wrapped paste, password recovery, paste whitespace/auto-cap and failed fetch retry', async ({ browser }) => {
    // 1. Truncated #k= fragment on initial open diagnoses cut-off invite and accepts a chat-wrapped link
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await p1.goto('/#k=short');
    await expect(p1.locator('#lock-status')).toContainText('every character after #k=');
    await p1.getByLabel('Private trip link').fill(`Here is the invite: https://osaka.example/${TEST_HASH} see you soon!`);
    await p1.getByRole('button', { name: 'Continue' }).click();
    const pw = p1.getByLabel('Password', { exact: true });
    await expect(pw).toBeVisible();
    await expect(pw).toHaveAttribute('autocapitalize', 'off');
    await expect(pw).toHaveAttribute('autocorrect', 'off');
    const pwFontPx = await pw.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(pwFontPx).toBeGreaterThanOrEqual(16);

    // 2. Password screen offers Replace or paste invite link recovery and Back to password
    await p1.getByRole('button', { name: 'Replace or paste invite link' }).click();
    await expect(p1.getByLabel('Private trip link')).toBeVisible();
    await p1.getByRole('button', { name: 'Back to password' }).click();
    await expect(pw).toBeVisible();

    // 3. Valid password with accidental paste whitespace and leading mobile auto-capitalization unlocks cleanly
    const autoCapSpaced = `  ${TEST_PASSWORD[0].toUpperCase()}${TEST_PASSWORD.slice(1)}\n`;
    await pw.fill(autoCapSpaced);
    await p1.getByRole('button', { name: 'Unlock' }).click();
    await expect(p1.locator('#view-title')).toHaveText('Today');
    const hint = p1.getByRole('dialog', { name: 'Add to Home Screen' });
    if (await hint.isVisible().catch(() => false)) await hint.getByRole('button', { name: 'Got It' }).click();

    // Info > App exposes Copy invite link without displaying the raw secret in visible text
    await p1.goto(url('info/app'));
    await expect(p1.getByText('Complete private link active')).toBeVisible();
    await expect(p1.getByRole('button', { name: 'Copy private invite link to clipboard' })).toBeVisible();
    const bodyText = await p1.locator('body').innerText();
    expect(bodyText).not.toContain(TEST_HASH.slice(3));
    await ctx1.close();

    // 4. Transient failed fetch while online distinguishes load failure from offline and recovers via Try Again
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    let failOnce = true;
    await p2.route('**/data/trip.enc.json', async (routeReq) => {
      if (failOnce) { failOnce = false; await routeReq.abort('failed'); }
      else await routeReq.continue();
    });
    await p2.goto(url());
    await expect(p2.getByText('Couldn’t load the encrypted trip right now')).toBeVisible();
    await p2.getByRole('button', { name: 'Try Again' }).click();
    await expect(p2.getByLabel('Password', { exact: true })).toBeVisible();
    expect(p2.url()).toContain(TEST_HASH.split('&')[0]);
    await ctx2.close();
  });
});

test.describe('unlocked app', () => {
  test.beforeEach(async ({ page }) => { await unlock(page); });

  test('today during the trip shows now, confirmed reservation, quick actions and the rest of today', async ({ page }, testInfo) => {
    await expect(page.getByText('Viewing as 2030-05-08 10:30 Tokyo time')).toBeVisible();
    await expect(page.locator('.now-card')).toContainText('Sample Zone A1');
    await expect(page.locator('.now-card .chip.now')).toHaveText('Now');
    await expect(page.locator('.now-card')).toContainText('Shorter walk: Sample flat lift-connected route ba.');
    const todayFromHere = page.locator('.now-card').getByRole('link', { name: /Directions from here/ });
    await expect(todayFromHere).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=Sample%20Station%20Osaka/);
    expect(await todayFromHere.getAttribute('href')).not.toContain('origin=');
    await expect(page.locator('.now-next-box')).toContainText('Sample Zone B1');
    const confirmedCard = page.locator('.booking-card').first();
    await expect(confirmedCard.locator('.chip.ev-certified')).toHaveText('Confirmed');
    await expect(confirmedCard).toContainText('18:00');
    await expect(confirmedCard).toContainText('Sample Tempura Counter');
    await expect(confirmedCard).toContainText('2 guests');
    for (const name of ['Back to the hotel', 'Food nearby', 'Prayer rooms', 'Taxi card']) await expect(page.locator('.quick')).toContainText(name);
    await expect(page.locator('.tomorrow-card')).toContainText('Sample Kaiseki Pavilion');
    await shot(page, testInfo, 'today');

    // Taxi card opened from Today closes right back to Today without jumping to Info
    await page.locator('.quick').getByRole('link', { name: 'Taxi card' }).click();
    const taxi = page.getByRole('dialog', { name: 'Taxi card' });
    await expect(taxi).toBeVisible();
    await taxi.getByRole('button', { name: 'Close' }).click();
    await expect(taxi).toHaveCount(0);
    await expect(page.locator('#view-title')).toHaveText('Today');

    // Zone-aware Food nearby at 14:30 resolves to Zone B1's area (nara) and after 20:00 Back to hotel uses taxi mode
    await page.goto(url('today', 'asof=2030-05-08T14:30'));
    await expect(page.locator('.quick').getByRole('link', { name: 'Food nearby' })).toHaveAttribute('href', /g(?:=|%3D)nara/);
    await page.goto(url('today', 'asof=2030-05-08T20:30'));
    await expect(page.locator('.quick').getByRole('link', { name: 'Back to the hotel' })).toHaveAttribute('href', /travelmode=driving/);

    // Tapping Zone 3 from Rest of today deep-links and focuses #zone-2
    await page.locator('.row-link', { hasText: 'Sample Zone C1' }).click();
    await expect(page.locator('#zone-2')).toBeFocused();
  });

  test('today before the trip shows the countdown and future confirmed bookings', async ({ page }) => {
    await page.goto(url('today', 'asof=2030-05-03'));
    await expect(page.locator('.hero-number')).toHaveText('4');
    await expect(page.locator('.booking-card')).toHaveCount(2);
    await expect(page.locator('.booking-card').nth(0)).toContainText('Sample Tempura Counter');
    await expect(page.locator('.booking-card').nth(1)).toContainText('Sample Kaiseki Pavilion');
    await expect(page.getByText('Sample task one')).toBeVisible();
  });

  test('days list, calm day detail hierarchy, previous and next', async ({ page }, testInfo) => {
    await page.goto(url('days'));
    await expect(page.locator('.rhythm-strip a')).toHaveCount(3);
    if (page.viewportSize().width >= 600) await expect(page.locator('.day-title')).toHaveText('Sample day 2'); // L4 split shows today
    await page.goto(url('days/2030-05-08'));
    await expect(page.locator('.day-title')).toHaveText('Sample day 2');
    if (page.viewportSize().width < 600) await expect(page.locator('.day-strip .day-pill')).toHaveCount(3);
    else await expect(page.locator('.day-strip')).toBeHidden();
    await expect(page.locator('.day-area-bar')).toContainText('Halal: Umeda');
    await expect(page.locator('.day-area-bar')).toContainText('Halal: Nara');
    await expect(page.locator('.day-area-bar a', { hasText: 'Prayer: Umeda' })).toContainText('1');
    await expect(page.locator('.day-area-bar a', { hasText: 'Prayer: Nara' })).toContainText('1');
    const routeSummary = page.locator('summary', { hasText: 'Route & pacing' });
    await expect(routeSummary).toBeVisible();
    await routeSummary.click();
    await expect(page.locator('.strategy-card')).toBeVisible();
    await expect(page.locator('.strategy-card')).toContainText('Sample route strategy for day 2.');
    await expect(page.locator('summary', { hasText: 'Entrances, tickets & practical logistics (1)' })).toBeVisible();
    await expect(page.locator('summary', { hasText: 'Rain & low-energy alternatives' })).toBeVisible();
    const spaSummary = page.locator('summary', { hasText: 'Optional massage, facial & spa (1)' });
    await expect(spaSummary).toBeVisible();
    await spaSummary.click();
    await expect(page.getByText('Sample spa intro for day 2.')).toBeVisible();
    await expect(page.getByText('Sample District walk-in inquiries')).toBeVisible();
    await expect(page.getByText('Sample Day Spa')).toBeVisible();
    await expect(page.getByText('Walk-in inquiry only · Same-day availability unconfirmed')).toBeVisible();
    await expect(page.getByText('Both can attend in private rooms.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Source & booking (example.com)' })).toHaveCount(1);
    await expect(page.locator('.spa-item .chip.ev-certified')).toHaveCount(0);
    await page.getByRole('link', { name: /Driver and walk-in card for Sample Day Spa/ }).click();
    const spaDriver = page.getByRole('dialog', { name: 'Driver card: Sample Day Spa' });
    await expect(spaDriver).toContainText('サンプルスパ');
    await expect(spaDriver).toContainText('本日空きはありますか？');
    await spaDriver.getByRole('button', { name: 'Close' }).click();
    await expect(spaDriver).toHaveCount(0);
    await expect(page.locator('.zone-routes').first()).toContainText('Sample flat lift-connected route ba.');
    await expect(page.locator('.zone-routes').first()).toContainText('Sample 9F book cafe seating ba.');
    await expect(page.locator('summary', { hasText: 'Coffee, sweets & rest (1)' }).first()).toBeVisible();
    await expect(page.locator('.zone-highlight').first()).toContainText('Sample zone highlight ba.');
    await expect(page.getByRole('heading', { name: 'Zones', exact: true })).toHaveCount(0);
    for (const t of ['Confirmed', 'The day', 'End of the day', 'Practical notes & options', 'Good to know', 'Questions to settle', 'Sources']) {
      await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible();
    }
    await shot(page, testInfo, 'day');
    await page.getByRole('button', { name: /^Next day/ }).click();
    await expect(page.locator('.day-title')).toHaveText('Sample day 3');
    await page.goBack();
    await expect(page.locator('.day-title')).toHaveText('Sample day 2');
  });

  test('confirmed bookings, collapsed alternatives, accessible backup, no-booking day and keyboard zone jump', async ({ page }, testInfo) => {
    await page.goto(url('days/2030-05-08'));
    const card = page.locator('.booking-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.chip.ev-certified')).toHaveText('Confirmed');
    await expect(card.locator('.booking-when')).toHaveText('18:00 \u00b7 Dinner');
    await expect(card.locator('.booking-venue')).toContainText('Sample Tempura Counter');
    await expect(card.locator('.booking-meta')).toHaveText('2 guests \u00b7 Sample District');
    await expect(card.getByRole('link', { name: 'Walk to Sample Tempura Counter' }))
      .toHaveAttribute('href', /google\.com\/maps\/dir\/.*destination=Sample%20Tempura%20Counter%20Osaka.*travelmode=walking/);

    // Reference and policy are collapsed until expanded
    const refDisc = card.locator('details.booking-disclosure');
    await expect(refDisc).not.toHaveAttribute('open', '');
    await expect(card.getByText('SYNTH-8842')).toBeHidden();
    const refSummary = refDisc.locator('summary');
    await refSummary.focus();
    await page.keyboard.press('Enter');
    await expect(refDisc).toHaveAttribute('open', '');
    await expect(card.getByText('SYNTH-8842')).toBeVisible();
    await expect(card.getByText('Traveller A')).toBeVisible();
    await expect(card.getByText('Cancel at least 24 hours ahead. Counter seating starts on time.')).toBeVisible();

    // Unified 5-row flow links via keyboard to Zone 3 without clobbering the private hash secret
    await expect(page.locator('.itinerary-overview .flow-item')).toHaveCount(5);
    const jumpBtn = page.locator('.itinerary-overview').getByRole('button', { name: 'Jump to Zone 3, Sample Zone C1' });
    await jumpBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#zone-2')).toBeFocused();
    expect(page.url()).toContain('k=');

    // Dinner zone pins confirmed booking visibly while keeping optional dinner alternatives collapsed
    const zone3 = page.locator('section.zone').nth(2);
    await expect(zone3.locator('.zone-confirmed')).toContainText('Sample Tempura Counter');
    await expect(zone3.getByRole('link', { name: 'Directions to Sample Tempura Counter' }))
      .toHaveAttribute('href', /destination=Sample%20Tempura%20Counter%20Osaka/);
    const altDisc = zone3.locator('details.disclosure').filter({ hasText: 'Optional dinner alternatives (3)' });
    await expect(altDisc).not.toHaveAttribute('open', '');
    await altDisc.locator('summary').click();
    await expect(altDisc).toHaveAttribute('open', '');
    await expect(altDisc.locator('.row-title', { hasText: 'Sample Tempura Counter' })).toHaveCount(0);
    await expect(altDisc.getByText('Sample Splurge Kappo', { exact: true })).toBeVisible();
    const backupRow = altDisc.locator('.row-link', { hasText: 'Sample Italian Trattoria' });
    await expect(backupRow).toBeVisible();
    await shot(page, testInfo, 'day-booking-expanded');

    await backupRow.click();
    const detail = page.locator('.sheet, .inspector').filter({ hasText: 'Sample Italian Trattoria' });
    await expect(detail.getByRole('heading', { name: 'Sample Italian Trattoria' })).toBeVisible();
    await expect(detail).toContainText('Sample wood-fired pizza and seafood pasta backup.');
    await expect(detail.getByRole('link', { name: 'Walk to Sample Italian Trattoria' })).toBeVisible();
    if (await page.locator('.sheet').count()) await page.keyboard.press('Escape');

    // Day 1 has no confirmed bookings (unbooked entry is ignored) and keeps genuine pending transfer alert
    await page.goto(url('days/2030-05-07'));
    await expect(page.locator('.booking-card')).toHaveCount(0);
    await expect(page.locator('.callout.warn')).toContainText('Not booked yet: Sample airport transfer in');
    await expect(page.locator('section.zone details.disclosure[open]')).toHaveCount(0);
    await shot(page, testInfo, 'day-no-booking');

    // Second future confirmed booking on Day 3 and in Info > Bookings
    await page.goto(url('days/2030-05-09'));
    await expect(page.locator('.booking-card')).toHaveCount(1);
    await expect(page.locator('.booking-card')).toContainText('Sample Kaiseki Pavilion');
    await expect(page.locator('.booking-card')).toContainText('12:30 \u00b7 Lunch');
    await page.goto(url('info/bookings'));
    await expect(page.locator('.booking-card')).toHaveCount(2);
  });

  test('place detail opens from a day and Back dismisses it first', async ({ page }, testInfo) => {
    await page.goto(url('days/2030-05-08'));
    await page.locator('.row-link', { hasText: 'Sample Garden ba' }).click();
    const detail = page.locator('.sheet, .inspector').filter({ hasText: 'Sample Garden ba' });
    await expect(detail.getByRole('heading', { name: 'Sample Garden ba' })).toBeVisible();
    await expect(detail).toContainText('Sample reason ba.');
    await expect(detail).toContainText('Sample highlight ba.');
    await expect(detail).toContainText('Sample entry tip ba.');
    await expect(detail.getByRole('link', { name: 'Walk to Sample Garden ba' })).toHaveAttribute('href', /google\.com\/maps\/dir\/.*travelmode=walking/);
    await shot(page, testInfo, 'place-sheet');
    if (await page.locator('.sheet').count()) {
      await expect(page.locator('.sheet')).toHaveAttribute('aria-labelledby', 'place-title');
      await expect(page.getByRole('button', { name: 'Close details' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('.sheet')).toHaveCount(0);
      await expect(page.locator('.row-link', { hasText: 'Sample Garden ba' }).first()).toBeFocused();
      await page.locator('.row-link', { hasText: 'Sample Garden ba' }).first().click();
      await expect(page.locator('.sheet')).toHaveCount(1);
    }
    await page.goBack();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.day-title')).toHaveText('Sample day 2');
  });

  test('halal: area default, evidence chips, certified filter, prayer rooms', async ({ page }, testInfo) => {
    await page.goto(url('food/halal'));
    const area = page.locator('select.select').first();
    await expect(area).toHaveValue('umeda');
    await expect(area.locator('option:checked')).toHaveText('Umeda (Today)');
    await expect(page.locator('.ev-certified').first()).toHaveText('Halal certified');
    await expect(page.locator('.ev-claim').first()).toHaveText('Halal (own claim)');
    await expect(page.getByText('Sample Prayer Room')).toBeVisible();
    await shot(page, testInfo, 'halal');
    await page.getByRole('switch', { name: 'Certified only' }).click();
    await expect(page.getByRole('switch', { name: 'Certified only' })).toBeChecked();
    await expect(page.getByText('Sample Claim Curry')).toHaveCount(0);
    await area.selectOption('nara');
    await expect(page.getByText('No certified places in this area.')).toBeVisible();
  });

  test('walk captions only for hotel-area places with a known time', async ({ page }) => {
    await page.goto(url('food/halal'));
    await expect(page.getByText('About 6 min walk from the hotel')).toBeVisible();
    await expect(page.locator('.row-meta')).toHaveCount(1);
  });

  test('places: kinds, works-for filter, search and grouping', async ({ page }, testInfo) => {
    await page.goto(url('places?k=eat&by=day'));
    await expect(page.getByRole('radio', { name: 'Eat' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Sample Grill aa', { exact: true })).toHaveCount(0); // Not for Traveller B is filtered by default
    await page.getByRole('switch', { name: 'Works for Traveller B' }).click();
    await expect(page.getByRole('switch', { name: 'Works for Traveller B' })).not.toBeChecked();
    await expect(page.getByText('Sample Grill aa', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search places' }).fill('fish bar ca');
    await expect(page.getByText('1 place matching')).toBeVisible();
    await shot(page, testInfo, 'places');
  });

  test('info: hotel, taxi card full screen and document sections', async ({ page }, testInfo) => {
    await page.goto(url('info'));
    await page.getByRole('link', { name: 'Show taxi card' }).click();
    const taxi = page.getByRole('dialog', { name: 'Taxi card' });
    await expect(taxi).toContainText('Sample Hotel');
    await shot(page, testInfo, 'taxi');
    await taxi.getByRole('button', { name: 'Close' }).click();
    await expect(taxi).toHaveCount(0);
    await page.goto(url('info/getting-around'));
    await expect(page.locator('.md-row-title')).toContainText('A to B');
    await page.goto(url('info/next-up'));
    const task = page.getByRole('checkbox', { name: 'Sample task one' });
    await task.check();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Sample task one' })).toBeChecked();
  });

  test('tab bar or top tabs reach every destination, re-tap pops to root', async ({ page }) => {
    for (const [name, title] of [['Days', 'Days'], ['Food', 'Food'], ['Places', 'Places'], ['Info', 'Info'], ['Today', 'Today']]) {
      await page.getByRole('navigation', { name: /Sections|Trip/ }).filter({ visible: true }).first().getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveTitle(`${title} \u00b7 Osaka Trip`);
    }
    await page.goto(url('days/2030-05-09'));
    await expect(page).toHaveTitle(/^Thu 9 May/);
    await page.getByRole('navigation', { name: /Sections|Trip/ }).filter({ visible: true }).first().getByRole('link', { name: 'Days', exact: true }).click();
    await expect(page).toHaveTitle('Days \u00b7 Osaka Trip');
  });

  test('no horizontal page scroll on any destination', async ({ page }) => {
    for (const v of ['today', 'days', 'days/2030-05-07', 'days/2030-05-08', 'food/halal', 'food/bakeries', 'places', 'info', 'info/bookings', 'info/to-book', 'info/getting-around', 'info/app']) {
      await page.goto(url(v));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, v).toBeLessThanOrEqual(1);
    }
  });

  test('external links never send a referrer and stay off the private fragment', async ({ page }) => {
    await page.goto(url('days/2030-05-08'));
    const links = await page.locator('a[target="_blank"]').evaluateAll((as) => as.map((a) => ({ href: a.href, rel: a.rel })));
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) {
      expect(l.rel).toContain('noreferrer');
      expect(l.href).not.toContain('#k=');
    }
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  });

  test('every interactive target is at least 44px (sampled)', async ({ page }) => {
    for (const [v, title] of [
      ['today', 'Today'],
      ['days/2030-05-08', 'Sample day 2'],
      ['food/halal', 'Food'],
      ['places', 'Places'],
      ['info/bookings', 'Bookings'],
      ['info/to-book', 'To book'],
    ]) {
      await page.goto(url(v));
      await expect(page.locator('#view-title')).toHaveText(title);
      const spaDisclosure = page.locator('summary', { hasText: 'Optional massage, facial & spa' });
      if (await spaDisclosure.count()) await spaDisclosure.click();
      const refDisclosure = page.locator('summary', { hasText: 'Reference & policy' }).first();
      if (await refDisclosure.count()) await refDisclosure.click();
      const altDisclosure = page.locator('summary', { hasText: 'Optional dinner alternatives' }).first();
      if (await altDisclosure.count()) await altDisclosure.click();
      await page.evaluate(() => { for (const d of document.querySelectorAll('#day-travel details')) d.open = true; });
      const small = await page.evaluate(() => [...document.querySelectorAll('.tab, .top-tab, .icon-btn, .btn, .row-link, .row-go, .filter-chip, .segmented button, .quick-btn, .rhythm-day a, .day-pill, .area-link, .disclosure > summary, .spa-item .text-btn, .flow-jump, .booking-links .text-btn, .booking-ext .text-btn, .travel-links .text-btn')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => { const r = el.getBoundingClientRect(); return { c: el.className, w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((r) => r.w < 44 || r.h < 44));
      expect(small, v).toEqual([]);
    }
  });
});

test.describe('Home Screen install (emulated; real iOS stays on the owner checklist)', () => {
  test('manifest keeps the current address and the private link survives unlock and Lock now', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.start_url).toBeUndefined();
    expect(manifest).toMatchObject({ scope: '/', display: 'standalone' });
    await unlock(page);
    expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('k')).toBe(TEST_HASH.match(/k=([^&]+)/)[1]);
    await page.goto(url('info/app'));
    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    expect(page.url()).toContain(TEST_HASH.split('&')[0]);
  });

  test('first standalone launch with separate storage: link kept asks for password; link dropped recovers by paste', async ({ browser }) => {
    for (const dropped of [false, true]) {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
      const page = await ctx.newPage();
      await page.goto(dropped ? '/' : url());
      if (dropped) {
        await page.getByLabel('Private trip link').fill(`https://osaka.example/${TEST_HASH}`);
        await page.getByRole('button', { name: 'Continue' }).click();
      }
      await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Unlock' }).click();
      await expect(page.locator('#view-title')).toHaveText('Today');
      await page.reload();
      await expect(page.locator('#view-title')).toHaveText('Today');
      await ctx.close();
    }
  });
});

test.describe('appearance', () => {
  test('light by default even when the system is dark; Automatic follows the system; Dark persists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await unlock(page);
    const attrs = () => page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.appearance, document.querySelector('meta[name="theme-color"]').content]);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await attrs()).toEqual(['light', 'light', '#F3F1EC']);
    const lightBg = await bg();
    await page.goto(url('info/app'));
    const seg = page.getByRole('radiogroup', { name: 'Appearance' });
    await seg.getByRole('radio', { name: 'Automatic' }).click();
    expect(await attrs()).toEqual(['auto', 'dark', '#111113']);
    expect(await bg()).not.toBe(lightBg);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(attrs).toEqual(['auto', 'light', '#F3F1EC']);
    await seg.getByRole('radio', { name: 'Dark' }).click();
    await page.reload();
    await expect(page.locator('#view-title')).toBeAttached();
    expect(await attrs()).toEqual(['dark', 'dark', '#111113']);
    await expect(page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Light' }).click();
    expect(await bg()).toBe(lightBg);
  });

  test('the locked screen is light by default on a dark system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url());
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.appearance)).toBe('light');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  });

  test('round check controls keep checkbox semantics', async ({ page }) => {
    await unlock(page);
    await page.goto(url('info/to-book'));
    const box = page.getByRole('checkbox').first();
    await expect(box).not.toBeChecked();
    await box.click();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
  });
});

test('list column never scrolls sideways (chip row stays inside it)', async ({ page }, testInfo) => {
  await unlock(page);
  for (const v of ['food', 'food/halal', 'places']) {
    await page.goto(url(v));
    const over = await page.evaluate(() => { const c = document.querySelector('.list-col'); return c && getComputedStyle(c).display !== 'none' ? c.scrollWidth - c.clientWidth : 0; });
    expect(over, `${testInfo.project.name} ${v}`).toBeLessThanOrEqual(1);
  }
});

test.describe('privacy and indexing', () => {
  test('noindex on index and 404; robots.txt allows crawling; no plaintext in the data file', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const notFound = await request.get('/missing-page');
    expect(notFound.status()).toBe(404);
    expect(await notFound.text()).toContain('noindex');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Allow: \//);
    expect(robots).not.toMatch(/Disallow: \//);
    const data = await (await request.get('/data/trip.enc.json')).text();
    expect(data).not.toContain('Sample');
    expect(JSON.parse(data)).toMatchObject({ v: 1, kdf: { alg: 'PBKDF2-SHA256+HKDF' } });
  });
});

test.describe('offline', () => {
  test('an update keeps the old revision whole and offers Trip updated on the lock screen; Reload switches atomically', async ({ browser, browserName, request }) => {
    test.skip(browserName !== 'chromium', 'Playwright drives service workers reliably only in Chromium; owner checks Safari on device (Q9).');
    const { serve } = await import('../../scripts/serve.mjs');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osaka-sw-'));
    const sw = path.join(tmp, 'sw.js'); const css = path.join(tmp, 'app.css'); const data = path.join(tmp, 'trip.enc.json');
    // Reuse the running fixture server's synthetic data (rebuilding the fixture would disturb parallel tests).
    fs.writeFileSync(data, await (await request.get('/data/trip.enc.json')).body());
    fs.copyFileSync('docs/sw.js', sw); fs.copyFileSync('docs/app.css', css);
    const server = await serve(0, path.resolve('docs'), { '/sw.js': sw, '/app.css': css, '/data/trip.enc.json': data });
    const port = server.address().port;
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const base = `http://127.0.0.1:${port}/${TEST_HASH}`;
    const marker = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--test-rev').trim()).catch(() => null);
    try {
      await page.goto(base);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      // Publish a new revision: a different worker REV and a changed stylesheet.
      fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const REV = '([^']+)'/, "const REV = '$1-next'"));
      fs.appendFileSync(css, '\n:root { --test-rev: next; }\n');
      await page.reload();
      await expect(page.getByRole('status').filter({ hasText: 'Trip updated' })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      expect(await marker()).toBe(''); // still the old revision, whole
      await page.reload();
      await expect(page.getByRole('status').filter({ hasText: 'Trip updated' })).toBeVisible(); // waiting worker offered again
      expect(await marker()).toBe('');
      await page.getByRole('button', { name: 'Reload' }).click();
      await expect.poll(marker, { timeout: 10000 }).toBe('next');
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    } finally {
      await ctx.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('after one load, the app unlocks and works offline (service worker)', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright drives service workers reliably only in Chromium; owner checks Safari offline on device (Q9).');
    await unlock(page);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // now controlled by the worker
    await expect(page.locator('#view-title')).toHaveText('Today');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#view-title')).toHaveText('Today');
    await expect(page.locator('.offline-pill').first()).toBeVisible();
    await page.goto(url('days/2030-05-08'));
    await expect(page.locator('.day-title')).toHaveText('Sample day 2');
    await page.goto(url('info/app'));
    await page.getByRole('button', { name: 'Lock now' }).click();
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.locator('#view-title')).toHaveText('Today');
    await context.setOffline(false);
  });
});

test.describe('text size (Y2, emulated)', () => {
  for (const px of [20, 28]) {
    test(`root text at ${px}px: no horizontal scroll, layouts stack`, async ({ page }) => {
      await unlock(page);
      for (const v of ['today', 'days/2030-05-08', 'food/halal', 'places', 'info/bookings', 'info/to-book', 'info/getting-around', 'info/app']) {
        await page.goto(url(v));
        await page.evaluate((size) => { document.documentElement.style.setProperty('font-size', `${size}px`, 'important'); }, px);
        await page.waitForTimeout(150); // ResizeObserver probe, no resize event (Dynamic Type)
        const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, ax: document.documentElement.hasAttribute('data-ax') }));
        expect(r.over, `${v} at ${px}px`).toBeLessThanOrEqual(1);
        expect(r.ax, `${v} ax flag at ${px}px`).toBe(px >= 23);
      }
    });
  }
});

test('no uncaught errors through unlock and rapid navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await unlock(page);
  for (const name of ['Days', 'Food', 'Places', 'Info', 'Today', 'Days']) {
    await page.getByRole('navigation', { name: /Sections|Trip/ }).filter({ visible: true }).first().getByRole('link', { name, exact: true }).click();
  }
  await page.goto(url('days/2030-05-07'));
  await page.getByRole('button', { name: /^Next day/ }).click();
  await page.getByRole('button', { name: /^Next day/ }).click();
  await page.goBack(); await page.goBack(); await page.goForward();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

test('to book: scoped suppression, updated confirmation caption and device-only ticks', async ({ page }, testInfo) => {
  await unlock(page);
  const warn = page.locator('.callout.warn').first();
  await expect(warn).toContainText('Not booked yet: Sample Fish Bar ba');
  await expect(warn).not.toContainText('Sample Splurge Kappo');
  await expect(warn).not.toContainText('Sample Tempura Counter');
  await page.goto(url('info/to-book'));
  await expect(page.getByText('Flights, hotels and confirmed reservations are already booked. Nothing on the list below is booked yet.')).toBeVisible();
  await expect(page.getByText('Only the flights and hotels are booked.')).toHaveCount(0);
  await expect(page.getByText('2 confirmed in trip plan')).toBeVisible();
  await expect(page.getByText('Sample Splurge Kappo')).toHaveCount(0);
  await expect(page.getByText('Sample Tempura Counter')).toHaveCount(0);
  await shot(page, testInfo, 'to-book');
  const tick = page.getByRole('checkbox', { name: /Sample Fish Bar ba/ });
  await tick.click();
  await expect(page.getByRole('checkbox', { name: /Sample Fish Bar ba/ })).toBeChecked();
  await page.goto(url('days/2030-05-08'));
  await expect(page.locator('.callout.warn')).toHaveCount(0);
  await page.goto(url('today', 'asof=2030-05-03'));
  await expect(page.getByRole('checkbox', { name: /Sample airport transfer in/ })).not.toBeChecked();
});

test('door-to-door travel cards separate Directions from here vs Point-to-point, render ordered steps, inline train booking, taxi last mile and Maps preferences', async ({ page }) => {
  await unlock(page);
  await page.goto(url('days/2030-05-08'));

  // Day detail surfaces one primary next-step card with Directions from here (no origin) and at most one .btn-filled
  const nextStep = page.locator('.next-step-card');
  await expect(nextStep).toBeVisible();
  const topFromHere = nextStep.getByRole('link', { name: /Directions from here/ });
  await expect(topFromHere).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=/);
  expect(await topFromHere.getAttribute('href')).not.toContain('origin=');
  expect(await page.locator('.btn-filled:visible').count()).toBeLessThanOrEqual(1);

  const sec = page.locator('#day-travel');
  await expect(sec).toContainText('Door-to-door travel');
  const primaryCard = sec.locator('.travel-card.is-recommended').first();
  const variantCard = sec.locator('.travel-card.is-variant').first();
  await expect(primaryCard).toHaveAttribute('open', '');
  await expect(variantCard).not.toHaveAttribute('open', '');
  await expect(primaryCard).toContainText('Door-to-door: ~60 to 70 min · In-vehicle: ~38 min combined');

  // Separate random-street Directions from here vs exact named Point-to-point
  const cardFromHere = primaryCard.getByRole('link', { name: 'Directions from here to Sample Park Station' });
  const cardHref = await cardFromHere.getAttribute('href');
  expect(cardHref).toMatch(/google\.com\/maps\/dir\/\?api=1&destination=Sample%20Park%20Station&travelmode=transit/);
  expect(cardHref).not.toContain('origin=');
  const p2pBtn = primaryCard.getByRole('link', { name: 'Point-to-point route from Sample Hotel Osaka to Sample Park Station' });
  await expect(p2pBtn).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&origin=Sample%20Hotel%20Osaka&destination=Sample%20Park%20Station&travelmode=transit/);

  // Ordered steps + inline Japanese lang="ja" + inline bookable train link with reserved-vs-IC note
  await expect(primaryCard.locator('.route-step')).toHaveCount(4);
  await expect(primaryCard.locator('.route-step [lang="ja"]')).toContainText('サンプル特急');
  const bookBtn = primaryCard.getByRole('link', { name: 'Sample reserve seat (+520 JPY)' });
  await expect(bookBtn).toHaveAttribute('href', 'https://example.com/booking');
  await expect(primaryCard.locator('.step-ticket-note')).toContainText('Sample +520 JPY seat supplement online · 680 JPY base fare via IC tap.');

  // Concise taxi alternative with Pickup map, Drop-off map, copyable Japanese, Driver screen and fallback
  const taxiBox = primaryCard.locator('.taxi-alt-box');
  const pickupBtn = taxiBox.getByRole('link', { name: 'Pickup map: Sample Park East Stand' });
  const dropBtn = taxiBox.getByRole('link', { name: 'Drop-off map: Sample Upper Sanctuary' });
  await expect(pickupBtn).toHaveAttribute('href', /destination=Sample%20Park%20Station&travelmode=walking/);
  await expect(dropBtn).toHaveAttribute('href', /destination=Sample%20Upper%20Sanctuary&travelmode=driving/);
  await expect(taxiBox.locator('.taxi-inline-jp[lang="ja"]')).toHaveText('サンプル神社本殿');
  await expect(taxiBox.getByRole('button', { name: /Copy Japanese destination/ })).toBeVisible();
  await expect(taxiBox).toContainText('Sample fallback: copy Japanese text or show Driver screen at the stand.');
  await taxiBox.getByRole('link', { name: 'Driver screen' }).click();
  const drvDialog = page.getByRole('dialog', { name: 'Driver card: Sample Upper Sanctuary' });
  await expect(drvDialog).toContainText('サンプル神社本殿');
  await expect(drvDialog).toContainText('Pickup: Sample Park East Stand');
  await drvDialog.getByRole('button', { name: 'Close' }).click();
  await expect(drvDialog).toHaveCount(0);

  // Secondary fares, watch-outs & operator links stay collapsed until expanded
  const moreDisc = primaryCard.locator('details.travel-more');
  await expect(moreDisc).not.toHaveAttribute('open', '');
  await moreDisc.locator('summary').click();
  await expect(moreDisc).toHaveAttribute('open', '');
  const timetableLink = moreDisc.getByRole('link', { name: 'Sample timetable' });
  await expect(timetableLink).toBeVisible();

  for (const el of [cardFromHere, p2pBtn, bookBtn, pickupBtn, dropBtn, timetableLink]) {
    const box = await el.boundingBox();
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  }

  // Apple Maps preference switches primary Directions from here AND keeps Google Maps from here readily available
  await page.goto(url('info/app'));
  await page.getByLabel('Open places in').selectOption('apple');
  await page.goto(url('days/2030-05-08'));
  const appleFromHere = primaryCard.getByRole('link', { name: 'Directions from here to Sample Park Station' });
  expect(await appleFromHere.getAttribute('href')).toBe('https://maps.apple.com/?daddr=Sample%20Park%20Station&dirflg=r');
  await expect(primaryCard.getByRole('link', { name: 'Google Maps from here to Sample Park Station' }))
    .toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=Sample%20Park%20Station&travelmode=transit');
  await expect(primaryCard.getByRole('link', { name: 'Point-to-point route from Sample Hotel Osaka to Sample Park Station' }))
    .toHaveAttribute('href', 'https://maps.apple.com/?saddr=Sample%20Hotel%20Osaka&daddr=Sample%20Park%20Station&dirflg=r');
});

test('week overview and Tomorrow preview surface core plan, unbooked tentative choices and separate confirmed bookings', async ({ page }) => {
  await unlock(page);

  // Pre-trip Today Week overview separates core plan, optional unbooked choices and confirmed bookings
  await page.goto(url('today', 'asof=2030-05-03'));
  const preOverview = page.locator('.week-overview');
  await expect(preOverview.locator('.day-row')).toHaveCount(3);
  await expect(preOverview).toContainText('Core: Sample gallery browse and afternoon rest before fixed dinner.');
  await expect(preOverview).toContainText('Optional: Sample walk-in salon inquiry (unbooked; availability unconfirmed)');
  await expect(preOverview).toContainText('Confirmed: 18:00 · Sample Tempura Counter');
  await expect(preOverview).toContainText('Optional: Sample covered arcade hop (unbooked; only if energy permits)');

  // During-trip Day 1 evening: Tomorrow card previews Day 2 with distinct Core plan, Tentative / optional, and Confirmed lines
  await page.goto(url('today', 'asof=2030-05-07T19:00'));
  const tmr = page.locator('.tomorrow-card');
  await expect(tmr).toContainText('Wed 8 May · Sample browse & optional wellness');
  await expect(tmr).toContainText('Core plan: Sample gallery browse and afternoon rest before fixed dinner.');
  await expect(tmr).toContainText('Tentative / optional: Sample walk-in salon inquiry (unbooked; availability unconfirmed)');
  await expect(tmr).toContainText('Confirmed: 18:00 · Sample Tempura Counter');

  // Days overview list mirrors the same hierarchy
  await page.goto(url('days'));
  const daysList = page.locator('.days-list').first();
  await expect(daysList).toContainText('Sample flex & arcade option');
  await expect(daysList).toContainText('Core: Sample garden sunset walk and lunch pavilion.');
  await expect(daysList).toContainText('Optional: Sample covered arcade hop (unbooked; only if energy permits)');
  await expect(daysList).toContainText('Confirmed: 12:30 · Sample Kaiseki Pavilion');
});

test('whole-app scan pass: place detail top actions, confirmed-card Directions from here, Halal quick bar, Places clear search and Info curbside card', async ({ page }) => {
  await unlock(page);

  // 1. Confirmed booking card surfaces Directions from here + Copy Japanese upfront
  const todayBk = page.locator('.booking-card').first();
  await expect(todayBk.getByRole('link', { name: 'Directions from here to Sample Tempura Counter' }))
    .toHaveAttribute('href', /destination=Sample%20Tempura%20Counter%20Osaka&travelmode=walking/);
  await expect(todayBk.getByRole('button', { name: 'Copy Japanese name for Sample Tempura Counter' })).toBeVisible();

  // 2. Day detail zone collapses Optional loop while Place detail puts Directions from here at top and verification in disclosure
  await page.goto(url('days/2030-05-08'));
  const extDisc = page.locator('section.zone').first().locator('details.zone-ext-disc');
  await expect(extDisc).not.toHaveAttribute('open', '');
  await extDisc.locator('summary').click();
  await expect(extDisc).toContainText('Sample backstreet coffee loop ba.');

  await page.locator('.row-link', { hasText: 'Sample Garden ba' }).click();
  const detail = page.locator('.sheet, .inspector').filter({ hasText: 'Sample Garden ba' });
  await expect(detail.getByRole('link', { name: 'Directions from here to Sample Garden ba' }))
    .toHaveAttribute('href', /destination=Sample%20Garden%20ba%20Osaka&travelmode=walking/);
  const placeMore = detail.locator('details.place-more');
  await expect(placeMore).not.toHaveAttribute('open', '');
  await placeMore.locator('summary').click();
  await expect(placeMore).toContainText('Primary source checked 1 May 30');
  if (await page.locator('.sheet').count()) await page.keyboard.press('Escape');

  // 3. Food > Halal top quick bar shows live counts, Halal near me, Prayer list jump, and Google Maps fallback under Apple Maps
  await page.goto(url('food/halal'));
  await expect(page.locator('.halal-quick-bar')).toContainText('2 places · 1 prayer room in Umeda');
  await expect(page.getByRole('link', { name: 'Search Maps for halal restaurants near me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prayer list (1)' })).toBeVisible();

  // 4. Places exposes 44pt Clear search button and Jump to today pill
  await page.goto(url('places?k=stops&by=day'));
  await expect(page.getByRole('button', { name: 'Jump to today' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search places' }).fill('Garden ba');
  const clearBtn = page.getByRole('button', { name: 'Clear search' });
  await expect(clearBtn).toBeVisible();
  const clearBox = await clearBtn.boundingBox();
  expect(Math.round(clearBox.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(clearBox.height)).toBeGreaterThanOrEqual(44);
  await clearBtn.click();
  await expect(page.getByRole('searchbox', { name: 'Search places' })).toHaveValue('');

  // 5. Info root surfaces Hotel & curbside card with at most one .btn-filled; Airport day surfaces data-driven Directions from here
  await page.goto(url('info'));
  const curb = page.locator('.info-curb-card');
  await expect(curb).toContainText('Sample Hotel');
  await expect(curb.getByRole('link', { name: 'Directions from here to Sample Hotel' })).toBeVisible();
  await expect(curb.getByRole('button', { name: 'Copy hotel Japanese address' })).toBeVisible();
  expect(await page.locator('.btn-filled:visible').count()).toBeLessThanOrEqual(1);

  await page.goto(url('info/airport'));
  await expect(page.getByRole('link', { name: 'Directions from here to Sample Station' })).toBeVisible();
  expect(await page.locator('.btn-filled:visible').count()).toBeLessThanOrEqual(1);
});

test('First stop regression & leg-by-leg shop navigation: unbooked morning never routes to evening dinner while reservation stays visible', async ({ page }) => {
  await unlock(page);

  // Day 2 has unbooked morning Zone 1 (9:00 to 12:30) and confirmed 18:00 dinner in Zone 3 (Sample Tempura Counter)
  // Viewing Day 2 from another day (First stop) must route to Zone 1's morning target, NOT the 18:00 dinner
  await page.goto(url('days/2030-05-08', 'asof=2030-05-07T10:00'));
  const firstStep = page.locator('.next-step-card');
  await expect(firstStep.locator('.eyebrow')).toContainText('First stop · 9:00 to 12:30');
  await expect(firstStep.locator('.next-step-title')).toHaveText('Sample Station');
  await expect(firstStep.locator('.next-step-title')).not.toContainText('Sample Tempura Counter');
  await expect(firstStep.getByRole('link', { name: 'Directions from here to Sample Station' }))
    .toHaveAttribute('href', /destination=Sample%20Station%20Osaka/);
  // Confirmed dinner card remains prominently visible right below
  const bkCard = page.locator('.booking-card').first();
  await expect(bkCard).toBeVisible();
  await expect(bkCard).toContainText('18:00 · Dinner');
  await expect(bkCard).toContainText('Sample Tempura Counter');

  // Viewing Day 2 during the morning (09:30) also routes Active now · Zone 1 to Sample Station, not dinner
  await page.goto(url('days/2030-05-08', 'asof=2030-05-08T09:30'));
  await expect(firstStep.locator('.eyebrow')).toContainText('Active now · Zone 1');
  await expect(firstStep.locator('.next-step-title')).toHaveText('Sample Station');

  // Selecting Zone 3 (?z=2) or viewing at dinner time (18:00) scopes the top card to Sample Tempura Counter
  await page.goto(url('days/2030-05-08?z=2', 'asof=2030-05-07T10:00'));
  await expect(firstStep.locator('.eyebrow')).toContainText('Zone 3 · 17:30 to 21:00');
  await expect(firstStep.locator('.next-step-title')).toHaveText('Sample Tempura Counter');
  await expect(firstStep.getByRole('link', { name: 'Directions from here to Sample Tempura Counter' }))
    .toHaveAttribute('href', /destination=Sample%20Tempura%20Counter%20Osaka/);

  await page.goto(url('days/2030-05-08', 'asof=2030-05-08T18:00'));
  await expect(firstStep.locator('.eyebrow')).toContainText('Active now · Zone 3');
  await expect(firstStep.locator('.next-step-title')).toHaveText('Sample Tempura Counter');

  // Leg-by-leg shop sequence: Place detail provides both Directions from here and Point-to-point from previous stop
  const shopDisc = page.locator('section.zone').first().locator('details.disclosure').filter({ hasText: 'Shop (1)' });
  await shopDisc.locator('summary').click();
  await shopDisc.locator('.row-link', { hasText: 'Sample Market ba' }).click();
  const detail = page.locator('.sheet, .inspector').filter({ hasText: 'Sample Market ba' });
  const fromHere = detail.getByRole('link', { name: 'Directions from here to Sample Market ba' });
  expect(await fromHere.getAttribute('href')).not.toContain('origin=');
  await expect(detail.getByRole('link', { name: 'Point-to-point route from Sample Garden ba Osaka to Sample Market ba Osaka' }))
    .toHaveAttribute('href', /origin=Sample%20Garden%20ba%20Osaka&destination=Sample%20Market%20ba%20Osaka/);
});
