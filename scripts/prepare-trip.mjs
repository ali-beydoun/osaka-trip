// Builds the private app dataset (../osaka-trip-private/trip.json) from the migration inputs.
// Inputs (all private): planner-data.json (verbatim planner DATA), the trip document export,
// trip-profile.local.json (travellers, hotel) and denylist.local.txt (redactions).
// Output is plaintext and stays in the private folder; build-data.mjs encrypts it.
import fs from 'node:fs';
import path from 'node:path';
import { PRIVATE_DIR, TRIP_FILE } from './paths.mjs';

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
  if (enrich.halal) {
    if (enrich.halal.dayGroups) trip.halal.dayGroups = enrich.halal.dayGroups;
    if (enrich.halal.places_patch) {
      for (const p of trip.halal.places) {
        const patch = enrich.halal.places_patch[p.name];
        if (patch) Object.assign(p, patch);
      }
    }
    if (enrich.halal.prayer_patch) {
      for (const pr of trip.halal.prayer) {
        const patch = enrich.halal.prayer_patch[pr.name];
        if (patch) Object.assign(pr, patch);
      }
    }
  }
  if (enrich.days) {
    for (const [iso, de] of Object.entries(enrich.days)) {
      const d = trip.days.find((x) => x.iso === iso);
      if (!d) throw new Error(`Enrichment day not found: ${iso}`);
      for (const k of ['checked_on', 'summary', 'pacing', 'route_strategy', 'rain_plan', 'logistics', 'spa_options']) {
        if (de[k] !== undefined) d[k] = de[k];
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
          const idx = d.watch_outs.findIndex((w) => w.includes(match));
          if (idx >= 0) d.watch_outs[idx] = text;
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
            const norm = (s) => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'");
            for (const kind of ['stops', 'eat', 'sweet', 'shop']) {
              for (const it of z[kind] || []) {
                const nIt = norm(it.name);
                const ip = ze.items_patch[it.name] || Object.entries(ze.items_patch).find(([key]) => nIt.includes(norm(key)) || norm(key).includes(nIt))?.[1];
                if (ip) Object.assign(it, ip);
              }
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

// To book: the owner's transfer items, then restaurants by what their own booking note says.
// needs: the note asks for a booking or a lead time. optional: bookable, but walk-in is not ruled out.
const NEEDS = /\b(required|book (now|ahead|by)|\d+ days? ahead|by (mon|tue|wed|thu|fri|sat|sun)\b)/i;
const CAN = /\b(book|bookings? taken|tablecheck|tabelog|online|reserv|tel |phone|call)\b/i;
const toBook = (updates.to_book || []).map((x) => ({ ...x, need: 'needs' }));
const seen = new Set();
trip.days.forEach((d) => d.zones.forEach((z) => (z.eat || []).forEach((it) => {
  const b = it.booking || '';
  const need = NEEDS.test(b) ? 'needs' : (CAN.test(b) && !/^walk[- ]?in\b|^no\b|^none\b/i.test(b.trim()) ? 'optional' : null);
  const key = `${d.iso}|${it.name}`;
  if (!need || seen.has(key)) return;
  seen.add(key);
  toBook.push({ id: `eat-${d.iso}-${it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title: it.name, day: d.iso, kind: 'restaurant', need, detail: b, maps_query: it.maps_query });
})));
trip.to_book = { note: 'Only the flights and hotels are booked. Nothing on this list is booked yet (owner, 8 Nov 2026).', items: toBook };

const json = JSON.stringify(trip, null, 1);
for (const d of payloadRedactions) if (json.includes(d)) throw new Error('Redaction failed: a private Claude link remains in the payload.');
fs.writeFileSync(TRIP_FILE, json + '\n', { mode: 0o600 });
console.log(`trip.json written: ${days.length} days, ${planner.bakeries.length} bakeries, ${planner.halal.places.length} halal places, ${planner.halal.prayer.length} prayer rooms, ${doc.sections.length} document sections.`);
