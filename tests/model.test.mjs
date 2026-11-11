import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures/make-fixture.mjs';
import {
  nowNext, zoneRange, resolveNow, tripPhase, allPlaces, foodCategories, halalByGroup, defaultHalalGroup, dayHalalGroups,
  walkCaption, dietKey, fill, searchPlaces, confirmedBookings, confirmedBookingsForDay, confirmedBookingForPlace,
  formatGuests, activeToBookItems, toBookCaption, activeDayOpen, activeDayDecisions, flowZoneIndex, flowBookingIndex,
  DEFAULT_TO_BOOK_NOTE, CONFIRMED_TO_BOOK_NOTE,
} from '../docs/js/model.js';
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

test('places index keeps every item with a stable id across 5-flow, 3-zone, 12-restaurant day', () => {
  const all = allPlaces(fixture);
  assert.equal(all.length, 44);
  assert.equal(all.filter((p) => p.dayISO === '2030-05-08' && p.kind === 'eat').length, 12);
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.equal(searchPlaces(all, 'pancake ba').length, 1);
  assert.equal(searchPlaces(all, 'entry tip ba').length, 1);
  assert.equal(searchPlaces(all, 'italian trattoria').length, 1);
});

test('food categories follow the original rules', () => {
  const cats = Object.fromEntries(foodCategories(fixture).map((c) => [c.id, c]));
  assert.equal(cats.bakeries.items.length, 1);
  assert.equal(cats.breakfast.items.length, 1); // opens 8:00 <= 8:30
  assert.equal(cats.pancakes.items.length, 7);
  assert.equal(cats.halal.items.length, 3);
});

test('halal ordering, default group and walk captions', () => {
  const list = halalByGroup(fixture, 'umeda');
  assert.deepEqual(list.map((p) => p.status), ['Halal certified', 'Halal (own claim)']);
  assert.equal(halalByGroup(fixture, 'umeda', { certifiedOnly: true }).length, 1);
  assert.equal(defaultHalalGroup(fixture, '2030-05-09'), 'nara');
  assert.equal(defaultHalalGroup(fixture, '2031-01-01'), 'umeda');
  assert.deepEqual(dayHalalGroups(fixture, '2030-05-08'), ['umeda', 'nara']);
  assert.deepEqual(dayHalalGroups(fixture, '2031-01-01'), ['umeda']);
  assert.match(walkCaption(list[0]), /6 min/);
  assert.equal(walkCaption(list[1]), ''); // 0 means unknown
  assert.equal(walkCaption(fixture.halal.places[2]), ''); // not from the hotel outside Osaka
  assert.equal(walkCaption({ walk_min: 7, walk_anchor: 'Sample Station' }), 'About 7 min walk from Sample Station');
});

test('diet labels and traveller templating', () => {
  assert.equal(dietKey('Halal certified'), 'certified');
  assert.equal(dietKey('Halal (own claim)'), 'claim');
  assert.equal(dietKey('Not for Traveller B'), 'no');
  assert.equal(dietKey('Fish, prawn or veg options'), 'options');
  assert.equal(fill(fixture, 'Works for {B}'), 'Works for Traveller B');
});

test('confirmed bookings contract: multiple future bookings, chronological sort and no prose inference', () => {
  const conf = confirmedBookings(fixture);
  assert.deepEqual(conf.map((b) => b.id), ['bk-d2-dinner', 'bk-d3-lunch']);
  assert.equal(confirmedBookingsForDay(fixture, '2030-05-07').length, 0); // unbooked status ignored
  assert.equal(confirmedBookingsForDay(fixture, '2030-05-08').length, 1);
  assert.equal(confirmedBookingsForDay(fixture, '2030-05-09').length, 1);
  assert.equal(formatGuests(2), '2 guests');
  assert.equal(formatGuests(1), '1 guest');
  assert.equal(formatGuests('2 adults'), '2 adults');

  // Supports multiple confirmed reservations on the same day, ordered by time
  const multiSameDay = {
    ...fixture,
    bookings: [
      ...fixture.bookings,
      { id: 'bk-d2-lunch', day: '2030-05-08', status: 'confirmed', kind: 'dining', meal: 'lunch', zone: 0, time: '12:00', venue: 'Sample Halal Diner ba', guests: 2 },
    ],
  };
  assert.deepEqual(confirmedBookingsForDay(multiSameDay, '2030-05-08').map((b) => b.id), ['bk-d2-lunch', 'bk-d2-dinner']);

  // Prose saying "Confirmed" or "Booked" never creates a confirmed booking without structured status: "confirmed"
  const proseOnly = {
    days: [{
      iso: '2030-05-08',
      summary: 'Dinner is already confirmed and booked at 18:00.',
      flow: [{ when: 'Evening', text: 'Confirmed reservation at Sample Bistro at 18:00.', level: 1 }],
      zones: [{
        name: 'Sample Evening',
        time: '17:30 to 21:00',
        eat: [{ name: 'Sample Bistro', what: 'Confirmed table for 2.', booking: 'Confirmed for 18:00, ref ABC123' }],
      }],
    }],
    bookings: [
      { id: 'p1', day: '2030-05-08', status: 'pending', venue: 'Sample Bistro', time: '18:00' },
      { id: 'p2', day: '2030-05-08', status: 'unbooked', venue: 'Sample Bistro', time: '18:00' },
    ],
  };
  assert.equal(confirmedBookings(proseOnly).length, 0);

  const matchedPlace = allPlaces(fixture).find((p) => p.name === 'Sample Tempura Counter');
  assert.equal(confirmedBookingForPlace(fixture, matchedPlace)?.id, 'bk-d2-dinner');
  const backupPlace = allPlaces(fixture).find((p) => p.name === 'Sample Italian Trattoria');
  assert.equal(confirmedBookingForPlace(fixture, backupPlace), null);
});

test('scoped suppression removes occupied meal/zone alternatives while preserving genuine pending commitments', () => {
  const active = activeToBookItems(fixture);
  assert.deepEqual(active.map((x) => x.id), ['transfer-arrival', 'eat-1', 'eat-2']);

  // Explicit meal match also suppresses a dinner candidate even without a zone index
  const mealScoped = {
    ...fixture,
    to_book: {
      note: fixture.to_book.note,
      items: [
        ...fixture.to_book.items,
        { id: 'eat-dinner-elsewhere', title: 'Sample Other Dinner', day: '2030-05-08', meal: 'dinner', kind: 'restaurant', need: 'needs', detail: 'Dinner slot.' },
        { id: 'activity-d2', title: 'Sample Evening Cruise', day: '2030-05-08', zone: 2, kind: 'activity', need: 'needs', detail: 'Ticket needed.' },
      ],
    },
  };
  assert.deepEqual(activeToBookItems(mealScoped).map((x) => x.id), ['transfer-arrival', 'eat-1', 'eat-2', 'activity-d2']);
});

test('global To book caption updates when confirmations exist and keeps default when none exist', () => {
  assert.equal(toBookCaption(fixture), CONFIRMED_TO_BOOK_NOTE);
  const noConfirmed = { ...fixture, bookings: fixture.bookings.filter((b) => b.status !== 'confirmed') };
  assert.equal(toBookCaption(noConfirmed), DEFAULT_TO_BOOK_NOTE);
  const customNote = { ...fixture, to_book: { ...fixture.to_book, note: 'Custom note from owner.' } };
  assert.equal(toBookCaption(customNote), 'Custom note from owner.');
});

test('itinerary flow-to-zone mapping and open decision resolution', () => {
  const day2 = fixture.days[1];
  assert.deepEqual(day2.flow.map((f) => flowZoneIndex(day2, f)), [0, 0, 1, -1, 2]);
  assert.equal(flowBookingIndex(day2, fixture.bookings[0]), 4);

  assert.equal(activeDayOpen(fixture, day2), 'Sample open decision');
  const resolvedOpenTrip = {
    ...fixture,
    days: fixture.days.map((d, i) => (i === 1 ? { ...d, open_meal: 'dinner', decisions: [{ text: 'Pick dinner venue?', meal: 'dinner' }, 'Check train pass?'] } : d)),
  };
  assert.equal(activeDayOpen(resolvedOpenTrip, resolvedOpenTrip.days[1]), '');
  assert.deepEqual(activeDayDecisions(resolvedOpenTrip, resolvedOpenTrip.days[1]), ['Check train pass?']);
});
