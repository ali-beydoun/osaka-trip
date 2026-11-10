// Rendering: lock screen, adaptive shell and the five destinations.
// Contract: design/05-implementation-contract.md (item ids in comments).
import { h, ext, icon, markdown } from './dom.js';
import {
  DAY_TYPE, LOAD, MODE, FLOW_LEVEL, KINDS, HALAL_STATUS, HALAL_KEY, dietKey, walkCaption, resolveNow, tripPhase,
  nowNext, allPlaces, foodCategories, halalPlaces, prayerRooms, defaultHalalGroup, dayHalalGroups, fill, searchPlaces, parseHM,
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
  const status = h('p', { class: 'lock-status', role: 'status', 'aria-live': 'polite' });
  const card = h('main', { class: 'lock', id: 'main' },
    h('div', { class: 'lock-mark', 'aria-hidden': 'true' }, icon('lock')),
    h('h1', { class: 'lock-title' }, 'Osaka Trip'));

  if (opts.state === 'offline-first') {
    card.append(
      h('p', { class: 'lock-body' }, 'You’re offline, and this device hasn’t opened the trip before. Connect once to download it. After that it works offline.'),
      h('button', { class: 'btn btn-filled', type: 'button', onclick: opts.onRetry }, icon('reload'), 'Try Again'));
  } else if (opts.state === 'missing-link') {
    const field = h('input', { class: 'field', id: 'link', type: 'url', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'url', enterkeyhint: 'go', placeholder: 'https://…#k=…' });
    const form = h('form', { class: 'lock-form', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      if (!opts.onPasteLink(field.value)) { status.textContent = 'That isn’t a complete trip link. Copy the whole link, including the part after #.'; field.focus(); }
    } },
    h('label', { class: 'lock-label', for: 'link' }, 'Private trip link'),
    field,
    h('button', { class: 'btn btn-filled', type: 'submit' }, 'Continue'));
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
    card.append(h('p', { class: 'lock-body' }, 'Enter the trip password to open the plan.'), form, status,
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
  const depth = (r) => r.sub.length + (r.params.get('p') ? 1 : 0) + (r.params.get('sheet') ? 1 : 0);
  const dir = !sameTab ? 'none' : depth(next) > depth(prev) ? 'push' : depth(next) < depth(prev) ? 'pop' : 'swap';
  const onlySheet = sameTab && prev.path === next.path && (prev.params.get('p') !== next.params.get('p'));
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
  const shell = h('div', { class: `shell tab-${r.tab}`, 'data-sidebar': sidebarState(), 'data-detail': place ? 'yes' : 'no' },
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
    view.overlay || null);
  root().replaceChildren(shell);
  const prevPlace = sheetOpener !== null;
  if (place && !prevPlace) sheetOpener = lastFocus || '';
  if (!place && prevPlace) { lastFocus = sheetOpener || null; sheetOpener = null; }
  if (place) trapSheet();
  document.title = view.title ? `${view.title} · Osaka Trip` : 'Osaka Trip';
  lastV = ctx.route.v;
  // Scroll and focus (N3, N6, L7)
  const saved = scrollMemory.get(ctx.route.v);
  if (dir === 'none' || dir === 'push' || dir === 'swap') window.scrollTo(0, dir === 'none' && saved ? saved : 0);
  else if (dir === 'pop' && saved !== undefined) window.scrollTo(0, saved);
  onScroll();
  if (!initial) {
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

// Escape closes an open place detail from anywhere (A6).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !ctx || !route().params.get('p')) return;
  if (document.querySelector('.taxi')) return;
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

function dirUrl(q, mode) {
  if (ctx.prefs.maps === 'apple') {
    const flag = { walking: 'w', transit: 'r', driving: 'd' }[mode] || 'r';
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=${flag}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=${mode}`;
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

// Place rows present a sheet or fill the inspector, so they show no chevron (C3).
function placeRow(it, v) {
  const badge = it.status ? halalChip(it.status) : it.kind === 'eat' && it.for_b ? dietChip(it.for_b) : null;
  const accessBadge = it.kind === 'prayer' && it.access ? chip(it.access, /patron/i.test(it.access) ? 'ev ev-claim' : 'plain') : null;
  const notesBadge = (it.look_for || it.entry_tip) && ['stops', 'eat', 'sweet', 'shop'].includes(it.kind) ? chip('Field tips', 'plain') : null;
  const chips = [badge, accessBadge, notesBadge].filter(Boolean);
  const selected = route().params.get('p') === it.id;
  const sub = it.kind === 'prayer' ? [it.area, it.where] : it.kind === 'halal' ? [it.area, it.cuisine] : [];
  const facts = ['stops', 'eat', 'sweet', 'shop'].includes(it.kind)
    ? [it.hours, it.cost || it.price, it.closed ? `Closed ${it.closed}` : ''].filter(Boolean).join(' \u00b7 ')
    : it.kind === 'prayer' && it.hours ? it.hours : '';
  return h('li', { class: 'row' },
    link(withParam(v, 'p', it.id), { class: 'row-link', 'aria-current': selected ? 'true' : null, 'data-key': `row-${it.id}` },
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, it.name, it.jp ? h('span', { class: 'row-jp', lang: 'ja' }, ` ${it.jp}`) : null),
        sub.filter(Boolean).length ? h('span', { class: 'row-sub' }, sub.filter(Boolean).join(' \u00b7 ')) : null,
        it.what || it.signature ? h('span', { class: 'row-sub clamp' }, it.what || it.signature) : null,
        facts ? h('span', { class: 'row-facts' }, facts) : null,
        chips.length ? h('span', { class: 'row-chips' }, ...chips) : null,
        walkCaption(it) ? h('span', { class: 'row-meta' }, walkCaption(it)) : it.opens ? h('span', { class: 'row-meta' }, `Opens ${it.opens}`) : null)),
    ext(dirUrl(it.maps_query || it.name, it.mode || (walkCaption(it) ? 'walking' : 'transit')), icon('arrowOut'), { class: 'row-go', 'aria-label': `Directions to ${it.name}` }));
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

function placeDetail(it) { // S7: the row expanded, with deeper practical field notes
  const t = ctx.trip;
  const q = it.maps_query || it.name;
  const kindLabel = { stops: 'See', shop: 'Shop', sweet: 'Something sweet', eat: 'Eat', bakery: 'Bakery', halal: 'Halal food', prayer: 'Prayer room' }[it.kind];
  const fieldNotes = grouped([
    it.kind !== 'bakery' ? kvStack('Why it works', it.why) : null,
    kvStack('What to look for', it.look_for),
    kvStack('Entrance & lifts', it.entry_tip),
  ], 'kv-list field-notes-list');
  return h('article', { class: 'place' },
    h('p', { class: 'eyebrow' }, [kindLabel, it.zone, it.dayLabel].filter(Boolean).join(' \u00b7 ')),
    h('h2', { class: 'place-title', id: 'place-title' }, it.name),
    it.jp ? h('p', { class: 'place-jp', lang: 'ja' }, it.jp) : null,
    h('div', { class: 'chips' }, halalChip(it.status), it.kind === 'eat' ? dietChip(it.for_b) : null, it.kind === 'prayer' && it.access ? chip(it.access, /patron/i.test(it.access) ? 'ev ev-claim' : 'plain') : null),
    it.what || it.signature ? h('p', { class: 'body' }, it.what || it.signature) : null,
    it.kind === 'bakery' && it.why ? h('p', { class: 'body' }, it.why) : null,
    fieldNotes,
    grouped([
      kv('Cuisine', it.cuisine),
      kv('Where', it.where || it.area),
      kv('Hours', it.hours),
      kv('Last entry', it.last_entry),
      kv('Opens', it.opens),
      kv('Closed', it.closed),
      kv('Price', it.price || it.cost),
      kv('Booking', it.booking),
      kv('Tax-free', it.tax_free),
      kv('Access', it.access),
      kv('Walk', walkCaption(it)),
      kv('Getting there', it.getting_there),
      kv('Seats', it.seats),
      kv('Coffee', it.coffee),
      kv('Queue', it.queue),
      kv('For', it.for),
      it.kind === 'bakery' ? kv(fill(t, 'For {B}'), it.for_b) : null,
    ], 'kv-list'),
    it.status ? h('p', { class: 'footnote' }, it.certifier ? `Certified by ${it.certifier}` : 'Certifier not named') : null,
    it.alcohol ? h('p', { class: 'footnote' }, `Alcohol served: ${it.alcohol}`) : null,
    it.verified ? h('p', { class: 'footnote' }, `Checked ${t.halal.as_of}: ${it.verified}`) : null,
    it.checked_on ? h('p', { class: 'footnote' }, `Primary source checked ${it.checked_on}${it.verification_note ? `: ${it.verification_note}` : '.'}`) : null,
    it.pacing ? h('p', { class: 'note' }, icon('figureWalk'), h('span', null, it.pacing)) : null,
    it.rain_alt ? h('p', { class: 'note' }, icon('leaf'), h('span', null, it.rain_alt)) : null,
    it.tags && it.tags.length ? h('div', { class: 'chips' }, it.tags.map((x) => chip(x, 'plain'))) : null,
    goButtons(q, it.name, it.mode || 'transit'),
    it.source ? h('p', { class: 'source' }, ext(it.source, [icon('link'), h('span', null, 'Source')], { class: 'text-btn', 'aria-label': `Source for ${it.name}` })) : null);
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

// ---------------------------------------------------------------- To book (owner: only flights and hotels are booked)
function toBook() { return (ctx.trip.to_book && ctx.trip.to_book.items) || []; }
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
  const items = toBook();
  const needs = items.filter((x) => x.need === 'needs');
  const optional = items.filter((x) => x.need !== 'needs');
  return [
    h('p', { class: 'caption' }, ctx.trip.to_book ? ctx.trip.to_book.note : ''),
    section('Needs booking', grouped(needs.map(bookRow), 'book-list')),
    optional.length ? section('Can be booked if you choose it', h('details', { class: 'disclosure' }, h('summary', null, `${optional.length} restaurants that take bookings`), grouped(optional.map(bookRow), 'book-list'))) : null,
    h('p', { class: 'caption' }, 'Ticks are saved on this device only. Tell the trip app owner what you booked so the plan can be updated for everyone.'),
  ];
}

function notBookedNote(iso) {
  const open = toBook().filter((x) => x.day === iso && x.need === 'needs' && ctx.prefs[`booked:${x.id}`] !== true);
  if (!open.length) return null;
  return h('p', { class: 'callout warn' }, icon('warning'), h('span', null, h('strong', null, 'Not booked yet: '), open.map((x) => x.title).join('; '), ' ', link('info/to-book', { class: 'text-btn small inline' }, 'To book')));
}

// ---------------------------------------------------------------- Today (S2, S3, S4)
function viewToday() {
  const t = ctx.trip;
  const n = now();
  const ph = tripPhase(t.days, n.iso);
  const day = t.days[ph.index];
  const tomorrow = t.days[ph.index + 1];
  let main;
  if (ph.phase === 'before') {
    main = [
      h('section', { class: 'hero', 'aria-label': 'Countdown' },
        h('p', { class: 'hero-number' }, String(ph.daysToGo)),
        h('p', { class: 'hero-label' }, ph.daysToGo === 1 ? 'day to go' : 'days to go'),
        h('p', { class: 'meta' }, `${t.days[0].date} to ${t.days[t.days.length - 1].date}, Tokyo time`)),
      section('To book', grouped(toBook().filter((x) => x.need === 'needs').slice(0, 6).map(bookRow), 'book-list'), link('info/to-book', { class: 'text-btn' }, 'All bookings to make')),
      docSection('next-up', 'Next up'),
      section('First day', dayCard(day)),
      section('Before you go', grouped([pushRow('info/bookings', 'Bookings'), pushRow('info/getting-around', 'Getting around'), pushRow('info/shopping-and-tax-refunds', 'Tax-free shopping')])),
    ];
  } else if (ph.phase === 'after') {
    main = [section(null, h('p', { class: 'body' }, 'The trip is over. Every day is still here to look back on.')), link('days', { class: 'btn btn-filled' }, 'Open Days')];
  } else {
    const nn = nowNext(day, n.minutes);
    const focus = nn.now ?? nn.next;
    const watch = day.watch_outs || [];
    main = [
      h('div', { class: 'today-head' },
        h('p', { class: 'eyebrow' }, `${day.date} · Day ${ph.index + 1} of ${t.days.length}`),
        h('p', { class: 'today-title' }, day.title),
        h('p', { class: 'day-place' }, day.place)),
      focus !== null && focus !== undefined ? zoneNowCard(day, day.zones[focus], nn.now === focus ? 'Now' : 'Next')
        : h('section', { class: 'now-card', 'aria-label': 'Today’s plan' }, h('p', { class: 'eyebrow' }, nn.done ? 'Plan done' : 'Today’s plan'), h('p', { class: 'body' }, nn.done ? 'That’s today’s plan done. Time to head back.' : day.summary)),
      quickActions(day),
      notBookedNote(day.iso),
      tomorrow ? notBookedNote(tomorrow.iso) : null,
      day.open ? h('p', { class: 'callout' }, icon('question'), h('span', null, h('strong', null, 'To decide: '), day.open)) : null,
      section('Rest of today', grouped(day.zones.map((z, i) => h('li', { class: `row ${i === nn.now ? 'is-now' : ''}` },
        link(`days/${day.iso}`, { class: 'row-link', 'data-key': `zone-${i}` },
          h('span', { class: 'row-time' }, z.time),
          h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, z.name), h('span', { class: 'row-sub' }, z.purpose)),
          i === nn.now ? chip('Now', 'now') : null, icon('chevronRight', null, 'chevron')))))),
      watch.length ? section('Watch out', h('ul', { class: 'bullets warn' }, watch.slice(0, 3).map((w) => h('li', null, w))),
        watch.length > 3 ? h('details', { class: 'disclosure' }, h('summary', null, `${watch.length - 3} more`), h('ul', { class: 'bullets warn' }, watch.slice(3).map((w) => h('li', null, w)))) : null) : null,
      tomorrow ? section('Tomorrow', dayCard(tomorrow)) : null,
    ];
  }
  return { title: 'Today', main };
}

function zoneNowCard(day, z, label) {
  const gt = z.getting_there || {};
  return h('section', { class: 'now-card', 'aria-label': `${label}: ${z.name}` },
    h('div', { class: 'now-top' }, chip(label, label === 'Now' ? 'now' : 'next'), h('span', { class: 'meta nums' }, z.time)),
    h('p', { class: 'now-title' }, z.name),
    h('p', { class: 'body' }, z.purpose),
    gt.how ? metaLine([gt.minutes ? `About ${gt.minutes} min` : '', gt.fare, gt.arrive_at ? `to ${gt.arrive_at}` : '']) : null,
    gt.maps_query ? goButtons(gt.maps_query, gt.arrive_at || z.name, gt.mode) : null);
}

function quickActions(day) {
  const t = ctx.trip;
  const g = defaultHalalGroup(t, day.iso);
  return h('nav', { class: 'quick', 'aria-label': 'Quick actions' },
    ext(dirUrl(t.hotel.maps_query, 'transit'), [icon('bed'), h('span', null, 'Back to the hotel')], { class: 'quick-btn' }),
    link(`food/halal?g=${g}`, { class: 'quick-btn', 'data-key': 'qa-food' }, icon('fork'), h('span', null, 'Food nearby')),
    link(`food/halal?g=${g}&focus=prayer`, { class: 'quick-btn', 'data-key': 'qa-prayer' }, icon('moon'), h('span', null, 'Prayer rooms')),
    link('info/taxi', { class: 'quick-btn', 'data-key': 'qa-taxi' }, icon('car'), h('span', null, 'Taxi card')));
}

function dayCard(d) {
  return link(`days/${d.iso}`, { class: 'day-card', 'data-key': `card-${d.iso}` },
    h('span', { class: 'day-badge' }, h('span', { class: 'day-num' }, d.n), h('span', { class: 'day-k', lang: 'ja' }, d.k)),
    h('span', { class: 'row-text' }, h('span', { class: 'row-sub' }, d.date), h('span', { class: 'row-title' }, d.title), h('span', { class: 'row-sub' }, d.place)),
    icon('chevronRight', null, 'chevron'));
}

function t0(d) { const t = ctx.trip; return t.days[tripPhase(t.days, now().iso).index].iso; }

function dayRow(d) {
  const today = now().iso === d.iso;
  const r = route();
  return h('li', { class: `row day-row ${today ? 'is-today' : ''}` },
    link(`days/${d.iso}`, { class: 'row-link', 'aria-current': r.tab === 'days' && (r.sub[0] || (!isCompact() && t0(d))) === d.iso ? 'page' : null, 'data-key': `day-${d.iso}` },
      h('span', { class: 'day-badge' }, h('span', { class: 'day-num' }, d.n), h('span', { class: 'day-k', lang: 'ja' }, d.k)),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-sub' }, [d.date, d.wkd ? 'Weekend' : '', today ? 'Today' : ''].filter(Boolean).join(' · ')),
        h('span', { class: 'row-title' }, d.title),
        h('span', { class: 'row-sub' }, d.place),
        h('span', { class: 'row-chips' }, typeChip(d.type), chip(LOAD[d.load], 'plain'), d.open ? chip('To decide', 'decide', 'question') : null)),
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
  const strip = h('ol', { class: 'rhythm-strip', 'aria-label': 'Trip at a glance' }, t.days.map((d, i) => h('li', { class: `rhythm-day t-${d.type} ${d.wkd ? 'wkd' : ''} ${d.iso === today ? 'is-today' : ''}` },
    link(`days/${d.iso}`, { 'aria-label': `${d.date}: ${d.title}. ${DAY_TYPE[d.type]}, ${LOAD[d.load]}${d.open ? ', to decide' : ''}${d.iso === today ? ', today' : ''}`, 'aria-current': i === selected ? 'page' : null, tabindex: i === Math.max(0, selected) ? '0' : '-1', 'data-key': `rhythm-${d.iso}` },
      h('span', { class: 'rhythm-k', lang: 'ja', 'aria-hidden': 'true' }, d.k),
      h('span', { class: 'rhythm-track', 'aria-hidden': 'true' }, h('span', { class: 'rhythm-bar', 'data-load': d.load })),
      h('span', { class: 'rhythm-n', 'aria-hidden': 'true' }, d.n),
      d.open ? h('span', { class: 'rhythm-open', 'aria-hidden': 'true' }) : null))));
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
  const primary = groups[0];
  const prayerCount = groups.reduce((acc, g) => acc + cache.prayer.filter((p) => p.g === g).length, 0);
  return h('nav', { class: 'day-area-bar', 'aria-label': 'Halal food and prayer rooms for this day' },
    groups.map((g) => {
      const label = t.halal.groups.find((x) => x.id === g)?.label || g;
      const count = cache.halal.filter((p) => p.g === g).length;
      return link(`food/halal?g=${g}`, { class: 'area-link', 'data-key': `day-halal-${d.iso}-${g}` },
        icon('fork'), h('span', null, `Halal: ${label}`), h('span', { class: 'count nums' }, String(count)));
    }),
    link(`food/halal?g=${primary}&focus=prayer`, { class: 'area-link', 'data-key': `day-prayer-${d.iso}` },
      icon('moon'), h('span', null, 'Prayer rooms'), h('span', { class: 'count nums' }, String(prayerCount))));
}

function spaRow(s) {
  const q = s.maps_query || s.name;
  return h('li', { class: 'row' },
    h('div', { class: 'row-link spa-item' },
      h('span', { class: 'row-text' },
        h('span', { class: 'row-title' }, s.name),
        s.area ? h('span', { class: 'row-sub' }, s.area) : null,
        s.why ? h('span', { class: 'row-sub' }, s.why) : null,
        h('span', { class: 'row-facts' }, [s.hours, s.price, s.booking].filter(Boolean).join(' \u00b7 ')),
        s.caveat ? h('span', { class: 'row-meta' }, s.caveat) : null,
        s.privacy ? h('span', { class: 'row-chips' }, chip(s.privacy, 'ev ev-certified', 'seal')) : null)),
    q ? ext(mapsUrl(q), icon('arrowOut'), { class: 'row-go', 'aria-label': `${s.name} in Maps` }) : null);
}

function dayDetail(d, i) {
  const t = ctx.trip;
  const v = `days/${d.iso}`;
  const isToday = d.iso === now().iso;
  const watch = d.watch_outs || [];
  const header = h('header', { class: 'day-head', tabindex: '0', 'aria-label': `${d.date}, ${d.title}. Use left and right arrow keys for other days.`, onkeydown: (e) => {
    const nd = e.key === 'ArrowLeft' ? t.days[i - 1] : e.key === 'ArrowRight' ? t.days[i + 1] : null;
    if (nd) { e.preventDefault(); lastFocus = 'day-head'; go(`days/${nd.iso}`); }
  }, 'data-key': 'day-head' },
  h('p', { class: 'eyebrow' }, `Day ${i + 1} of ${t.days.length}${d.wkd ? ' \u00b7 Weekend' : ''}`),
  h('h1', { class: 'day-title', id: 'view-title', 'aria-live': 'polite' }, d.title),
  h('p', { class: 'day-place' }, `${d.date} \u00b7 ${d.place}`),
  h('div', { class: 'chips' },
    isToday ? chip('Today', 'now') : null,
    typeChip(d.type),
    chip(LOAD[d.load], 'plain'),
    d.walk ? chip(`Walking: ${d.walk}`, 'plain', 'figureWalk') : null,
    d.checked_on ? chip(`Checked ${d.checked_on}`, 'plain') : null));
  return h('div', { class: 'day-detail' },
    dayJumpStrip(i),
    header,
    h('p', { class: 'body lead' }, d.summary),
    notBookedNote(d.iso),
    d.open ? h('p', { class: 'callout' }, icon('question'), h('span', null, h('strong', null, 'To decide: '), d.open)) : null,
    dayAreaBar(d),
    d.route_strategy ? h('section', { class: 'strategy-card card', 'aria-label': 'Route and pacing' },
      h('p', { class: 'eyebrow' }, 'Route & pacing'),
      h('p', { class: 'body' }, d.route_strategy)) : null,
    d.logistics && d.logistics.length ? h('details', { class: 'disclosure' },
      h('summary', null, h('span', { class: 'summary-label' }, `Entrances, tickets & practical logistics (${d.logistics.length})`)),
      grouped(d.logistics.map((x) => kvStack(x.label, x.value)), 'kv-list')) : null,
    d.rain_plan && (Array.isArray(d.rain_plan) ? d.rain_plan.length : d.rain_plan) ? h('details', { class: 'disclosure' },
      h('summary', null, h('span', { class: 'summary-label' }, 'Rain & low-energy alternatives')),
      Array.isArray(d.rain_plan)
        ? h('ul', { class: 'bullets' }, d.rain_plan.map((r) => h('li', null, r)))
        : h('div', { class: 'disclosure-pad' }, h('p', { class: 'body' }, d.rain_plan))) : null,
    d.spa_options && d.spa_options.length ? h('details', { class: 'disclosure' },
      h('summary', null, h('span', { class: 'summary-label' }, `Private & women-only spa options (${d.spa_options.length})`)),
      grouped(d.spa_options.map(spaRow))) : null,
    h('div', { class: 'day-grid' },
      section('The day', h('ol', { class: 'flow' }, d.flow.map((f) => h('li', { class: `flow-item lvl-${f.level}` },
        h('span', { class: 'flow-when' }, f.when), h('span', { class: 'flow-text' }, f.text), chip(FLOW_LEVEL[f.level], `lvl lvl-${f.level}`))))),
      h('div', { class: 'zones' }, h('h2', { class: 'group-title' }, 'Zones'), d.zones.map((z, zi) => zoneCard(d, z, zi, v)))),
    section('End of the day', h('div', { class: 'card' }, h('p', { class: 'body' }, d.home.how), goButtons(d.home.maps_query || t.hotel.maps_query, 'the hotel', d.home.mode),
      d.home.source ? ext(d.home.source, [icon('link'), h('span', null, 'Source')], { class: 'text-btn' }) : null)),
    section('Good to know', d.pacing ? h('p', { class: 'note' }, icon('figureWalk'), h('span', null, d.pacing)) : null,
      watch.length ? h('ul', { class: 'bullets warn' }, watch.slice(0, 4).map((w) => h('li', null, w))) : null,
      watch.length > 4 ? h('details', { class: 'disclosure' }, h('summary', null, `${watch.length - 4} more watch-outs`), h('ul', { class: 'bullets warn' }, watch.slice(4).map((w) => h('li', null, w)))) : null),
    d.decisions.length ? section('Questions to settle', h('ul', { class: 'bullets' }, d.decisions.map((w) => h('li', null, w)))) : null,
    d.sources.length ? section('Sources', h('details', { class: 'disclosure' }, h('summary', null, `${d.sources.length} sources`), h('ul', { class: 'sources' }, d.sources.map((s) => h('li', null, ext(s, sourceLabel(s))))))) : null,
    h('nav', { class: 'day-pager', 'aria-label': 'Other days' },
      i > 0 ? link(`days/${t.days[i - 1].iso}`, { class: 'btn btn-gray' }, icon('chevronLeft'), h('span', { class: 'pager-text' }, `${t.days[i - 1].date} \u00b7 ${t.days[i - 1].title}`)) : h('span'),
      i < t.days.length - 1 ? link(`days/${t.days[i + 1].iso}`, { class: 'btn btn-gray' }, h('span', { class: 'pager-text' }, `${t.days[i + 1].date} \u00b7 ${t.days[i + 1].title}`), icon('chevronRight')) : h('span')));
}

function sourceLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function zoneCard(d, z, zi, v) {
  const gt = z.getting_there || {};
  const items = cache.places.filter((p) => p.dayISO === d.iso && p.zone === z.name);
  const by = (k) => items.filter((p) => p.kind === k);
  const noStops = by('stops').length === 0;
  const firstFallback = noStops ? ['eat', 'shop', 'sweet'].find((k) => by(k).length > 0) : null;
  const disclose = (k, label) => {
    const list = by(k);
    if (!list.length) return null;
    const preview = list.slice(0, 2).map((x) => x.name).join(', ') + (list.length > 2 ? '\u2026' : '');
    return h('details', { class: 'disclosure', open: firstFallback === k ? true : null },
      h('summary', null,
        h('span', { class: 'summary-label' }, `${label} (${list.length})`, h('span', { class: 'summary-preview' }, ` \u00b7 ${preview}`))),
      grouped(list.map((p) => placeRow(p, v))));
  };
  return h('section', { class: 'zone card', 'aria-labelledby': `zone-${zi}` },
    h('h3', { class: 'zone-title', id: `zone-${zi}` },
      h('span', { class: 'zone-num', 'aria-hidden': 'true' }, String(zi + 1)),
      h('span', { class: 'zone-name' }, z.name),
      z.badge ? chip(z.badge, 'next') : null),
    h('p', { class: 'meta nums' }, z.time),
    h('p', { class: 'body' }, z.purpose),
    z.what_to_look_for ? h('p', { class: 'zone-highlight' }, z.what_to_look_for) : null,
    z.tips && z.tips.length ? h('details', { class: 'disclosure zone-tips' },
      h('summary', null, h('span', { class: 'summary-label' }, `Zone tips & entry details (${z.tips.length})`)),
      h('ul', { class: 'bullets' }, z.tips.map((tip) => h('li', null, tip)))) : null,
    gt.how ? h('div', { class: 'getting' },
      h('p', { class: 'getting-label' }, icon(MODE_ICON[gt.mode] || 'train'), 'Getting there'),
      h('p', { class: 'body' }, gt.how),
      metaLine([gt.minutes ? `About ${gt.minutes} min` : '', gt.fare, gt.arrive_at]),
      gt.maps_query ? goButtons(gt.maps_query, gt.arrive_at || z.name, gt.mode) : null) : null,
    by('stops').length ? h('div', { class: 'zone-kind' }, h('h4', { class: 'kind-title' }, 'See'), grouped(by('stops').map((p) => placeRow(p, v)))) : null,
    disclose('eat', 'Eat'), disclose('sweet', 'Something sweet'), disclose('shop', 'Shop'));
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
    if (prayerSection && r.params.get('focus') === 'prayer') prayerSection.id = 'prayer';
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
          return h('button', { type: 'button', class: `area-link ${tg === g ? 'is-active' : ''}`, onclick: () => go(`food/halal?g=${tg}`, { replace: true }) },
            icon('pin'), h('span', null, lbl));
        })) : null,
      h('details', { class: 'disclosure legend-box' }, h('summary', null, 'What the labels mean'),
        h('ul', { class: 'legend-list' }, HALAL_STATUS.map((s) => h('li', null, halalChip(s), h('span', null, HALAL_MEANING[s]))))),
      h('p', { class: 'caption' }, `Checked ${t.halal.as_of}. Hours and status can change, so confirm on arrival.`),
      places.length ? grouped(places.map((p) => placeRow(p, base))) : h('p', { class: 'empty' }, certOnly ? 'No certified places in this area. Turn off Certified only to see more.' : `No halal places listed for ${groupLabel}. Try another area or search Maps.`),
      h('div', { class: 'go-row wide' },
        ext(mapsUrl('halal restaurant'), [icon('search'), h('span', null, 'Halal near me')], { class: 'btn btn-gray', 'aria-label': 'Search Maps for halal restaurants near me' }),
        ext(mapsUrl('prayer room'), [icon('moon'), h('span', null, 'Prayer rooms near me')], { class: 'btn btn-gray', 'aria-label': 'Search Maps for prayer rooms near me' })),
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
  const list = [
    h('form', { class: 'search-wrap', role: 'search', onsubmit: (e) => e.preventDefault() }, icon('search'), field),
    segmented('Kind', KINDS.map(([k, label]) => [k, label]), kind, (k) => { ctx.setPref('kind', k); go(withParam(base, 'k', k), { replace: true }); }),
    h('div', { class: 'filters' },
      segmented('Group by', [['day', 'Day'], ['area', 'Area']], by, (b) => { ctx.setPref('by', b); go(withParam(base, 'by', b), { replace: true }); }, 'small'),
      kind === 'eat' ? toggleRow(fill(t, 'Works for {B}'), onlyB, (on) => { ctx.setPref('onlyB', on); draw(); }) : null),
    h('p', { class: 'caption', role: 'status' }, `${items.length} ${items.length === 1 ? 'place' : 'places'}${q ? ` matching “${q}”` : ''}`),
    items.length ? [...groups].map(([key, ps]) => {
      const d = by === 'day' ? t.days.find((x) => x.iso === key) : null;
      return h('section', { class: 'group' },
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
  const fixed = { 'to-book': 'To book', hotel: 'Hotel', 'getting-around': 'Getting around', bookings: 'Bookings', airport: 'Airport day', 'shopping-and-tax-refunds': 'Tax-free shopping', guides: 'Guides', decisions: 'Decisions', 'next-up': 'Next up', 'what-we-want': 'What we want', sources: 'Sources', app: 'App', taxi: 'Taxi card' };
  if (fixed[id]) return fixed[id];
  const s = docSec(id);
  return s ? s.title : 'Info';
}

function viewInfo(r) {
  const id = r.sub[0];
  const rows = (ids) => grouped(ids.filter((x) => ['hotel', 'airport', 'guides', 'app', 'to-book'].includes(x) || (docSec(x) && docSec(x).md.trim())).map((x) => pushRow(`info/${x}`, infoTitle(x))));
  const list = [
    section('Stay', grouped([pushRow('info/hotel', 'Hotel', ctx.trip.hotel.name),
      h('li', { class: 'row' }, link('info/taxi', { class: 'row-link', 'data-key': 'show-taxi' }, h('span', { class: 'row-text' }, h('span', { class: 'row-title tint' }, 'Show taxi card')), icon('car', null, 'chevron'))),
      h('li', { class: 'row' }, ext(dirUrl(ctx.trip.hotel.maps_query, 'transit'), [h('span', { class: 'row-text' }, h('span', { class: 'row-title tint' }, 'Back to the hotel')), icon('arrowOut', null, 'chevron')], { class: 'row-link' }))])),
    section('Travel', rows(['to-book', 'getting-around', 'bookings', 'airport', 'shopping-and-tax-refunds'])),
    section('Plan', rows(['guides', 'decisions', 'next-up', 'what-we-want', 'sources'])),
    section('App', rows(['app'])),
  ];
  if (!id) return { title: 'Info', main: list };
  let main;
  if (id === 'hotel') main = hotelView();
  else if (id === 'taxi') return { title: 'Info', main: list, overlay: taxiCard() };
  else if (id === 'app') main = appSettings();
  else if (id === 'airport') main = airportDay();
  else if (id === 'to-book') main = toBookView();
  else if (id === 'guides') main = r.sub[1] ? docView(r.sub[1]) : grouped(guides().map((s) => pushRow(`info/guides/${s.id}`, s.title)));
  else main = docView(id);
  const title = id === 'guides' && r.sub[1] ? infoTitle(r.sub[1]) : infoTitle(id);
  return { title, large: false, back: id === 'guides' && r.sub[1] ? ['info/guides', 'Guides'] : ['info', 'Info'], list, listLabel: 'Info', main: [h('h2', { class: 'section-title' }, title), main] };
}

function docView(id) {
  const s = docSec(id);
  if (!s) return h('p', { class: 'empty' }, 'This section isn’t in the trip data.');
  return h('div', { class: 'doc' }, markdown(s.md, { onTask: taskToggle }));
}

function hotelView() {
  const ho = ctx.trip.hotel;
  return [
    grouped([kv('Name', ho.name), ho.name_jp ? h('li', { class: 'kv' }, h('span', { class: 'kv-label' }, 'In Japanese'), h('span', { class: 'kv-value', lang: 'ja' }, ho.name_jp)) : null,
      kv('Address', ho.address), kv('Check-in', ho.checkin), kv('Check-out', ho.checkout), kv('Stations', ho.stations),
      ho.phone ? h('li', { class: 'kv' }, h('span', { class: 'kv-label' }, 'Phone'), ext(`tel:${ho.phone.replace(/\s/g, '')}`, ho.phone, { class: 'kv-value' })) : null], 'kv-list'),
    link('info/taxi', { class: 'btn btn-filled', 'data-key': 'show-taxi-2' }, icon('car'), 'Show Taxi Card'),
    goButtons(ho.maps_query, 'the hotel', 'transit'),
  ];
}

function taxiCard() { // S12
  const ho = ctx.trip.hotel;
  const close = () => go('info');
  const card = h('div', { class: 'taxi', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Taxi card', tabindex: '-1', onkeydown: (e) => { if (e.key === 'Escape') close(); } },
    h('div', { class: 'taxi-bar' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: close }, 'Close')),
    h('div', { class: 'taxi-body' },
      h('p', { class: 'taxi-eyebrow' }, 'Please take me to'),
      h('p', { class: 'taxi-eyebrow', lang: 'ja' }, 'こちらまでお願いします'),
      ho.name_jp ? h('p', { class: 'taxi-jp', lang: 'ja' }, ho.name_jp) : null,
      ho.address_jp ? h('p', { class: 'taxi-addr', lang: 'ja' }, ho.address_jp) : null,
      h('p', { class: 'taxi-en' }, ho.name),
      h('p', { class: 'taxi-en' }, ho.address),
      ho.phone ? ext(`tel:${ho.phone.replace(/\s/g, '')}`, [icon('phone'), h('span', null, ho.phone)], { class: 'btn btn-gray' }) : null),
    goButtons(ho.maps_query, 'the hotel', 'driving'));
  queueMicrotask(() => card.focus());
  return card;
}

function airportDay() {
  const t = ctx.trip;
  const first = t.days[0], last = t.days[t.days.length - 1];
  const ga = docSec('getting-around');
  const airportRows = ga ? ga.md.split('\n').filter((l, i, a) => /^\|/.test(l) && (i < 2 || /\bKIX\b|airport/i.test(l))).join('\n') : '';
  const bookings = docSec('bookings');
  const flights = bookings ? bookings.md.split('\n').filter((l) => /^\|/.test(l)).join('\n').split(/\n(?=\| Hotel)/)[0] : '';
  return [
    section('Arrival and departure', grouped([pushRow(`days/${first.iso}`, first.title, first.date), pushRow(`days/${last.iso}`, last.title, last.date)])),
    flights ? section('Flights', h('div', { class: 'doc' }, markdown(flights))) : null,
    airportRows ? section('Airport transfers', h('div', { class: 'doc' }, markdown(airportRows))) : null,
    h('p', { class: 'caption' }, 'From the bookings and getting-around notes. Flight times change: the airline app is the source of truth.'),
  ];
}

function appSettings() { // S13
  const p = ctx.prefs;
  const linkField = h('input', { class: 'field', type: 'url', id: 'newlink', placeholder: 'Paste a new private link', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const linkStatus = h('p', { class: 'lock-status', role: 'status' });
  return [
    section('Privacy', grouped([
      h('li', { class: 'kv' }, toggleRow('Keep unlocked on this device', p.remember !== false, async (on) => { await ctx.setRemember(on); draw(); })),
    ]), h('p', { class: 'caption' }, 'When on, this device opens the trip without the password. Lock now forgets it.'),
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
