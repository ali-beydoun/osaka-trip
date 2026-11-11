// Fails if any repository file (tracked or about to be) contains private trip text or key material.
// Needles come from the private folder, so this script itself contains no private data.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, PRIVATE_DIR, KEYS_FILE, TRIP_FILE } from './paths.mjs';

const MIN = 10; // ignore short generic strings
const needles = new Set();
function collect(v) {
  if (typeof v === 'string') { const s = v.trim(); if (s.length >= MIN && !/^https?:\/\//.test(s)) needles.add(s); }
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
}
for (const f of [TRIP_FILE, path.join(PRIVATE_DIR, 'planner-data.json'), path.join(PRIVATE_DIR, 'bookings.local.json')]) {
  if (!fs.existsSync(f)) continue;
  const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rest = Array.isArray(parsed) ? { bookings: parsed } : (() => { const { meta, ...r } = parsed; return r; })(); // meta holds only public labels
  collect(rest);
  for (const doc of rest.documents || []) if (doc.url) needles.add(doc.url);
  for (const b of rest.bookings || []) {
    if (b && b.reference && String(b.reference).trim().length >= 4) needles.add(String(b.reference).trim());
    if (b && b.manage_url) needles.add(String(b.manage_url).trim());
  }
}
if (fs.existsSync(KEYS_FILE)) {
  const k = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  [k.linkSecret, k.rawKey].filter(Boolean).forEach((s) => needles.add(s));
}
const extra = path.join(PRIVATE_DIR, 'denylist.local.txt');
if (fs.existsSync(extra)) fs.readFileSync(extra, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')).forEach((s) => needles.add(s));
if (process.env.OSAKA_PASSWORD) needles.add(process.env.OSAKA_PASSWORD);

// Public vocabulary (status enums, section names) and bare time ranges are not private.
const allow = new Set(fs.readFileSync(path.join(ROOT, 'scripts', 'privacy-allowlist.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')));
for (const n of [...needles]) if (allow.has(n) || /^\d{1,2}:\d{2} to \d{1,2}:\d{2}$/.test(n)) needles.delete(n);

if (needles.size === 0) {
  console.error('Privacy check: no private folder found, cannot verify. Set OSAKA_PRIVATE_DIR.');
  process.exit(2);
}

// --staged (pre-commit): scan exactly what is about to be committed, read from the index.
// Default: every tracked or untracked, non-ignored file in the working tree.
const staged = process.argv.includes('--staged');
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
const files = (staged ? git(['ls-files', '--cached']) : git(['ls-files', '-co', '--exclude-standard'])).split('\n').filter(Boolean);
const hits = [];
for (const rel of files) {
  let text;
  if (staged) {
    try { text = git(['show', `:${rel}`]); } catch { continue; }
  } else {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).size > 5e6) continue;
    text = fs.readFileSync(abs, 'utf8');
  }
  for (const n of needles) if (text.includes(n)) { hits.push(`${rel}: private string of length ${n.length}`); break; }
}
if (hits.length) {
  console.error(`Privacy check FAILED (${hits.length} file(s)); values not printed:\n` + hits.join('\n'));
  process.exit(1);
}
console.log(`Privacy check passed: ${files.length} repo files clean against ${needles.size} private strings.`);
