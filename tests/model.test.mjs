import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures/make-fixture.mjs';
import { nowNext, zoneRange, resolveNow, tripPhase, allPlaces, foodCategories, halalByGroup, defaultHalalGroup, walkCaption, dietKey, fill, searchPlaces } from '../docs/js/model.js';
import { tokyoISO } from '../docs/js/trip.js';

test('zone ranges and now/next', () => {
  const day = fixture.days[0];
  assert.deepEqual(zoneRange(day.zones[0]), { start: 540, end: 780 });
  assert.deepEqual(nowNext(day, 8 * 60), { now: null, next: 0, known: true, done: false });
  assert.deepEqual(nowNext(day, 10 * 60), { now: 0, next: 1, known: true, done: false });
  assert.equal(nowNext(day, 13 * 60 + 30).next, 1);
  assert.equal(nowNext(day, 22 * 60).done, true);
  assert.equal(nowNext({ zones: [{ time: 'Evening' }] }, 600).known, false);
});

test('trip phase in Asia/Tokyo', () => {
  assert.deepEqual(tripPhase(fixture.days, '2030-05-08'), { phase: 'during', index: 1 });
  assert.equal(tripPhase(fixture.days, '2030-05-03').daysToGo, 4);
  assert.equal(tripPhase(fixture.days, '2030-06-25').phase, 'after');
  // 6 May 16:30 UTC is 7 May 01:30 in Tokyo
  assert.equal(tokyoISO(new Date('2030-05-06T16:30:00Z')), '2030-05-07');
  assert.deepEqual(resolveNow('2030-05-08T14:30'), { iso: '2030-05-08', minutes: 870, simulated: true });
  assert.equal(resolveNow('').simulated, false);
});

test('places index keeps every item with a stable id', () => {
  const all = allPlaces(fixture);
  assert.equal(all.length, 3 * 2 * (1 + 3 + 1 + 1));
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.equal(searchPlaces(all, 'pancake ba').length, 1);
});

test('food categories follow the original rules', () => {
  const cats = Object.fromEntries(foodCategories(fixture).map((c) => [c.id, c]));
  assert.equal(cats.bakeries.items.length, 1);
  assert.equal(cats.breakfast.items.length, 1); // opens 8:00 <= 8:30
  assert.equal(cats.pancakes.items.length, 6);
  assert.equal(cats.halal.items.length, 3);
});

test('halal ordering, default group and walk captions', () => {
  const list = halalByGroup(fixture, 'umeda');
  assert.deepEqual(list.map((p) => p.status), ['Halal certified', 'Halal (own claim)']);
  assert.equal(halalByGroup(fixture, 'umeda', { certifiedOnly: true }).length, 1);
  assert.equal(defaultHalalGroup(fixture, '2030-05-09'), 'nara');
  assert.equal(defaultHalalGroup(fixture, '2031-01-01'), 'umeda');
  assert.match(walkCaption(list[0]), /6 min/);
  assert.equal(walkCaption(list[1]), ''); // 0 means unknown
  assert.equal(walkCaption(fixture.halal.places[2]), ''); // not from the hotel outside Osaka
});

test('diet labels and traveller templating', () => {
  assert.equal(dietKey('Halal certified'), 'certified');
  assert.equal(dietKey('Halal (own claim)'), 'claim');
  assert.equal(dietKey('Not for Traveller B'), 'no');
  assert.equal(dietKey('Fish, prawn or veg options'), 'options');
  assert.equal(fill(fixture, 'Works for {B}'), 'Works for Traveller B');
});
