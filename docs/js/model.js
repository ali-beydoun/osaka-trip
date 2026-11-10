// View-model helpers over the decrypted trip. Pure functions, no DOM; unit-tested in Node.
import { tokyoISO } from './trip.js';

export const DAY_TYPE = { shop: 'Shopping', sight: 'Sightseeing', rest: 'Rest', travel: 'Travel' };
export const LOAD = { 1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Full' };
export const MODE = { transit: 'Train', walking: 'Walk', driving: 'Taxi' };
export const FLOW_LEVEL = { 0: 'Downtime', 1: 'Easy', 2: 'On the go' };
export const KINDS = [['stops', 'See'], ['shop', 'Shop'], ['sweet', 'Sweet'], ['eat', 'Eat']];

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
