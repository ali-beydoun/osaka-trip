// Boot, unlock and routing. Rendering lives in ui.js.
import { linkSecretFromHash, envelopeSalt } from './vault.js';
import { fetchEnvelope, keyFromPassword, decryptTrip } from './trip.js';
import { saveKey, loadKey, forgetKey } from './keystore.js';
import * as ui from './ui.js';

const FAIL_DELAY_MS = 700;

// ---------- Fragment parameters: k (link secret), v (view), asof (review date) ----------
export function readHash() {
  const p = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return { k: p.get('k'), v: p.get('v') || '', asof: p.get('asof') || '' };
}

export function writeHash(next, { replace = false } = {}) {
  const cur = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  for (const [key, val] of Object.entries(next)) {
    if (val === null || val === '') cur.delete(key); else cur.set(key, val);
  }
  // Keep k first so the private link stays recognisable.
  const ordered = new URLSearchParams();
  if (cur.get('k')) ordered.set('k', cur.get('k'));
  for (const [key, val] of cur) if (key !== 'k') ordered.set(key, val);
  const hash = `#${ordered.toString()}`;
  if (replace) history.replaceState(history.state, '', hash); else history.pushState(null, '', hash);
}

function prefs() {
  try { return JSON.parse(localStorage.getItem('osaka.prefs') || '{}'); } catch { return {}; }
}

// Mutates the shared prefs object so every holder (ui ctx) sees the change.
export function setPref(key, value) {
  state.prefs[key] = value;
  try { localStorage.setItem('osaka.prefs', JSON.stringify(state.prefs)); } catch { /* private mode */ }
}

const state = { env: null, trip: null, key: null, prefs: prefs(), online: navigator.onLine };

// ---------- Service worker and update notice ----------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    // U8: never reload on our own. Only after the person taps Reload on the update notice.
    let accepted = false;
    const offer = (w) => ui.showUpdate(() => { accepted = true; w.postMessage('skipWaiting'); });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (accepted) location.reload();
    });
  } catch { /* offline support unavailable; app still works online */ }
}

// ---------- Unlock ----------
async function tryRemembered() {
  const key = await loadKey(state.env.kdf.salt);
  if (!key) return false;
  try {
    state.trip = await decryptTrip(state.env, key);
    state.key = key;
    return true;
  } catch {
    await forgetKey(); // password or link rotated
    return false;
  }
}

export async function unlock(password, remember) {
  const link = linkSecretFromHash(location.hash);
  if (!link) return { ok: false, reason: 'missing-link' };
  const started = performance.now();
  try {
    const key = await keyFromPassword(state.env, password, link);
    state.trip = await decryptTrip(state.env, key);
    state.key = key;
    if (remember) await saveKey(state.env.kdf.salt, key);
    setPref('remember', !!remember);
    startApp({ fromUnlock: true });
    return { ok: true };
  } catch {
    const wait = FAIL_DELAY_MS - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return { ok: false, reason: 'wrong' };
  }
}

// Accepts a pasted private link (or just its fragment) and adopts its secret.
export function adoptLink(text) {
  const t = (text || '').trim();
  const hash = t.includes('#') ? t.slice(t.indexOf('#')) : `#${t}`;
  const secret = linkSecretFromHash(hash);
  if (!secret) return false;
  const k = new URLSearchParams(hash.slice(1)).get('k');
  writeHash({ k }, { replace: true });
  return true;
}

export async function lockNow() {
  await forgetKey();
  state.trip = null;
  state.key = null;
  writeHash({ v: 'today' }, { replace: true });
  showLock();
}

// Keep unlocked on this device: store or forget the in-memory non-extractable key.
async function setRemember(on) {
  if (on && state.key) await saveKey(state.env.kdf.salt, state.key);
  if (!on) await forgetKey();
  setPref('remember', on);
}

// Update trip link: adopt a newly pasted private link, forget the old key and ask for the password.
async function replaceLink(text) {
  if (!adoptLink(text)) return false;
  await lockNow();
  return true;
}

function showLock() {
  const hasLink = !!linkSecretFromHash(location.hash);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  ui.renderLock({
    state: hasLink ? 'password' : 'missing-link',
    standalone,
    remember: state.prefs.remember !== false,
    onUnlock: unlock,
    onPasteLink: (text) => {
      const ok = adoptLink(text);
      if (ok) showLock();
      return ok;
    },
  });
}

// ---------- App ----------
function startApp({ fromUnlock = false } = {}) {
  ui.renderApp({
    fromUnlock,
    trip: state.trip,
    env: state.env,
    prefs: state.prefs,
    setPref,
    route: readHash(),
    navigate: (v, opts) => { writeHash({ v }, opts); ui.onRoute(readHash()); },
    lockNow,
    setRemember,
    replaceLink,
    online: state.online,
  });
}

// pushState does not fire these; they cover Back, Forward and edited addresses.
function onLocation() {
  if (state.trip) ui.onRoute(readHash());
  else if (state.env) showLock();
}
window.addEventListener('hashchange', onLocation);
window.addEventListener('popstate', onLocation);
window.addEventListener('online', () => { state.online = true; ui.setOnline(true); });
window.addEventListener('offline', () => { state.online = false; ui.setOnline(false); });

async function boot() {
  registerSW();
  try {
    state.env = await fetchEnvelope();
  } catch {
    ui.renderLock({ state: 'offline-first', onRetry: () => location.reload() });
    return;
  }
  if (await tryRemembered()) startApp();
  else showLock();
}

boot();
