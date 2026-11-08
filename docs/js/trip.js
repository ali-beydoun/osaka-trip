// Loading, decrypting and querying the trip. All dates are Asia/Tokyo.
import { deriveKey, open, envelopeSalt, gunzipToJson } from './vault.js';

export const TZ = 'Asia/Tokyo';

export async function fetchEnvelope() {
  const res = await fetch('data/trip.enc.json', { cache: 'no-cache' }).catch(() => null)
    || await caches.match('data/trip.enc.json');
  if (!res || !res.ok) throw new Error('offline-no-data');
  return res.json();
}

export function keyFromPassword(env, password, linkSecret) {
  return deriveKey(password, linkSecret, envelopeSalt(env), env.kdf.iter);
}

export async function decryptTrip(env, key) {
  return gunzipToJson(await open(key, env));
}

export function tokyoISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Today during the trip, otherwise the first day before it and the last day after it.
export function currentDayIndex(days, now = new Date()) {
  const today = tokyoISO(now);
  const i = days.findIndex((d) => d.iso === today);
  if (i >= 0) return { index: i, phase: 'during' };
  if (today < days[0].iso) return { index: 0, phase: 'before', daysToGo: daysBetween(today, days[0].iso) };
  return { index: days.length - 1, phase: 'after' };
}

export function daysBetween(aISO, bISO) {
  return Math.round((Date.parse(`${bISO}T00:00:00Z`) - Date.parse(`${aISO}T00:00:00Z`)) / 86400000);
}

export function appleMapsUrl(query) {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

export function googleMapsUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function directionsUrl(destQuery, { mode = 'r', from } = {}) {
  // Apple Maps: dirflg r = transit, w = walking, d = driving.
  const p = new URLSearchParams({ daddr: destQuery, dirflg: mode });
  if (from) p.set('saddr', from);
  return `https://maps.apple.com/?${p}`;
}
