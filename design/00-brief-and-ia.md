# Osaka Trip app: design brief and information architecture

Owner: Fable - Osaka Apple design. Status: v1 accepted by Opus, 8 Nov 2026 (this revision sanitised for the public repository).
Scope: iPhone, iPad Mini, iPad Pro in Safari and as a Home Screen web app. Portrait, landscape, Split View, Slide Over, Stage Manager and resizable iPadOS windows. Nothing is optimised for desktop.

Privacy rule for every file under design/: synthetic examples only. No real trip dates, no day-by-day plan facts, no hotel name or neighbourhood, no flight or transfer times, no booking details, no health details and no personal names. Traveller names come from the encrypted payload and are templated here as `{name}`. Public vocabulary (status enums, section names, field names) is fine. Examples in this folder use the synthetic fixture shipped with the tests.

## 1. What the app is for

A multi-day city trip with one hotel as the base, some day-trip days and one outlet shopping day. The plan was researched in detail and favours a relaxed pace: one area per day, no cross-town dashing, a sit-down break every 60 to 90 minutes, lifts over stairs. The app is the on-trip and pre-trip reference for that plan. It is not a booking tool and never invents hours, prices or availability.

Four moments shape the design:

1. **On the street, iPhone, one hand, daylight.** What is next, where to eat nearby that works for everyone's dietary needs, how to get back to the hotel, what to show a taxi driver. Low signal is normal. This moment earns the app its place on the Home Screen.
2. **Evening in the hotel, iPad on the bed or desk.** Review tomorrow, read the watch-outs, settle an open decision, look up a shop.
3. **Before the trip, iPad or iPhone at home.** Scan the whole rhythm, read the essentials, tick off preparation items.
4. **Airport days.** Transfer options on arrival; timings and tax-refund steps on departure.

Design principles applied (from the HIG eight): Purpose and Simplicity put today's plan and food evidence first. Agency keeps every view reachable in two taps and never locks the reader into a flow. Responsibility means the app says what it does not know (unverified, not booked, to decide) as clearly as what it knows. Familiarity means standard iOS and iPadOS navigation, grouped lists, sheets and system typography rather than a bespoke website theme. Flexibility means Dynamic Type, VoiceOver, keyboard and reduced motion from day one.

## 2. Source inventory (what the data gives us)

The payload has one entry per trip day plus cross-trip indexes. Field names below are the real schema; counts are omitted here on purpose.

| Entity | Fields that drive the UI |
| --- | --- |
| Day | iso, date, weekday kanji `k`, day number `n`, type (shop, sight, rest, travel), load 1 to 4, weekend flag, title, place, walking level text, summary, optional `open` decision, flow[], zones[] (two or three per day), home, pacing (pacing note), watch_outs[], decisions[], sources[] |
| Flow item | when (Morning, Afternoon, Evening and finer), text, level 0 downtime / 1 easy / 2 on the go |
| Zone | name, purpose, time as "H:MM to H:MM" (always parseable), getting_there {how, minutes, fare, arrive_at, maps_query, mode transit/walking/driving, source}, stops[], eat[], sweet[], shop[] |
| Stop | name, maps_query, what, hours, cost, pacing, source |
| Eat (in zone) | name, maps_query, what, dietary label for the traveller with dietary needs (`for_b`), price, hours, booking, source |
| Sweet | name, maps_query, what, hours, source |
| Shop | name, maps_query, what, for (a traveller or Both), hours, source |
| Bakery | name, jp, area, why, signature, dietary note, hours, closed, opens, seats, coffee, queue, walk_min from the hotel, getting_there, mode, price, tags, source |
| Halal place | name, jp, area, city, cuisine, status, certifier, alcohol, what, hours, closed, price, booking, walk_min, maps_query, verified note, source, group `g` |
| Halal group | id and label per area, plus `dayGroup` mapping each trip day to its area and `as_of` for the research date |
| Prayer room | name, area, where, hours, maps_query, source, group |
| Dropped place | name, reason (kept for transparency, collapsed) |
| Travellers | id, role, name, dietary summary (drives templated labels) |
| Hotel | name, address, maps_query, check-in, check-out, nearest stations |
| Doc sections | the companion document as structured sections: intro, Next up checklist, Decisions, What we want, Shopping zones, a shopping guide, Food zones, Gardens and temples, Plan review, Bookings, tax refunds, Getting around, Sources |

No coordinates exist anywhere (confirmed by the delivery lead's source audit across every day item, the halal index, prayer rooms and bakeries). Every place carries a `maps_query` string, so directions are a handoff to the Maps app, never an embedded map. Consequences:

- No "nearest to me", no distance sort and no computed "open now". Hours and closed days are free text and are shown verbatim.
- `walk_min` means minutes from the hotel and is only meaningful for areas near it; when it is 0 or the place is in a day-trip city the walk caption is omitted rather than shown as 0.
- Area is the primary grouping everywhere. `dayGroup` maps each day to one area; a few days genuinely span two, so the area picker defaults to the day's area and keeps every other area one tap away.
- Uncertainty is part of the content, not noise: the text carries many "unverified", "could not confirm", "check", "estimate" and "conflicting sources" qualifiers. The design gives these a consistent inline note style ("Sources disagree", "Could not confirm", "Estimate") and never hides them behind truncation.
- Where one source says booked and the trip document says not booked, booking status always comes from the trip document's status field and uses a neutral Not booked / To decide treatment, never an alarming one.

Evidence vocabulary that must stay visible and distinct:

- Zone eat entries, dietary label: `Halal certified`, `Halal (own claim)`, `Fish, prawn or veg options`, `Not for {name}`.
- Halal index status, ranked: `Halal certified`, `Halal (own claim)`, `Halal menu`, `Muslim-friendly`, `Not halal: fallback`. Plus `certifier` (named body or blank), `alcohol` (Yes, No, Unknown) and a free-text `verified` note dated by `as_of`.
- Booking status: Booked, Booked with free cancellation until a date, Not booked, Not needed.
- Decision status: Decided on a date, Open with a lean.

Recency (the `as_of` and researched dates) is shown as a caption, never folded into the evidence chip.

## 3. Information architecture

Five top-level destinations. On iPhone they are a bottom tab bar. On iPad they are a top tab bar that converts to a sidebar, where the sidebar also lists the trip days directly.

| Destination | Purpose | Icon idea (SF Symbol name for reference only; shipped as our own SVG) |
| --- | --- | --- |
| **Today** | The current day in trip time, with Now and Next, quick actions and tomorrow's preview. Before the trip it is the countdown and preparation list. After the trip it is a quiet summary. | sun.max |
| **Days** | The whole trip: the rhythm chart, the day list and each day's full plan. | calendar |
| **Food** | Bakeries, breakfast, pancakes and the halal index with evidence, area, prayer rooms and the dropped list. | fork.knife |
| **Places** | Every recommendation by kind (See, Shop, Sweet, Eat), grouped by day or area, searchable. | mappin.and.ellipse |
| **Info** | Essentials: hotel and taxi card, getting around, bookings status, airport day, tax-free rules, guides, decisions, what we want, sources, and the App group (lock, maps app, install, offline, version). | info.circle |

Why five and not fewer: Today is the fast surface and must not be buried inside Days. Food is the most used index during the trip and has its own filters. Places is the cross-trip index for "where was that shop". Info holds everything that is read rarely but matters a lot. Five is the HIG ceiling before tabs overflow into More; we stay under it with no search tab because search lives inside Places.

### Screen inventory

```
Locked
  ├─ Missing link (bare URL opened)        → paste trip link
  ├─ Enter password                        → unlocking (in-button progress) → success
  ├─ Could not unlock                      → retry
  └─ Offline before first load             → explain, retry
Today
  ├─ Pre-trip (countdown, Next up checklist, first day preview, essentials shortcuts)
  ├─ On trip (header, Now/Next, quick actions, rest of today, tomorrow, watch-outs)
  └─ After trip (summary, link to Days)
Days
  ├─ Trip at a glance (rhythm chart) + day list
  └─ Day detail (header, chips, summary, To decide, The day, Zones, End of the day,
       Good to know, Questions to settle, Sources)
       └─ Place detail (sheet on compact, inspector on regular)
Food
  ├─ Category (Bakeries, Breakfast, Pancakes, Halal, further data-driven categories)
  ├─ Halal: area picker (defaults to today's area), Certified only, legend, list ranked by
  │     evidence then walk minutes where known, Prayer rooms, Closed or left out (disclosure)
  └─ Place detail
Places
  ├─ Kind segmented (See, Shop, Sweet, Eat) + group by Day or Area + search + works-for toggle
  └─ Place detail
Info
  ├─ Hotel and taxi card (full-screen card view)
  ├─ Getting around
  ├─ Bookings (status from the trip document only; references withheld unless the owner decides otherwise)
  ├─ Airport day timeline
  ├─ Tax-free shopping
  ├─ Guides (Shopping zones, the shopping guide, Food zones, Gardens and temples, Plan review)
  ├─ Decisions (open first, then decided)
  ├─ What we want
  ├─ Sources
  └─ App (Keep unlocked, Lock now, Maps app, Add to Home Screen, Offline and data version, Update trip link)
Transient
  ├─ Trip updated banner (quiet, dismissible)
  ├─ Offline pill in the navigation bar
  └─ Add to Home Screen hint (once, after first unlock, dismissible)
```

### Navigation model

- **Compact width (iPhone portrait, Slide Over, narrow Split View):** floating bottom tab bar with five items, labels always visible. Within a tab, hierarchical push with a standard back control at the leading edge of the navigation bar and swipe-from-left-edge back. Large title on each root screen collapses to an inline title on scroll. Place detail opens as a sheet that stops at a medium detent first and can expand.
- **Compact height (iPhone landscape):** same tab bar, reduced height without the home-indicator inset, inline titles only; day detail lays The day and Zones side by side when the width allows.
- **Regular width, narrow (iPad Mini portrait, iPad 11-inch portrait, half Split View on a 13-inch):** top tab bar centred in the navigation bar in the iPadOS style, sidebar collapsed by default behind a leading sidebar button. Days shows a day list column beside the detail. Food and Places show their controls and list beside a place inspector; tapping a row fills the inspector rather than opening a sheet.
- **Regular width, wide (iPad landscape, iPad Pro 13-inch portrait):** sidebar expanded by default with two levels: the five destinations, and under Days each trip day as a row with weekday, date and title. Content uses a readable measure with a trailing rail for secondary information rather than stretching cards across the window.
- Changing size class never changes what the app can do, only how much is visible at once. A selected day, category, filter and scroll position survive a rotation or a Split View resize.

### Trip time

All "today" logic uses Asia/Tokyo regardless of device time zone. Phases: before the first trip day at 00:00 Tokyo is pre-trip; first to last day inclusive is on-trip; after the last day at 23:59 Tokyo is post-trip. The current zone is derived from each zone's time range. An `asof` fragment parameter (never a query string, so nothing reaches server logs) lets reviewers simulate a date and time; when it is active a small "Viewing as" banner says so. All in-app routes also live in the fragment beside the link secret, because GitHub Pages cannot rewrite paths.

### Directions handoff

Every place has a Directions action. The default target is Google Maps, because every `maps_query` string was written and checked against Google Maps search and some Japanese venue names resolve differently in Apple Maps; Info > App offers Apple Maps as the alternative, as a single setting. Mode buttons (Walk, Train, Taxi) map to the provider's directions mode. "Back to the hotel" is a persistent quick action on Today and in Info and uses the hotel's `maps_query`.

### Tables from the trip document

The document's tables do not fit a phone column. Each becomes a grouped list where the first column is the row title, the remaining columns become labelled lines or label and value pairs, and link columns become trailing actions. On regular width the same data may render as a two-column grid of cards, never as a horizontally scrolling table.

## 4. Adaptive layout tiers (CSS px, Safari viewport)

| Tier | Width | Typical surfaces | Navigation | Content |
| --- | --- | --- | --- | --- |
| Compact | up to 599 | iPhone portrait 375 to 440, Slide Over about 320 to 400, one-third Split View | Bottom tab bar | One column, push navigation, sheets |
| Compact height | height up to 500 | iPhone landscape | Bottom tab bar, inline titles | Day detail two columns when width is 700 or more |
| Regular narrow | 600 to 899 | iPad Mini portrait 744, iPad 11-inch portrait 834, half Split View on 13-inch about 678 | Top tab bar, sidebar collapsed | Two columns: list 320 to 340 plus detail |
| Regular wide | 900 to 1179 | iPad Mini landscape 1133, iPad Pro 13-inch portrait 1024 | Sidebar expanded 280, top tab bar hidden while the sidebar is open | Two columns inside the content area where meaningful |
| Extra wide | 1180 and up | iPad 11-inch landscape 1194 to 1210, iPad Pro 13-inch landscape 1366 | Sidebar expanded 300 | Food and Places keep list plus inspector beside the sidebar, with the list taking the spare width; Days detail gains a trailing rail |

Device widths are reference values from Apple's published screen sizes and must be confirmed on the real devices during QA. The tier boundaries are the contract; the device list is guidance. Resizable iPadOS windows can produce any width, which is why tiers are width-based and not device-based.

## 5. What the app will not do

- No embedded map tiles, geolocation tracking or external APIs. Directions are a handoff.
- It never makes a reservation or a payment. Booking status is displayed, never changed.
- No invented hours, prices or claims. If a field is blank the row omits it; the UI never fills a gap with an invented default such as a daily opening time.
- No dependency on any chat or AI session. All content is in the encrypted payload shipped with the app.
- No desktop-first layout. Wide windows get the iPad layout with a readable measure, nothing more.

## 6. Open design questions for the owner

Each has a default that the prototype uses so work is not blocked.

1. Tab names: Today, Days, Food, Places, Info. Default as written.
2. Accent: a system-blue accent tuned for AA contrast (see tokens.css), with higher-contrast variants under Increase Contrast. Default yes. Alternative: a deeper indigo-blue closer to the original planner.
3. Default maps app: Google Maps (the queries were tested there), with Apple Maps selectable in Info > App.
4. Preparation checklist ticks (Next up) stored only on the device. Default yes, local only.
5. Booking references inside the encrypted payload: omitted for now; if included later they appear masked with a tap to reveal.

## 7. Files in this folder

- `00-brief-and-ia.md` this document
- `tokens.css` design tokens as CSS custom properties, imported unchanged by the app
- `01-design-system.md` type, colour, materials, iconography, motion, and how the tokens are used
- `02-screens.md` every screen per tier with layout and content order
- `03-components.md` component specs with states, sizes and accessibility
- `04-unlock-pwa-offline.md` unlock flow, install, offline and update behaviour
- `05-implementation-contract.md` the checklist the delivery lead implements and the design role reviews against
- `prototype/` static adaptive prototype on the synthetic fixture, no personal data
