// Safe DOM helpers. Trip text is only ever set via textContent or attributes; never innerHTML.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function safeUrl(url) {
  try {
    const u = new URL(url, location.href);
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'tel:' ? u.href : null;
  } catch { return null; }
}

// External links never send a referrer and open outside the app.
export function ext(url, label, attrs = {}) {
  const href = safeUrl(url);
  if (!href) return h('span', attrs, label);
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attrs }, label);
}

// Icons come from the design sprite (docs/icons.svg, a copy of design/prototype/icons.svg).
const SPRITE = {
  sun: 'sun-max', calendar: 'calendar', fork: 'fork-knife', pin: 'mappin', info: 'info-circle',
  chevronLeft: 'chevron-left', chevronRight: 'chevron-right', sidebar: 'sidebar', walk: 'figure-walk',
  figureWalk: 'figure-walk', train: 'tram', car: 'car', bed: 'building-2', map: 'map', lock: 'lock',
  check: 'checkmark', search: 'magnifyingglass', xmark: 'xmark', link: 'link', moon: 'moon-stars',
  warning: 'exclamation-triangle', reload: 'arrow-clockwise', eye: 'eye', eyeSlash: 'eye-slash',
  wifiSlash: 'wifi-slash', seal: 'checkmark-seal', checkCircle: 'checkmark-circle', xmarkCircle: 'xmark-circle',
  listRect: 'list-rect', hand: 'hand-raised', fish: 'fish', bag: 'bag', columns: 'building-columns',
  leaf: 'leaf', airplane: 'airplane', question: 'question-circle', arrowOut: 'directions', phone: 'phone',
  plusApp: 'plus-app', dot: 'checkmark-circle', clock: 'clock', yen: 'yen', share: 'share',
};

export function icon(name, label, cls = '') {
  const filled = name.endsWith('Fill');
  const base = filled ? name.slice(0, -4) : name;
  const id = `i-${SPRITE[base] || 'checkmark-circle'}${filled ? '-fill' : ''}`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `icon icon-${base}${cls ? ` ${cls}` : ''}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `icons.svg#${id}`);
  svg.append(use);
  return svg;
}

// Minimal, safe Markdown subset used by the trip document: paragraphs, bold, links,
// bullet and numbered lists, task checkboxes and pipe tables. Tables become grouped lists.
export function markdown(src, { onTask } = {}) {
  const frag = document.createDocumentFragment();
  const lines = (src || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      frag.append(mdTable(rows));
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const list = h(ordered ? 'ol' : 'ul', { class: 'md-list' });
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*([-*]|\d+\.)\s/, '');
        const task = /^\[( |x)\]\s/i.exec(text);
        if (task) {
          const id = `task-${hash(text.slice(4))}`;
          list.append(h('li', { class: 'md-task' }, onTask ? onTask(id, task[1].toLowerCase() === 'x', inline(text.slice(4))) : inline(text.slice(4))));
        } else list.append(h('li', null, inline(text)));
        i++;
      }
      frag.append(list);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\|/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) { para.push(lines[i]); i++; }
    frag.append(h('p', { class: 'md-p' }, inline(para.join(' '))));
  }
  return frag;
}

function cells(row) {
  return row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function mdTable(rows) {
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const list = h('ul', { class: 'md-table grouped' });
  for (const r of body) {
    list.append(h('li', { class: 'md-row' },
      h('div', { class: 'md-row-title' }, inline(r[0] || '')),
      h('dl', { class: 'md-row-fields' }, head.slice(1).map((label, j) => (r[j + 1] ? [h('dt', null, label), h('dd', null, inline(r[j + 1]))] : null)))));
  }
  return list;
}

// Bold and links only. Link labels and URLs are validated.
export function inline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(h('strong', null, inline(m[1])));
    else out.push(ext(m[3], m[2]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function hash(s) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return (x >>> 0).toString(36);
}
