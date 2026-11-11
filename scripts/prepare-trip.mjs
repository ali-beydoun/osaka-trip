// Builds the private app dataset (../osaka-trip-private/trip.json) from the migration inputs.
// Inputs (all private): planner-data.json (verbatim planner DATA), the trip document export,
// trip-profile.local.json (travellers, hotel) and denylist.local.txt (redactions).
// Output is plaintext and stays in the private folder; build-data.mjs encrypts it.
import fs from 'node:fs';
import path from 'node:path';
import { PRIVATE_DIR, TRIP_FILE } from './paths.mjs';
import {
  BOOKING_STATUS, CONFIRMED_TO_BOOK_NOTE, confirmedBookings, explicitBookingZoneIndex, isSupersededByConfirmedBooking, normKey,
} from '../docs/js/model.js';

const read = (f) => fs.readFileSync(path.join(PRIVATE_DIR, f), 'utf8');
const planner = JSON.parse(read('planner-data.json'));
const profile = JSON.parse(read('trip-profile.local.json'));
const deny = read('denylist.local.txt').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
const md = read('source-exports/Osaka Trip 2026.md');

// denylist.local.txt keeps every private string out of the repository (check-privacy.mjs).
// The encrypted payload keeps booking references (owner decision, 8 Nov 2026) and drops only private Claude links.
const payloadRedactions = deny.filter((d) => d.includes('claude.ai/'));
function redact(text) {
  let t = text.replace(/\[([^\]]+)\]\(https:\/\/claude\.ai\/[^)]*\)/g, '$1'); // drop private Claude links, keep label
  for (const d of payloadRedactions) t = t.split(d).join('');
  return t;
}

// Split the document into sections; keep markdown text verbatim apart from redactions.
function sections(src) {
  const lines = src.split('\n');
  const out = [];
  let cur = null;
  let intro = [];
  for (const line of lines.slice(1)) {
    const m = /^(#{2,3}) (.+)$/.exec(line);
    if (m) {
      cur = { id: m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), level: m[1].length, title: m[2], md: '' };
      out.push(cur);
    } else if (cur) cur.md += line + '\n';
    else intro.push(line);
  }
  // First intro line is the document byline (date and author); it is not trip content.
  const introText = intro.filter((l) => l.trim() && !/^\w{3} \d{1,2}, \d{4} ·/.test(l)).join('\n');
  out.forEach((s) => { s.md = redact(s.md.trim()); });
  return { intro: redact(introText.trim()), sections: out };
}

const doc = sections(md);

// Public code must not reveal personal themes through field names: the source names one field after
// the second traveller and another after a health detail. Both are renamed (mapping kept private).
const RENAME = profile.rename_fields || {};
function renameKeys(v) {
  if (Array.isArray(v)) return v.map(renameKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[RENAME[k] || k] = renameKeys(val);
    return out;
  }
  return v;
}
const days = planner.days;
const trip = {
  meta: {
    title: 'Osaka Trip',
    tz: 'Asia/Tokyo',
    start: days[0].iso,
    end: days[days.length - 1].iso,
    halal_as_of: planner.halal.as_of,
    migrated_from: 'Osaka Trip Planner artifact export and Osaka Trip 2026 document, 8 Nov 2026',
    notes: profile.notes,
  },
  travellers: profile.travellers,
  hotel: profile.hotel,
  days: renameKeys(days),
  bakeries: renameKeys(planner.bakeries),
  halal: renameKeys(planner.halal),
  doc,
};

// Owner corrections (owner-updates.local.json): exact replacements that must each match exactly once.
const updates = fs.existsSync(path.join(PRIVATE_DIR, 'owner-updates.local.json')) ? JSON.parse(read('owner-updates.local.json')) : { replace: [], replace_exact_fields: [], to_book: [] };
let body = JSON.stringify(trip.days);
for (const [from, to] of updates.replace || []) {
  const n = body.split(from).length - 1;
  if (n !== 1) throw new Error(`Owner update expected one match, found ${n} (length ${from.length}).`);
  body = body.replace(from, to);
}
trip.days = JSON.parse(body);
for (const f of updates.replace_exact_fields || []) {
  let obj = trip.days.find((d) => d.iso === f.day);
  const last = f.path[f.path.length - 1];
  for (const k of f.path.slice(0, -1)) obj = obj[k];
  if (obj[last] !== f.from) throw new Error(`Owner field update did not match on ${f.day}.`);
  obj[last] = f.to;
}

// Structured day and directory enrichments (day-enrichments.local.json), applied after owner updates.
if (fs.existsSync(path.join(PRIVATE_DIR, 'day-enrichments.local.json'))) {
  const enrich = JSON.parse(read('day-enrichments.local.json'));
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\u2018\u2019]/g, "'");
  if (enrich.halal) {
    if (enrich.halal.dayGroups) trip.halal.dayGroups = enrich.halal.dayGroups;
    if (enrich.halal.places_patch) {
      for (const [key, patch] of Object.entries(enrich.halal.places_patch)) {
        const matches = trip.halal.places.filter((p) => norm(p.name) === norm(key));
        if (matches.length !== 1) throw new Error(`Halal place patch "${key}" expected 1 exact match, found ${matches.length}.`);
        Object.assign(matches[0], patch);
      }
    }
    if (enrich.halal.prayer_patch) {
      for (const [key, patch] of Object.entries(enrich.halal.prayer_patch)) {
        const matches = trip.halal.prayer.filter((pr) => norm(pr.name) === norm(key));
        if (matches.length !== 1) throw new Error(`Prayer patch "${key}" expected 1 exact match, found ${matches.length}.`);
        Object.assign(matches[0], patch);
      }
    }
  }
  if (enrich.days) {
    for (const [iso, de] of Object.entries(enrich.days)) {
      const d = trip.days.find((x) => x.iso === iso);
      if (!d) throw new Error(`Enrichment day not found: ${iso}`);
      for (const k of ['checked_on', 'summary', 'pacing', 'route_strategy', 'rain_plan', 'logistics', 'spa_intro', 'spa_options', 'open', 'open_meal', 'decisions', 'bookings']) {
        if (de[k] !== undefined) d[k] = de[k];
      }
      if (de.decisions_replace) {
        for (const rep of de.decisions_replace) {
          const { match, text, meal, zone } = rep;
          const hits = (d.decisions || [])
            .map((w, idx) => ((typeof w === 'string' ? w : (w?.text || '')).includes(match) ? idx : -1))
            .filter((idx) => idx >= 0);
          if (hits.length !== 1) throw new Error(`Decision replace "${match}" on ${iso} expected 1 match, found ${hits.length}.`);
          const prev = d.decisions[hits[0]];
          const nextText = text !== undefined ? text : (typeof prev === 'string' ? prev : prev.text);
          d.decisions[hits[0]] = (meal !== undefined || zone !== undefined || (nextText && typeof nextText === 'object'))
            ? (typeof nextText === 'object' ? nextText : { text: nextText, ...(meal !== undefined ? { meal } : {}), ...(zone !== undefined ? { zone } : {}) })
            : nextText;
        }
      }
      if (de.decisions_remove) {
        for (const match of de.decisions_remove) {
          const hits = (d.decisions || [])
            .map((w, idx) => ((typeof w === 'string' ? w : (w?.text || '')).includes(match) ? idx : -1))
            .filter((idx) => idx >= 0);
          if (hits.length !== 1) throw new Error(`Decision remove "${match}" on ${iso} expected 1 match, found ${hits.length}.`);
          d.decisions.splice(hits[0], 1);
        }
      }
      if (de.flow_patch) {
        for (const [fi, fp] of Object.entries(de.flow_patch)) {
          const item = d.flow[Number(fi)];
          if (!item) throw new Error(`Flow index ${fi} missing on ${iso}`);
          Object.assign(item, fp);
        }
      }
      if (de.watch_outs_replace) {
        for (const { match, text } of de.watch_outs_replace) {
          const hits = d.watch_outs.map((w, idx) => (w.includes(match) ? idx : -1)).filter((idx) => idx >= 0);
          if (hits.length !== 1) throw new Error(`Watch-out replace "${match}" on ${iso} expected 1 match, found ${hits.length}.`);
          d.watch_outs[hits[0]] = text;
        }
      }
      if (de.watch_outs_prepend) d.watch_outs = [...de.watch_outs_prepend, ...d.watch_outs];
      if (de.watch_outs_append) d.watch_outs = [...d.watch_outs, ...de.watch_outs_append];
      if (de.sources_append) {
        for (const s of de.sources_append) if (!d.sources.includes(s)) d.sources.push(s);
      }
      if (de.zones) {
        for (const [zi, ze] of Object.entries(de.zones)) {
          const z = d.zones[Number(zi)];
          if (!z) throw new Error(`Zone index ${zi} missing on ${iso}`);
          for (const k of ['badge', 'purpose', 'what_to_look_for', 'tips']) {
            if (ze[k] !== undefined) z[k] = ze[k];
          }
          if (ze.getting_there_patch) Object.assign(z.getting_there, ze.getting_there_patch);
          if (ze.items_patch) {
            const allItems = ['stops', 'eat', 'sweet', 'shop'].flatMap((kind) => z[kind] || []);
            for (const [key, ip] of Object.entries(ze.items_patch)) {
              const nKey = norm(key);
              const matches = allItems.filter((it) => norm(it.name) === nKey);
              if (matches.length !== 1) {
                throw new Error(`Item patch "${key}" on ${iso} zone ${zi} expected 1 exact match, found ${matches.length}.`);
              }
              Object.assign(matches[0], ip);
            }
          }
          for (const kind of ['stops', 'eat', 'sweet', 'shop']) {
            const add = ze[`${kind}_append`];
            if (Array.isArray(add) && add.length) z[kind] = [...(z[kind] || []), ...add];
          }
        }
      }
    }
  }
}

// Structured bookings (bookings.local.json, plus optional bookings arrays in owner-updates / day-enrichments).
// Confirmation is never inferred from prose; every booking must declare an explicit BOOKING_STATUS value.
const rawBookings = [];
if (Array.isArray(updates.bookings)) rawBookings.push(...updates.bookings);
if (fs.existsSync(path.join(PRIVATE_DIR, 'day-enrichments.local.json'))) {
  const enrich = JSON.parse(read('day-enrichments.local.json'));
  if (Array.isArray(enrich.bookings)) rawBookings.push(...enrich.bookings);
}
if (fs.existsSync(path.join(PRIVATE_DIR, 'bookings.local.json'))) {
  const bFile = JSON.parse(read('bookings.local.json'));
  const list = Array.isArray(bFile) ? bFile : bFile.bookings;
  if (!Array.isArray(list)) throw new Error('bookings.local.json must be an array or { "bookings": [...] }.');
  rawBookings.push(...list);
}
for (const d of trip.days) {
  if (Array.isArray(d.bookings)) {
    for (const b of d.bookings) rawBookings.push(b.day ? b : { ...b, day: d.iso });
    delete d.bookings;
  }
}
if (rawBookings.length) {
  const seenIds = new Set();
  trip.bookings = rawBookings.map((b) => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('Booking entry must be an object.');
    if (typeof b.id !== 'string' || !b.id.trim()) throw new Error('Booking entry requires a non-empty string id.');
    if (seenIds.has(b.id)) throw new Error(`Duplicate booking id: ${b.id}`);
    seenIds.add(b.id);
    const day = trip.days.find((d) => d.iso === b.day);
    if (!day) throw new Error(`Booking "${b.id}" references unknown day: ${b.day}`);
    if (!BOOKING_STATUS.includes(b.status)) throw new Error(`Booking "${b.id}" has invalid status "${b.status}".`);
    if (typeof b.venue !== 'string' || !b.venue.trim()) throw new Error(`Booking "${b.id}" requires venue.`);
    if (b.status === 'confirmed') {
      if (typeof b.time !== 'string' || !b.time.trim()) throw new Error(`Confirmed booking "${b.id}" requires time.`);
      if (b.guests === undefined || b.guests === null || String(b.guests).trim() === '') throw new Error(`Confirmed booking "${b.id}" requires guests.`);
      if (typeof b.maps_query !== 'string' || !b.maps_query.trim()) throw new Error(`Confirmed booking "${b.id}" requires maps_query.`);
    }
    if (b.zone !== undefined && b.zone !== null && explicitBookingZoneIndex(day, b) < 0) {
      throw new Error(`Booking "${b.id}" zone "${b.zone}" did not match any zone on ${b.day}.`);
    }
    if (b.place_match) {
      const target = normKey(b.place_match);
      const found = day.zones.some((z) => ['stops', 'eat', 'sweet', 'shop'].some((k) => (z[k] || []).some((it) => normKey(it.name) === target)));
      if (!found) throw new Error(`Booking "${b.id}" place_match "${b.place_match}" did not match any item on ${b.day}.`);
    }
    return b;
  });
}

// To book: the owner's transfer items, then restaurants by what their own booking note says.
// Suppresses items in slots already occupied by an explicit confirmed booking (venue, meal, or dining zone).
// needs: the note asks for a booking or a lead time. optional: bookable, but walk-in is not ruled out.
const NEEDS = /\b(required|book (now|ahead|by)|\d+ days? ahead|by (mon|tue|wed|thu|fri|sat|sun)\b)/i;
const CAN = /\b(book|bookings? taken|tablecheck|tabelog|online|reserv|tel |phone|call)\b/i;
const toBook = (updates.to_book || [])
  .map((x) => ({ ...x, need: x.need || 'needs' }))
  .filter((x) => !isSupersededByConfirmedBooking(trip, x));
const seen = new Set();
trip.days.forEach((d) => d.zones.forEach((z, zi) => (z.eat || []).forEach((it) => {
  const b = it.booking || '';
  const need = NEEDS.test(b) ? 'needs' : (CAN.test(b) && !/^walk[- ]?in\b|^no\b|^none\b/i.test(b.trim()) ? 'optional' : null);
  const key = `${d.iso}|${it.name}`;
  if (!need || seen.has(key)) return;
  const candidate = {
    id: `eat-${d.iso}-${it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: it.name,
    day: d.iso,
    zone: zi,
    ...(it.meal ? { meal: it.meal } : {}),
    kind: 'restaurant',
    need,
    detail: b,
    maps_query: it.maps_query,
  };
  if (isSupersededByConfirmedBooking(trip, candidate)) return;
  seen.add(key);
  toBook.push(candidate);
})));
const hasConfirmed = confirmedBookings(trip).length > 0;
trip.to_book = {
  note: hasConfirmed ? CONFIRMED_TO_BOOK_NOTE : 'Only the flights and hotels are booked. Nothing on this list is booked yet (owner, 8 Nov 2026).',
  items: toBook,
};

// Document pointers only. Originals remain in iCloud Drive.
if (fs.existsSync(path.join(PRIVATE_DIR, 'documents.local.json'))) {
  const documents = JSON.parse(read('documents.local.json'));
  trip.documents = documents.map(({ group, title, file, url }) => {
    if (url) {
      const link = new URL(url);
      if (link.protocol !== 'https:' || !['icloud.com', 'www.icloud.com'].includes(link.host) ||
          link.username || link.password || !link.pathname.startsWith('/iclouddrive/')) {
        throw new Error('A document link must point to iCloud Drive.');
      }
    }
    return { group, title, file, ...(url ? { url } : {}) };
  });
}

const json = JSON.stringify(trip, null, 1);
for (const d of payloadRedactions) if (json.includes(d)) throw new Error('Redaction failed: a private Claude link remains in the payload.');
fs.writeFileSync(TRIP_FILE, json + '\n', { mode: 0o600 });
console.log(`trip.json written: ${days.length} days, ${planner.bakeries.length} bakeries, ${planner.halal.places.length} halal places, ${planner.halal.prayer.length} prayer rooms, ${doc.sections.length} document sections.`);
