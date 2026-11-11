// View-model helpers over the decrypted trip. Pure functions, no DOM; unit-tested in Node.
import { tokyoISO } from './trip.js';

export const DAY_TYPE = { shop: 'Shopping', sight: 'Sightseeing', rest: 'Rest', travel: 'Travel' };
export const LOAD = { 1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Full' };
export const MODE = { transit: 'Train', walking: 'Walk', driving: 'Taxi' };
export const FLOW_LEVEL = { 0: 'Downtime', 1: 'Easy', 2: 'On the go' };
export const KINDS = [['stops', 'See'], ['shop', 'Shop'], ['sweet', 'Sweet'], ['eat', 'Eat']];
export const BOOKING_STATUS = ['confirmed', 'pending', 'unbooked', 'cancelled'];
export const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', cafe: 'Cafe' };
export const DEFAULT_TO_BOOK_NOTE = 'Only the flights and hotels are booked. Nothing on this list is booked yet.';
export const CONFIRMED_TO_BOOK_NOTE = 'Flights, hotels and confirmed reservations are already booked. Nothing on the list below is booked yet.';

// Halal evidence, strongest first. Strings are the dataset's exact values.
export const HALAL_STATUS = ['Halal certified', 'Halal (own claim)', 'Halal menu', 'Muslim-friendly', 'Not halal: fallback'];
export const HALAL_KEY = { 'Halal certified': 'certified', 'Halal (own claim)': 'claim', 'Halal menu': 'menu', 'Muslim-friendly': 'friendly', 'Not halal: fallback': 'fallback' };

// Day eat items carry a dietary label for the second traveller (field name kept from the source).
export function dietKey(label = '') {
  if (/^halal certified/i.test(label)) return 'certified';
  if (/^halal/i.test(label)) return 'claim';
  if (/^not for/i.test(label)) return 'no';
  if (label) return 'options';
  return '';
}

// Osaka-area groups where walk_min means minutes on foot from the hotel.
export const HOTEL_WALK_GROUPS = new Set(['umeda']);

export function walkCaption(item, group) {
  const g = group || item.g;
  if (!item.walk_min) return '';
  if (item.walk_anchor) return `About ${item.walk_min} min walk from ${item.walk_anchor}`;
  if (g && !HOTEL_WALK_GROUPS.has(g)) return '';
  return `About ${item.walk_min} min walk from the hotel`;
}

// ---------- Time ----------
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function zoneRange(zone) {
  const m = /^\s*(\d{1,2}:\d{2})\s*to\s*(\d{1,2}:\d{2})\s*$/.exec(zone.time || '');
  if (!m) return null;
  return { start: parseHM(m[1]), end: parseHM(m[2]) };
}

export function tokyoMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

// Accepts "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (Tokyo wall time) for review; else real time.
export function resolveNow(asof) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(asof || '');
  if (!m) return { iso: tokyoISO(), minutes: tokyoMinutes(), simulated: false };
  return { iso: m[1], minutes: m[2] ? Number(m[2]) * 60 + Number(m[3]) : 9 * 60, simulated: true };
}

export function tripPhase(days, iso) {
  const i = days.findIndex((d) => d.iso === iso);
  if (i >= 0) return { phase: 'during', index: i };
  if (iso < days[0].iso) return { phase: 'before', index: 0, daysToGo: Math.round((Date.parse(days[0].iso) - Date.parse(iso)) / 86400000) };
  return { phase: 'after', index: days.length - 1 };
}

// Now and Next by zone time ranges. Returns nulls rather than guessing.
export function nowNext(day, minutes) {
  const zones = day.zones.map((z, i) => ({ z, i, r: zoneRange(z) }));
  if (zones.some((x) => !x.r)) return { now: null, next: null, known: false };
  const now = zones.find((x) => minutes >= x.r.start && minutes < x.r.end) || null;
  const next = zones.find((x) => x.r.start > minutes) || null;
  return { now: now && now.i, next: next && next.i, known: true, done: !now && !next };
}

// ---------- Indexes ----------
// Every recommendation across the trip, tagged with its day and zone. ids are stable per dataset.
export function allPlaces(trip) {
  const out = [];
  trip.days.forEach((d, di) => d.zones.forEach((z, zi) => KINDS.forEach(([kind]) => (z[kind] || []).forEach((it, ii) => {
    out.push({ ...it, id: `d${di}-z${zi}-${kind}-${ii}`, kind, dayIndex: di, dayISO: d.iso, dayLabel: d.date, zone: z.name });
  }))));
  return out;
}

function dedupeKey(name) {
  let key = (name || '').toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('buyu')) key = 'buyuden';
  if (key.startsWith('adining')) key = 'adining';
  return key;
}

function fromDays(trip, test) {
  const seen = new Set();
  return allPlaces(trip).filter((it) => {
    if (it.kind !== 'eat' && it.kind !== 'sweet') return false;
    const key = dedupeKey(it.name);
    if (seen.has(key) || !test(it)) return false;
    seen.add(key);
    return true;
  });
}

const textTest = (re) => (it) => re.test(`${it.name || ''} ${it.what || ''}`);

// Food categories as defined by the original planner, with the same rules.
export function foodCategories(trip) {
  const bakes = trip.bakeries.map((b, i) => ({ ...b, id: `b${i}`, kind: 'bakery' }));
  return [
    { id: 'bakeries', label: 'Bakeries', blurb: 'Pastries and coffee near the hotel, researched 31 Oct.', items: bakes },
    { id: 'breakfast', label: 'Breakfast', blurb: 'Early openers and breakfast cafés, from the bakery list and the day plans.',
      items: bakes.filter((b) => (parseHM(b.opens) ?? 9999) <= 510).concat(fromDays(trip, textTest(/breakfast|brunch|morning|toast set/i))) },
    { id: 'pancakes', label: 'Pancakes', blurb: 'Soufflé and classic pancakes found across the trip.', items: fromDays(trip, textTest(/pancake|souffl/i)) },
    { id: 'halal', label: 'Halal', custom: true, items: halalPlaces(trip) },
  ];
}

export function halalPlaces(trip) {
  return trip.halal.places.map((p, i) => ({ ...p, id: `h${i}`, kind: 'halal' }));
}

export function prayerRooms(trip) {
  return trip.halal.prayer.map((p, i) => ({ ...p, id: `p${i}`, kind: 'prayer' }));
}

export function halalByGroup(trip, group, { certifiedOnly = false } = {}) {
  return halalPlaces(trip)
    .filter((p) => p.g === group && (!certifiedOnly || p.status === 'Halal certified'))
    .sort((a, b) => HALAL_STATUS.indexOf(a.status) - HALAL_STATUS.indexOf(b.status) || (a.walk_min || 99) - (b.walk_min || 99));
}

export function defaultHalalGroup(trip, iso) {
  const g = trip.halal.dayGroup[iso];
  return trip.halal.groups.some((x) => x.id === g) ? g : trip.halal.groups[0].id;
}

export function dayHalalGroups(trip, iso) {
  const valid = new Set((trip.halal.groups || []).map((x) => x.id));
  const raw = trip.halal.dayGroups && trip.halal.dayGroups[iso];
  if (Array.isArray(raw)) {
    const out = raw.filter((g) => valid.has(g));
    if (out.length) return out;
  }
  return [defaultHalalGroup(trip, iso)];
}

// Travellers come from the payload with roles: A is the trip owner, B the second traveller.
export function traveller(trip, role) {
  const t = (trip.travellers || []).find((x) => x.role === role);
  return t ? t.name : '';
}

// Fills {A} and {B} in copy; source labels that already name a traveller pass through unchanged.
export function fill(trip, text) {
  return String(text).replace(/\{(A|B)\}/g, (_, r) => traveller(trip, r));
}

export function searchPlaces(list, q) {
  const terms = (q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((it) => {
    const hay = `${it.name} ${it.jp || ''} ${it.what || ''} ${it.why || ''} ${it.look_for || ''} ${it.entry_tip || ''} ${it.zone || it.area || ''} ${it.cuisine || ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// ---------- Structured bookings & itinerary integration ----------
export function normKey(s) {
  return String(s || '').trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ');
}

// Reads only explicit structured booking objects. Never infers booking status from prose.
export function allBookings(trip) {
  if (!trip || typeof trip !== 'object') return [];
  const raw = [];
  if (Array.isArray(trip.bookings)) raw.push(...trip.bookings);
  for (const d of trip.days || []) {
    if (Array.isArray(d.bookings)) {
      for (const b of d.bookings) {
        if (b && typeof b === 'object' && !Array.isArray(b)) raw.push(b.day ? b : { ...b, day: d.iso });
      }
    }
  }
  const seen = new Set();
  const out = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object' || Array.isArray(b)) continue;
    if (typeof b.day !== 'string' || !b.day.trim()) continue;
    if (typeof b.venue !== 'string' || !b.venue.trim()) continue;
    if (typeof b.status !== 'string' || !BOOKING_STATUS.includes(b.status)) continue;
    const key = b.id ? `id:${b.id}` : `slot:${b.day}|${normKey(b.venue)}|${b.time || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

export function confirmedBookings(trip) {
  return allBookings(trip)
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => a.day.localeCompare(b.day) || ((parseHM(a.time) ?? 9999) - (parseHM(b.time) ?? 9999)));
}

export function confirmedBookingsForDay(trip, iso) {
  return confirmedBookings(trip).filter((b) => b.day === iso);
}

export function formatGuests(guests) {
  if (guests === null || guests === undefined || guests === '') return '';
  const s = String(guests).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 0 ? `${n} ${n === 1 ? 'guest' : 'guests'}` : '';
  }
  return s;
}

export function explicitBookingZoneIndex(day, booking) {
  if (!day || !Array.isArray(day.zones) || !booking) return -1;
  if (Number.isInteger(booking.zone) && booking.zone >= 0 && booking.zone < day.zones.length) return booking.zone;
  if (typeof booking.zone === 'string' && booking.zone.trim()) {
    return day.zones.findIndex((z) => normKey(z.name) === normKey(booking.zone));
  }
  return -1;
}

export function bookingZoneIndex(day, booking) {
  const explicit = explicitBookingZoneIndex(day, booking);
  if (explicit >= 0) return explicit;
  if (!day || !Array.isArray(day.zones) || !booking) return -1;
  const target = normKey(booking.place_match || booking.venue);
  if (target) {
    const byPlace = day.zones.findIndex((z) => KINDS.some(([k]) => (z[k] || []).some((it) => normKey(it.name) === target)));
    if (byPlace >= 0) return byPlace;
  }
  return -1;
}

export function confirmedBookingForPlace(trip, place) {
  const iso = place && (place.dayISO || place.day);
  if (!iso || !place.name) return null;
  const day = (trip?.days || []).find((d) => d.iso === iso);
  const pNorm = normKey(place.name);
  const pZone = day && place.zone ? day.zones.findIndex((z) => normKey(z.name) === normKey(place.zone)) : -1;
  for (const b of confirmedBookingsForDay(trip, iso)) {
    const matchName = normKey(b.venue) === pNorm || (b.place_match && normKey(b.place_match) === pNorm);
    if (!matchName) continue;
    const bZone = day ? explicitBookingZoneIndex(day, b) : -1;
    if (bZone >= 0 && pZone >= 0 && bZone !== pZone) continue;
    return b;
  }
  return null;
}

// Scopes suppression strictly to explicit venue/id match, explicit meal match, or explicit occupied dining zone.
export function isSupersededByConfirmedBooking(trip, item) {
  if (!item || !item.day) return false;
  const confirmed = confirmedBookingsForDay(trip, item.day);
  if (!confirmed.length) return false;
  const day = (trip?.days || []).find((d) => d.iso === item.day);
  const itemNorm = normKey(item.title);
  const isRestaurantItem = item.kind === 'restaurant' || item.kind === 'dining';

  let itemZone = -1;
  let itemMeal = item.meal || '';
  if (day) {
    if (Number.isInteger(item.zone) && item.zone >= 0 && item.zone < day.zones.length) itemZone = item.zone;
    else if (typeof item.zone === 'string' && item.zone.trim()) {
      itemZone = day.zones.findIndex((z) => normKey(z.name) === normKey(item.zone));
    }
    if (isRestaurantItem && (itemZone < 0 || !itemMeal)) {
      day.zones.forEach((z, zi) => {
        for (const eat of z.eat || []) {
          if (normKey(eat.name) === itemNorm) {
            if (itemZone < 0) itemZone = zi;
            if (!itemMeal && eat.meal) itemMeal = eat.meal;
          }
        }
      });
    }
  }

  return confirmed.some((b) => {
    if (b.replaces_to_book && b.replaces_to_book === item.id) return true;
    if (itemNorm && (normKey(b.venue) === itemNorm || (b.place_match && normKey(b.place_match) === itemNorm))) return true;
    const bIsDining = !b.kind || b.kind === 'dining' || b.kind === 'restaurant' || Boolean(b.meal);
    if (bIsDining && isRestaurantItem) {
      if (b.meal && itemMeal) return b.meal === itemMeal;
      const bZone = day ? explicitBookingZoneIndex(day, b) : -1;
      if (bZone >= 0 && itemZone === bZone) {
        if (!itemMeal || !b.meal || itemMeal === b.meal) return true;
      }
    }
    return false;
  });
}

export function activeToBookItems(trip) {
  const raw = (trip?.to_book && Array.isArray(trip.to_book.items)) ? trip.to_book.items : [];
  return raw.filter((it) => !isSupersededByConfirmedBooking(trip, it));
}

export function toBookCaption(trip) {
  const raw = (trip?.to_book && trip.to_book.note) || '';
  if (confirmedBookings(trip).length > 0) {
    if (!raw || /only the flights and hotels are booked/i.test(raw)) return CONFIRMED_TO_BOOK_NOTE;
    return raw;
  }
  return raw || DEFAULT_TO_BOOK_NOTE;
}

export function activeDayOpen(trip, day) {
  if (!day || !day.open) return '';
  const confirmed = confirmedBookingsForDay(trip, day.iso);
  if (confirmed.some((b) => b.resolves_open === true || (day.open_meal && b.meal === day.open_meal))) return '';
  return day.open;
}

export function activeDayDecisions(trip, day) {
  if (!day || !Array.isArray(day.decisions)) return [];
  const confirmed = confirmedBookingsForDay(trip, day.iso);
  const out = [];
  for (const dec of day.decisions) {
    if (typeof dec === 'string') {
      if (dec.trim()) out.push(dec);
    } else if (dec && typeof dec === 'object' && typeof dec.text === 'string' && dec.text.trim()) {
      const sup = confirmed.some((b) => (dec.meal && b.meal === dec.meal) || (Number.isInteger(dec.zone) && explicitBookingZoneIndex(day, b) === dec.zone));
      if (!sup) out.push(dec.text);
    }
  }
  return out;
}

function flowWindow(when) {
  const raw = String(when || '').trim();
  const rangeMatch = /^(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})$/i.exec(raw);
  if (rangeMatch) return [parseHM(rangeMatch[1]), parseHM(rangeMatch[2])];
  const clock = parseHM(raw);
  if (clock !== null) return [clock, clock + 60];
  const w = raw.toLowerCase();
  if (/late\s*morning|mid[- ]?morning/.test(w)) return [600, 750];
  if (/early\s*morning|^early$/.test(w)) return [420, 600];
  if (/\bmorning\b|\bam\b/.test(w)) return [480, 720];
  if (/early\s*afternoon/.test(w)) return [780, 930];
  if (/late\s*afternoon/.test(w)) return [930, 1065];
  if (/\bafternoon\b|\bpm\b/.test(w)) return [780, 1035];
  if (/\bmidday\b|\bnoon\b|\blunch\b/.test(w)) return [705, 840];
  if (/\bdinner\b|\bevening\b/.test(w)) return [1035, 1290];
  if (/\bnight\b|\blate\b/.test(w)) return [1200, 1410];
  return null;
}

export function flowZoneIndex(day, flowItem) {
  if (!day || !Array.isArray(day.zones) || !flowItem) return -1;
  if (flowItem.zone === null) return -1;
  if (Number.isInteger(flowItem.zone) && flowItem.zone >= 0 && flowItem.zone < day.zones.length) return flowItem.zone;
  if (typeof flowItem.zone === 'string' && flowItem.zone.trim()) {
    const idx = day.zones.findIndex((z) => normKey(z.name) === normKey(flowItem.zone));
    if (idx >= 0) return idx;
  }
  const win = flowWindow(flowItem.when);
  if (!win) return -1;
  const minOverlap = flowItem.level === 0 ? 60 : 30;
  let best = -1;
  let bestOverlap = 0;
  day.zones.forEach((z, zi) => {
    const r = zoneRange(z);
    if (!r) return;
    const overlap = Math.min(win[1], r.end) - Math.max(win[0], r.start);
    if (overlap >= minOverlap && overlap > bestOverlap) {
      bestOverlap = overlap;
      best = zi;
    }
  });
  return best;
}

export function flowBookingIndex(day, booking) {
  if (!day || !Array.isArray(day.flow) || !day.flow.length || !booking) return -1;
  if (Number.isInteger(booking.flow) && booking.flow >= 0 && booking.flow < day.flow.length) return booking.flow;
  const bm = parseHM(booking.time);
  if (bm !== null) {
    let best = -1;
    let bestSpan = Infinity;
    day.flow.forEach((f, fi) => {
      const win = flowWindow(f.when);
      if (!win) return;
      if (bm >= win[0] && bm <= win[1] && (win[1] - win[0]) < bestSpan) {
        bestSpan = win[1] - win[0];
        best = fi;
      }
    });
    if (best >= 0) return best;
  }
  const mealRe = booking.meal === 'breakfast' ? /\bmorning\b|\bearly\b/i
    : booking.meal === 'lunch' ? /\bmidday\b|\bnoon\b|\blunch\b|late\s*morning|early\s*afternoon/i
      : booking.meal === 'dinner' ? /\bdinner\b|\bevening\b|\bnight\b/i : null;
  if (mealRe) {
    const idx = day.flow.findIndex((f) => mealRe.test(f.when || ''));
    if (idx >= 0) return idx;
  }
  const bz = bookingZoneIndex(day, booking);
  if (bz >= 0) {
    const matches = day.flow.map((f, fi) => (flowZoneIndex(day, f) === bz ? fi : -1)).filter((fi) => fi >= 0);
    if (matches.length) return booking.meal === 'dinner' ? matches[matches.length - 1] : matches[0];
  }
  return -1;
}
