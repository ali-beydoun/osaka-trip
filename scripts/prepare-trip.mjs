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

function redact(text) {
  let t = text.replace(/\[([^\]]+)\]\(https:\/\/claude\.ai\/[^)]*\)/g, '$1'); // drop private Claude links, keep label
  for (const d of deny) t = t.split(d).join(`(${profile.redact_with})`);
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

const json = JSON.stringify(trip, null, 1);
for (const d of deny) if (json.includes(d)) throw new Error('Redaction failed: a denylisted string remains in the payload.');
fs.writeFileSync(TRIP_FILE, json + '\n', { mode: 0o600 });
console.log(`trip.json written: ${days.length} days, ${planner.bakeries.length} bakeries, ${planner.halal.places.length} halal places, ${planner.halal.prayer.length} prayer rooms, ${doc.sections.length} document sections.`);
