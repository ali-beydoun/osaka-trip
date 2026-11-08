/* Osaka Trip prototype. Static, hash-routed, synthetic data. Demonstrates the adaptive design; not the app. */
(function () {
  'use strict';
  const D = window.PROTO;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (n, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
  const B = D.travellers.find((t) => t.role === 'B');
  const A = D.travellers.find((t) => t.role === 'A');
  const TYPE = { shop: ['Shopping', 'var(--type-shop)', 'bag'], sight: ['Sightseeing', 'var(--type-sight)', 'building-columns'], rest: ['Rest', 'var(--type-rest)', 'leaf'], travel: ['Travel', 'var(--type-travel)', 'airplane'] };
  const LOAD = { 1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Full' };
  const MODE = { transit: ['Train', 'tram'], walking: ['Walk', 'figure-walk'], driving: ['Taxi', 'car'] };
  const TABS = [['today', 'Today', 'sun-max'], ['days', 'Days', 'calendar'], ['food', 'Food', 'fork-knife'], ['places', 'Places', 'mappin'], ['info', 'Info', 'info-circle']];

  /* ---------- Settings (device local) ---------- */
  const store = { get(k, d) { try { const v = localStorage.getItem('osaka-proto-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('osaka-proto-' + k, JSON.stringify(v)); } catch (e) {} } };
  const settings = { maps: store.get('maps', 'google'), keep: store.get('keep', true), ticks: store.get('ticks', {}), hint: store.get('hint', false) };

  /* ---------- Icons sprite ---------- */
  fetch('icons.svg').then((r) => r.text()).then((t) => { $('#icons').innerHTML = t; }).catch(() => {});

  /* ---------- Route ---------- */
  function route() { const p = new URLSearchParams(location.hash.replace(/^#/, '')); return { v: p.get('v') || 'today', d: p.get('d') || '', p: p.get('p') || '', c: p.get('c') || 'bakeries', g: p.get('g') || '', k: p.get('k') || 'stops', by: p.get('by') || 'day', q: p.get('q') || '', s: p.get('s') || 'password', asof: p.get('asof') || '', x: p.get('x') || '' }; }
  function href(o) { const cur = route(); const n = Object.assign({}, { v: cur.v }, o); if (o.asof === undefined && cur.asof) n.asof = cur.asof; const p = new URLSearchParams(); Object.keys(n).forEach((k) => { if (n[k]) p.set(k, n[k]); }); return '#' + p.toString(); }
  function go(o, replace) { const h = href(o); if (replace) history.replaceState(null, '', h); else location.hash = h; if (replace) render(); }
  let lastV = null, lastDepth = 0;

  /* ---------- Tier ---------- */
  function tier() { const w = innerWidth; return w < 600 ? 'compact' : w < 900 ? 'narrow' : w < 1180 ? 'wide' : 'xwide'; }
  let sbOpen = null; // null = default per tier
  function sidebarOpen() { const t = tier(); if (t === 'compact') return false; return sbOpen == null ? (t !== 'narrow') : sbOpen; }
  function applyTier() { const h = document.documentElement; h.dataset.tier = tier(); h.dataset.compactHeight = innerHeight <= 500 ? 'true' : 'false'; const fs = parseFloat(getComputedStyle(h).fontSize); h.classList.toggle('ax', fs >= 23); }

  /* ---------- Trip time ---------- */
  function nowTokyo() { const r = route(); let iso = r.asof; if (iso === 'pre') iso = '2030-04-20T09:00'; if (iso === 'post') iso = '2030-05-20T09:00'; if (!iso) iso = '2030-05-09T10:30'; const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso); return m ? { date: m[1], mins: m[2] ? (+m[2]) * 60 + (+m[3]) : 540, raw: iso } : { date: '2030-05-09', mins: 630, raw: iso }; }
  function phase() { const n = nowTokyo(); if (n.date < D.meta.start) return 'pre'; if (n.date > D.meta.end) return 'post'; return 'on'; }
  function todayDay() { const n = nowTokyo(); return D.days.find((d) => d.iso === n.date) || null; }
  function mins(t) { const m = /(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function zoneRange(z) { const m = /^(\d{1,2}:\d{2}) to (\d{1,2}:\d{2})$/.exec(z.time || ''); return m ? [mins(m[1]), mins(m[2])] : null; }
  function nowNext(day) { const n = nowTokyo(); let cur = null, next = null; (day.zones || []).forEach((z, i) => { const r = zoneRange(z); if (!r) return; if (r[0] <= n.mins && n.mins < r[1] && !cur) cur = { z, i }; else if (r[0] > n.mins && !next) next = { z, i }; }); return { cur, next }; }
  function daysUntil(iso) { const a = new Date(iso + 'T00:00:00Z'), b = new Date(nowTokyo().date + 'T00:00:00Z'); return Math.round((a - b) / 864e5); }

  /* ---------- Maps ---------- */
  function searchURL(q) { return settings.maps === 'apple' ? 'https://maps.apple.com/?q=' + encodeURIComponent(q) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function dirURL(q, mode) { if (settings.maps === 'apple') { const f = { walking: 'w', transit: 'r', driving: 'd' }[mode] || 'r'; return 'https://maps.apple.com/?daddr=' + encodeURIComponent(q) + '&dirflg=' + f; } return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q) + '&travelmode=' + mode; }
  function ext(hrefv, cls, inner, label) { return `<a class="${cls}" href="${esc(hrefv)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="${esc(label)}">${inner}</a>`; }
  function goBtn(q, mode, name, solid) { const m = MODE[mode] || MODE.transit; return ext(dirURL(q, mode), 'act-btn' + (solid ? ' solid' : ''), icon(m[1]) + m[0], m[0] + ' to ' + name); }
  function mapBtn(q, name) { return ext(searchURL(q), 'act-btn', icon('map') + 'Map', name + ' on the map'); }
  function srcBtn(u, name) { return u ? ext(u, 'act-btn', icon('link') + 'Source', 'Source for ' + name) : ''; }

  /* ---------- Evidence ---------- */
  function evClass(s) { s = (s || '').toLowerCase(); if (s.indexOf('not for') === 0) return 'no'; if (s.indexOf('certified') > -1) return 'cert'; if (s.indexOf('own claim') > -1) return 'claim'; if (s.indexOf('halal menu') === 0) return 'menu'; if (s.indexOf('muslim') === 0) return 'friendly'; if (s.indexOf('not halal') === 0 || s.indexOf('fish') === 0) return 'fallback'; return 'friendly'; }
  const EV_ICON = { cert: 'checkmark-seal', claim: 'checkmark-circle', menu: 'list-rect', friendly: 'hand-raised', fallback: 'fish', no: 'xmark-circle' };
  function evLabel(s) { return (s || 'Unverified').replace(/Traveller B/g, B.name); }
  function chip(s) { const c = evClass(s); return `<span class="chip ${c}">${icon(EV_ICON[c])}${esc(evLabel(s))}</span>`; }
  function typeChip(t) { const T = TYPE[t]; return `<span class="chip type-${t}">${icon(T[2])}${T[0]}</span>`; }
  function meta(parts) { const p = parts.filter(Boolean); return p.length ? `<p class="meta num">${p.map(esc).join(' · ')}</p>` : ''; }
  function uncertainty(text) { if (!text) return ''; const t = text.toLowerCase(); if (t.indexOf('sources disagree') > -1 || t.indexOf('conflicting') > -1) return `<p class="note warn">${icon('exclamation-triangle')}<span><b>Sources disagree.</b> ${esc(text)}</span></p>`; if (t.indexOf('could not confirm') > -1 || t.indexOf('unverified') > -1 || t.indexOf('estimate') > -1) return `<p class="note">${icon('question-circle')}<span>${esc(text)}</span></p>`; return ''; }

  /* ---------- Place rows (shared) ---------- */
  function placeId(kind, it, ctx) { return kind + ':' + (it.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + (ctx ? ':' + ctx : ''); }
  const PLACES = {};
  function regPlace(id, obj) { PLACES[id] = obj; return id; }
  function placeRow(kind, it, ctx, extra) {
    const id = regPlace(placeId(kind, it, ctx), Object.assign({ kind }, it, extra || {}));
    const r = route(); const sel = r.p === id ? ' sel' : '';
    const right = kind === 'eat' && it.for_b ? chip(it.for_b) : kind === 'halal' ? chip(it.status) : kind === 'shop' && it.for ? `<span class="chip">${icon(it.for === 'Both' ? 'person-2' : 'person')}${esc(it.for.replace('Traveller B', B.name).replace('Traveller A', A.name))}</span>` : kind === 'bakery' && it.opens ? `<span class="chip">${icon('clock')}Opens ${esc(it.opens)}</span>` : '';
    const walk = it.walk_min && it.city === 'Osaka' ? 'About ' + it.walk_min + ' min from the hotel' : '';
    const m1 = kind === 'halal' ? [it.cuisine, it.area, walk] : kind === 'bakery' ? [it.area, walk, it.seats, it.coffee ? 'Coffee: ' + it.coffee : '', it.queue ? 'Queue: ' + it.queue : ''] : [extra && extra.zone, it.price, it.cost];
    const m2 = [it.hours, it.closed && it.closed !== 'No closing day listed' ? 'Closed ' + it.closed : '', kind === 'halal' || kind === 'bakery' ? it.price : ''];
    return `<div class="row">
      <div class="top"><a class="nm" href="${esc(href({ p: id }))}">${esc(it.name)}${it.jp ? ` <span class="jp" lang="ja">${esc(it.jp)}</span>` : ''}</a>${right}</div>
      ${it.why ? `<p class="what" style="font-weight:var(--fw-medium)">${esc(it.why)}</p>` : ''}
      ${it.what || it.signature ? `<p class="what">${esc(it.signature || it.what)}</p>` : ''}
      ${meta(m1)}${meta(m2)}
      ${it.booking ? `<p class="meta">${esc(it.booking)}</p>` : ''}
      ${it.pacing ? `<p class="note"><span><b>Pacing:</b> ${esc(it.pacing)}</span></p>` : ''}
      ${uncertainty(it.verified) || uncertainty(it.hours) || ''}
      <div class="acts">${goBtn(it.maps_query || it.name, 'walking', it.name, true)}${goBtn(it.maps_query || it.name, 'driving', it.name)}${mapBtn(it.maps_query || it.name, it.name)}${srcBtn(it.source, it.name)}</div>
    </div>`;
  }
  function placeDetail(id) {
    const it = PLACES[id]; if (!it) return `<div class="inspector placeholder">${icon('mappin', 'lg')}<p>Select a place to see its details.</p></div>`;
    const walk = it.walk_min && it.city === 'Osaka' ? 'About ' + it.walk_min + ' min from the hotel' : '';
    return `<div class="sheet-body-inner" style="display:grid;gap:var(--space-4)">
      <div class="chips">${it.kind === 'eat' && it.for_b ? chip(it.for_b) : ''}${it.kind === 'halal' ? chip(it.status) : ''}${it.zone ? `<span class="chip">${icon('mappin')}${esc(it.zone)}</span>` : ''}</div>
      ${it.what || it.signature ? `<p class="t-body">${esc(it.what || it.signature)}</p>` : ''}
      <div class="list">
        ${it.hours ? `<div class="cell"><span class="lead">${icon('clock', 'tb')}</span><span class="body"><span class="ttl">${esc(it.hours)}</span>${it.closed && it.closed !== 'No closing day listed' ? `<span class="sub">Closed ${esc(it.closed)}</span>` : ''}</span></div>` : ''}
        ${it.price || it.cost ? `<div class="cell"><span class="lead">${icon('yen', 'tb')}</span><span class="body"><span class="ttl num">${esc(it.price || it.cost)}</span></span></div>` : ''}
        ${it.booking ? `<div class="cell"><span class="lead">${icon('phone', 'tb')}</span><span class="body"><span class="ttl">${esc(it.booking)}</span></span></div>` : ''}
        ${walk ? `<div class="cell"><span class="lead">${icon('figure-walk', 'tb')}</span><span class="body"><span class="ttl">${esc(walk)}</span></span></div>` : ''}
        ${it.certifier ? `<div class="cell"><span class="lead">${icon('checkmark-seal', 'tb')}</span><span class="body"><span class="ttl">Certified by ${esc(it.certifier)}</span></span></div>` : ''}
        ${it.alcohol ? `<div class="cell"><span class="lead">${icon('info-circle', 'tb')}</span><span class="body"><span class="ttl">Alcohol served: ${esc(it.alcohol)}</span></span></div>` : ''}
        ${it.pacing ? `<div class="cell"><span class="lead">${icon('figure-walk', 'tb')}</span><span class="body"><span class="ttl">${esc(it.pacing)}</span><span class="sub">Pacing note</span></span></div>` : ''}
      </div>
      ${it.verified ? `<p class="t-foot sec">Checked ${esc(D.halal.as_of)}: ${esc(it.verified)}</p>` : ''}
      <div class="acts">${goBtn(it.maps_query || it.name, 'walking', it.name, true)}${goBtn(it.maps_query || it.name, 'transit', it.name)}${goBtn(it.maps_query || it.name, 'driving', it.name)}${mapBtn(it.maps_query || it.name, it.name)}${srcBtn(it.source, it.name)}</div>
      <p class="t-foot sec">Names are suggestions, not bookings. Hours change, so check on the day.</p>
    </div>`;
  }

  /* ---------- Views ---------- */
  function vToday() {
    const ph = phase(); const n = nowTokyo();
    if (ph === 'pre') {
      const dd = daysUntil(D.meta.start); const first = D.days[0]; const nx = D.doc.sections.find((s) => s.id === 'next-up');
      return { title: 'Today', body: `
        <section class="card countdown" aria-label="Countdown"><p class="big num">${dd}</p><p class="t-title3">${dd === 1 ? 'day' : 'days'} to go</p><p class="sec t-sub">The trip starts ${esc(first.date)}. All times are Japan time.</p></section>
        <section><h2 class="group-h">Next up</h2><div class="list">${nx.items.map((it, i) => { const on = settings.ticks[i] != null ? settings.ticks[i] : it.done; return `<label class="cell check" style="grid-template-columns:auto 1fr"><input type="checkbox" data-tick="${i}" ${on ? 'checked' : ''}><span class="bx">${icon('checkmark')}</span><span class="tx">${esc(it.text)}</span></label>`; }).join('')}</div><p class="group-f">Ticks stay on this device only.</p></section>
        <section><h2 class="group-h">First day</h2><a class="list cell" href="${esc(href({ v: 'days', d: first.iso }))}"><span class="lead">${icon(TYPE[first.type][2], 'tb')}</span><span class="body"><span class="ttl b">${esc(first.title)}</span><span class="sub">${esc(first.date)} · ${esc(first.place)}</span></span><span class="trail">${icon('chevron-right')}</span></a></section>
        <section><h2 class="group-h">Essentials</h2><div class="list">${[['bookings', 'Bookings', 'calendar'], ['getting-around', 'Getting around', 'tram'], ['tax-free', 'Tax-free shopping', 'yen']].map((r) => `<a class="cell icon-lead" href="${esc(href({ v: 'info', x: r[0] }))}"><span class="lead">${icon(r[2], 'tb')}</span><span class="body"><span class="ttl">${r[1]}</span></span><span class="trail">${icon('chevron-right')}</span></a>`).join('')}</div></section>` };
    }
    if (ph === 'post') {
      return { title: 'Today', body: `<section class="card" style="text-align:center;padding:var(--space-8) var(--space-5)">${icon('sun-max', 'lg')}<h2 class="t-title2">Trip complete</h2><p class="sec">The plan stays here for next time.</p><a class="btn secondary" href="${esc(href({ v: 'days' }))}">Open the itinerary</a></section>` };
    }
    const day = todayDay(); const idx = D.days.indexOf(day); const tm = D.days[idx + 1]; const nn = nowNext(day); const c = TYPE[day.type][1]; const grp = D.halal.dayGroup[day.iso];
    const nowBlock = nn.cur ? `<p class="nowlab">${icon('clock')}Now · ${esc(nn.cur.z.time)}</p><h3 class="t-title3">${esc(nn.cur.z.name)}</h3><p class="t-sub sec">${esc(nn.cur.z.purpose)}</p>` : `<p class="nowlab">${icon('sun-max')}Today's plan</p><h3 class="t-title3">${esc(day.title)}</h3><p class="t-sub sec">${esc(day.summary)}</p>`;
    const nextBlock = nn.next ? `<div class="box"><p class="lab">Next · ${esc(nn.next.z.time)}</p><p class="t-headline">${esc(nn.next.z.name)}</p>${nn.next.z.getting_there && nn.next.z.getting_there.how ? `<p class="t-foot sec">${esc(nn.next.z.getting_there.how)}</p>` : ''}<div class="acts">${goBtn(nn.next.z.getting_there.maps_query, nn.next.z.getting_there.mode, nn.next.z.getting_there.arrive_at, true)}</div></div>` : (nn.cur ? `<div class="box"><p class="lab">Then</p><p class="t-headline">End of the day</p><p class="t-foot sec">${esc(day.home.how)}</p></div>` : '');
    return { title: 'Today', body: `
      <section class="card now-card" aria-live="polite"><p class="t-foot sec num">${esc(day.date)} · ${esc(day.k)} · Day ${idx + 1} of ${D.days.length}</p>${nowBlock}${nextBlock}<a class="btn plain" style="justify-content:flex-start;padding:0" href="${esc(href({ v: 'days', d: day.iso }))}">Open the full day ${icon('chevron-right')}</a></section>
      <nav class="quick" aria-label="Quick actions">
        ${ext(dirURL(D.hotel.maps_query, n.mins >= 1200 ? 'driving' : 'transit'), '', icon('building-2', 'tb') + '<span>Back to the hotel</span>', 'Directions back to the hotel')}
        <a href="${esc(href({ v: 'food', c: 'halal', g: grp }))}">${icon('fork-knife', 'tb')}<span>Food near here</span></a>
        <a href="${esc(href({ v: 'food', c: 'halal', g: grp, x: 'prayer' }))}">${icon('moon-stars', 'tb')}<span>Prayer rooms</span></a>
        <a href="${esc(href({ v: 'taxi' }))}">${icon('car', 'tb')}<span>Taxi card</span></a>
      </nav>
      <section><h2 class="group-h">Rest of today</h2><div class="list">${day.zones.map((z, i) => `<a class="cell" href="${esc(href({ v: 'days', d: day.iso, x: 'z' + i }))}"><span class="lead"><span class="zn" style="--c:${c};width:26px;height:26px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;font-size:var(--fs-caption1);font-weight:var(--fw-bold)">${i + 1}</span></span><span class="body"><span class="ttl b">${esc(z.name)}</span><span class="sub num">${esc(z.time)} · ${esc(z.purpose)}</span></span><span class="trail">${icon('chevron-right')}</span></a>`).join('')}</div></section>
      ${day.watch_outs.length ? `<section><h2 class="group-h">Watch out</h2><div class="list">${day.watch_outs.slice(0, 3).map((w) => `<div class="cell icon-lead"><span class="lead" style="color:var(--yellow-text)">${icon('exclamation-triangle', 'tb')}</span><span class="body"><span class="ttl">${esc(w)}</span></span></div>`).join('')}${day.watch_outs.length > 3 ? `<a class="cell" href="${esc(href({ v: 'days', d: day.iso, x: 'know' }))}"><span class="lead"></span><span class="body"><span class="ttl" style="color:var(--tint)">${day.watch_outs.length - 3} more</span></span><span class="trail">${icon('chevron-right')}</span></a>` : ''}</div></section>` : ''}
      ${tm ? `<section><h2 class="group-h">Tomorrow</h2><a class="list cell" href="${esc(href({ v: 'days', d: tm.iso }))}"><span class="lead">${icon(TYPE[tm.type][2], 'tb')}</span><span class="body"><span class="ttl b">${esc(tm.title)}</span><span class="sub">${esc(tm.date)} · ${esc(tm.place)} · ${LOAD[tm.load]}</span></span><span class="trail">${icon('chevron-right')}</span></a></section>` : ''}` };
  }

  function rhythm(selIso) {
    const t = todayDay(); const light = D.days.filter((d) => d.load <= 2).length, mod = D.days.filter((d) => d.load === 3).length, full = D.days.filter((d) => d.load === 4).length;
    return `<section class="card" aria-labelledby="rh"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-3)"><h2 id="rh" class="t-title3">Trip at a glance</h2><p class="t-foot sec num">${light} light · ${mod} moderate · ${full} full</p></div>
      <div class="rhythm" style="--n:${D.days.length}" role="list" aria-label="Days of the trip">${D.days.map((d) => `<a role="listitem" class="col${d.wkd ? ' wkd' : ''}${d.open ? ' open' : ''}${t && t.iso === d.iso ? ' today' : ''}${selIso === d.iso ? ' sel' : ''}" href="${esc(href({ v: 'days', d: d.iso }))}" aria-label="${esc(d.date)}${t && t.iso === d.iso ? ' (today)' : ''}, ${esc(d.title)}, ${LOAD[d.load].toLowerCase()}${d.open ? ', decision open' : ''}" aria-current="${selIso === d.iso ? 'true' : 'false'}"><span class="dot"></span><span class="track"><span class="bar" style="--h:${d.load / 4};--c:${TYPE[d.type][1]}"></span></span><span class="k" lang="ja">${d.k}</span><span class="n num">${d.n}</span></a>`).join('')}</div>
      <div class="legend"><span><i class="sw" style="--c:var(--type-shop)"></i>Shopping</span><span><i class="sw" style="--c:var(--type-sight)"></i>Sightseeing</span><span><i class="sw" style="--c:var(--type-rest)"></i>Rest</span><span><i class="sw" style="--c:var(--type-travel)"></i>Travel</span><span><i class="sw" style="--c:var(--label-tertiary);width:6px;height:12px"></i>Taller is busier</span><span><i class="sw ring"></i>To decide</span></div></section>`;
  }
  function dayList(selIso) {
    const t = todayDay();
    return `<section><h2 class="group-h">All days</h2><div class="list">${D.days.map((d) => `<a class="cell${selIso === d.iso ? ' sel' : ''}" href="${esc(href({ v: 'days', d: d.iso }))}" aria-current="${selIso === d.iso ? 'true' : 'false'}"><span class="lead" style="color:${TYPE[d.type][1]}">${icon(TYPE[d.type][2], 'tb')}</span><span class="body"><span class="ttl b">${esc(d.title)}${t && t.iso === d.iso ? ' <span class="chip decide" style="margin-left:4px">Today</span>' : ''}</span><span class="sub num">${esc(d.date)} · ${esc(d.place)}</span><span class="chips" style="margin-top:4px">${typeChip(d.type)}<span class="chip">${LOAD[d.load]}</span>${d.open ? `<span class="chip decide">${icon('question-circle')}To decide</span>` : ''}</span></span><span class="trail">${icon('chevron-right')}</span></a>`).join('')}</div></section>`;
  }
  function dayDetail(d, standalone) {
    const i = D.days.indexOf(d); const c = TYPE[d.type][1]; const prev = D.days[i - 1], next = D.days[i + 1]; const t = todayDay();
    const flow = `<section><h2 class="group-h">The day</h2><div class="card"><div class="flow">${d.flow.map((f) => `<div class="it"><span class="when"><i class="lvl" data-l="${f.level}" style="--c:${c}"></i>${esc(f.when)}</span><p class="t-sub">${esc(f.text)}</p></div>`).join('')}</div><p class="legend"><span><i class="lvl" data-l="2" style="--c:var(--label-tertiary)"></i>On the go</span><span><i class="lvl" data-l="1" style="--c:var(--label-tertiary)"></i>Easy</span><span><i class="lvl" data-l="0"></i>Downtime</span></p></div></section>`;
    const zones = `<section id="zones"><h2 class="group-h">Zones <span class="act" style="color:var(--label-secondary)">In order. Tap a name for details</span></h2><div style="display:grid;gap:var(--space-4)">${d.zones.map((z, k) => { const g = z.getting_there || {}; const gq = g.maps_query || g.arrive_at || z.name; return `<article class="zone" id="z${k}" aria-labelledby="zt${k}"><div class="zh"><span class="zn" style="--c:${c}">${k + 1}</span><div><h3 id="zt${k}" class="t-title3">${esc(z.name)}</h3><p class="ztime num">${esc(z.time)}</p>${z.purpose ? `<p class="t-sub">${esc(z.purpose)}</p>` : ''}</div></div>
      ${g.how ? `<div class="box"><p class="lab">Getting there</p><p class="t-sub">${esc(g.how)}</p>${meta([g.minutes ? 'About ' + g.minutes + ' min' : '', g.fare, g.arrive_at ? 'Arrive: ' + g.arrive_at : ''])}<div class="acts">${goBtn(gq, g.mode || 'transit', g.arrive_at || z.name, true)}${g.mode !== 'driving' ? goBtn(gq, 'driving', g.arrive_at || z.name) : ''}${mapBtn(gq, g.arrive_at || z.name)}</div></div>` : ''}
      ${z.stops.length ? `<div class="zone-list">${z.stops.map((s) => placeRow('stop', s, d.iso + k, { zone: z.name })).join('')}</div>` : ''}
      ${z.eat.length ? `<details class="disc" ${tier() !== 'compact' ? 'open' : ''}><summary><span>Eat<span class="cnt num">${z.eat.length}</span></span>${icon('chevron-down')}</summary><div class="list zone-list">${z.eat.map((e) => placeRow('eat', e, d.iso + k, { zone: z.name })).join('')}</div></details>` : ''}
      ${z.sweet.length ? `<details class="disc"><summary><span>Something sweet<span class="cnt num">${z.sweet.length}</span></span>${icon('chevron-down')}</summary><div class="list zone-list">${z.sweet.map((e) => placeRow('sweet', e, d.iso + k, { zone: z.name })).join('')}</div></details>` : ''}
      ${z.shop.length ? `<details class="disc"><summary><span>Shop<span class="cnt num">${z.shop.length}</span></span>${icon('chevron-down')}</summary><div class="list zone-list">${z.shop.map((e) => placeRow('shop', e, d.iso + k, { zone: z.name })).join('')}</div></details>` : ''}
      </article>`; }).join('')}</div></section>
      ${d.home && d.home.how ? `<section><h2 class="group-h">End of the day</h2><div class="card"><p class="t-sub">${esc(d.home.how)}</p><div class="acts">${goBtn(d.home.maps_query || D.hotel.maps_query, d.home.mode || 'transit', 'the hotel', true)}${d.home.mode !== 'driving' ? goBtn(d.home.maps_query || D.hotel.maps_query, 'driving', 'the hotel') : ''}</div></div></section>` : ''}`;
    const know = `<section id="know"><h2 class="group-h">Good to know</h2><div class="list">${d.pacing ? `<div class="cell icon-lead"><span class="lead">${icon('figure-walk', 'tb')}</span><span class="body"><span class="ttl">${esc(d.pacing)}</span><span class="sub">Pacing</span></span></div>` : ''}${d.watch_outs.map((w) => `<div class="cell icon-lead"><span class="lead" style="color:var(--yellow-text)">${icon('exclamation-triangle', 'tb')}</span><span class="body"><span class="ttl">${esc(w)}</span></span></div>`).join('')}</div></section>
      ${d.decisions.length ? `<section><h2 class="group-h">Questions to settle</h2><div class="list">${d.decisions.map((q) => `<div class="cell icon-lead"><span class="lead">${icon('question-circle', 'tb')}</span><span class="body"><span class="ttl">${esc(q)}</span></span></div>`).join('')}</div></section>` : ''}
      ${d.sources.length ? `<details class="disc"><summary><span>Sources<span class="cnt num">${d.sources.length}</span></span>${icon('chevron-down')}</summary><div class="list">${d.sources.map((u) => ext(u, 'cell', `<span class="lead">${icon('link', 'tb')}</span><span class="body"><span class="ttl" style="overflow-wrap:anywhere;color:var(--tint)">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</span></span>`, 'Source ' + u)).join('')}</div></details>` : ''}`;
    return `<div class="view ${standalone ? '' : 'fade'}" key="${d.iso}">
      <header class="day-head"><div><p class="t-foot sec num">${t && t.iso === d.iso ? '<span style="color:var(--tint);font-weight:var(--fw-semibold)">Today</span> · ' : ''}${esc(d.date)} · <span lang="ja">${esc(d.k)}</span> · ${d.wkd ? 'Weekend' : 'Weekday'}</p><h1 class="t-title2" id="dtitle" tabindex="-1">${esc(d.title)}</h1><p class="sec">${esc(d.place)}</p></div><div class="nav"><a class="${prev ? '' : 'dis'}" ${prev ? `href="${esc(href({ v: 'days', d: prev.iso }))}"` : 'aria-disabled="true"'} aria-label="Previous day${prev ? ', ' + esc(prev.date) : ''}" role="button" style="${prev ? '' : 'color:var(--label-tertiary);pointer-events:none'}">${icon('chevron-left', 'tb')}</a><a ${next ? `href="${esc(href({ v: 'days', d: next.iso }))}"` : 'aria-disabled="true"'} aria-label="Next day${next ? ', ' + esc(next.date) : ''}" role="button" style="${next ? '' : 'color:var(--label-tertiary);pointer-events:none'}">${icon('chevron-right', 'tb')}</a></div></header>
      <div class="chips" style="margin-top:var(--space-4)">${typeChip(d.type)}<span class="chip">${LOAD[d.load]}</span><span class="chip">${icon('figure-walk')}Walking: ${esc(d.walk.toLowerCase())}</span></div>
      <p class="t-body" style="margin-top:var(--space-4)">${esc(d.summary)}</p>
      ${d.open ? `<div class="card tint" style="margin-top:var(--space-5)"><p class="lab">${icon('question-circle')} To decide</p><p>${esc(d.open)}</p></div>` : ''}
      <div class="day-grid" style="margin-top:var(--space-6)"><div style="display:grid;gap:var(--space-6);min-width:0">${tier() === 'xwide' || document.documentElement.dataset.compactHeight === 'true' ? zones : flow + zones + know}</div><div class="rail">${tier() === 'xwide' || document.documentElement.dataset.compactHeight === 'true' ? flow + know : ''}</div></div>
    </div>`;
  }
  function vDays() {
    const r = route(); const t = tier(); const sel = r.d ? D.days.find((d) => d.iso === r.d) : null;
    if (t === 'compact') {
      if (sel) return { title: sel.title, inline: true, back: { label: 'Days', to: { v: 'days', d: '' } }, inner: 'day-inner', body: dayDetail(sel, true) };
      return { title: 'Days', body: rhythm('') + dayList('') };
    }
    const cur = sel || todayDay() || D.days[0];
    return { title: 'Days', inner: 'split-inner', body: `<div class="split"><div class="col-list">${rhythm(cur.iso)}${dayList(cur.iso)}</div><div class="col-detail scroll">${dayDetail(cur, false)}</div></div>` };
  }

  function vFood() {
    const r = route(); const t = tier(); const today = todayDay(); const grpToday = today ? D.halal.dayGroup[today.iso] : '';
    const cats = [['bakeries', 'Bakeries', D.bakeries.length], ['breakfast', 'Breakfast', D.bakeries.filter((b) => mins(b.opens) <= 510).length], ['pancakes', 'Pancakes', 2], ['halal', 'Halal', D.halal.places.length]];
    const cat = r.c || 'bakeries';
    const catBar = `<div class="filter-chips" role="radiogroup" aria-label="Food category">${cats.map((c) => `<a role="radio" class="fchip" aria-checked="${cat === c[0]}" href="${esc(href({ v: 'food', c: c[0], g: '', p: '' }))}">${c[1]}<span class="cnt num">${c[2]}</span></a>`).join('')}</div>`;
    let list = '', head = '';
    if (cat === 'halal') {
      const g = r.g || grpToday || D.halal.groups[0].id; const cert = r.x === 'cert'; const gl = (D.halal.groups.find((x) => x.id === g) || {}).label;
      const items = D.halal.places.filter((p) => p.g === g && (!cert || p.status === 'Halal certified')); const RANK = { 'Halal certified': 0, 'Halal (own claim)': 1, 'Halal menu': 2, 'Muslim-friendly': 3, 'Not halal: fallback': 4 };
      items.sort((a, b) => (RANK[a.status] - RANK[b.status]) || ((a.walk_min || 99) - (b.walk_min || 99)));
      const pr = D.halal.prayer.filter((p) => p.g === g);
      head = `<div class="card" style="gap:var(--space-3)"><h2 class="t-title3">Halal</h2><p class="t-foot sec">Researched and checked ${esc(D.halal.as_of)}. Pick where you are; it opens on today's area during the trip.</p>
        <div class="filter-chips" role="radiogroup" aria-label="Area">${D.halal.groups.map((x) => `<a role="radio" class="fchip" aria-checked="${x.id === g}" href="${esc(href({ v: 'food', c: 'halal', g: x.id, p: '' }))}">${x.id === grpToday ? '<span class="today">Today</span>' : ''}${esc(x.label)}<span class="cnt num">${D.halal.places.filter((p) => p.g === x.id && (!cert || p.status === 'Halal certified')).length}</span></a>`).join('')}</div>
        <label class="cell" style="padding:var(--space-2) 0;grid-template-columns:1fr auto"><span class="body"><span class="ttl">Certified only</span></span><span class="switch"><input type="checkbox" data-cert ${cert ? 'checked' : ''} aria-label="Certified only"><span class="tr"><span class="kn"></span></span></span></label>
        <div class="chips" aria-label="Legend">${['Halal certified', 'Halal (own claim)', 'Halal menu', 'Muslim-friendly', 'Not halal: fallback'].map(chip).join('')}</div>
        <div class="acts">${ext(searchURL('halal restaurant'), 'act-btn solid', icon('magnifyingglass') + 'Halal near me', 'Search halal restaurants near you in the maps app')}${ext(searchURL('prayer room'), 'act-btn', icon('moon-stars') + 'Prayer room near me', 'Search prayer rooms near you in the maps app')}</div></div>`;
      list = `<section><h2 class="group-h">${esc(gl)}</h2><div class="list">${items.length ? items.map((p) => placeRow('halal', p, g)).join('') : `<div class="empty">${icon('fork-knife', 'lg')}<p>${cert ? 'No certified places in this area. Turn off Certified only to see more.' : 'Nothing verified in this area yet.'}</p></div>`}</div></section>
        ${pr.length ? `<section id="prayer"><h2 class="group-h">Prayer rooms · ${esc(gl)}</h2><div class="list">${pr.map((p) => `<div class="row"><div class="top"><span class="nm">${esc(p.name)}</span><span class="chip">${icon('moon-stars')}Prayer room</span></div>${meta([p.where, p.hours])}<div class="acts">${goBtn(p.maps_query, 'walking', p.name, true)}${mapBtn(p.maps_query, p.name)}${srcBtn(p.source, p.name)}</div></div>`).join('')}</div></section>` : ''}
        ${D.halal.dropped.length ? `<details class="disc"><summary><span>Closed or left out<span class="cnt num">${D.halal.dropped.length}</span></span>${icon('chevron-down')}</summary><div class="list">${D.halal.dropped.map((x) => `<div class="cell"><span class="lead"></span><span class="body"><span class="ttl">${esc(x.name)}</span><span class="sub">${esc(x.reason)}</span></span></div>`).join('')}</div></details>` : ''}`;
    } else {
      let items = D.bakeries.slice(); let blurb = 'Pastries and coffee near the hotel.';
      if (cat === 'breakfast') { items = items.filter((b) => mins(b.opens) <= 510); blurb = 'Early openers and breakfast cafés.'; }
      if (cat === 'pancakes') { items = []; D.days.forEach((d) => d.zones.forEach((z) => z.sweet.concat(z.eat).forEach((it) => { if (/pancake/i.test(it.name + ' ' + (it.what || '')) && !items.find((x) => x.name === it.name)) items.push(Object.assign({ area: z.name }, it)); }))); blurb = 'Soufflé and classic pancakes found across the trip.'; }
      const sort = r.x === 'early' ? 'early' : 'near';
      if (cat !== 'pancakes') items.sort((a, b) => sort === 'early' ? ((mins(a.opens) || 9999) - (mins(b.opens) || 9999)) : ((a.walk_min || 99) - (b.walk_min || 99)));
      head = `<div class="card" style="gap:var(--space-3)"><h2 class="t-title3">${cats.find((c) => c[0] === cat)[1]}</h2><p class="t-foot sec">${blurb}</p>${cat !== 'pancakes' ? `<div class="seg" role="radiogroup" aria-label="Sort"><button role="radio" aria-checked="${sort === 'near'}" data-sort="near">Nearest the hotel</button><button role="radio" aria-checked="${sort === 'early'}" data-sort="early">Opens earliest</button></div>` : ''}</div>`;
      list = `<section><div class="list">${items.length ? items.map((b) => placeRow(cat === 'pancakes' ? 'sweet' : 'bakery', b, cat, { zone: b.area })).join('') : `<div class="empty">${icon('cup', 'lg')}<p>Nothing here yet.</p></div>`}</div></section>`;
    }
    const listCol = catBar + head + list;
    if (t === 'compact') return { title: 'Food', body: listCol };
    return { title: 'Food', inner: 'split-inner', body: `<div class="split"><div class="col-list">${listCol}</div><div class="col-detail scroll"><div class="inspector${r.p ? '' : ' placeholder'}">${r.p ? `<div class="sh" style="padding:0 0 var(--space-3);display:grid;grid-template-columns:1fr auto;border-bottom:var(--hairline) solid var(--separator)"><div><h2 class="t-title2">${esc((PLACES[r.p] || {}).name || '')}</h2>${(PLACES[r.p] || {}).jp ? `<p class="sec" lang="ja">${esc(PLACES[r.p].jp)}</p>` : ''}</div><a class="close-btn" href="${esc(href({ p: '' }))}" aria-label="Close details">${icon('xmark')}</a></div>` + placeDetail(r.p) : placeDetail('')}</div></div></div>` };
  }

  function vPlaces() {
    const r = route(); const t = tier(); const kind = r.k || 'stops'; const by = r.by || 'day'; const q = (r.q || '').toLowerCase(); const onlyB = r.x === 'b';
    const KINDS = [['stops', 'See'], ['shop', 'Shop'], ['sweet', 'Sweet'], ['eat', 'Eat']];
    const groups = [];
    const add = (key, label, it, zone, day) => { if (q && (it.name + ' ' + (it.jp || '') + ' ' + (it.what || '')).toLowerCase().indexOf(q) < 0) return; if (kind === 'eat' && onlyB && evClass(it.for_b) === 'no') return; let g = groups.find((x) => x.key === key); if (!g) { g = { key, label, items: [], day }; groups.push(g); } g.items.push([it, zone, day]); };
    D.days.forEach((d) => d.zones.forEach((z) => (z[kind] || []).forEach((it) => by === 'day' ? add(d.iso, d.date + ' · ' + d.title, it, z.name, d) : add(z.name, z.name, it, z.name, d))));
    const kindLabel = kind === 'stops' ? 'stop' : kind;
    const body = `<div class="seg" role="radiogroup" aria-label="Kind of place">${KINDS.map((k) => `<button role="radio" aria-checked="${kind === k[0]}" data-kind="${k[0]}">${k[1]}</button>`).join('')}</div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;justify-content:space-between"><div class="seg" role="radiogroup" aria-label="Group by" style="min-width:200px"><button role="radio" aria-checked="${by === 'day'}" data-by="day">By day</button><button role="radio" aria-checked="${by === 'area'}" data-by="area">By area</button></div>${kind === 'eat' ? `<label class="cell" style="padding:0;min-height:0;grid-template-columns:auto auto;gap:var(--space-3)"><span class="t-sub">Works for ${esc(B.name)}</span><span class="switch"><input type="checkbox" data-onlyb ${onlyB ? 'checked' : ''} aria-label="Only places that work for ${esc(B.name)}"><span class="tr"><span class="kn"></span></span></span></label>` : ''}</div>
      ${groups.length ? groups.map((g) => `<section><h2 class="group-h"><span>${esc(g.label)}</span>${by === 'day' ? `<a class="act" href="${esc(href({ v: 'days', d: g.key }))}">Open day</a>` : ''}</h2><div class="list">${g.items.map((x) => placeRow(kindLabel, x[0], g.key, { zone: by === 'day' ? x[1] : x[2].date })).join('')}</div></section>`).join('') : `<div class="card empty">${icon('magnifyingglass', 'lg')}<p>No ${KINDS.find((k) => k[0] === kind)[1].toLowerCase()} places match${q ? ' "' + esc(r.q) + '"' : ''}.</p>${q ? `<a class="btn secondary" style="width:auto" href="${esc(href({ q: '' }))}">Clear search</a>` : ''}</div>`}`;
    const search = `<form class="field" role="search" data-search style="margin-top:var(--space-2)"><label class="vh" for="pq">Search places</label><div class="in"><input id="pq" type="search" placeholder="Search names and notes" value="${esc(r.q)}" autocomplete="off"><span class="eye" aria-hidden="true">${icon('magnifyingglass', 'tb')}</span></div></form>`;
    if (t === 'compact') return { title: 'Places', body: search + body };
    return { title: 'Places', inner: 'split-inner', body: `<div class="split"><div class="col-list">${search}${body}</div><div class="col-detail scroll"><div class="inspector${r.p ? '' : ' placeholder'}">${r.p ? `<div style="display:grid;grid-template-columns:1fr auto;gap:var(--space-3);padding-bottom:var(--space-3);border-bottom:var(--hairline) solid var(--separator)"><div><h2 class="t-title2">${esc((PLACES[r.p] || {}).name || '')}</h2>${(PLACES[r.p] || {}).jp ? `<p class="sec" lang="ja">${esc(PLACES[r.p].jp)}</p>` : ''}</div><a class="close-btn" href="${esc(href({ p: '' }))}" aria-label="Close details">${icon('xmark')}</a></div>` + placeDetail(r.p) : placeDetail('')}</div></div></div>` };
  }

  function vInfo() {
    const r = route(); const sec = (id) => D.doc.sections.find((s) => s.id === id);
    const statusChip = (s) => s ? `<span class="chip ${s === 'Booked' || s === 'Decided' ? 'cert' : ''}">${s === 'Booked' || s === 'Decided' ? icon('checkmark-circle') : icon('question-circle')}${esc(s)}</span>` : '';
    const rows = (list, withQ) => `<div class="list">${list.map((x) => `<div class="row"><div class="top"><span class="nm">${esc(x.title)}</span>${statusChip(x.status)}</div>${x.detail ? `<p class="what">${esc(x.detail)}</p>` : ''}${x.lean ? `<p class="meta">Lean: ${esc(x.lean)}</p>` : ''}${withQ && x.q ? `<div class="acts">${goBtn(x.q, 'transit', x.title, true)}${mapBtn(x.q, x.title)}</div>` : ''}</div>`).join('')}</div>`;
    const H = D.hotel;
    const body = `
      <section id="hotel"><h2 class="group-h">Hotel</h2><div class="list">
        <div class="cell icon-lead"><span class="lead">${icon('building-2', 'tb')}</span><span class="body"><span class="ttl b">${esc(H.name)}</span><span class="sub">${esc(H.address)}</span><span class="sub">Check in ${esc(H.checkin)} · Check out ${esc(H.checkout)} · ${esc(H.stations)}</span></span></div>
        <a class="cell icon-lead" href="${esc(href({ v: 'taxi' }))}"><span class="lead">${icon('car', 'tb')}</span><span class="body"><span class="ttl">Show taxi card</span><span class="sub">Large Japanese name and address for a driver</span></span><span class="trail">${icon('chevron-right')}</span></a>
        ${ext('tel:' + H.phone.replace(/\s/g, ''), 'cell icon-lead', `<span class="lead">${icon('phone', 'tb')}</span><span class="body"><span class="ttl">Call the hotel</span><span class="sub num">${esc(H.phone)}</span></span>`, 'Call the hotel')}
        <div class="cell icon-lead" style="grid-template-columns:auto 1fr"><span class="lead">${icon('directions', 'tb')}</span><span class="acts">${goBtn(H.maps_query, 'driving', 'the hotel', true)}${goBtn(H.maps_query, 'transit', 'the hotel')}${goBtn(H.maps_query, 'walking', 'the hotel')}${mapBtn(H.maps_query, 'the hotel')}</span></div></div></section>
      <section id="getting-around"><h2 class="group-h">Getting around</h2>${rows(sec('getting-around').rows, true)}<p class="group-f">Trains for distance, taxis for the last stretch.</p></section>
      <section id="bookings"><h2 class="group-h">Bookings</h2>${rows(sec('bookings').rows)}<p class="group-f">Status from the trip notes. References are in the confirmation emails.</p></section>
      <section id="airport-day"><h2 class="group-h">Airport day</h2><div class="list">${sec('airport-day').steps.map((s, i) => `<div class="cell"><span class="lead"><span class="chip num" style="min-width:26px;justify-content:center">${i + 1}</span></span><span class="body"><span class="ttl">${esc(s)}</span></span></div>`).join('')}</div></section>
      <section id="tax-free"><h2 class="group-h">Tax-free shopping</h2><div class="list">${sec('tax-free').bullets.map((s) => `<div class="cell icon-lead"><span class="lead">${icon('yen', 'tb')}</span><span class="body"><span class="ttl">${esc(s)}</span></span></div>`).join('')}</div></section>
      <section id="guides"><h2 class="group-h">Guides</h2><div class="list">${sec('guides').rows.map((g) => `<a class="cell" href="#"><span class="lead"></span><span class="body"><span class="ttl">${esc(g.title)}</span><span class="sub">${esc(g.detail)}</span></span><span class="trail">${icon('chevron-right')}</span></a>`).join('')}</div></section>
      <section id="decisions"><h2 class="group-h">Decisions</h2>${rows(sec('decisions').rows.slice().sort((a, b) => (a.status === 'Open' ? -1 : 1) - (b.status === 'Open' ? -1 : 1)))}</section>
      <section id="wants"><h2 class="group-h">What we want</h2>${rows(sec('wants').rows)}</section>
      <section id="sources"><h2 class="group-h">Sources</h2><div class="list">${sec('sources').links.map((u) => ext(u, 'cell icon-lead', `<span class="lead">${icon('link', 'tb')}</span><span class="body"><span class="ttl" style="color:var(--tint);overflow-wrap:anywhere">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</span></span>`, 'Source ' + u)).join('')}</div></section>
      <section id="appgroup"><h2 class="group-h">App</h2><div class="list">
        <label class="cell icon-lead"><span class="lead">${icon('lock-open', 'tb')}</span><span class="body"><span class="ttl">Keep unlocked on this device</span><span class="sub">Off means the password is asked once per launch</span></span><span class="switch"><input type="checkbox" data-keep ${settings.keep ? 'checked' : ''} aria-label="Keep unlocked on this device"><span class="tr"><span class="kn"></span></span></span></label>
        <a class="cell icon-lead" href="${esc(href({ v: 'locked', s: 'password' }))}"><span class="lead">${icon('lock', 'tb')}</span><span class="body"><span class="ttl" style="color:var(--tint)">Lock now</span></span></a>
        <div class="cell icon-lead"><span class="lead">${icon('map', 'tb')}</span><span class="body"><span class="ttl">Maps app</span></span><span class="seg" style="min-width:200px" role="radiogroup" aria-label="Maps app"><button role="radio" aria-checked="${settings.maps === 'google'}" data-maps="google">Google Maps</button><button role="radio" aria-checked="${settings.maps === 'apple'}" data-maps="apple">Apple Maps</button></span></div>
        <div class="cell icon-lead"><span class="lead">${icon('plus-app', 'tb')}</span><span class="body"><span class="ttl">Add to Home Screen</span><span class="sub">In Safari tap Share, then Add to Home Screen. The app then opens full screen and works offline.</span></span></div>
        <div class="cell icon-lead"><span class="lead">${icon('arrow-clockwise', 'tb')}</span><span class="body"><span class="ttl">Offline ready</span><span class="sub num">Trip data ${esc(D.meta.version)} · researched ${esc(D.meta.researched)} · halal checked ${esc(D.halal.as_of)}</span></span></div>
        <a class="cell icon-lead" href="${esc(href({ v: 'locked', s: 'missing' }))}"><span class="lead">${icon('key', 'tb')}</span><span class="body"><span class="ttl">Update trip link</span><span class="sub">Paste a new private link if you were sent one</span></span><span class="trail">${icon('chevron-right')}</span></a>
        <div class="cell icon-lead"><span class="lead">${icon('info-circle', 'tb')}</span><span class="body"><span class="ttl">About</span><span class="sub">Private, unlisted and encrypted. Opening the trip needs both the private link and the password. Nothing is tracked.</span></span></div></div>
        <p class="group-f">Prototype only: Lock now and Update trip link open the locked screen states.</p></section>`;
    return { title: 'Info', body, scrollTo: r.x };
  }

  function vTaxi() {
    const H = D.hotel;
    return { full: true, body: `<div class="taxi view fade" role="dialog" aria-labelledby="taxit"><div style="display:flex;justify-content:space-between;align-items:center"><p class="lab">Show this to the driver</p><a class="close-btn" href="${esc(href({ v: 'info' }))}" aria-label="Close taxi card">${icon('xmark')}</a></div>
      <div><p id="taxit" class="jp-name" lang="ja">${esc(H.jp)}</p><p class="jp-addr" lang="ja">${esc(H.address_jp)}</p></div>
      <div class="box"><p class="t-sub">${esc(H.name)}</p><p class="t-foot sec">${esc(H.address)} · <span class="num">${esc(H.phone)}</span></p></div>
      <div class="acts">${goBtn(H.maps_query, 'driving', 'the hotel', true)}${mapBtn(H.maps_query, 'the hotel')}${ext('tel:' + H.phone.replace(/\s/g, ''), 'act-btn', icon('phone') + 'Call', 'Call the hotel')}</div>
      <p class="t-foot sec">Works offline. Tap the address to copy it if the driver prefers to read it from a map app.</p></div>` };
  }

  function vLocked() {
    const r = route(); const s = r.s || 'password';
    const mark = `<div class="mark">${icon(s === 'missing' ? 'key' : s === 'offline' ? 'wifi-slash' : 'lock', 'lg')}</div>`;
    let inner = '';
    if (s === 'missing') inner = `${mark}<div style="text-align:center;display:grid;gap:var(--space-2)"><h1 class="t-title2">Open this from your private trip link</h1><p class="sec t-sub">This address on its own cannot unlock the trip. Open the full link you were sent, or paste it here once.</p></div>
      <form class="field" data-paste><label for="lnk">Trip link</label><div class="in"><input id="lnk" type="url" inputmode="url" placeholder="Paste the full link" autocomplete="off"></div><p class="err" role="status" aria-live="polite"></p></form><button class="btn primary" type="submit" form="pf">Continue</button><p class="fine">The link is kept on this device only and is never sent anywhere.</p>`;
    else if (s === 'offline') inner = `${mark}<div style="text-align:center;display:grid;gap:var(--space-2)"><h1 class="t-title2">You're offline</h1><p class="sec t-sub">The trip has not been loaded on this device yet, so it needs a connection once. After that it works offline.</p></div><a class="btn primary" href="${esc(href({ v: 'locked', s: 'password' }))}">Try again</a>`;
    else inner = `${mark}<div style="text-align:center;display:grid;gap:var(--space-2)"><h1 class="t-title2">Osaka Trip</h1><p class="sec t-sub">Enter the password to open the plan.</p></div>
      <form class="field" data-unlock novalidate><label for="pw">Password</label><div class="in"><input id="pw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Password" required><button type="button" class="eye" data-eye aria-label="Show password" aria-pressed="false">${icon('eye', 'tb')}</button></div><p class="err" role="status" aria-live="polite">${s === 'fail' ? icon('exclamation-triangle') + 'That password didn\'t work. Check it and try again.' : ''}</p>
      <label class="cell" style="padding:var(--space-2) 0;grid-template-columns:1fr auto"><span class="body"><span class="ttl">Keep unlocked on this ${/iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone'}</span></span><span class="switch"><input type="checkbox" data-keep ${settings.keep ? 'checked' : ''} aria-label="Keep unlocked on this device"><span class="tr"><span class="kn"></span></span></span></label>
      <button class="btn primary" type="submit"><span class="prog" aria-hidden="true"></span><span class="lbl">Unlock</span></button></form><p class="fine">Both the private link and the password are needed. Nothing is sent to a server.</p>`;
    return { full: true, body: `<div class="locked view fade"><div class="pane">${inner}</div></div>` };
  }

  /* ---------- Shell ---------- */
  function navbar(v, info) {
    const t = tier(); const r = route();
    const lead = info.back ? `<a class="nav-btn" href="${esc(href(info.back.to))}" aria-label="Back to ${esc(info.back.label)}">${icon('chevron-left', 'tb')}<span class="lbl">${esc(info.back.label)}</span></a>` : (t !== 'compact' ? `<button class="nav-btn" data-sb aria-label="${sidebarOpen() ? 'Hide sidebar' : 'Show sidebar'}" aria-expanded="${sidebarOpen()}">${icon('sidebar', 'tb')}</button>` : '');
    const tabs = t !== 'compact' && !sidebarOpen() ? `<nav class="toptabs" aria-label="Sections">${TABS.map((tb) => `<a href="${esc(href({ v: tb[0], d: '', p: '', x: '' }))}" ${v === tb[0] ? 'aria-current="page"' : ''}>${icon(v === tb[0] ? tb[2] + '-fill' : tb[2])}${tb[1]}</a>`).join('')}</nav>` : `<span class="nav-title">${esc(info.title || '')}</span>`;
    const trail = `${!navigator.onLine ? `<span class="pill-off">${icon('wifi-slash')}Offline</span>` : ''}${r.asof ? `<a class="nav-btn" href="${esc(href({ asof: '' }))}" aria-label="Stop viewing as another time">${icon('clock', 'tb')}</a>` : ''}`;
    const large = !info.inline && !info.back ? `<div class="large-title"><h1 class="t-large">${esc(info.title)}</h1></div>` : '';
    return `<header class="navbar${info.inline || info.back ? ' inline' : ''}"><div class="nav-row"><div class="nav-lead">${lead}</div>${tabs}<div class="nav-trail">${trail}</div></div>${large}</header>`;
  }
  function tabbar(v) { return `<nav class="tabbar" aria-label="Sections">${TABS.map((tb) => `<a href="${esc(href({ v: tb[0], d: '', p: '', x: '' }))}" ${v === tb[0] ? 'aria-current="page"' : ''}>${icon(v === tb[0] ? tb[2] + '-fill' : tb[2], 'tab')}<span>${tb[1]}</span></a>`).join('')}</nav>`; }
  function sidebar(v) {
    const r = route(); const t = todayDay();
    return `<aside class="sidebar" aria-label="Sidebar"><div class="sb-inner"><p class="sb-title t-title2">Osaka Trip</p><nav aria-label="Sections">${TABS.map((tb) => `<a class="sb-row" href="${esc(href({ v: tb[0], d: '', p: '', x: '' }))}" ${v === tb[0] && !(tb[0] === 'days' && r.d) ? 'aria-current="page"' : ''}>${icon(v === tb[0] ? tb[2] + '-fill' : tb[2], 'tb')}<span class="sbt">${tb[1]}</span></a>`).join('')}</nav>
      <nav aria-label="Days"><p class="sb-sec">Days</p>${D.days.map((d) => `<a class="sb-row${v === 'days' && r.d === d.iso ? ' sel' : ''}${t && t.iso === d.iso ? ' today' : ''}" href="${esc(href({ v: 'days', d: d.iso }))}"><span class="d num">${d.n}</span><span class="sbt">${esc(d.title)}<span class="sbs">${esc(d.date)}</span></span></a>`).join('')}</nav></div></aside>`;
  }
  function banners() { const r = route(); let h = ''; if (r.asof) h += `<div class="banner viewing" role="status">${icon('clock')}<span class="sp">Viewing as ${esc(nowTokyo().raw)} Japan time</span><a href="${esc(href({ asof: '' }))}" class="t-foot" style="font-weight:var(--fw-semibold);color:inherit">Stop</a></div>`; if (!settings.hint && phase() !== 'post' && route().v === 'today') h += `<div class="banner" role="status">${icon('plus-app')}<span class="sp">Add to Home Screen for full screen and offline use. Share, then Add to Home Screen.</span><button class="t-foot" data-hint style="color:var(--tint);font-weight:var(--fw-semibold)">Dismiss</button></div>`; return h; }

  function render() {
    applyTier(); const r = route(); const app = $('#app'); const t = tier(); const v = r.v;
    const views = { today: vToday, days: vDays, food: vFood, places: vPlaces, info: vInfo, taxi: vTaxi, locked: vLocked };
    const info = (views[v] || vToday)();
    const prevScroll = $('.content') ? $('.content').scrollTop : 0; const sameView = lastV === v + (r.d || '') + (r.c || '') + (r.k || '') + (r.by || '');
    app.classList.toggle('sb-open', sidebarOpen());
    if (info.full) { app.innerHTML = `<div class="main" style="grid-template-rows:1fr"><div class="content" style="padding:0">${info.body}</div></div>`; }
    else {
      const depth = info.back ? 1 : 0; const anim = sameView ? '' : (depth < lastDepth ? 'pop' : (lastV && lastV.indexOf(v) === 0 ? 'fade' : '')); lastDepth = depth;
      app.innerHTML = `${sidebar(v)}<div class="main">${navbar(v, info)}<main class="content" id="content"><div class="inner ${info.inner || ''}"><div class="view ${anim}">${banners()}${info.body}</div></div></main>${t === 'compact' ? tabbar(v) : ''}</div>`;
      const content = $('.content'); const nb = $('.navbar');
      content.addEventListener('scroll', () => nb.classList.toggle('scrolled', content.scrollTop > 36), { passive: true });
      if (sameView) content.scrollTop = prevScroll; else if (info.scrollTo && $('#' + info.scrollTo)) $('#' + info.scrollTo).scrollIntoView(); else if (r.x && $('#' + r.x)) $('#' + r.x).scrollIntoView();
      if (!sameView && info.back) { const h = $('#dtitle') || $('.content h1'); if (h) h.focus({ preventScroll: true }); }
    }
    lastV = v + (r.d || '') + (r.c || '') + (r.k || '') + (r.by || '');
    // Place detail presentation on compact and in day detail contexts
    const old = $('.scrim'); if (old) old.remove(); const oldS = $('.sheet, .formsheet'); if (oldS) oldS.remove();
    if (r.p && PLACES[r.p] && (t === 'compact' || v === 'days' || v === 'today' || false)) presentPlace(r.p, t === 'compact' ? 'sheet' : 'form');
    app.setAttribute('aria-busy', 'false'); document.title = (info.title ? info.title + ' · ' : '') + 'Osaka Trip prototype';
  }
  function presentPlace(id, kind) {
    const it = PLACES[id]; const back = href({ p: '' });
    const head = `<div class="sh"><div><h2 class="t-title2" id="ptitle">${esc(it.name)}</h2>${it.jp ? `<p class="sec" lang="ja">${esc(it.jp)}</p>` : ''}</div><a class="close-btn" href="${esc(back)}" aria-label="Close">${icon('xmark')}</a></div>`;
    const el = document.createElement('div');
    if (kind === 'sheet') { el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ptitle'); el.innerHTML = `<div class="grab" data-grab aria-hidden="true"><i></i></div>${head}<div class="sb">${placeDetail(id)}</div>`; }
    else { el.className = 'formsheet'; el.innerHTML = `<div class="pane" role="dialog" aria-modal="true" aria-labelledby="ptitle">${head}<div class="sb">${placeDetail(id)}</div></div>`; }
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.addEventListener('click', () => { location.hash = back; });
    document.body.append(scrim, el); requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); const c = $('.close-btn', el); if (c) c.focus({ preventScroll: true }); });
    const g = $('[data-grab]', el); if (g) { let y0 = 0; g.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true }); g.addEventListener('touchend', (e) => { const dy = e.changedTouches[0].clientY - y0; if (dy > 40) location.hash = back; else if (dy < -40) el.classList.add('full'); }); g.addEventListener('click', () => el.classList.toggle('full')); }
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-sb]'); if (sb) { sbOpen = !sidebarOpen(); render(); return; }
    const sort = e.target.closest('[data-sort]'); if (sort) { go({ x: sort.dataset.sort === 'near' ? '' : 'early' }, true); return; }
    const kind = e.target.closest('[data-kind]'); if (kind) { go({ k: kind.dataset.kind, p: '', x: '' }, true); return; }
    const by = e.target.closest('[data-by]'); if (by) { go({ by: by.dataset.by, p: '' }, true); return; }
    const maps = e.target.closest('[data-maps]'); if (maps) { settings.maps = maps.dataset.maps; store.set('maps', settings.maps); render(); return; }
    const hint = e.target.closest('[data-hint]'); if (hint) { settings.hint = true; store.set('hint', true); render(); return; }
    const eye = e.target.closest('[data-eye]'); if (eye) { const inp = $('#pw'); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.setAttribute('aria-pressed', String(show)); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); eye.innerHTML = icon(show ? 'eye-slash' : 'eye', 'tb'); return; }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-cert]')) { go({ x: t.checked ? 'cert' : '' }, true); }
    if (t.matches('[data-onlyb]')) { go({ x: t.checked ? 'b' : '' }, true); }
    if (t.matches('[data-keep]')) { settings.keep = t.checked; store.set('keep', settings.keep); }
    if (t.matches('[data-tick]')) { settings.ticks[t.dataset.tick] = t.checked; store.set('ticks', settings.ticks); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.matches('[data-search]')) { e.preventDefault(); go({ q: $('#pq').value.trim(), p: '' }, true); const i = $('#pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    if (f.matches('[data-unlock]')) { e.preventDefault(); const btn = $('button[type=submit]', f); const pw = $('#pw').value; const prog = $('.prog', btn); btn.disabled = true; $('.lbl', btn).textContent = 'Unlocking'; prog.style.width = '90%'; setTimeout(() => { prog.style.width = '100%'; if (pw === 'demo') setTimeout(() => go({ v: 'today', s: '' }), 150); else { $('#pw').value = ''; go({ v: 'locked', s: 'fail' }, true); const i = $('#pw'); if (i) i.focus(); } }, 900); }
    if (f.matches('[data-paste]')) { e.preventDefault(); const v = $('#lnk').value.trim(); const err = $('.err', f); if (/#.*k=/.test(v) || v.length > 40) go({ v: 'locked', s: 'password' }); else { err.innerHTML = icon('exclamation-triangle') + 'That does not look like the trip link. It is a long address ending in a code.'; } }
  });
  document.addEventListener('input', (e) => { if (e.target.matches('#pq')) { clearTimeout(window.__q); window.__q = setTimeout(() => { const v = e.target.value.trim(); if (v !== route().q) { go({ q: v, p: '' }, true); const i = $('#pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }, 250); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const r = route(); if (r.p) { location.hash = href({ p: '' }); } else if (r.v === 'taxi') location.hash = href({ v: 'info' }); } if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement && document.activeElement.closest('.day-head, .rhythm')) { const r = route(); const i = D.days.findIndex((d) => d.iso === r.d); const n = D.days[e.key === 'ArrowLeft' ? i - 1 : i + 1]; if (n) { e.preventDefault(); location.hash = href({ v: 'days', d: n.iso }); } } });
  addEventListener('hashchange', render); addEventListener('resize', () => { clearTimeout(window.__r); window.__r = setTimeout(render, 80); }); addEventListener('online', render); addEventListener('offline', render);
  render();
})();
