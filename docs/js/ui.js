// Rendering: lock screen, adaptive shell and the five destinations.
// Contract: design/05-implementation-contract.md (item ids in comments).
import { h, ext, icon, markdown } from './dom.js';
import {
  DAY_TYPE, LOAD, MODE, FLOW_LEVEL, KINDS, HALAL_STATUS, HALAL_KEY, MEAL_LABEL, dietKey, walkCaption, resolveNow, tripPhase,
  nowNext, allPlaces, foodCategories, halalPlaces, prayerRooms, defaultHalalGroup, dayHalalGroups, zoneHalalGroup, fill, searchPlaces, parseHM,
  confirmedBookings, confirmedBookingsForDay, confirmedBookingForPlace, bookingZoneIndex, formatGuests,
  activeToBookItems, toBookCaption, activeDayOpen, activeDayDecisions, flowZoneIndex, flowBookingIndex, normKey,
  dayTheme, dayForwardSummary,
} from './model.js';

const TABS = [
  ['today', 'Today', 'sun'],
  ['days', 'Days', 'calendar'],
  ['food', 'Food', 'fork'],
  ['places', 'Places', 'pin'],
  ['info', 'Info', 'info'],
];
const TIERS = [['compact', 0], ['narrow', 600], ['wide', 900], ['xwide', 1180]];

const root = () => document.getElementById('app');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => window.matchMedia('(max-width: 599px)').matches;

let ctx = null; // { trip, env, prefs, setPref, navigate, lockNow, setRemember, replaceLink, online, route }
let cache = null;
const tabStack = {}; // N3: last route per tab
const scrollMemory = new Map(); // N3/L7: scroll per route
let lastV = '';
let lastFocus = null;
let sheetOpener = null; // data-key of the row that opened the current place detail

// ---------------------------------------------------------------- Tier (L1)
function applyTier() {
  const before = document.documentElement.dataset.tier;
  const w = window.innerWidth;
  let tier = 'compact';
  for (const [name, min] of TIERS) if (w >= min) tier = name;
  const el = document.documentElement;
  el.dataset.tier = tier;
  el.toggleAttribute('data-short', window.innerHeight <= 500);
  // Typography rule 2.3: multi-column text collapses at the first accessibility size.
  el.toggleAttribute('data-ax', parseFloat(getComputedStyle(el).fontSize) >= 23);
  // L7: crossing the compact boundary changes sheet vs inspector, so re-render keeping state.
  if (ctx && before && (before === 'compact') !== (tier === 'compact')) { scrollMemory.set(lastV, window.scrollY); draw({ dir: 'pop' }); }
}
applyTier();
window.addEventListener('resize', applyTier);
// Dynamic Type can change without a resize: watch a 10rem probe.
if ('ResizeObserver' in window) {
  const probe = document.createElement('div');
  probe.className = 'rem-probe';
  probe.setAttribute('aria-hidden', 'true');
  document.documentElement.append(probe);
  new ResizeObserver(() => applyTier()).observe(probe);
}

// ---------------------------------------------------------------- Lock (S1, U2, U3, U6)
export function renderLock(opts) {
  document.body.className = 'is-locked';
  document.title = 'Osaka Trip';
  const status = h('p', { class: 'lock-status', id: 'lock-status', role: 'status', 'aria-live': 'polite' });
  const card = h('main', { class: 'lock', id: 'main' },
    h('div', { class: 'lock-mark', 'aria-hidden': 'true' }, icon('lock')),
    h('h1', { class: 'lock-title' }, 'Osaka Trip'));

  if (opts.state === 'offline-first' || opts.state === 'load-failed') {
    const isOffline = opts.state === 'offline-first';
    card.append(
      h('p', { class: 'lock-body' }, isOffline
        ? 'You’re offline, and this device hasn’t opened the trip before. Connect once to download it. After that it works offline.'
        : 'Couldn’t load the encrypted trip right now. Check your connection or Wi-Fi sign-in page, then tap Try Again.'),
      h('button', { class: 'btn btn-filled', type: 'button', onclick: opts.onRetry }, icon('reload'), 'Try Again'));
  } else if (opts.state === 'missing-link') {
    const field = h('input', { class: 'field', id: 'link', type: 'url', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', inputmode: 'url', enterkeyhint: 'go', placeholder: 'https://…#k=…' });
    if (opts.linkIssue === 'truncated') {
      status.textContent = 'That isn’t a complete trip link. Copy the whole link, including every character after #k=.';
    }
    const tryPasteClipboard = (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText)
      ? h('button', { class: 'btn btn-gray', type: 'button', onclick: async () => {
        try {
          const clip = await navigator.clipboard.readText();
          if (!clip) { status.textContent = 'Clipboard is empty. Copy the full invite link first.'; field.focus(); return; }
          field.value = clip;
          if (!opts.onPasteLink(clip)) {
            status.textContent = 'That isn’t a complete trip link. Copy the whole link, including the part after #.';
            field.focus();
          }
        } catch {
          status.textContent = 'Paste directly into the box above and tap Continue.';
          field.focus();
        }
      } }, icon('copy'), 'Paste from Clipboard') : null;
    const form = h('form', { class: 'lock-form', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      if (!opts.onPasteLink(field.value)) { status.textContent = 'That isn’t a complete trip link. Copy the whole link, including the part after #.'; field.focus(); }
    } },
    h('label', { class: 'lock-label', for: 'link' }, 'Private trip link'),
    field,
    h('button', { class: 'btn btn-filled', type: 'submit' }, 'Continue'),
    tryPasteClipboard,
    opts.hasHashLink && opts.onBackToPassword ? h('button', { class: 'text-btn small', type: 'button', onclick: opts.onBackToPassword }, 'Back to password') : null);
    card.append(h('p', { class: 'lock-body' }, opts.standalone
      ? 'The Home Screen app needs your private trip link once. Paste it here, then enter the password.'
      : 'Open this app from your private trip link, or paste the link here.'), form, status);
  } else {
    const field = h('input', { class: 'field', id: 'pw', type: 'password', autocomplete: 'current-password', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'go', 'aria-describedby': 'lock-status' });
    const eye = h('button', { class: 'field-btn', type: 'button', 'aria-label': 'Show password', 'aria-pressed': 'false', onclick: () => {
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      eye.replaceChildren(icon(show ? 'eyeSlash' : 'eye'));
      field.focus();
    } }, icon('eye'));
    const remember = h('input', { type: 'checkbox', id: 'remember', class: 'switch', role: 'switch', checked: opts.remember });
    const button = h('button', { class: 'btn btn-filled', type: 'submit' }, h('span', { class: 'btn-label' }, 'Unlock'), h('span', { class: 'btn-progress', 'aria-hidden': 'true' }));
    const recovery = h('div', { class: 'lock-recovery' },
      opts.onSwitchToPasteLink ? h('button', { class: 'text-btn small', type: 'button', onclick: opts.onSwitchToPasteLink }, icon('link'), h('span', null, 'Replace or paste invite link')) : null);
    status.id = 'lock-status';
    const form = h('form', { class: 'lock-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!field.value) { status.textContent = 'Enter the password.'; field.focus(); return; }
      button.disabled = true;
      button.classList.add('is-busy');
      button.querySelector('.btn-label').textContent = 'Unlocking';
      status.textContent = '';
      const res = await opts.onUnlock(field.value, remember.checked);
      if (!res.ok) {
        button.disabled = false;
        button.classList.remove('is-busy');
        button.querySelector('.btn-label').textContent = 'Unlock';
        status.textContent = res.reason === 'missing-link' ? 'This link is incomplete. Open the full private link.' : 'That password didn’t work. Check it and try again.';
        field.value = '';
        field.focus();
      }
    } },
    h('label', { class: 'lock-label', for: 'pw' }, 'Password'),
    h('div', { class: 'field-wrap' }, field, eye),
    h('div', { class: 'lock-remember' }, h('label', { for: 'remember' }, 'Keep unlocked on this device'), remember),
    button);
    card.append(h('p', { class: 'lock-body' }, 'Enter the trip password to open the plan.'), form, status, recovery,
      h('p', { class: 'lock-foot' }, 'Both the private link and the password are needed. Nothing is sent to a server.'));
    queueMicrotask(() => field.focus());
  }
  root().replaceChildren(card);
}

// ---------------------------------------------------------------- Shell
export function renderApp(c) {
  ctx = c;
  cache = { places: allPlaces(c.trip), food: foodCategories(c.trip), prayer: prayerRooms(c.trip), halal: halalPlaces(c.trip) };
  document.body.className = c.fromUnlock ? 'is-unlocked just-unlocked' : 'is-unlocked';
  if (!c.route.v) { ctx.navigate('today', { replace: true }); c.route = { ...c.route, v: 'today' }; }
  draw({ initial: true });
  if (c.fromUnlock) { const t = document.getElementById('view-title'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', offlineGuard, true);
  maybeInstallHint();
}

export function onRoute(route) {
  if (!ctx) return;
  if (route.v === ctx.route.v && route.asof === ctx.route.asof && document.querySelector('.shell')) return;
  scrollMemory.set(lastV, window.scrollY);
  const prev = parse(ctx.route.v);
  ctx.route = route;
  const next = parse(route.v);
  const sameTab = prev.tab === next.tab;
  const depth = (r) => r.sub.length + (r.params.get('p') ? 1 : 0) + (r.params.get('sheet') ? 1 : 0) + (r.params.get('taxi') ? 1 : 0);
  const dir = !sameTab ? 'none' : depth(next) > depth(prev) ? 'push' : depth(next) < depth(prev) ? 'pop' : 'swap';
  const onlySheet = sameTab && prev.path === next.path && (prev.params.get('p') !== next.params.get('p') || prev.params.get('taxi') !== next.params.get('taxi'));
  transition(dir === 'none' || onlySheet ? null : dir, () => draw({ dir }));
}

export function setOnline(on) {
  if (!ctx) return;
  ctx.online = on;
  document.querySelectorAll('.offline-pill').forEach((p) => { p.hidden = on; });
}

export function showUpdate(apply) { // U8
  document.querySelector('.update-banner')?.remove();
  const bar = h('div', { class: 'update-banner', role: 'status' },
    icon('reload'), h('span', { class: 'update-text' }, 'Trip updated'),
    h('button', { class: 'btn btn-tinted btn-small', type: 'button', onclick: () => { bar.remove(); apply(); } }, 'Reload'),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dismiss update notice', onclick: () => bar.remove() }, icon('xmark')));
  document.body.append(bar);
}

function transition(dir, fn) {
  if (!dir || reduceMotion() || !document.startViewTransition || !document.querySelector('.shell') || document.visibilityState !== 'visible') { fn(); return; }
  document.documentElement.dataset.nav = dir;
  const t = document.startViewTransition(fn);
  t.ready.catch(() => {}); // a newer navigation may abort this one; that is fine
  t.updateCallbackDone.catch(() => {});
  t.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.nav; });
}

function parse(v = '') {
  const [path, q] = (v || 'today').split('?');
  const parts = path.split('/');
  return { tab: TABS.some((t) => t[0] === parts[0]) ? parts[0] : 'today', sub: parts.slice(1).filter(Boolean), params: new URLSearchParams(q || ''), path };
}

const route = () => parse(ctx.route.v);
function go(v, opts) { ctx.navigate(v, opts); }
function now() { return resolveNow(ctx.route.asof); }

function withParam(v, key, val) {
  const [path, q] = v.split('?');
  const p = new URLSearchParams(q || '');
  if (val === null || val === undefined || val === '') p.delete(key); else p.set(key, val);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export function hrefFor(v) {
  const p = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  p.set('v', v);
  return `#${p}`;
}

function link(v, attrs, ...children) {
  return h('a', { href: hrefFor(v), ...attrs, onclick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    lastFocus = e.currentTarget.dataset.key || null;
    go(v);
  } }, ...children);
}

function draw({ dir, initial } = {}) {
  const r = route();
  tabStack[r.tab] = ctx.route.v || r.tab;
  const view = VIEWS[r.tab](r);
  const place = view.place || null;
  const inspector = view.inspector && !isCompact();
  const overlay = view.overlay || (r.params.get('taxi') ? driverCardFromParam(r) : null);
  const shell = h('div', { class: `shell tab-${r.tab}`, 'data-view': ctx.route.v || r.tab, 'data-sidebar': sidebarState(), 'data-detail': place ? 'yes' : 'no' },
    h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); document.getElementById('main')?.focus(); } }, 'Skip to content'),
    sidebar(r),
    h('div', { class: 'stage' },
      navbar(view, r),
      h('div', { class: 'columns' },
        view.list ? h('section', { class: 'list-col', 'aria-label': view.listLabel || 'List' }, view.list) : null,
        h('main', { id: 'main', class: 'main-col', tabindex: '-1', 'aria-labelledby': 'view-title' },
          view.ownH1 ? null : view.large !== false ? h('h1', { class: 'large-title', id: 'view-title' }, view.title) : h('h1', { class: 'sr-only', id: 'view-title' }, view.title),
          now().simulated ? h('p', { class: 'banner', role: 'note' }, `Viewing as ${now().iso} ${fmtMin(now().minutes)} Tokyo time`) : null,
          view.main),
        view.inspector ? inspectorPane(place, view.emptyText) : place ? sheetPane(place) : null)),
    tabbar(r.tab),
    overlay);
  root().replaceChildren(shell);
  const prevPlace = sheetOpener !== null;
  if (place && !prevPlace) sheetOpener = lastFocus || '';
  if (!place && prevPlace) { lastFocus = sheetOpener || null; sheetOpener = null; }
  if (place) trapSheet();
  document.title = view.title ? `${view.title} · Osaka Trip` : 'Osaka Trip';
  lastV = ctx.route.v;
  // Scroll and focus (N3, N6, L7)
  const saved = scrollMemory.get(ctx.route.v);
  const zJump = r.tab === 'days' && r.sub[0] && r.params.has('z') && !place && !overlay ? Number(r.params.get('z')) : -1;
  const focusSpa = r.tab === 'days' && r.sub[0] && r.params.get('focus') === 'spa' && !place && !overlay;
  const focusTravel = r.tab === 'days' && r.sub[0] && r.params.get('focus') === 'travel' && !place && !overlay;
  if (zJump >= 0 && Number.isInteger(zJump)) {
    queueMicrotask(() => jumpToZone(zJump));
  } else if (focusSpa) {
    queueMicrotask(() => jumpToSpa());
  } else if (focusTravel) {
    queueMicrotask(() => jumpToTravel());
  } else if (dir === 'none' || dir === 'push' || dir === 'swap') window.scrollTo(0, dir === 'none' && saved ? saved : 0);
  else if (dir === 'pop' && saved !== undefined) window.scrollTo(0, saved);
  onScroll();
  if (!initial && zJump < 0 && !focusSpa && !focusTravel && !overlay) {
    const detailFocus = place && document.querySelector('.sheet-close, .inspector .place-title');
    const target = (detailFocus && !document.querySelector('.inspector') ? detailFocus : null)
      || (place && document.querySelector('.inspector') ? document.querySelector('.inspector .place-title') : null)
      || (lastFocus && document.querySelector(`[data-key="${CSS.escape(lastFocus)}"]`)) || (dir === 'push' || dir === 'swap' ? document.getElementById('view-title') : null);
    if (target && target.classList.contains('place-title')) target.setAttribute('tabindex', '-1');
    if (target) { if (target.id === 'view-title') target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    lastFocus = null;
  }
}

function sidebarState() {
  const stored = ctx.prefs.sidebar;
  return stored === false ? 'closed' : 'open';
}

function onScroll() { // N4: large title collapses into the inline title
  const nav = document.querySelector('.navbar');
  if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24);
}

function navbar(view, r) {
  const toggle = h('button', { class: 'icon-btn sidebar-toggle', type: 'button', 'aria-label': 'Sidebar', 'aria-expanded': String(sidebarState() === 'open'), onclick: () => {
    if (window.innerWidth < 900) document.querySelector('.shell').toggleAttribute('data-overlay');
    else { ctx.setPref('sidebar', ctx.prefs.sidebar === false); draw(); }
  } }, icon('sidebar'));
  return h('header', { class: 'navbar' },
    h('div', { class: 'nav-leading' }, toggle,
      view.back ? link(view.back[0], { class: 'nav-back', 'aria-label': `Back to ${view.back[1]}` }, icon('chevronLeft'), h('span', null, view.back[1])) : null),
    h('nav', { class: 'top-tabs', 'aria-label': 'Sections' }, TABS.map(([id, label, ic]) => tabLink(id, label, ic, r.tab, 'top-tab'))),
    h('p', { class: 'nav-title', 'aria-hidden': 'true' }, view.title || ''),
    h('div', { class: 'nav-trailing' }, h('span', { class: 'offline-pill', hidden: ctx.online }, icon('wifiSlash'), 'Offline'), view.trailing || null));
}

function tabLink(id, label, ic, current, cls, { toRoot = false } = {}) {
  const selected = id === current;
  const target = toRoot ? id : tabStack[id] || id;
  return h('a', { href: hrefFor(target), class: cls, 'aria-current': selected ? 'page' : null, onclick: (e) => {
    e.preventDefault();
    document.querySelector('.shell')?.removeAttribute('data-overlay');
    if (selected) { // N3: re-tap pops to root and scrolls to top
      if (ctx.route.v !== id) go(id); else window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    } else go(target);
  } }, icon(selected ? `${ic}Fill` : ic), h('span', null, label));
}

function tabbar(tab) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Sections' }, TABS.map(([id, label, ic]) => tabLink(id, label, ic, tab, 'tab')));
}

function sidebar(r) {
  const days = ctx.trip.days;
  const today = now().iso;
  return h('nav', { class: 'sidebar', 'aria-label': 'Trip' },
    h('p', { class: 'sidebar-title' }, 'Osaka Trip'),
    h('ul', { class: 'side-list' }, TABS.map(([id, label, ic]) => h('li', null,
      tabLink(id, label, ic, r.tab === id && !(id === 'days' && r.sub[0]) ? id : '', 'side-item', { toRoot: true }),
      id === 'days' ? h('details', { class: 'side-group', open: true },
        h('summary', { class: 'side-summary' }, h('span', { class: 'sr-only' }, 'Trip days')),
        h('ul', { class: 'side-sub' }, days.map((d) => h('li', null,
          link(`days/${d.iso}`, { class: 'side-item side-day', 'aria-current': r.tab === 'days' && r.sub[0] === d.iso ? 'page' : null, 'data-key': `side-${d.iso}` },
            h('span', { class: `type-dot t-${d.type}`, 'aria-hidden': 'true' }),
            h('span', { class: 'side-day-date' }, d.date),
            h('span', { class: 'side-day-title' }, d.title, d.iso === today ? h('span', { class: 'sr-only' }, ', today') : null)))))) : null))));
}

// ---------------------------------------------------------------- Sheet and inspector (S7, A6)
function sheetPane(place) {
  const close = () => go(withParam(ctx.route.v, 'p', null));
  const pane = h('aside', { class: 'sheet', 'aria-labelledby': 'place-title', role: 'dialog', 'aria-modal': isCompact() ? 'true' : null, tabindex: '-1', 'data-detent': 'medium' },
    h('div', { class: 'sheet-head' },
      h('div', { class: 'grabber-hit', 'aria-hidden': 'true' }, h('span', { class: 'grabber' })),
      h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': 'Close details', onclick: close }, icon('xmark'))),
    placeDetail(place));
  dragSheet(pane, close);
  return [h('div', { class: 'scrim', 'aria-hidden': 'true', onclick: close }), pane];
}

function inspectorPane(place, emptyText) {
  if (!place) return h('aside', { class: 'inspector is-empty', 'aria-label': 'Details' }, h('div', { class: 'inspector-empty' }, icon('pin'), h('p', null, emptyText || 'Choose a place to see its details.')));
  if (isCompact()) return sheetPane(place);
  return h('aside', { class: 'inspector', 'aria-labelledby': 'place-title', tabindex: '-1' }, placeDetail(place));
}

// Escape closes an open driver card or place detail from anywhere (A6).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !ctx) return;
  const r = route();
  if (r.params.get('taxi')) {
    e.preventDefault();
    go(withParam(ctx.route.v || 'today', 'taxi', null));
    return;
  }
  if (!r.params.get('p') || document.querySelector('.taxi')) return;
  e.preventDefault();
  go(withParam(ctx.route.v, 'p', null));
});

function trapSheet() {
  const pane = document.querySelector('.sheet');
  if (!pane) return;
  pane.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !isCompact()) return;
    const f = [...pane.querySelectorAll('a[href], button:not([disabled]), summary, input, select')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// Grabber drag: up expands to the large detent, down dismisses (touch and pointer).
function dragSheet(pane, close) {
  let startY = null, startDetent = 'medium';
  const handle = () => pane.querySelector('.sheet-head');
  queueMicrotask(() => {
    const el = handle();
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; startY = e.clientY; startDetent = pane.dataset.detent; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (startY === null) return; const dy = Math.max(-80, e.clientY - startY); pane.style.transform = dy > 0 ? `translateY(${dy}px)` : ''; });
    el.addEventListener('pointerup', (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      pane.style.transform = '';
      startY = null;
      if (dy > 80) { if (startDetent === 'large') pane.dataset.detent = 'medium'; else close(); }
      else if (dy < -40) pane.dataset.detent = 'large';
      else if (Math.abs(dy) < 6) pane.dataset.detent = pane.dataset.detent === 'large' ? 'medium' : 'large';
    });
  });
}

// ---------------------------------------------------------------- Shared pieces
function fmtMin(m) { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }

function section(title, ...body) {
  const content = body.flat(Infinity).filter(Boolean);
  if (!content.length) return null;
  return h('section', { class: 'group' }, title ? h('h2', { class: 'group-title' }, title) : null, ...content);
}

function grouped(items, cls = '') {
  const list = items.filter(Boolean);
  return list.length ? h('ul', { class: `grouped ${cls}` }, list) : null;
}

function chip(text, cls = '', ic) {
  return text ? h('span', { class: `chip ${cls}` }, ic ? icon(ic) : null, h('span', null, text)) : null;
}

const DIET_ICON = { certified: 'seal', claim: 'checkCircle', options: 'fish', no: 'xmarkCircle' };
function dietChip(label) {
  if (!label) return null;
  const k = dietKey(label);
  return chip(label, `ev ev-${k === 'options' ? 'fallback' : k}`, DIET_ICON[k]);
}

const HALAL_ICON = { certified: 'seal', claim: 'checkCircle', menu: 'listRect', friendly: 'hand', fallback: 'fish' };
function halalChip(status) {
  if (!status) return null;
  const k = HALAL_KEY[status] || 'friendly';
  return chip(status, `ev ev-${k}`, HALAL_ICON[k]);
}

const TYPE_ICON = { shop: 'bag', sight: 'columns', rest: 'leaf', travel: 'airplane' };
function typeChip(type) { return chip(DAY_TYPE[type], `type t-${type}`, TYPE_ICON[type]); }

function mapsUrl(q) {
  return ctx.prefs.maps === 'apple' ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function googleFromHereUrl(q, mode = 'transit') {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=${mode}`;
}

function dirUrl(q, mode) {
  if (ctx.prefs.maps === 'apple') {
    const flag = { walking: 'w', transit: 'r', driving: 'd' }[mode] || 'r';
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=${flag}`;
  }
  return googleFromHereUrl(q, mode);
}

function routeDirUrl(origin, dest, mode = 'transit') {
  if (!dest) return '';
  if (!origin) return dirUrl(dest, mode);
  if (ctx.prefs.maps === 'apple') {
    const flag = { walking: 'w', transit: 'r', driving: 'd' }[mode] || 'r';
    return `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(dest)}&dirflg=${flag}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

function showToast(msg, ic = 'check') {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const t = h('div', { class: 'toast', role: 'status' }, icon(ic), h('span', null, msg));
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

async function copyPlainText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback below */ }
  }
  try {
    const ta = h('textarea', { class: 'sr-only', readonly: true });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function copyTextButton(text, label = 'Copy Japanese', ariaLabel = '') {
  if (!text) return null;
  const span = h('span', null, label);
  return h('button', {
    type: 'button',
    class: 'btn btn-gray btn-small',
    'aria-label': ariaLabel || label,
    onclick: async () => {
      const ok = await copyPlainText(text);
      span.textContent = ok ? 'Copied' : label;
      showToast(ok ? 'Copied to clipboard' : 'Select and copy the Japanese text above');
      setTimeout(() => { span.textContent = label; }, 2200);
    },
  }, icon('copy'), span);
}

function fromHereActionRow(destQuery, destName, mode = 'transit', { primaryFilled = false, pointOrigin = '', pointDest = '', pointLabel = '' } = {}) {
  if (!destQuery) return null;
  const isApple = ctx.prefs.maps === 'apple';
  const primaryCls = primaryFilled ? 'btn btn-filled' : 'btn btn-tinted btn-small';
  return h('div', { class: 'from-here-row' },
    ext(dirUrl(destQuery, mode),
      [icon('arrowOut'), h('span', null, 'Directions from here')],
      { class: primaryCls, 'aria-label': `Directions from here to ${destName}` }),
    isApple ? ext(googleFromHereUrl(destQuery, mode),
      [icon('map'), h('span', null, 'Google Maps from here')],
      { class: 'btn btn-gray btn-small', 'aria-label': `Google Maps from here to ${destName}` }) : null,
    pointOrigin && pointDest ? ext(routeDirUrl(pointOrigin, pointDest, mode),
      [icon(MODE_ICON[mode] || 'train'), h('span', null, `Point-to-point: ${pointLabel || destName}`)],
      { class: 'btn btn-gray btn-small', 'aria-label': `Point-to-point route from ${pointOrigin} to ${pointDest}` }) : null);
}

const MODE_ICON = { walking: 'walk', transit: 'train', driving: 'car' };
const MODE_VERB = { walking: 'Walk to', transit: 'Train to', driving: 'Taxi to' };
function goButtons(q, name, primary = 'transit') {
  if (!q) return null;
  const order = ['walking', 'transit', 'driving'].sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0));
  return h('div', { class: 'go-row' },
    order.map((m, i) => ext(dirUrl(q, m), [icon(MODE_ICON[m]), h('span', null, MODE[m])],
      { class: `btn ${i === 0 ? 'btn-tinted' : 'btn-gray'}`, 'aria-label': `${MODE_VERB[m]} ${name}` })),
    ext(mapsUrl(q), [icon('map'), h('span', null, 'Map')], { class: 'btn btn-gray', 'aria-label': `${name} in Maps` }));
}

function metaLine(parts) {
  const p = parts.filter(Boolean);
  return p.length ? h('p', { class: 'meta' }, p.join(' · ')) : null;
}

function defaultPlaceMode(it) {
  if (it.mode) return it.mode;
  if (['stops', 'eat', 'sweet', 'shop', 'prayer'].includes(it.kind) || walkCaption(it)) return 'walking';
  return 'transit';
}

function hotelReturnMode(day) {
  return now().minutes >= 1200 ? 'driving' : (day?.home?.mode || 'transit');
}

// Place rows present a sheet or fill the inspector, so they show no chevron (C3).
function placeRow(it, v) {
  const cb = ['stops', 'eat', 'sweet', 'shop'].includes(it.kind) ? confirmedBookingForPlace(ctx.trip, it) : null;
  const confBadge = cb ? chip('Confirmed', 'ev ev-certified', 'checkCircle') : null;
  const priorityBadge = it.badge ? chip(it.badge, /core/i.test(it.badge) ? 'next' : 'plain') : null;
  const badge = it.status ? halalChip(it.status) : it.kind === 'eat' && it.for_b ? dietChip(it.for_b) : null;
  const accessBadge = it.kind === 'prayer' && it.access ? chip(it.access, /patron/i.test(it.access) ? 'ev ev-claim' : 'plain') : null;
  const bookHint = !cb && it.kind === 'eat' && it.booking
    ? (/^walk[- ]?in|^not needed|^no\b/i.test(it.booking.trim()) ? chip('Walk-in OK', 'plain')
      : /required|\d+\s*days?\s*ahead|book ahead/i.test(it.booking) ? chip('Book ahead', 'plain') : null)
    : null;
  const forBadge = it.kind === 'shop' && it.for ? chip(fill(ctx.trip, `For ${it.for}`), 'plain') : null;
  const notesBadge = (it.look_for || it.entry_tip) && ['stops', 'eat', 'sweet', 'shop'].includes(it.kind)
    ? chip(it.entry_tip ? 'Lift & entry tips' : 'Field tips', 'plain')
    : null;
  const chips = [confBadge, priorityBadge, badge, accessBadge, bookHint, forBadge, notesBadge].filter(Boolean);
  const selected = route().params.get('p') === it.id;
  const sub = it.kind === 'prayer' ? [it.area, it.where] : it.kind === 'halal' ? [it.area, it.cuisine] : [];
  const facts = ['stops', 'eat', 'sweet', 'shop', 'bakery', 'halal'].includes(it.kind)
    ? [
        it.kind === 'bakery' && it.opens ? `Opens ${it.opens}` : '',
        it.hours,
        it.cost || it.price,
        it.closed ? `Closed ${it.closed}` : '',
        it.seats,
        it.coffee,
      ].filter(Boolean).join(' \u00b7 ')
    : it.kind === 'prayer' && it.hours ? it.hours : '';
  return h('li', { class: 'row' },
    link(withParam(v, 'p', it.id), { class: 'row-link', 'aria-current': selected ? 'true' : null, 'data-key': `row-${it.id}` },
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, it.name, it.jp ? h('span', { class: 'row-jp', lang: 'ja' }, ` ${it.jp}`) : null),
        sub.filter(Boolean).length ? h('span', { class: 'row-sub' }, sub.filter(Boolean).join(' \u00b7 ')) : null,
        it.what || it.signature ? h('span', { class: 'row-sub clamp' }, it.what || it.signature) : null,
        facts ? h('span', { class: 'row-facts' }, facts) : null,
        chips.length ? h('span', { class: 'row-chips' }, ...chips) : null,
        walkCaption(it) ? h('span', { class: 'row-meta' }, walkCaption(it)) : (it.kind !== 'halal' && it.opens) ? h('span', { class: 'row-meta' }, `Opens ${it.opens}`) : null)),
    ext(dirUrl(it.maps_query || it.name, defaultPlaceMode(it)), icon('arrowOut'), { class: 'row-go', 'aria-label': `Directions to ${it.name}` }));
}

function pushRow(v, title, sub, extra) {
  return h('li', { class: 'row' }, link(v, { class: 'row-link', 'aria-current': ctx.route.v === v ? 'page' : null, 'data-key': `push-${v}` },
    h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, title), sub ? h('span', { class: 'row-sub' }, sub) : null),
    extra || null, icon('chevronRight', null, 'chevron')));
}

function findPlace(id) {
  if (!id) return null;
  return cache.places.find((p) => p.id === id)
    || cache.food.flatMap((c) => c.items).find((p) => p.id === id)
    || cache.prayer.find((p) => p.id === id) || null;
}

function placeDetail(it) { // S7: the row expanded, with immediate curbside actions & progressive disclosure
  const t = ctx.trip;
  const cb = confirmedBookingForPlace(t, it);
  const q = (cb && cb.maps_query) || it.maps_query || it.name;
  const targetName = (cb && cb.venue) || it.name;
  const primaryMode = (cb && cb.mode) || defaultPlaceMode(it);
  const curV = ctx.route.v || route().path;
  const kindLabel = { stops: 'See', shop: 'Shop', sweet: 'Coffee, sweets & rest', eat: 'Eat', bakery: 'Bakery', halal: 'Halal food', prayer: 'Prayer room' }[it.kind];
  const fieldNotes = grouped([
    it.kind !== 'bakery' ? kvStack('Why it works', it.why) : null,
    kvStack('What to look for', it.look_for),
    kvStack('Entrance & lifts', it.entry_tip),
  ], 'kv-list field-notes-list');
  const canDriver = Boolean(it.jp || it.where || it.area || q);
  const jpCopy = [it.jp, it.address_jp].filter(Boolean).join(' ');
  const coreFacts = grouped([
    cb ? kv('Reservation', ['Confirmed', cb.time, formatGuests(cb.guests)].filter(Boolean).join(' \u00b7 ')) : null,
    kv('Where', it.where || it.area),
    kv('Hours', it.hours),
    kv('Opens', it.opens),
    kv('Last entry', it.last_entry),
    kv('Closed', it.closed),
    kv('Price', it.price || it.cost),
    kv('Walk', walkCaption(it)),
    kv('Seats', it.seats),
    !cb ? kv('Booking', it.booking) : null,
  ], 'kv-list');
  const secondaryRows = [
    kv('Cuisine', it.cuisine),
    kv('Tax-free', it.tax_free),
    kv('Access', it.access),
    kv('Getting there', it.getting_there),
    kv('Coffee', it.coffee),
    kv('Queue', it.queue),
    kv('For', it.for ? fill(t, it.for) : ''),
    it.kind === 'bakery' ? kv(fill(t, 'For {B}'), it.for_b) : null,
  ].filter(Boolean);
  const secondaryNotes = [
    it.status ? h('p', { class: 'footnote' }, it.certifier ? `Certified by ${it.certifier}` : 'Certifier not named') : null,
    it.alcohol ? h('p', { class: 'footnote' }, `Alcohol served: ${it.alcohol}`) : null,
    it.verified ? h('p', { class: 'footnote' }, `Checked ${t.halal.as_of}: ${it.verified}`) : null,
    it.checked_on ? h('p', { class: 'footnote' }, `Primary source checked ${it.checked_on}${it.verification_note ? `: ${it.verification_note}` : '.'}`) : null,
    it.tags && it.tags.length ? h('div', { class: 'chips' }, it.tags.map((x) => chip(x, 'plain'))) : null,
  ].filter(Boolean);
  const hasSecondary = secondaryRows.length > 0 || secondaryNotes.length > 0;
  return h('article', { class: 'place' },
    h('p', { class: 'eyebrow' }, [kindLabel, it.zone, it.dayLabel].filter(Boolean).join(' \u00b7 ')),
    h('h2', { class: 'place-title', id: 'place-title' }, it.name),
    it.jp ? h('p', { class: 'place-jp', lang: 'ja' }, it.jp) : null,
    h('div', { class: 'chips' },
      cb ? chip('Confirmed', 'ev ev-certified', 'checkCircle') : null,
      it.badge ? chip(it.badge, /core/i.test(it.badge) ? 'next' : 'plain') : null,
      halalChip(it.status),
      it.kind === 'eat' ? dietChip(it.for_b) : null,
      it.kind === 'prayer' && it.access ? chip(it.access, /patron/i.test(it.access) ? 'ev ev-claim' : 'plain') : null),
    fromHereActionRow(q, targetName, primaryMode),
    (jpCopy || canDriver) ? h('div', { class: 'place-top-actions' },
      jpCopy ? copyTextButton(jpCopy, 'Copy Japanese', `Copy Japanese name for ${it.name}`) : null,
      canDriver ? link(withParam(curV, 'taxi', `pl:${it.id}`), { class: 'btn btn-gray btn-small', 'data-key': `drv-pl-${it.id}`, 'aria-label': `Show driver card for ${it.name}` }, icon('car'), h('span', null, 'Show driver card')) : null) : null,
    it.what || it.signature ? h('p', { class: 'body' }, it.what || it.signature) : null,
    it.kind === 'bakery' && it.why ? h('p', { class: 'body' }, it.why) : null,
    it.pacing ? h('p', { class: 'note' }, icon('figureWalk'), h('span', null, it.pacing)) : null,
    it.rain_alt ? h('p', { class: 'note' }, icon('leaf'), h('span', null, it.rain_alt)) : null,
    fieldNotes,
    coreFacts,
    cb ? bookingReferenceDisclosure(cb) : null,
    hasSecondary ? h('details', { class: 'disclosure place-more' },
      h('summary', null, h('span', { class: 'summary-label' }, 'More details & verification')),
      secondaryRows.length ? grouped(secondaryRows, 'kv-list') : null,
      secondaryNotes.length ? h('div', { class: 'disclosure-pad place-more-notes' }, ...secondaryNotes) : null) : null,
    goButtons(q, targetName, primaryMode),
    it.source ? h('div', { class: 'place-links' },
      ext(it.source, [icon('link'), h('span', null, 'Source')], { class: 'text-btn', 'aria-label': `Source for ${it.name}` })) : null);
}

function kv(label, value) {
  if (!value) return null;
  return h('li', { class: 'kv' }, h('span', { class: 'kv-label' }, label), h('span', { class: 'kv-value' }, value));
}

function kvStack(label, value) {
  if (!value) return null;
  return h('li', { class: 'kv stack' }, h('span', { class: 'kv-label' }, label), h('span', { class: 'kv-value' }, value));
}

// Segmented control as a radio group with arrow keys (C4, N6).
function segmented(label, options, selected, onSelect, cls = '') {
  const group = h('div', { class: `segmented ${cls}`, role: 'radiogroup', 'aria-label': label });
  options.forEach(([value, text]) => {
    const on = value === selected;
    group.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1', 'data-key': `seg-${label}-${value}`, onclick: () => { lastFocus = `seg-${label}-${value}`; onSelect(value); } }, text));
  });
  group.addEventListener('keydown', (e) => {
    const btns = [...group.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    btns[(i + d + btns.length) % btns.length].click();
  });
  return group;
}

function toggleRow(label, checked, onChange) {
  const id = `sw-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return h('div', { class: 'toggle' }, h('label', { for: id }, label),
    h('input', { id, type: 'checkbox', role: 'switch', class: 'switch', checked, 'data-key': id, onchange: (e) => { lastFocus = id; onChange(e.target.checked); } }));
}

function jumpToZone(zi) {
  const el = document.getElementById(`zone-${zi}`);
  if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

function jumpToSpa() {
  const det = document.getElementById('day-spa');
  if (!det) return;
  det.open = true;
  det.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  const sum = det.querySelector('summary');
  if (sum) sum.focus({ preventScroll: true });
}

function jumpToTravel() {
  const el = document.getElementById('day-travel');
  if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

function bookingReferenceDisclosure(b) {
  if (!b) return null;
  const rows = [
    kv('Reference', b.reference),
    kv('Booked under', b.booked_under ? fill(ctx.trip, b.booked_under) : ''),
    kvStack('Details', b.notes),
    kvStack('Policy', b.policy),
  ].filter(Boolean);
  const links = [
    b.manage_url ? ext(b.manage_url, [icon('link'), h('span', null, 'Manage booking')], { class: 'text-btn small' }) : null,
    b.source ? ext(b.source, [icon('link'), h('span', null, 'Venue page')], { class: 'text-btn small', 'aria-label': `Venue page for ${b.venue}` }) : null,
  ].filter(Boolean);
  if (!rows.length && !links.length) return null;
  return h('details', { class: 'disclosure booking-disclosure' },
    h('summary', null, h('span', { class: 'summary-label' }, 'Reference & policy')),
    rows.length ? grouped(rows, 'kv-list') : null,
    links.length ? h('div', { class: 'disclosure-pad booking-ext' }, ...links) : null);
}

function confirmedBookingCard(b, { day, v = route().path, showDayLink = false } = {}) {
  const d = day || dayOf(b.day);
  const zi = d ? bookingZoneIndex(d, b) : -1;
  const targetName = normKey(b.place_match || b.venue);
  const matchedPlace = cache.places.find((p) => p.dayISO === b.day && normKey(p.name) === targetName && (zi < 0 || normKey(p.zone) === normKey(d.zones[zi]?.name)));
  const kindLabel = b.meal && MEAL_LABEL[b.meal] ? MEAL_LABEL[b.meal] : (b.kind === 'transfer' ? 'Transfer' : '');
  const whenText = [b.time, kindLabel].filter(Boolean).join(' \u00b7 ');
  const metaParts = [formatGuests(b.guests), b.area].filter(Boolean);
  const links = [];
  if (showDayLink) {
    links.push(link(zi >= 0 ? `days/${b.day}?z=${zi}` : `days/${b.day}`, { class: 'text-btn small', 'data-key': `bk-day-${b.id || b.day}` },
      icon('calendar'), h('span', null, d ? `${d.date} \u00b7 ${d.title}` : b.day)));
  } else if (v === 'today') {
    links.push(link(zi >= 0 ? `days/${b.day}?z=${zi}` : `days/${b.day}`, { class: 'text-btn small', 'data-key': `bk-open-${b.id || b.day}` },
      icon('calendar'), h('span', null, zi >= 0 && d ? `In plan: Zone ${zi + 1} (${d.zones[zi].name})` : 'Open day plan')));
  } else if (zi >= 0 && d) {
    links.push(h('button', {
      type: 'button',
      class: 'text-btn small booking-jump',
      onclick: () => jumpToZone(zi),
      'aria-label': `In itinerary: Zone ${zi + 1}, ${d.zones[zi].name}`,
    }, icon('pin'), h('span', null, `Zone ${zi + 1}: ${d.zones[zi].name}`)));
  }
  if (matchedPlace) {
    links.push(link(withParam(v, 'p', matchedPlace.id), { class: 'text-btn small', 'data-key': `bk-place-${matchedPlace.id}` },
      icon('info'), h('span', null, 'Venue notes')));
  }
  if (b.kind !== 'transfer' && b.id) {
    links.push(link(withParam(v, 'taxi', `bk:${b.id}`), { class: 'text-btn small', 'data-key': `bk-drv-${b.id}`, 'aria-label': `Driver card for ${b.venue}` },
      icon('car'), h('span', null, 'Driver card')));
  }
  const primaryMode = b.mode || (b.kind === 'transfer' ? 'driving' : 'walking');
  const bkJp = [b.venue_jp, b.address_jp].filter(Boolean).join(' ');
  return h('article', { class: 'card booking-card', 'aria-label': `Confirmed: ${b.venue}` },
    h('div', { class: 'booking-top' },
      chip('Confirmed', 'ev ev-certified', 'checkCircle'),
      whenText ? h('span', { class: 'booking-when nums' }, whenText) : null),
    h('h3', { class: 'booking-venue' }, b.venue, b.venue_jp ? h('span', { class: 'row-jp', lang: 'ja' }, ` ${b.venue_jp}`) : null),
    metaParts.length ? h('p', { class: 'booking-meta' }, metaParts.join(' \u00b7 ')) : null,
    b.kind === 'transfer' && b.notes ? h('p', { class: 'booking-note' }, b.notes) : null,
    fromHereActionRow(b.maps_query || b.venue, b.venue, primaryMode),
    bkJp ? h('div', { class: 'booking-copy-row' }, copyTextButton(bkJp, 'Copy Japanese', `Copy Japanese name for ${b.venue}`)) : null,
    links.length ? h('div', { class: 'booking-links' }, ...links) : null,
    goButtons(b.maps_query || b.venue, b.venue, primaryMode),
    bookingReferenceDisclosure(b));
}

// ---------------------------------------------------------------- To book & confirmed reservations
function toBook() { return activeToBookItems(ctx.trip); }
function dayOf(iso) { return ctx.trip.days.find((d) => d.iso === iso); }

function bookRow(it) {
  const key = `booked:${it.id}`;
  const done = ctx.prefs[key] === true;
  const d = dayOf(it.day);
  const id = `bk-${it.id}`;
  return h('li', { class: `book-row ${done ? 'is-done' : ''}` },
    h('span', { class: 'check' }, h('input', { type: 'checkbox', id, class: 'book-check', checked: done, 'data-key': id, onchange: (e) => { lastFocus = id; ctx.setPref(key, e.target.checked); draw(); } }), icon('check')),
    h('label', { for: id, class: 'row-text' },
      h('span', { class: 'row-title' }, it.title),
      h('span', { class: 'row-sub' }, [d ? d.date : it.day, it.deadline ? `book by ${it.deadline}` : ''].filter(Boolean).join(' \u00b7 ')),
      h('span', { class: 'row-meta' }, it.detail),
      h('span', { class: 'row-meta' }, done ? 'Marked booked on this device' : 'Not booked yet')),
    d ? link(`days/${d.iso}`, { class: 'row-go', 'aria-label': `Open ${d.date}` }, icon('calendar')) : null);
}

function toBookView() {
  const confirmed = confirmedBookings(ctx.trip);
  const items = toBook();
  const needs = items.filter((x) => x.need === 'needs');
  const optional = items.filter((x) => x.need !== 'needs');
  return [
    h('p', { class: 'caption' }, toBookCaption(ctx.trip)),
    confirmed.length ? grouped([pushRow('info/bookings', 'Confirmed reservations', `${confirmed.length} confirmed in trip plan`)]) : null,
    needs.length ? section('Needs booking', grouped(needs.map(bookRow), 'book-list')) : null,
    optional.length ? section('Can be booked if you choose it', h('details', { class: 'disclosure' }, h('summary', null, `${optional.length} ${optional.length === 1 ? 'restaurant that takes' : 'restaurants that take'} bookings`), grouped(optional.map(bookRow), 'book-list'))) : null,
    !needs.length && !optional.length ? h('p', { class: 'empty' }, 'Nothing left on the booking list.') : null,
    h('p', { class: 'caption' }, 'Ticks are saved on this device only. Tell the trip app owner what you booked so the plan can be updated for everyone.'),
  ];
}

function notBookedNote(iso, prefix = 'Not booked yet: ') {
  const open = toBook().filter((x) => x.day === iso && x.need === 'needs' && ctx.prefs[`booked:${x.id}`] !== true);
  if (!open.length) return null;
  return h('div', { class: 'callout warn callout-action' },
    icon('warning'),
    h('div', { class: 'callout-body' },
      h('p', { class: 'callout-text' }, h('strong', null, prefix), open.map((x) => x.title).join('; ')),
      link('info/to-book', { class: 'text-btn small' }, icon('listRect'), h('span', null, 'Open booking list'))));
}

// ---------------------------------------------------------------- Today (S2, S3, S4)
function viewToday(r) {
  const t = ctx.trip;
  const n = now();
  const ph = tripPhase(t.days, n.iso);
  const day = t.days[ph.index];
  const tomorrow = t.days[ph.index + 1];
  let main;
  if (ph.phase === 'before') {
    const confirmed = confirmedBookings(t);
    const pendingNeeds = toBook().filter((x) => x.need === 'needs');
    main = [
      h('section', { class: 'hero', 'aria-label': 'Countdown' },
        h('p', { class: 'hero-number' }, String(ph.daysToGo)),
        h('p', { class: 'hero-label' }, ph.daysToGo === 1 ? 'day to go' : 'days to go'),
        h('p', { class: 'meta' }, `${t.days[0].date} to ${t.days[t.days.length - 1].date}, Tokyo time`)),
      documentShortcut(),
      confirmed.length ? section('Confirmed', h('div', { class: 'bookings-stack' }, confirmed.map((b) => confirmedBookingCard(b, { day: dayOf(b.day), v: 'today', showDayLink: true })))) : null,
      pendingNeeds.length ? section('To book', grouped(pendingNeeds.slice(0, 6).map(bookRow), 'book-list'), link('info/to-book', { class: 'text-btn' }, 'All bookings to make')) : null,
      docSection('next-up', 'Next up'),
      section('First day', tomorrowCard(day)),
      section('Week overview', grouped(t.days.map(dayRow), 'days-list week-overview')),
      section('Before you go', grouped([pushRow('info/bookings', 'Bookings'), pushRow('info/getting-around', 'Getting around'), pushRow('info/shopping-and-tax-refunds', 'Tax-free shopping')])),
    ];
  } else if (ph.phase === 'after') {
    main = [section(null, h('p', { class: 'body' }, 'The trip is over. Every day is still here to look back on.')), link('days', { class: 'btn btn-filled' }, 'Open Days')];
  } else {
    const nn = nowNext(day, n.minutes);
    const focus = nn.now ?? nn.next;
    const watch = day.watch_outs || [];
    const dayConfirmed = confirmedBookingsForDay(t, day.iso);
    const openText = activeDayOpen(t, day);
    const confirmedZones = new Set(dayConfirmed.map((b) => bookingZoneIndex(day, b)).filter((zi) => zi >= 0));
    const focusZoneBookings = focus !== null && focus !== undefined ? dayConfirmed.filter((b) => bookingZoneIndex(day, b) === focus) : [];
    const nextZone = nn.now !== null && nn.now !== undefined ? day.zones[nn.now + 1] : null;
    const isAirportBoundary = ph.index === 0 || ph.index === t.days.length - 1;
    const restOfWeek = t.days.slice(ph.index + 2);
    const weekAheadDisclosure = restOfWeek.length ? h('details', { class: 'disclosure week-ahead-disc' },
      h('summary', null, h('span', { class: 'summary-label' }, `Later this week (${restOfWeek.length} ${restOfWeek.length === 1 ? 'day' : 'days'})`)),
      grouped(restOfWeek.map(dayRow), 'days-list week-overview')) : null;
    const tomorrowSection = tomorrow ? section('Tomorrow', tomorrowCard(tomorrow), weekAheadDisclosure) : null;
    main = [
      h('div', { class: 'today-head' },
        h('p', { class: 'eyebrow' }, [day.date, `Day ${ph.index + 1} of ${t.days.length}`, dayTheme(day)].filter(Boolean).join(' \u00b7 ')),
        h('p', { class: 'today-title' }, day.title),
        h('p', { class: 'day-place' }, day.place)),
      focus !== null && focus !== undefined ? zoneNowCard(day, day.zones[focus], nn.now === focus ? 'Now' : 'Next', focus, nextZone, focusZoneBookings)
        : h('section', { class: 'now-card', 'aria-label': 'Today’s plan' },
          h('p', { class: 'eyebrow' }, nn.done ? 'Plan done' : 'Today’s plan'),
          h('p', { class: 'body' }, nn.done ? 'That’s today’s plan done. Time to head back.' : (day.short_summary || day.summary)),
          fromHereActionRow(
            nn.done ? (day.home?.maps_query || t.hotel.maps_query) : (day.zones?.[0]?.getting_there?.maps_query || t.hotel.maps_query),
            nn.done ? (t.hotel.name || 'the hotel') : (day.zones?.[0]?.getting_there?.arrive_at || day.zones?.[0]?.name || 'start of day'),
            nn.done ? hotelReturnMode(day) : (day.zones?.[0]?.getting_there?.mode || 'transit'),
            { primaryFilled: true },
          ),
          link(`days/${day.iso}`, { class: 'text-btn small', 'data-key': 'now-open-day' }, icon('calendar'), h('span', null, 'Open the full day'))),
      dayConfirmed.length ? section('Confirmed today', h('div', { class: 'bookings-stack' }, dayConfirmed.map((b) => confirmedBookingCard(b, { day, v: 'today' })))) : null,
      isAirportBoundary ? documentShortcut() : null,
      quickActions(day, focus),
      notBookedNote(day.iso, 'Not booked yet: '),
      tomorrow ? notBookedNote(tomorrow.iso, 'Tomorrow not booked yet: ') : null,
      openText ? h('p', { class: 'callout' }, icon('question'), h('span', null, h('strong', null, 'To decide: '), openText)) : null,
      nn.done ? tomorrowSection : null,
      section('Rest of today', grouped(day.zones.map((z, i) => {
        const isPast = nn.done || (nn.now !== null && nn.now !== undefined && i < nn.now);
        return h('li', { class: `row ${i === nn.now ? 'is-now' : ''} ${isPast ? 'is-past' : ''}`.trim() },
          link(`days/${day.iso}?z=${i}`, { class: 'row-link', 'data-key': `zone-${i}` },
            h('span', { class: 'row-time' }, z.time),
            h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, z.name), h('span', { class: 'row-sub' }, z.purpose)),
            confirmedZones.has(i) ? chip('Confirmed', 'ev ev-certified', 'checkCircle') : null,
            i === nn.now ? chip('Now', 'now') : null, icon('chevronRight', null, 'chevron')));
      }))),
      watch.length ? section('Watch out', h('ul', { class: 'bullets warn' }, watch.slice(0, 2).map((w) => h('li', null, w))),
        watch.length > 2 ? h('details', { class: 'disclosure' }, h('summary', null, `${watch.length - 2} more watch-outs`), h('ul', { class: 'bullets warn' }, watch.slice(2).map((w) => h('li', null, w)))) : null) : null,
      !nn.done ? tomorrowSection : null,
    ];
  }
  return { title: 'Today', main, place: findPlace(r.params.get('p')) };
}

function zoneNowCard(day, z, label, zi = 0, nextZ = null, zBookings = []) {
  const gt = z.getting_there || {};
  const isNow = label === 'Now';
  const zItems = cache.places.filter((p) => p.dayISO === day.iso && p.zone === z.name);
  const topStops = zItems.filter((p) => p.kind === 'stops').slice(0, 2).map((p) => p.name);
  const topShop = zItems.filter((p) => p.kind === 'shop').slice(0, 2).map((p) => p.name);
  const restSpots = zItems.filter((p) => p.kind === 'sweet').slice(0, 2).map((p) => p.name);
  const inZoneSummary = [
    topStops.length ? `See: ${topStops.join(', ')}` : '',
    !topStops.length && topShop.length ? `Shop: ${topShop.join(', ')}` : '',
    restSpots.length ? `Rest & coffee: ${restSpots.join(', ')}` : '',
  ].filter(Boolean).join(' \u00b7 ');
  const nextGt = nextZ?.getting_there || {};
  const leadBooking = zBookings[0];
  const heroDest = (leadBooking && (leadBooking.maps_query || leadBooking.venue))
    || gt.maps_query
    || zItems[0]?.maps_query
    || zItems[0]?.name
    || z.name;
  const heroName = (leadBooking && leadBooking.venue) || gt.arrive_at || z.name;
  const heroMode = leadBooking ? (leadBooking.mode || (leadBooking.kind === 'transfer' ? 'driving' : 'walking')) : (gt.mode || 'transit');
  return h('section', { class: 'now-card', 'aria-label': `${label}: ${z.name}` },
    h('div', { class: 'now-top' }, chip(label, isNow ? 'now' : 'next'), h('span', { class: 'meta nums' }, z.time)),
    h('p', { class: 'now-title' }, z.name),
    h('p', { class: 'body' }, z.purpose),
    zBookings.length ? h('div', { class: 'chips' }, zBookings.map((b) =>
      chip(['Confirmed', b.time, b.venue].filter(Boolean).join(' \u00b7 '), 'ev ev-certified', 'checkCircle'))) : null,
    h('p', { class: 'eyebrow now-go-label' }, `Go to: ${heroName}`),
    fromHereActionRow(heroDest, heroName, heroMode, { primaryFilled: true }),
    isNow && z.short_route ? h('p', { class: 'meta' }, `Shorter walk: ${z.short_route}`) : null,
    isNow && inZoneSummary ? h('p', { class: 'meta' }, inZoneSummary) : null,
    !isNow && gt.how ? metaLine([gt.minutes ? `About ${gt.minutes} min` : '', gt.fare, gt.arrive_at ? `to ${gt.arrive_at}` : '']) : null,
    isNow && nextZ ? h('div', { class: 'now-next-box' },
      h('p', { class: 'eyebrow' }, `Next \u00b7 ${nextZ.time}`),
      h('p', { class: 'now-next-title' }, nextZ.name),
      nextGt.how ? h('p', { class: 'meta' }, [nextGt.minutes ? `About ${nextGt.minutes} min` : '', nextGt.fare, nextGt.arrive_at ? `to ${nextGt.arrive_at}` : ''].filter(Boolean).join(' \u00b7 ')) : null)
      : isNow ? h('div', { class: 'now-next-box' }, h('p', { class: 'eyebrow' }, 'Then'), h('p', { class: 'meta' }, day.home?.how || 'Back to the hotel when ready.')) : null,
    h('div', { class: 'now-actions' },
      link(`days/${day.iso}?z=${zi}`, { class: 'text-btn small', 'data-key': `now-zone-${zi}` }, icon('calendar'), h('span', null, `Open Zone ${zi + 1} in day plan`)),
      day.travel_cards?.length ? link(`days/${day.iso}?focus=travel`, { class: 'text-btn small', 'data-key': `now-trv-${day.iso}` }, icon('train'), h('span', null, 'Step-by-step transit')) : null));
}

function quickActions(day, focusZoneIdx = null) {
  const t = ctx.trip;
  const g = zoneHalalGroup(t, day, focusZoneIdx) || defaultHalalGroup(t, day.iso);
  const curV = ctx.route.v || 'today';
  return h('nav', { class: 'quick', 'aria-label': 'Quick actions' },
    ext(dirUrl(t.hotel.maps_query, hotelReturnMode(day)), [icon('bed'), h('span', null, 'Back to the hotel')], { class: 'quick-btn' }),
    link(`food/halal?g=${g}`, { class: 'quick-btn', 'data-key': 'qa-food' }, icon('fork'), h('span', null, 'Food nearby')),
    link(`food/halal?g=${g}&focus=prayer`, { class: 'quick-btn', 'data-key': 'qa-prayer' }, icon('moon'), h('span', null, 'Prayer rooms')),
    link(withParam(curV, 'taxi', 'hotel'), { class: 'quick-btn', 'data-key': 'qa-taxi' }, icon('car'), h('span', null, 'Taxi card')));
}

function tomorrowCard(d) {
  const t = ctx.trip;
  const fp = dayForwardSummary(t, d);
  const openText = activeDayOpen(t, d);
  const z0 = d.zones?.[0];
  const topWatch = d.watch_outs?.[0] || '';
  return link(`days/${d.iso}`, { class: 'day-card tomorrow-card', 'data-key': `card-${d.iso}` },
    h('span', { class: 'day-badge' }, h('span', { class: 'day-num' }, d.n), h('span', { class: 'day-k', lang: 'ja' }, d.k)),
    h('span', { class: 'row-text' },
      h('span', { class: 'row-sub' }, [fp.date, d.wkd ? 'Weekend' : '', fp.theme].filter(Boolean).join(' \u00b7 ')),
      h('span', { class: 'row-title' }, fp.title),
      h('span', { class: 'row-sub' }, fp.area),
      z0 ? h('span', { class: 'row-facts' }, `Starts: ${z0.time} \u00b7 ${z0.name}`) : null,
      fp.corePlan ? h('span', { class: 'row-facts plan-line plan-core' }, h('strong', null, 'Core plan: '), fp.corePlan) : null,
      fp.tentative.length ? h('span', { class: 'row-facts plan-line plan-tentative' }, h('strong', null, 'Tentative / optional: '), fp.tentative.join(' \u00b7 ')) : null,
      fp.confirmed.length ? h('span', { class: 'row-facts plan-line plan-confirmed' }, h('strong', null, 'Confirmed: '), fp.confirmed.map((b) => [b.time, b.venue].filter(Boolean).join(' \u00b7 ')).join('; ')) : null,
      h('span', { class: 'row-chips' },
        typeChip(d.type),
        chip(LOAD[d.load], 'plain'),
        d.walk ? chip(`Walking: ${d.walk}`, 'plain', 'figureWalk') : null,
        ...fp.confirmed.map((b) => chip(['Confirmed', b.time, b.venue].filter(Boolean).join(' \u00b7 '), 'ev ev-certified', 'checkCircle')),
        openText ? chip('To decide', 'decide', 'question') : null,
        d.type === 'shop' ? chip('Carry physical passports', 'plain') : null),
      topWatch ? h('span', { class: 'row-meta clamp' }, topWatch) : null),
    icon('chevronRight', null, 'chevron'));
}

function t0(d) { const t = ctx.trip; return t.days[tripPhase(t.days, now().iso).index].iso; }

function dayRow(d) {
  const today = now().iso === d.iso;
  const r = route();
  const fp = dayForwardSummary(ctx.trip, d);
  const openText = activeDayOpen(ctx.trip, d);
  return h('li', { class: `row day-row ${today ? 'is-today' : ''}` },
    link(`days/${d.iso}`, { class: 'row-link', 'aria-current': r.tab === 'days' && (r.sub[0] || (!isCompact() && t0(d))) === d.iso ? 'page' : null, 'data-key': `day-${d.iso}` },
      h('span', { class: 'day-badge' }, h('span', { class: 'day-num' }, d.n), h('span', { class: 'day-k', lang: 'ja' }, d.k)),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-sub' }, [fp.date, d.wkd ? 'Weekend' : '', fp.theme, today ? 'Today' : ''].filter(Boolean).join(' \u00b7 ')),
        h('span', { class: 'row-title' }, fp.title),
        h('span', { class: 'row-sub' }, fp.area),
        fp.corePlan ? h('span', { class: 'row-facts plan-line plan-core' }, h('strong', null, 'Core: '), fp.corePlan) : null,
        fp.tentative.length ? h('span', { class: 'row-facts plan-line plan-tentative' }, h('strong', null, 'Optional: '), fp.tentative.join(' \u00b7 ')) : null,
        fp.confirmed.length ? h('span', { class: 'row-facts plan-line plan-confirmed' }, h('strong', null, 'Confirmed: '), fp.confirmed.map((b) => [b.time, b.venue].filter(Boolean).join(' \u00b7 ')).join('; ')) : null,
        h('span', { class: 'row-chips' },
          typeChip(d.type),
          chip(LOAD[d.load], 'plain'),
          fp.confirmed.length ? chip(fp.confirmed.length > 1 ? `${fp.confirmed.length} confirmed` : 'Confirmed', 'ev ev-certified', 'checkCircle') : null,
          openText ? chip('To decide', 'decide', 'question') : null)),
      icon('chevronRight', null, 'chevron')));
}

// ---------------------------------------------------------------- Days (S5, S6)
function viewDays(r) {
  const t = ctx.trip;
  let i = t.days.findIndex((d) => d.iso === r.sub[0]);
  const isRoot = i < 0;
  // Compact: the root is the chart and list. Regular widths: list column plus today's (or the first) day.
  if (isRoot && isCompact()) return { title: 'Days', main: [rhythm(-1), grouped(t.days.map(dayRow), 'days-list')] };
  if (isRoot) i = tripPhase(t.days, now().iso).index;
  const d = t.days[i];
  const prev = t.days[i - 1], next = t.days[i + 1];
  const longDate = (x) => new Date(`${x.iso}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return {
    title: isRoot ? 'Days' : d.date,
    large: false,
    ownH1: true,
    back: isRoot ? null : ['days', 'Days'],
    list: [rhythm(i), grouped(t.days.map(dayRow), 'days-list')],
    listLabel: 'Days',
    main: dayDetail(d, i),
    place: findPlace(r.params.get('p')),
    trailing: h('div', { class: 'pager' },
      h('button', { class: 'icon-btn', type: 'button', disabled: !prev, 'aria-label': prev ? `Previous day, ${longDate(prev)}` : 'No previous day', onclick: () => go(`days/${prev.iso}`) }, icon('chevronLeft')),
      h('button', { class: 'icon-btn', type: 'button', disabled: !next, 'aria-label': next ? `Next day, ${longDate(next)}` : 'No next day', onclick: () => go(`days/${next.iso}`) }, icon('chevronRight'))),
  };
}

function rhythm(selected) {
  const t = ctx.trip;
  const today = now().iso;
  const strip = h('ol', { class: 'rhythm-strip', 'aria-label': 'Trip at a glance' }, t.days.map((d, i) => {
    const openText = activeDayOpen(t, d);
    return h('li', { class: `rhythm-day t-${d.type} ${d.wkd ? 'wkd' : ''} ${d.iso === today ? 'is-today' : ''}` },
      link(`days/${d.iso}`, { 'aria-label': `${d.date}: ${d.title}. ${DAY_TYPE[d.type]}, ${LOAD[d.load]}${openText ? ', to decide' : ''}${d.iso === today ? ', today' : ''}`, 'aria-current': i === selected ? 'page' : null, tabindex: i === Math.max(0, selected) ? '0' : '-1', 'data-key': `rhythm-${d.iso}` },
        h('span', { class: 'rhythm-k', lang: 'ja', 'aria-hidden': 'true' }, d.k),
        h('span', { class: 'rhythm-track', 'aria-hidden': 'true' }, h('span', { class: 'rhythm-bar', 'data-load': d.load })),
        h('span', { class: 'rhythm-n', 'aria-hidden': 'true' }, d.n),
        openText ? h('span', { class: 'rhythm-open', 'aria-hidden': 'true' }) : null));
  }));
  strip.addEventListener('keydown', (e) => {
    const links = [...strip.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (i < 0 || !d) return;
    e.preventDefault();
    const j = Math.min(links.length - 1, Math.max(0, i + d));
    links.forEach((a, k) => a.setAttribute('tabindex', k === j ? '0' : '-1'));
    links[j].focus();
  });
  return h('section', { class: 'rhythm' },
    h('h2', { class: 'group-title' }, 'Trip at a glance'),
    h('div', { class: 'rhythm-scroll' }, strip),
    h('ul', { class: 'legend', 'aria-label': 'Legend' }, Object.entries(DAY_TYPE).map(([k, v]) => h('li', null, h('span', { class: `type-dot t-${k}`, 'aria-hidden': 'true' }), v)),
      h('li', null, h('span', { class: 'rhythm-open legend-open', 'aria-hidden': 'true' }), 'To decide'),
      h('li', null, 'Bar height: how full the day is')));
}

function dayJumpStrip(selected) {
  const t = ctx.trip;
  const today = now().iso;
  const scroller = h('div', { class: 'day-strip-scroll' },
    h('ol', { class: 'day-strip-list' }, t.days.map((d, idx) => {
      const shortDate = (d.date || '').split(' ').slice(0, 2).join(' ') || d.n;
      const active = idx === selected;
      return h('li', null,
        link(`days/${d.iso}`, {
          class: `day-pill ${d.iso === today ? 'is-today' : ''}`,
          'aria-current': active ? 'page' : null,
          'aria-label': `${d.date}: ${d.title}`,
          'data-key': `pill-${d.iso}`,
        },
        h('span', { class: `type-dot t-${d.type}`, 'aria-hidden': 'true' }),
        h('span', { class: 'day-pill-date nums' }, shortDate),
        h('span', { class: 'day-pill-title' }, d.title)));
    })));
  queueMicrotask(() => {
    const activeEl = scroller.querySelector('[aria-current="page"]');
    if (activeEl && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollLeft = Math.max(0, activeEl.offsetLeft - (scroller.clientWidth - activeEl.offsetWidth) / 2);
    }
  });
  return h('nav', { class: 'day-strip', 'aria-label': 'Jump to day' }, scroller);
}

function dayAreaBar(d) {
  const t = ctx.trip;
  if (!t.halal || !Array.isArray(t.halal.groups) || !t.halal.groups.length) return null;
  const groups = dayHalalGroups(t, d.iso);
  if (!groups.length) return null;
  const prayerGroups = groups
    .map((g) => ({ g, label: t.halal.groups.find((x) => x.id === g)?.label || g, count: cache.prayer.filter((p) => p.g === g).length }))
    .filter((x) => x.count > 0);
  return h('nav', { class: 'day-area-bar', 'aria-label': 'Halal food and prayer rooms for this day' },
    groups.map((g) => {
      const label = t.halal.groups.find((x) => x.id === g)?.label || g;
      const count = cache.halal.filter((p) => p.g === g).length;
      return link(`food/halal?g=${g}`, { class: 'area-link', 'data-key': `day-halal-${d.iso}-${g}` },
        icon('fork'), h('span', null, `Halal: ${label}`), h('span', { class: 'count nums' }, String(count)));
    }),
    prayerGroups.map(({ g, label, count }) => link(`food/halal?g=${g}&focus=prayer`, { class: 'area-link', 'data-key': `day-prayer-${d.iso}-${g}` },
      icon('moon'), h('span', null, prayerGroups.length > 1 ? `Prayer: ${label}` : 'Prayer rooms'), h('span', { class: 'count nums' }, String(count)))));
}

function spaRow(s, dayIso = '', idx = 0) {
  const q = s.maps_query || s.name;
  const v = ctx.route.v || (dayIso ? `days/${dayIso}` : 'today');
  const line = (lbl, val, cls = 'row-facts') => val ? h('span', { class: cls }, h('strong', null, `${lbl}: `), val) : null;
  const actions = [];
  if (s.source && s.booking_url && s.source === s.booking_url) {
    actions.push(ext(s.booking_url, [icon('link'), h('span', null, `Source & booking (${sourceLabel(s.booking_url)})`)], { class: 'text-btn small' }));
  } else {
    if (s.source) actions.push(ext(s.source, [icon('link'), h('span', null, `Source (${sourceLabel(s.source)})`)], { class: 'text-btn small' }));
    if (s.booking_url) actions.push(ext(s.booking_url, [icon('link'), h('span', null, `Book (${sourceLabel(s.booking_url)})`)], { class: 'text-btn small' }));
  }
  if (dayIso && (s.jp || s.address_jp || s.area)) {
    actions.push(link(withParam(v, 'taxi', `spa:${dayIso}:${idx}`), { class: 'text-btn small', 'data-key': `spa-drv-${dayIso}-${idx}`, 'aria-label': `Driver and walk-in card for ${s.name}` },
      icon('car'), h('span', null, 'Driver & walk-in card')));
  }
  return h('li', { class: 'row' },
    h('div', { class: 'row-link spa-item' },
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, s.name, s.jp ? h('span', { class: 'row-jp', lang: 'ja' }, ` ${s.jp}`) : null),
        s.area ? h('span', { class: 'row-sub' }, s.area) : null,
        (s.privacy || s.checked_on) ? h('span', { class: 'row-chips' },
          s.privacy ? chip(s.privacy, 'plain') : null,
          s.checked_on ? chip(`Checked ${s.checked_on}`, 'plain') : null) : null,
        s.why ? h('span', { class: 'row-sub' }, s.why) : null,
        line('Availability', s.availability),
        line('Menu', s.price),
        line('Hours', s.hours),
        line('Rooms', s.attendance),
        line('Walk-in / booking', s.booking),
        line('Notes', s.caveat, 'row-meta'),
        actions.length ? h('span', { class: 'spa-actions' }, ...actions) : null)),
    q ? ext(dirUrl(q, s.mode || 'walking'), icon('arrowOut'), { class: 'row-go', 'aria-label': `Directions to ${s.name}` }) : null);
}

function spaOptionsContent(d) {
  const list = d.spa_options || [];
  if (!list.length) return null;
  const hasGroups = list.some((s) => s.zone_group);
  if (!hasGroups) return grouped(list.map((s, idx) => spaRow(s, d.iso, idx)));
  const groups = [];
  list.forEach((s, idx) => {
    const gName = s.zone_group || 'Options';
    let entry = groups.find((x) => x.name === gName);
    if (!entry) { entry = { name: gName, rows: [] }; groups.push(entry); }
    entry.rows.push(spaRow(s, d.iso, idx));
  });
  return groups.map((g) => h('div', { class: 'spa-zone-group' },
    h('h4', { class: 'kind-title' }, g.name),
    grouped(g.rows)));
}

const STEP_ICON = { walk: 'walk', train: 'train', subway: 'train', transfer: 'reload', exit: 'arrowOut', bus: 'train', taxi: 'car' };

function travelStepRow(st, idx) {
  const modeKey = String(st.mode || 'train').toLowerCase();
  const modeLabel = st.mode_label || (modeKey.charAt(0).toUpperCase() + modeKey.slice(1));
  return h('li', { class: 'route-step' },
    h('span', { class: 'step-num nums', 'aria-hidden': 'true' }, String(idx + 1)),
    h('div', { class: 'step-body' },
      h('div', { class: 'step-head-row' },
        chip(modeLabel, 'plain', STEP_ICON[modeKey] || 'train'),
        st.head ? h('span', { class: 'step-head' }, st.head) : null),
      st.detail ? h('p', { class: 'step-detail' }, st.detail) : null,
      st.book_url && st.book_label ? h('div', { class: 'step-book-box' },
        ext(st.book_url, [icon('link'), h('span', null, st.book_label)], { class: 'btn btn-tinted btn-small' }),
        st.ticket_note ? h('span', { class: 'step-ticket-note' }, st.ticket_note) : null) : null));
}

function taxiAltBox(tx, dayIso, idx, curV) {
  if (!tx) return null;
  const hasPickup = Boolean(tx.pickup_query && tx.pickup_label);
  const hasDrop = Boolean(tx.dropoff_query && tx.dropoff_label);
  return h('div', { class: 'taxi-alt-box' },
    h('p', { class: 'eyebrow' }, 'Taxi alternative'),
    tx.when ? h('p', { class: 'taxi-alt-when' }, tx.when) : null,
    (hasPickup || hasDrop) ? h('div', { class: 'taxi-alt-maps' },
      hasPickup ? ext(dirUrl(tx.pickup_query, 'walking'),
        [icon('pin'), h('span', null, `Pickup: ${tx.pickup_label}`)],
        { class: 'btn btn-gray btn-small', 'aria-label': `Pickup map: ${tx.pickup_label}` }) : null,
      hasDrop ? ext(dirUrl(tx.dropoff_query, 'driving'),
        [icon('car'), h('span', null, `Drop-off: ${tx.dropoff_label}`)],
        { class: 'btn btn-tinted btn-small', 'aria-label': `Drop-off map: ${tx.dropoff_label}` }) : null) : null,
    tx.jp_dest ? h('div', { class: 'taxi-alt-jp-wrap' },
      h('p', { class: 'taxi-inline-jp', lang: 'ja' }, tx.jp_dest),
      h('div', { class: 'taxi-alt-jp-actions' },
        copyTextButton(tx.jp_dest, 'Copy Japanese', `Copy Japanese destination for ${tx.dropoff_label || 'taxi'}`),
        dayIso ? link(withParam(curV, 'taxi', `trv:${dayIso}:${idx}`), { class: 'btn btn-gray btn-small', 'data-key': `trv-drv-${dayIso}-${idx}` },
          icon('car'), h('span', null, 'Driver screen')) : null)) : null,
    tx.fallback ? h('p', { class: 'taxi-alt-fallback' }, tx.fallback) : null);
}

function travelCard(c, dayIso = '', idx = 0) {
  const curV = ctx.route.v || (dayIso ? `days/${dayIso}` : 'today');
  const hasSteps = Array.isArray(c.steps) && c.steps.length > 0;
  const legacyRows = !hasSteps ? [
    kvStack('Station & entrance', c.station_entrance),
    kvStack('Operator & line', c.operator_line),
    kvStack('Destination & signage', c.signage),
    kvStack('Transfers', c.transfers),
    kvStack('Arrival exit & last mile', c.arrival_exit),
  ].filter(Boolean) : [];
  const moreRows = [
    kvStack('Fare & IC / tickets', c.fare_booking),
    !c.taxi_alt && c.taxi_tip ? kvStack('Taxi tip', c.taxi_tip) : null,
    kvStack('Watch-out & exceptions', c.caveat),
  ].filter(Boolean);
  const extLinks = (c.links || [])
    .filter((lk) => lk && lk.url && lk.label)
    .map((lk) => ext(lk.url, [icon('link'), h('span', null, lk.label)], { class: 'text-btn small' }));
  const timeLine = [
    c.door_to_door ? `Door-to-door: ${c.door_to_door}` : '',
    c.in_vehicle ? `In-vehicle: ${c.in_vehicle}` : '',
  ].filter(Boolean).join(' \u00b7 ');
  const isOpenDefault = c.open !== undefined ? Boolean(c.open) : c.recommended !== false;
  const destTarget = c.from_here_dest || c.route_dest || '';
  const destLabel = c.dest_label || c.route_dest || c.title;
  return h('details', { class: `disclosure travel-card ${c.recommended ? 'is-recommended' : 'is-variant'}`, open: isOpenDefault },
    h('summary', { class: 'travel-summary' },
      h('span', { class: 'travel-summary-body' },
        h('span', { class: 'travel-chips' },
          c.stage ? chip(c.stage, 'plain', MODE_ICON[c.route_mode || 'transit'] || 'train') : null,
          c.badge ? chip(c.badge, c.recommended ? 'ev ev-certified' : 'next') : null),
        h('span', { class: 'travel-title' }, c.title),
        timeLine ? h('span', { class: 'travel-times nums' }, timeLine) : null)),
    h('div', { class: 'disclosure-pad travel-body' },
      c.summary ? h('p', { class: 'body' }, c.summary) : null,
      destTarget ? fromHereActionRow(destTarget, destLabel, c.route_mode || 'transit', {
        primaryFilled: false,
        pointOrigin: c.route_origin || '',
        pointDest: c.route_dest || '',
        pointLabel: c.p2p_label || c.route_label || destLabel,
      }) : null,
      hasSteps ? h('ol', { class: 'route-steps' }, c.steps.map((st, si) => travelStepRow(st, si))) : null,
      legacyRows.length ? grouped(legacyRows, 'kv-list travel-kv') : null,
      c.taxi_alt ? taxiAltBox(c.taxi_alt, dayIso, idx, curV) : null,
      (moreRows.length || extLinks.length) ? h('details', { class: 'disclosure travel-more' },
        h('summary', null, h('span', { class: 'summary-label' }, 'Fares, watch-outs & operator links')),
        moreRows.length ? grouped(moreRows, 'kv-list travel-kv') : null,
        extLinks.length ? h('div', { class: 'disclosure-pad travel-links' }, ...extLinks) : null) : null));
}

function travelCardsSection(d) {
  const list = d.travel_cards || [];
  if (!list.length) return null;
  return h('section', { class: 'group', id: 'day-travel', 'aria-labelledby': 'day-travel-title' },
    h('h2', { class: 'group-title', id: 'day-travel-title' }, 'Door-to-door travel'),
    d.travel_intro ? h('p', { class: 'travel-intro' }, d.travel_intro) : null,
    h('div', { class: 'travel-stack' }, list.map((c, idx) => travelCard(c, d.iso, idx))));
}

function dayDetail(d, i) {
  const t = ctx.trip;
  const v = `days/${d.iso}`;
  const isToday = d.iso === now().iso;
  const nn = isToday ? nowNext(d, now().minutes) : { now: null };
  const watch = d.watch_outs || [];
  const dayConfirmed = confirmedBookingsForDay(t, d.iso);
  const transferConfirmed = dayConfirmed.filter((b) => b.kind === 'transfer');
  const openText = activeDayOpen(t, d);
  const decisions = activeDayDecisions(t, d);
  const bookingsByZone = new Map();
  dayConfirmed.forEach((b) => {
    const zi = bookingZoneIndex(d, b);
    if (zi >= 0) {
      if (!bookingsByZone.has(zi)) bookingsByZone.set(zi, []);
      bookingsByZone.get(zi).push(b);
    }
  });
  const bookingsByFlow = new Map();
  dayConfirmed.forEach((b) => {
    const fi = flowBookingIndex(d, b);
    if (fi >= 0) {
      if (!bookingsByFlow.has(fi)) bookingsByFlow.set(fi, []);
      bookingsByFlow.get(fi).push(b);
    }
  });
  const flowLabelsByZone = new Map();
  (d.flow || []).forEach((f) => {
    const zi = flowZoneIndex(d, f);
    if (zi >= 0 && f.when) {
      if (!flowLabelsByZone.has(zi)) flowLabelsByZone.set(zi, []);
      flowLabelsByZone.get(zi).push(f.when);
    }
  });
  const fp = dayForwardSummary(t, d);
  const header = h('header', { class: 'day-head', tabindex: '0', 'aria-label': `${d.date}, ${d.title}. Use left and right arrow keys for other days.`, onkeydown: (e) => {
    const nd = e.key === 'ArrowLeft' ? t.days[i - 1] : e.key === 'ArrowRight' ? t.days[i + 1] : null;
    if (nd) { e.preventDefault(); lastFocus = 'day-head'; go(`days/${nd.iso}`); }
  }, 'data-key': 'day-head' },
  h('p', { class: 'eyebrow' }, [`Day ${i + 1} of ${t.days.length}`, d.wkd ? 'Weekend' : '', fp.theme].filter(Boolean).join(' \u00b7 ')),
  h('h1', { class: 'day-title', id: 'view-title', 'aria-live': 'polite' }, d.title),
  h('p', { class: 'day-place' }, `${d.date} \u00b7 ${d.place}`),
  h('div', { class: 'chips' },
    isToday ? chip('Today', 'now') : null,
    typeChip(d.type),
    chip(LOAD[d.load], 'plain'),
    d.walk ? chip(`Walking: ${d.walk}`, 'plain', 'figureWalk') : null));
  const planBrief = (d.core_plan || fp.tentative.length) ? grouped([
    d.core_plan ? kvStack('Core plan', fp.corePlan) : null,
    fp.tentative.length ? kvStack('Tentative & optional (unbooked)', fp.tentative.join(' \u00b7 ')) : null,
  ], 'kv-list day-plan-brief') : null;
  const itineraryOverview = d.flow && d.flow.length ? h('ol', { class: 'flow itinerary-overview' }, d.flow.map((f, fi) => {
    const zi = flowZoneIndex(d, f);
    const z = zi >= 0 ? d.zones[zi] : null;
    const fBookings = bookingsByFlow.get(fi) || [];
    return h('li', { class: `flow-item lvl-${f.level}` },
      h('div', { class: 'flow-when-col' },
        h('span', { class: 'flow-when' }, f.when),
        h('span', { class: `flow-pace lvl-${f.level}` }, FLOW_LEVEL[f.level])),
      h('div', { class: 'flow-body' },
        h('span', { class: 'flow-text' }, f.text),
        fBookings.length ? h('div', { class: 'flow-bookings' }, fBookings.map((b) =>
          chip(['Confirmed', b.time, b.venue].filter(Boolean).join(' \u00b7 '), 'ev ev-certified', 'checkCircle'))) : null,
        z ? h('button', {
          type: 'button',
          class: 'flow-jump',
          onclick: () => jumpToZone(zi),
          'aria-label': `Jump to Zone ${zi + 1}, ${z.name}`,
        }, h('span', { class: 'flow-jump-num nums', 'aria-hidden': 'true' }, String(zi + 1)), h('span', { class: 'flow-jump-name' }, z.name), icon('chevronRight', null, 'chevron')) : null));
  })) : null;
  const isAirportBoundary = i === 0 || i === t.days.length - 1;
  const activeZi = nn.now !== null && nn.now !== undefined ? nn.now : 0;
  const activeZone = d.zones?.[activeZi] || null;
  const activeGt = activeZone?.getting_there || {};
  const leadStartBooking = (bookingsByZone.get(activeZi) || [])[0] || dayConfirmed[0] || null;
  const startDestQuery = (leadStartBooking && activeZi === 0 && (leadStartBooking.maps_query || leadStartBooking.venue))
    || activeGt.maps_query
    || d.travel_cards?.[0]?.from_here_dest
    || d.travel_cards?.[0]?.route_dest
    || activeZone?.name
    || t.hotel.maps_query;
  const startDestName = (leadStartBooking && activeZi === 0 && leadStartBooking.venue)
    || activeGt.arrive_at
    || activeZone?.name
    || d.title;
  const startMode = activeGt.mode || d.travel_cards?.[0]?.route_mode || 'transit';
  const nextStepStrip = startDestQuery ? h('div', { class: 'card next-step-card' },
    h('p', { class: 'eyebrow' }, isToday && nn.now !== null ? `Active now \u00b7 Zone ${activeZi + 1}` : `First stop \u00b7 ${activeZone?.time || d.date}`),
    h('p', { class: 'next-step-title' }, startDestName),
    activeZone?.short_route ? h('p', { class: 'meta' }, activeZone.short_route) : null,
    fromHereActionRow(startDestQuery, startDestName, startMode, { primaryFilled: true }),
    d.travel_cards?.length ? h('button', {
      type: 'button',
      class: 'flow-jump travel-top-jump',
      onclick: () => jumpToTravel(),
    }, icon('train'), h('span', null, `Step-by-step travel (${d.travel_cards.length})`), icon('chevronRight', null, 'chevron')) : null) : null;
  return h('div', { class: 'day-detail' },
    dayJumpStrip(i),
    isAirportBoundary ? documentShortcut() : null,
    header,
    h('p', { class: 'body lead' }, d.short_summary || d.summary),
    planBrief,
    nextStepStrip,
    dayAreaBar(d),
    dayConfirmed.length ? section('Confirmed', h('div', { class: 'bookings-stack' }, dayConfirmed.map((b) => confirmedBookingCard(b, { day: d, v })))) : null,
    notBookedNote(d.iso),
    openText ? h('p', { class: 'callout' }, icon('question'), h('span', null, h('strong', null, 'To decide: '), openText)) : null,
    h('div', { class: 'day-layout' },
      h('div', { class: 'day-primary' },
        section('The day',
          d.route_strategy ? h('details', { class: 'disclosure route-top-disc' },
            h('summary', null, h('span', { class: 'summary-label' }, 'Route & pacing')),
            h('div', { class: 'disclosure-pad strategy-card' }, h('p', { class: 'body' }, d.route_strategy))) : null,
          itineraryOverview,
          d.zones.length ? h('div', { class: 'itinerary-stages' }, d.zones.map((z, zi) => zoneCard(d, z, zi, v, flowLabelsByZone.get(zi) || [], bookingsByZone.get(zi) || [], nn.now === zi))) : null),
        travelCardsSection(d),
        section('End of the day', h('div', { class: 'card' },
          transferConfirmed.length ? h('div', { class: 'chips' }, transferConfirmed.map((b) =>
            chip(['Confirmed transfer', b.time, b.venue].filter(Boolean).join(' \u00b7 '), 'ev ev-certified', 'checkCircle'))) : null,
          h('p', { class: 'body' }, d.home.how),
          fromHereActionRow(d.home.maps_query || t.hotel.maps_query, t.hotel.name || 'the hotel', hotelReturnMode(d)),
          h('div', { class: 'end-hotel-actions' },
            copyTextButton([t.hotel.name_jp, t.hotel.address_jp].filter(Boolean).join(' '), 'Copy hotel Japanese', 'Copy hotel Japanese address'),
            link(withParam(v, 'taxi', 'hotel'), { class: 'btn btn-gray btn-small', 'data-key': `end-taxi-${d.iso}` }, icon('car'), h('span', null, 'Hotel driver screen'))),
          goButtons(d.home.maps_query || t.hotel.maps_query, 'the hotel', d.home.mode),
          d.home.source ? ext(d.home.source, [icon('link'), h('span', null, 'Source')], { class: 'text-btn' }) : null))),
      h('div', { class: 'day-secondary' },
        section('Practical notes & options',
          d.spa_options && d.spa_options.length ? h('details', { class: 'disclosure', id: 'day-spa' },
            h('summary', null, h('span', { class: 'summary-label' }, `Optional massage, facial & spa (${d.spa_options.length})`)),
            d.spa_intro ? h('div', { class: 'disclosure-pad' }, h('p', { class: 'body' }, d.spa_intro)) : null,
            spaOptionsContent(d)) : null,
          d.logistics && d.logistics.length ? h('details', { class: 'disclosure' },
            h('summary', null, h('span', { class: 'summary-label' }, `Entrances, tickets & practical logistics (${d.logistics.length})`)),
            grouped(d.logistics.map((x) => kvStack(x.label, x.value)), 'kv-list')) : null,
          d.rain_plan && (Array.isArray(d.rain_plan) ? d.rain_plan.length : d.rain_plan) ? h('details', { class: 'disclosure' },
            h('summary', null, h('span', { class: 'summary-label' }, 'Rain & low-energy alternatives')),
            Array.isArray(d.rain_plan)
              ? h('ul', { class: 'bullets' }, d.rain_plan.map((r) => h('li', null, r)))
              : h('div', { class: 'disclosure-pad' }, h('p', { class: 'body' }, d.rain_plan))) : null),
        section('Good to know', d.pacing ? h('p', { class: 'note' }, icon('figureWalk'), h('span', null, d.pacing)) : null,
          watch.length ? h('ul', { class: 'bullets warn' }, watch.slice(0, 2).map((w) => h('li', null, w))) : null,
          watch.length > 2 ? h('details', { class: 'disclosure' }, h('summary', null, `${watch.length - 2} more watch-outs`), h('ul', { class: 'bullets warn' }, watch.slice(2).map((w) => h('li', null, w)))) : null),
        decisions.length ? section('Questions to settle', h('ul', { class: 'bullets' }, decisions.map((w) => h('li', null, w)))) : null,
        (d.sources.length || d.checked_on) ? section('Sources',
          d.checked_on ? h('p', { class: 'caption' }, `Checked ${d.checked_on}`) : null,
          d.sources.length ? h('details', { class: 'disclosure' }, h('summary', null, `${d.sources.length} ${d.sources.length === 1 ? 'source' : 'sources'}`), h('ul', { class: 'sources' }, d.sources.map((s) => h('li', null, ext(s, sourceLabel(s)))))) : null) : null)),
    h('nav', { class: 'day-pager', 'aria-label': 'Other days' },
      i > 0 ? link(`days/${t.days[i - 1].iso}`, { class: 'btn btn-gray' }, icon('chevronLeft'), h('span', { class: 'pager-text' }, `${t.days[i - 1].date} \u00b7 ${t.days[i - 1].title}`)) : h('span'),
      i < t.days.length - 1 ? link(`days/${t.days[i + 1].iso}`, { class: 'btn btn-gray' }, h('span', { class: 'pager-text' }, `${t.days[i + 1].date} \u00b7 ${t.days[i + 1].title}`), icon('chevronRight')) : h('span')));
}

function sourceLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function zoneCard(d, z, zi, v, phaseLabels = [], zBookings = [], isNow = false) {
  const gt = z.getting_there || {};
  const items = cache.places.filter((p) => p.dayISO === d.iso && p.zone === z.name);
  const diningBookings = zBookings.filter((b) => !b.kind || b.kind === 'dining' || b.kind === 'restaurant' || Boolean(b.meal));
  const confirmedNames = new Set(diningBookings.flatMap((b) => [normKey(b.venue), b.place_match ? normKey(b.place_match) : ''].filter(Boolean)));
  const by = (k) => items.filter((p) => p.kind === k && !(k === 'eat' && confirmedNames.has(normKey(p.name))));
  const eatMeal = diningBookings.length === 1 && diningBookings[0].meal ? diningBookings[0].meal : '';
  const eatLabel = diningBookings.length
    ? (eatMeal === 'dinner' ? 'Optional dinner alternatives'
      : eatMeal === 'lunch' ? 'Optional lunch alternatives'
        : eatMeal === 'breakfast' ? 'Optional breakfast alternatives'
          : 'Optional dining alternatives')
    : 'Eat';
  const zeroSightsUnbooked = by('stops').length === 0 && zBookings.length === 0;
  const autoOpenKind = zeroSightsUnbooked
    ? ((d.type === 'shop' && by('shop').length) ? 'shop' : (by('shop').length && !by('eat').length ? 'shop' : (by('eat').length ? 'eat' : '')))
    : '';
  const disclose = (k, label) => {
    const list = by(k);
    if (!list.length) return null;
    const preview = list.slice(0, 2).map((x) => x.name).join(', ') + (list.length > 2 ? '\u2026' : '');
    return h('details', { class: 'disclosure', open: k === autoOpenKind },
      h('summary', null,
        h('span', { class: 'summary-label' }, `${label} (${list.length})`, h('span', { class: 'summary-preview' }, ` \u00b7 ${preview}`))),
      grouped(list.map((p) => placeRow(p, v))));
  };
  const gtPreview = [gt.minutes ? `~${gt.minutes} min` : '', gt.fare, gt.arrive_at].filter(Boolean).join(' \u00b7 ');
  const confirmedRows = zBookings.map((b) => {
    const target = normKey(b.place_match || b.venue);
    const matched = items.find((p) => normKey(p.name) === target);
    const selected = matched && route().params.get('p') === matched.id;
    const slotMeta = [formatGuests(b.guests), b.area, b.notes].filter(Boolean).join(' \u00b7 ');
    const inner = h('span', { class: 'row-text' },
      h('span', { class: 'confirmed-slot-chips' },
        chip('Confirmed', 'ev ev-certified', 'checkCircle'),
        b.time ? h('span', { class: 'slot-time nums' }, b.time) : null,
        b.meal && MEAL_LABEL[b.meal] ? h('span', { class: 'slot-meal' }, MEAL_LABEL[b.meal]) : (b.kind === 'transfer' ? h('span', { class: 'slot-meal' }, 'Transfer') : null)),
      h('span', { class: 'row-title' }, b.venue, b.venue_jp ? h('span', { class: 'row-jp', lang: 'ja' }, ` ${b.venue_jp}`) : null),
      slotMeta ? h('span', { class: 'row-sub' }, slotMeta) : null);
    const primaryMode = b.mode || (b.kind === 'transfer' ? 'driving' : 'walking');
    return h('li', { class: 'row confirmed-slot-row' },
      matched
        ? link(withParam(v, 'p', matched.id), { class: 'row-link', 'aria-current': selected ? 'true' : null, 'data-key': `row-${matched.id}` }, inner)
        : h('div', { class: 'row-static' }, inner),
      ext(dirUrl(b.maps_query || b.venue, primaryMode), icon('arrowOut'), { class: 'row-go', 'aria-label': `Directions to ${b.venue}` }));
  });
  const phaseText = phaseLabels.length ? phaseLabels.join(', ') : '';
  const routeRows = [
    z.short_route ? kvStack('Shorter walk', z.short_route) : null,
    z.seating ? kvStack('Seating & rest', z.seating) : null,
  ].filter(Boolean);
  const showSpaJump = d.spa_options && d.spa_options.length > 0 && /spa|scalp|facial|fukushima|walk-in/i.test(`${z.name} ${z.purpose}`);
  return h('section', { class: 'zone card', 'aria-labelledby': `zone-${zi}` },
    h('h3', { class: 'zone-title', id: `zone-${zi}` },
      h('span', { class: 'zone-num', 'aria-hidden': 'true' }, String(zi + 1)),
      h('span', { class: 'zone-name' }, z.name),
      isNow ? chip('Now', 'now') : null,
      z.badge ? chip(z.badge, 'next') : null),
    h('p', { class: 'meta nums' }, [phaseText, z.time].filter(Boolean).join(' \u00b7 ')),
    h('p', { class: 'body' }, z.purpose),
    confirmedRows.length ? grouped(confirmedRows, 'zone-confirmed') : null,
    routeRows.length ? grouped(routeRows, 'kv-list zone-routes') : null,
    z.optional_extension ? h('details', { class: 'disclosure zone-ext-disc' },
      h('summary', null, h('span', { class: 'summary-label' }, 'Optional loop if energy permits')),
      h('div', { class: 'disclosure-pad' }, h('p', { class: 'body' }, z.optional_extension))) : null,
    showSpaJump ? h('button', {
      type: 'button',
      class: 'flow-jump zone-spa-jump',
      onclick: () => jumpToSpa(),
    }, icon('leaf'), h('span', null, `Walk-in spa & facial inquiries (${d.spa_options.length})`), icon('chevronRight', null, 'chevron')) : null,
    gt.how ? h('details', { class: 'disclosure getting-disc' },
      h('summary', null,
        icon(MODE_ICON[gt.mode] || 'train'),
        h('span', { class: 'summary-label' }, 'Getting there', gtPreview ? h('span', { class: 'summary-preview' }, ` \u00b7 ${gtPreview}`) : null)),
      h('div', { class: 'disclosure-pad getting-body' },
        h('p', { class: 'body' }, gt.how),
        metaLine([gt.minutes ? `About ${gt.minutes} min` : '', gt.fare, gt.arrive_at]),
        gt.maps_query ? fromHereActionRow(gt.maps_query, gt.arrive_at || z.name, gt.mode || 'transit', {
          primaryFilled: false,
          pointOrigin: gt.origin_query || (zi === 0 ? ctx.trip.hotel.maps_query : ''),
          pointDest: gt.maps_query,
          pointLabel: gt.origin_label || (zi === 0 ? `Hotel -> ${gt.arrive_at || z.name}` : ''),
        }) : null,
        gt.maps_query ? goButtons(gt.maps_query, gt.arrive_at || z.name, gt.mode) : null)) : null,
    by('stops').length ? h('div', { class: 'zone-kind' }, h('h4', { class: 'kind-title' }, 'See'), grouped(by('stops').map((p) => placeRow(p, v)))) : null,
    z.what_to_look_for ? h('p', { class: 'zone-highlight' }, z.what_to_look_for) : null,
    z.tips && z.tips.length ? h('details', { class: 'disclosure zone-tips' },
      h('summary', null, h('span', { class: 'summary-label' }, `Zone tips & entry details (${z.tips.length})`)),
      h('ul', { class: 'bullets' }, z.tips.map((tip) => h('li', null, tip)))) : null,
    disclose('eat', eatLabel), disclose('sweet', 'Coffee, sweets & rest'), disclose('shop', 'Shop'));
}

// ---------------------------------------------------------------- Food (S8, S9)
function viewFood(r) {
  const t = ctx.trip;
  const catId = r.sub[0] || ctx.prefs.food || 'halal';
  const cat = cache.food.find((c) => c.id === catId) || cache.food[0];
  const base = r.path + (r.params.get('g') ? `?g=${r.params.get('g')}` : '');
  const cats = h('div', { class: 'chip-scroll', role: 'group', 'aria-label': 'Food category' }, cache.food.map((c) =>
    h('button', { type: 'button', class: 'filter-chip', 'aria-pressed': String(c.id === cat.id), 'data-key': `cat-${c.id}`, onclick: () => { lastFocus = `cat-${c.id}`; ctx.setPref('food', c.id); go(`food/${c.id}`); } },
      c.label, h('span', { class: 'count' }, String(c.id === 'halal' ? cache.halal.length : c.items.length)))));
  let list;
  if (cat.id === 'halal') {
    const todayG = t.halal.dayGroup[now().iso];
    const todayGroups = dayHalalGroups(t, now().iso);
    const g = r.params.get('g') || defaultHalalGroup(t, now().iso);
    const certOnly = ctx.prefs.certOnly === true;
    const places = cache.halal.filter((p) => p.g === g && (!certOnly || p.status === 'Halal certified'))
      .sort((a, b) => HALAL_STATUS.indexOf(a.status) - HALAL_STATUS.indexOf(b.status) || (a.walk_min || 99) - (b.walk_min || 99) || a._i - b._i);
    const prayer = cache.prayer.filter((p) => p.g === g);
    const groupLabel = t.halal.groups.find((x) => x.id === g)?.label || g;
    const prayerSection = prayer.length ? section('Prayer rooms', grouped(prayer.map((p) => placeRow(p, base)))) : section('Prayer rooms', h('p', { class: 'empty' }, `No prayer rooms listed for ${groupLabel}. Search Maps for one nearby.`));
    if (prayerSection) prayerSection.id = 'prayer';
    const isApple = ctx.prefs.maps === 'apple';
    list = [
      cats,
      h('div', { class: 'filters' },
        h('label', { class: 'picker' }, h('span', { class: 'picker-label' }, 'Area'),
          h('select', { class: 'select', 'data-key': 'area', onchange: (e) => { lastFocus = 'area'; go(`food/halal?g=${e.target.value}`, { replace: true }); } },
            t.halal.groups.map((x) => h('option', { value: x.id, selected: x.id === g }, x.id === todayG ? `${x.label} (Today)` : todayGroups.includes(x.id) ? `${x.label} (Today)` : x.label)))),
        toggleRow('Certified only', certOnly, (on) => { ctx.setPref('certOnly', on); draw(); })),
      todayGroups.length > 1 ? h('div', { class: 'day-area-bar', role: 'group', 'aria-label': 'Today’s areas' },
        todayGroups.map((tg) => {
          const lbl = t.halal.groups.find((x) => x.id === tg)?.label || tg;
          const focusQ = r.params.get('focus') === 'prayer' ? '&focus=prayer' : '';
          return h('button', { type: 'button', class: `area-link ${tg === g ? 'is-active' : ''}`, onclick: () => go(`food/halal?g=${tg}${focusQ}`, { replace: true }) },
            icon('pin'), h('span', null, lbl));
        })) : null,
      h('div', { class: 'halal-quick-bar' },
        h('p', { class: 'meta nums' }, `${places.length} ${places.length === 1 ? 'place' : 'places'} \u00b7 ${prayer.length} ${prayer.length === 1 ? 'prayer room' : 'prayer rooms'} in ${groupLabel}`),
        h('div', { class: 'halal-quick-actions' },
          ext(mapsUrl('halal restaurant'), [icon('search'), h('span', null, 'Halal near me')], { class: 'btn btn-tinted btn-small', 'aria-label': 'Search Maps for halal restaurants near me' }),
          ext(mapsUrl('prayer room'), [icon('moon'), h('span', null, 'Prayer rooms near me')], { class: 'btn btn-gray btn-small', 'aria-label': 'Search Maps for prayer rooms near me' }),
          isApple ? ext('https://www.google.com/maps/search/?api=1&query=halal%20restaurant', [icon('map'), h('span', null, 'Google Maps: Halal')], { class: 'btn btn-gray btn-small', 'aria-label': 'Search Google Maps for halal restaurants near me' }) : null,
          prayer.length ? h('button', { type: 'button', class: 'btn btn-gray btn-small', onclick: () => document.getElementById('prayer')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }) }, icon('moon'), h('span', null, `Prayer list (${prayer.length})`)) : null)),
      h('details', { class: 'disclosure legend-box' }, h('summary', null, 'What the labels mean'),
        h('ul', { class: 'legend-list' }, HALAL_STATUS.map((s) => h('li', null, halalChip(s), h('span', null, HALAL_MEANING[s]))))),
      h('p', { class: 'caption' }, `Checked ${t.halal.as_of}. Hours and status can change, so confirm on arrival.`),
      places.length ? grouped(places.map((p) => placeRow(p, base))) : h('p', { class: 'empty' }, certOnly ? 'No certified places in this area. Turn off Certified only to see more.' : `No halal places listed for ${groupLabel}. Try another area or search Maps.`),
      prayerSection,
      t.halal.dropped.length ? section('Closed or left out', h('details', { class: 'disclosure' }, h('summary', null, `${t.halal.dropped.length} places checked and left out`),
        h('ul', { class: 'grouped' }, t.halal.dropped.map((x) => h('li', { class: 'kv stack' }, h('span', { class: 'kv-label' }, x.name), h('span', { class: 'kv-value' }, x.reason)))))) : null,
    ];
    if (r.params.get('focus') === 'prayer') queueMicrotask(() => document.getElementById('prayer')?.scrollIntoView({ block: 'start' }));
  } else {
    let items = cat.items;
    const canNear = items.some((x) => x.walk_min), canEarly = items.some((x) => x.opens);
    const sort = ctx.prefs.bsort || 'near';
    if (canNear || canEarly) {
      items = items.slice().sort((x, y) => {
        const n = (x.walk_min || 99) - (y.walk_min || 99), e = (parseHM(x.opens) ?? 9999) - (parseHM(y.opens) ?? 9999);
        return sort === 'early' ? (e || n) : (n || e);
      });
    }
    list = [cats, h('p', { class: 'caption' }, cat.blurb),
      canNear && canEarly ? segmented('Sort', [['near', 'Nearest'], ['early', 'Opens earliest']], sort, (s) => { ctx.setPref('bsort', s); draw(); }) : null,
      items.length ? grouped(items.map((p) => placeRow(p, base))) : h('p', { class: 'empty' }, 'Nothing in this category yet. Try another category.')];
  }
  return { title: 'Food', list: isCompact() ? null : list, listLabel: `${cat.label} list`, main: isCompact() ? list : null, inspector: true, place: findPlace(r.params.get('p')), emptyText: 'Choose a place to see hours, evidence and directions.' };
}

const HALAL_MEANING = {
  'Halal certified': 'A named body certifies it.',
  'Halal (own claim)': 'The restaurant says it is halal. No certifier confirmed.',
  'Halal menu': 'Some dishes are halal. The kitchen may be shared.',
  'Muslim-friendly': 'Adjusted for Muslim guests, but not halal certified.',
  'Not halal: fallback': 'Not halal. Listed only for fish, prawn or vegetarian options.',
};

// ---------------------------------------------------------------- Places (S10)
function viewPlaces(r) {
  const t = ctx.trip;
  const kind = r.params.get('k') || ctx.prefs.kind || 'stops';
  const by = r.params.get('by') || ctx.prefs.by || 'day';
  const q = r.params.get('q') || '';
  const onlyB = ctx.prefs.onlyB !== false;
  const base = withParam(withParam(withParam('places', 'k', kind), 'by', by), 'q', q);
  let items = cache.places.filter((p) => p.kind === kind);
  if (kind === 'eat' && onlyB) items = items.filter((p) => dietKey(p.for_b) !== 'no');
  items = searchPlaces(items, q);
  const groups = new Map();
  for (const p of items) {
    const key = by === 'day' ? p.dayISO : p.zone;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const field = h('input', { class: 'field search', type: 'search', placeholder: 'Search places', 'aria-label': 'Search places', value: q, enterkeyhint: 'search', autocomplete: 'off', 'data-key': 'search',
    onkeydown: (e) => { if (e.key === 'Escape') { e.target.value = ''; lastFocus = 'search'; go(withParam(base, 'q', null), { replace: true }); } } });
  let timer;
  field.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { lastFocus = 'search'; go(withParam(base, 'q', field.value.trim()), { replace: true }); }, 250); });
  const clearBtn = q ? h('button', { type: 'button', class: 'field-btn search-clear', 'aria-label': 'Clear search', onclick: () => { lastFocus = 'search'; go(withParam(base, 'q', null), { replace: true }); } }, icon('xmarkCircle')) : null;
  const todayIso = now().iso;
  const hasTodayGroup = by === 'day' && groups.has(todayIso);
  const list = [
    h('form', { class: 'search-wrap', role: 'search', onsubmit: (e) => e.preventDefault() }, icon('search'), field, clearBtn),
    segmented('Kind', KINDS.map(([k, label]) => [k, label]), kind, (k) => { ctx.setPref('kind', k); go(withParam(base, 'k', k), { replace: true }); }),
    h('div', { class: 'filters' },
      segmented('Group by', [['day', 'Day'], ['area', 'Area']], by, (b) => { ctx.setPref('by', b); go(withParam(base, 'by', b), { replace: true }); }, 'small'),
      kind === 'eat' ? toggleRow(fill(t, 'Works for {B}'), onlyB, (on) => { ctx.setPref('onlyB', on); draw(); }) : null),
    h('div', { class: 'places-status-row' },
      h('p', { class: 'caption', role: 'status' }, `${items.length} ${items.length === 1 ? 'place' : 'places'}${q ? ` matching “${q}”` : ''}`),
      hasTodayGroup ? h('button', { type: 'button', class: 'flow-jump places-today-jump', onclick: () => document.getElementById(`places-day-${todayIso}`)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }) }, icon('calendar'), h('span', null, 'Jump to today')) : null),
    items.length ? [...groups].map(([key, ps]) => {
      const d = by === 'day' ? t.days.find((x) => x.iso === key) : null;
      return h('section', { class: 'group', id: d ? `places-day-${d.iso}` : null },
        h('div', { class: 'group-head' }, h('h2', { class: 'group-title' }, d ? `${d.date} · ${d.title}` : key),
          d ? link(`days/${d.iso}`, { class: 'text-btn small', 'aria-label': `Open day, ${d.date}` }, 'Open day') : null),
        grouped(ps.map((p) => placeRow(p, base))));
    }) : h('p', { class: 'empty' }, q ? `Nothing matches “${q}”. Try a shorter word, or another kind.` : 'Nothing of this kind is planned. Try another kind.'),
  ];
  return { title: 'Places', list: isCompact() ? null : list, listLabel: 'Places list', main: isCompact() ? list : null, inspector: true, place: findPlace(r.params.get('p')), emptyText: 'Choose a place to see its details and directions.' };
}

// ---------------------------------------------------------------- Info (S11, S12, S13)
const PLACED = new Set(['next-up', 'decisions', 'what-we-want', 'sources', 'know-before-you-go', 'bookings', 'shopping-and-tax-refunds', 'getting-around']);

function docSec(id) { return ctx.trip.doc.sections.find((s) => s.id === id); }

function docSection(id, title) {
  const s = docSec(id);
  return s && s.md.trim() ? section(title || s.title, h('div', { class: 'doc' }, markdown(s.md, { onTask: taskToggle }))) : null;
}

function taskToggle(id, doneInSource, label) { // S2: ticks are stored on this device only
  const key = `task:${id}`;
  const done = ctx.prefs[key] ?? doneInSource;
  return h('label', { class: 'task' }, h('span', { class: 'check' }, h('input', { type: 'checkbox', checked: done, onchange: (e) => ctx.setPref(key, e.target.checked) }), icon('check')), h('span', null, label));
}

function guides() {
  return ctx.trip.doc.sections.filter((s) => s.level === 2 && !PLACED.has(s.id) && s.md.trim());
}

function infoTitle(id) {
  const fixed = { documents: 'Documents', 'to-book': 'To book', hotel: 'Hotel', 'getting-around': 'Getting around', bookings: 'Bookings', airport: 'Airport day', 'shopping-and-tax-refunds': 'Tax-free shopping', guides: 'Guides', decisions: 'Decisions', 'next-up': 'Next up', 'what-we-want': 'What we want', sources: 'Sources', app: 'App', taxi: 'Taxi card' };
  if (fixed[id]) return fixed[id];
  const s = docSec(id);
  return s ? s.title : 'Info';
}

function viewInfo(r) {
  const id = r.sub[0];
  const ho = ctx.trip.hotel;
  const hoJp = [ho.name_jp, ho.address_jp].filter(Boolean).join(' ');
  const hasBookings = confirmedBookings(ctx.trip).length > 0;
  const rows = (ids) => grouped(ids.filter((x) => ['hotel', 'airport', 'guides', 'app', 'to-book'].includes(x) || (x === 'bookings' && hasBookings) || (docSec(x) && docSec(x).md.trim())).map((x) => pushRow(`info/${x}`, infoTitle(x))));
  const curbsideCard = !id ? h('div', { class: 'card next-step-card info-curb-card' },
    h('p', { class: 'eyebrow' }, 'Hotel & curbside'),
    h('p', { class: 'next-step-title' }, ho.name || 'Hotel'),
    ho.stations ? h('p', { class: 'meta' }, ho.stations) : null,
    fromHereActionRow(ho.maps_query, ho.name || 'the hotel', hotelReturnMode(null), { primaryFilled: true }),
    h('div', { class: 'end-hotel-actions' },
      hoJp ? copyTextButton(hoJp, 'Copy hotel Japanese', 'Copy hotel Japanese address') : null,
      link('info/taxi', { class: 'btn btn-gray btn-small', 'data-key': 'curb-taxi' }, icon('car'), h('span', null, 'Hotel driver screen')))) : null;
  const list = [
    curbsideCard,
    documentShortcut(),
    section('Stay', grouped([pushRow('info/hotel', 'Hotel', ctx.trip.hotel.name),
      h('li', { class: 'row' }, link('info/taxi', { class: 'row-link', 'data-key': 'show-taxi' }, h('span', { class: 'row-text' }, h('span', { class: 'row-title tint' }, 'Show taxi card')), icon('car', null, 'chevron'))),
      h('li', { class: 'row' }, ext(dirUrl(ctx.trip.hotel.maps_query, hotelReturnMode(null)), [h('span', { class: 'row-text' }, h('span', { class: 'row-title tint' }, 'Back to the hotel')), icon('arrowOut', null, 'chevron')], { class: 'row-link' }))])),
    section('Travel', rows(['to-book', 'bookings', 'getting-around', 'airport', 'shopping-and-tax-refunds'])),
    section('Plan', rows(['guides', 'decisions', 'next-up', 'what-we-want', 'sources'])),
    section('App', rows(['app'])),
  ];
  if (!id) return { title: 'Info', main: list, place: findPlace(r.params.get('p')) };
  let main;
  if (id === 'hotel') main = hotelView();
  else if (id === 'taxi') return { title: 'Info', main: list, overlay: taxiCard() };
  else if (id === 'app') main = appSettings();
  else if (id === 'airport') main = airportDay();
  else if (id === 'documents') main = documentsView();
  else if (id === 'to-book') main = toBookView();
  else if (id === 'bookings') main = bookingsView();
  else if (id === 'guides') main = r.sub[1] ? docView(r.sub[1]) : grouped(guides().map((s) => pushRow(`info/guides/${s.id}`, s.title)));
  else main = docView(id);
  const title = id === 'guides' && r.sub[1] ? infoTitle(r.sub[1]) : infoTitle(id);
  return { title, large: false, back: id === 'guides' && r.sub[1] ? ['info/guides', 'Guides'] : ['info', 'Info'], list, listLabel: 'Info', main: [h('h2', { class: 'section-title' }, title), main], place: findPlace(r.params.get('p')) };
}

function bookingsView() {
  const confirmed = confirmedBookings(ctx.trip);
  const s = docSec('bookings');
  if (!confirmed.length && (!s || !s.md.trim())) return h('p', { class: 'empty' }, 'Reservations will appear here.');
  return [
    confirmed.length ? section('Confirmed reservations', h('div', { class: 'bookings-stack' },
      confirmed.map((b) => confirmedBookingCard(b, { day: dayOf(b.day), v: 'info/bookings', showDayLink: true })))) : null,
    s && s.md.trim() ? (confirmed.length
      ? section('Flights, hotel & notes', h('details', { class: 'disclosure' },
        h('summary', null, h('span', { class: 'summary-label' }, 'Flight numbers, hotel & booking notes')),
        h('div', { class: 'disclosure-pad doc' }, markdown(s.md, { onTask: taskToggle }))))
      : section(null, h('div', { class: 'doc' }, markdown(s.md, { onTask: taskToggle })))) : null,
  ];
}

function documentShortcut() {
  return ctx.trip.documents?.length
    ? grouped([pushRow('info/documents', 'Documents', 'Arrival QR codes, flights, hotels and insurance')])
    : null;
}

function documentsView() {
  const documents = ctx.trip.documents || [];
  if (!documents.length) return h('p', { class: 'empty' }, 'No documents have been added.');
  const groups = [
    ['arrival', 'Arrival QR codes and entry details'],
    ['flights', 'Flights'],
    ['hotels', 'Hotels'],
    ['insurance', 'Travel insurance'],
  ];
  return [
    h('p', { class: 'caption' }, 'In Files, go to iCloud Drive → Travel & Events → Japan 2026. The file paths below start there.'),
    ...groups.map(([key, label]) => {
      const rows = documents.filter((doc) => doc.group === key).map((doc) => {
        const name = h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, doc.title),
          h('span', { class: 'row-sub' }, doc.file));
        return h('li', { class: 'row' }, doc.url
          ? ext(doc.url, [name, icon('arrowOut', null, 'chevron')], { class: 'row-link' })
          : h('div', { class: 'row-link' }, name));
      });
      return rows.length ? section(label, grouped(rows), key === 'arrival'
        ? ext('https://www.vjw.digital.go.jp/', [icon('arrowOut'), 'Open Visit Japan Web'], { class: 'text-btn' })
        : null) : null;
    }),
  ];
}

function docView(id) {
  const s = docSec(id);
  if (!s) return h('p', { class: 'empty' }, 'This section isn’t in the trip data.');
  return h('div', { class: 'doc' }, markdown(s.md, { onTask: taskToggle }));
}

function hotelView() {
  const ho = ctx.trip.hotel;
  const hoJp = [ho.name_jp, ho.address_jp].filter(Boolean).join(' ');
  return [
    fromHereActionRow(ho.maps_query, ho.name || 'the hotel', hotelReturnMode(null)),
    hoJp ? h('div', { class: 'end-hotel-actions' }, copyTextButton(hoJp, 'Copy hotel Japanese', 'Copy hotel Japanese address')) : null,
    link('info/taxi', { class: 'btn btn-filled', 'data-key': 'show-taxi-2' }, icon('car'), 'Show Taxi Card'),
    grouped([kv('Name', ho.name), ho.name_jp ? h('li', { class: 'kv' }, h('span', { class: 'kv-label' }, 'In Japanese'), h('span', { class: 'kv-value', lang: 'ja' }, ho.name_jp)) : null,
      kv('Address', ho.address), kv('Check-in', ho.checkin), kv('Check-out', ho.checkout), kv('Stations', ho.stations),
      ho.phone ? h('li', { class: 'kv' }, h('span', { class: 'kv-label' }, 'Phone'), ext(`tel:${ho.phone.replace(/\s/g, '')}`, ho.phone, { class: 'text-btn small' })) : null], 'kv-list'),
    goButtons(ho.maps_query, 'the hotel', 'transit'),
  ];
}

function driverCardView({ label = 'Taxi card', nameJp = '', addrJp = '', nameEn = '', addrEn = '', phone = '', query = '', pickupLabel = '', pickupQuery = '', fallbackNote = '', walkInNoteJp = '', walkInNoteEn = '' }, onClose) {
  const jpCopy = [nameJp, addrJp].filter(Boolean).join(' ');
  const card = h('div', { class: 'taxi', role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1', onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } } },
    h('div', { class: 'taxi-bar' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: onClose }, 'Close')),
    h('div', { class: 'taxi-body' },
      h('p', { class: 'taxi-eyebrow' }, 'Please take me to'),
      h('p', { class: 'taxi-eyebrow', lang: 'ja' }, 'こちらまでお願いします'),
      nameJp ? h('p', { class: 'taxi-jp', lang: 'ja' }, nameJp) : null,
      addrJp ? h('p', { class: 'taxi-addr', lang: 'ja' }, addrJp) : null,
      nameEn ? h('p', { class: 'taxi-en' }, nameEn) : null,
      addrEn ? h('p', { class: 'taxi-en' }, addrEn) : null,
      h('div', { class: 'taxi-actions' },
        jpCopy ? copyTextButton(jpCopy, 'Copy Japanese', `Copy Japanese address for ${nameEn || 'destination'}`) : null,
        pickupQuery && pickupLabel ? ext(dirUrl(pickupQuery, 'walking'), [icon('pin'), h('span', null, `Pickup: ${pickupLabel}`)], { class: 'btn btn-gray btn-small', 'aria-label': `Pickup map: ${pickupLabel}` }) : null,
        phone ? ext(`tel:${phone.replace(/\s/g, '')}`, [icon('phone'), h('span', null, phone)], { class: 'btn btn-gray btn-small' }) : null),
      h('p', { class: 'taxi-fallback' }, fallbackNote || 'Show this screen at a signed taxi rank, or tap Copy Japanese to paste into GO / Uber if destination prefill fails.'),
      walkInNoteJp ? h('div', { class: 'taxi-note' },
        h('p', { class: 'taxi-eyebrow' }, walkInNoteEn || 'For salon reception (walk-in inquiry)'),
        h('p', { class: 'taxi-addr', lang: 'ja' }, walkInNoteJp),
        copyTextButton(walkInNoteJp, 'Copy Japanese inquiry', 'Copy Japanese walk-in inquiry')) : null),
    h('div', { class: 'taxi-foot' },
      fromHereActionRow(query || nameEn, nameEn || 'destination', 'driving', { primaryFilled: true }),
      goButtons(query || nameEn, nameEn || 'destination', 'driving')));
  queueMicrotask(() => card.focus());
  return card;
}

function taxiCard(onClose = () => go('info')) { // S12
  const ho = ctx.trip.hotel;
  return driverCardView({
    label: 'Taxi card',
    nameJp: ho.name_jp,
    addrJp: ho.address_jp,
    nameEn: ho.name,
    addrEn: ho.address,
    phone: ho.phone,
    query: ho.maps_query,
  }, onClose);
}

function driverCardFromParam(r) {
  const spec = r.params.get('taxi') || '';
  const close = () => go(withParam(ctx.route.v || 'today', 'taxi', null));
  if (!spec || spec === 'hotel') return taxiCard(close);
  if (spec.startsWith('bk:')) {
    const id = spec.slice(3);
    const b = confirmedBookings(ctx.trip).find((x) => x.id === id);
    if (!b) return taxiCard(close);
    return driverCardView({
      label: `Driver card: ${b.venue}`,
      nameJp: b.venue_jp || '',
      addrJp: b.address_jp || '',
      nameEn: b.venue,
      addrEn: [b.area, b.time ? `Reservation ${b.time}` : ''].filter(Boolean).join(' \u00b7 '),
      query: b.maps_query || b.venue,
    }, close);
  }
  if (spec.startsWith('pl:')) {
    const p = findPlace(spec.slice(3));
    if (!p) return taxiCard(close);
    return driverCardView({
      label: `Driver card: ${p.name}`,
      nameJp: p.jp || '',
      addrJp: p.address_jp || '',
      nameEn: p.name,
      addrEn: p.where || p.area || p.zone || '',
      query: p.maps_query || p.name,
    }, close);
  }
  if (spec.startsWith('spa:')) {
    const [, iso, rawIdx] = spec.split(':');
    const d = dayOf(iso);
    const s = d?.spa_options?.[Number(rawIdx)];
    if (!s) return taxiCard(close);
    return driverCardView({
      label: `Driver card: ${s.name}`,
      nameJp: s.jp || '',
      addrJp: s.address_jp || '',
      nameEn: s.name,
      addrEn: s.area || '',
      query: s.maps_query || s.name,
      walkInNoteEn: s.inquiry_label || '',
      walkInNoteJp: s.inquiry_jp || '',
    }, close);
  }
  if (spec.startsWith('trv:')) {
    const [, iso, rawIdx] = spec.split(':');
    const d = dayOf(iso);
    const tx = d?.travel_cards?.[Number(rawIdx)]?.taxi_alt;
    if (!tx) return taxiCard(close);
    return driverCardView({
      label: `Driver card: ${tx.dropoff_label || 'Taxi drop-off'}`,
      nameJp: tx.jp_dest || '',
      addrJp: tx.jp_addr || '',
      nameEn: tx.dropoff_label || '',
      addrEn: tx.when || '',
      query: tx.dropoff_query || tx.dropoff_label,
      pickupLabel: tx.pickup_label || '',
      pickupQuery: tx.pickup_query || '',
      fallbackNote: tx.fallback || '',
    }, close);
  }
  return taxiCard(close);
}

function airportDay() {
  const t = ctx.trip;
  const first = t.days[0], last = t.days[t.days.length - 1];
  const transfers = confirmedBookings(t).filter((b) => b.kind === 'transfer');
  const ga = docSec('getting-around');
  const airportRows = ga ? ga.md.split('\n').filter((l, i, a) => /^\|/.test(l) && (i < 2 || /\bKIX\b|airport/i.test(l))).join('\n') : '';
  const bookings = docSec('bookings');
  const flights = bookings ? bookings.md.split('\n').filter((l) => /^\|/.test(l)).join('\n').split(/\n(?=\| Hotel)/)[0] : '';
  const airportDest = last?.travel_cards?.[0]?.from_here_dest
    || transfers.find((b) => b.day === last?.iso)?.maps_query
    || first?.zones?.[0]?.getting_there?.maps_query || '';
  const airportLabel = last?.travel_cards?.[0]?.dest_label
    || first?.zones?.[0]?.getting_there?.arrive_at || 'the airport';
  return [
    airportDest ? h('div', { class: 'card next-step-card' },
      h('p', { class: 'eyebrow' }, 'Airport navigation'),
      h('p', { class: 'next-step-title' }, airportLabel),
      fromHereActionRow(airportDest, airportLabel, 'driving', { primaryFilled: true })) : null,
    documentShortcut(),
    transfers.length ? section('Confirmed airport transfers', h('div', { class: 'bookings-stack' },
      transfers.map((b) => confirmedBookingCard(b, { day: dayOf(b.day), v: 'info/airport', showDayLink: true })))) : null,
    section('Arrival and departure', grouped([pushRow(`days/${first.iso}`, first.title, first.date), pushRow(`days/${last.iso}`, last.title, last.date)])),
    flights ? section('Flights', h('details', { class: 'disclosure', open: !transfers.length },
      h('summary', null, h('span', { class: 'summary-label' }, 'Flight schedule notes')),
      h('div', { class: 'disclosure-pad doc' }, markdown(flights)))) : null,
    airportRows ? section('Airport transfers', h('details', { class: 'disclosure' },
      h('summary', null, h('span', { class: 'summary-label' }, 'Rail & fallback airport routes')),
      h('div', { class: 'disclosure-pad doc' }, markdown(airportRows)))) : null,
    h('p', { class: 'caption' }, 'From the bookings and getting-around notes. Flight times change: the airline app is the source of truth.'),
  ];
}

function appSettings() { // S13
  const p = ctx.prefs;
  const linkField = h('input', { class: 'field', type: 'url', id: 'newlink', placeholder: 'Paste a new private link', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const linkStatus = h('p', { class: 'lock-status', role: 'status' });
  const inviteUrl = ctx.getInviteUrl ? ctx.getInviteUrl() : '';
  return [
    section('Privacy & invite', grouped([
      h('li', { class: 'kv' }, toggleRow('Keep unlocked on this device', p.remember !== false, async (on) => { await ctx.setRemember(on); draw(); })),
      kv('Invite link status', inviteUrl ? 'Complete private link active' : 'Opened from saved device key'),
    ]),
    inviteUrl ? h('div', { class: 'invite-actions' }, copyTextButton(inviteUrl, 'Copy invite link', 'Copy private invite link to clipboard')) : h('p', { class: 'caption' }, 'To share with a new device, paste the full #k= invite link below first.'),
    h('p', { class: 'caption' }, 'When Keep unlocked is on, this device opens the trip without re-entering the password. Lock now forgets the stored key.'),
    grouped([h('li', { class: 'row' }, h('button', { class: 'row-link row-button', type: 'button', onclick: () => ctx.lockNow() }, icon('lock'), h('span', { class: 'row-text' }, h('span', { class: 'row-title tint' }, 'Lock now'))))])),
    section('Appearance', segmented('Appearance', [['light', 'Light'], ['auto', 'Automatic'], ['dark', 'Dark']], p.appearance || window.osakaTheme.DEFAULT,
      (v) => { ctx.setPref('appearance', window.osakaTheme.apply(v)); draw(); }),
      h('p', { class: 'caption' }, 'Automatic follows the iPhone or iPad setting.')),
    section('Maps', grouped([h('li', { class: 'kv' }, h('label', { class: 'kv-label', for: 'maps' }, 'Open places in'),
      h('select', { id: 'maps', class: 'select', 'data-key': 'maps', onchange: (e) => { lastFocus = 'maps'; ctx.setPref('maps', e.target.value); draw(); } },
        h('option', { value: 'google', selected: p.maps !== 'apple' }, 'Google Maps'), h('option', { value: 'apple', selected: p.maps === 'apple' }, 'Apple Maps')))])),
    section('Add to Home Screen', h('ol', { class: 'steps' }, h('li', null, 'In Safari, tap the Share button.'), h('li', null, 'Choose Add to Home Screen, then Add.'), h('li', null, 'Open it from the Home Screen and enter the password once.'))),
    section('Offline and data', grouped([kv('Status', ctx.online ? 'Online' : 'Offline, using the saved copy'), kv('Trip data version', ctx.env && ctx.env.rev),
      kv('Halal list checked', ctx.trip.halal.as_of), kv('Plan notes', ctx.trip.meta.notes)], 'kv-list')),
    section('Update trip link', h('form', { class: 'lock-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!(await ctx.replaceLink(linkField.value))) linkStatus.textContent = 'That isn’t a complete trip link.';
    } }, h('label', { class: 'sr-only', for: 'newlink' }, 'New private link'), linkField, h('button', { class: 'btn btn-gray', type: 'submit' }, 'Use This Link')), linkStatus),
    section('About', h('p', { class: 'body' }, 'The trip is stored encrypted. Opening it needs both the private link and the password, and decryption happens only on this device. Search engines are asked not to index the site. There are no analytics or trackers.')),
  ];
}

// ---------------------------------------------------------------- Install hint (U5) and offline guard (U7)
function maybeInstallHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || ctx.prefs.installHintShown) return;
  const close = () => { ctx.setPref('installHintShown', true); sheet.remove(); scrim.remove(); };
  const scrim = h('div', { class: 'scrim', onclick: close });
  const sheet = h('aside', { class: 'sheet hint', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add to Home Screen', 'data-detent': 'medium', tabindex: '-1', onkeydown: (e) => { if (e.key === 'Escape') close(); } },
    h('div', { class: 'hint-icon', 'aria-hidden': 'true' }, icon('plusApp')),
    h('h2', { class: 'place-title' }, 'Keep the trip on your Home Screen'),
    h('ol', { class: 'steps' }, h('li', null, 'Tap Share in Safari.'), h('li', null, 'Choose Add to Home Screen.')),
    h('p', { class: 'body' }, 'It opens full screen and works offline. The first launch asks for the password once.'),
    h('button', { class: 'btn btn-filled', type: 'button', onclick: close }, 'Got It'));
  document.body.append(scrim, sheet);
  queueMicrotask(() => sheet.focus());
}

function offlineGuard(e) {
  const a = e.target.closest && e.target.closest('a[target="_blank"]');
  if (!a || navigator.onLine) return;
  e.preventDefault();
  const t = h('div', { class: 'toast', role: 'status' }, icon('wifiSlash'), h('span', null, 'This needs a connection. You’re offline.'));
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

const VIEWS = { today: viewToday, days: viewDays, food: viewFood, places: viewPlaces, info: viewInfo };
