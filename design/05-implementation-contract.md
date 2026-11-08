# Implementation contract and review checklist

Owner: Fable - Osaka Apple design. v1, 8 Nov 2026. The delivery lead implements against this list; the design role reviews the built app against the same list and reports by item id. An item is met only with evidence (screenshot at the stated viewport, a passing automated check, or a recorded device observation by the owner). "Looks fine" is not evidence.

Severity for review findings: **Blocker** (ships broken on a target device or violates privacy), **Major** (clear HIG violation or accessibility failure), **Minor** (polish).

## H. Document head and shell

- H1 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; no `user-scalable=no`, no `maximum-scale` (pinch zoom must stay available).
- H2 `<meta name="color-scheme" content="light dark">` and two `theme-color` metas with `prefers-color-scheme` media.
- H3 `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-mobile-web-app-title="Osaka Trip"`, `apple-touch-icon` 180px, `manifest.webmanifest` with name, short_name, `display: standalone`, `start_url` without any fragment, icons 192/512 plus 512 maskable, `background_color` and `theme_color`.
- H4 `<html lang="en">`; every Japanese string is wrapped with `lang="ja"`.
- H5 `design/tokens.css` is loaded first and unmodified; a byte comparison with the design folder passes. No other stylesheet declares a colour, font-size, radius or duration literal (lint: grep for `#[0-9a-f]{3,8}`, `px` font sizes and `ms` outside tokens.css yields only documented exceptions).
- H6 `html { font: -apple-system-body }` is in effect; the fallback applies only where unsupported.

## L. Layout tiers

- L1 Tiers switch at 600, 900 and 1180 CSS px of viewport width, and compact height applies at or below 500 px of height. The tier is also exposed as `data-tier` on `html` for tests.
- L2 Compact: single column, bottom floating tab bar, large titles, sheets. Verified at 375 by 667, 393 by 852 and 440 by 956, and at 320 by 700 (Slide Over).
- L3 Compact height: inline titles only, tab bar without the home-indicator inset, day detail in two columns when width is 700 px or more. Verified at 852 by 393.
- L4 Regular narrow: top tab bar with sidebar toggle, sidebar collapsed by default; Days, Food and Places show list plus detail columns. Verified at 744 by 1133, 834 by 1194 and 678 by 1024.
- L5 Regular wide: sidebar expanded (280 px) with the Days group listing every trip day; content measure capped. Verified at 1133 by 744 and 1024 by 1366.
- L6 Extra wide: sidebar 300 px; Food and Places keep list plus inspector with the list absorbing the spare width; day detail shows the trailing rail. Verified at 1194 by 834 and 1366 by 1024.
- L7 Resizing across a tier boundary keeps the selected tab, day, category, filters and the scroll position of the active list.
- L8 Safe areas: no content or control sits under the status bar, Dynamic Island, home indicator or landscape side insets; verified in both landscape orientations on a notched iPhone.
- L9 No horizontal page scroll at any tier or text size. Long unbroken strings (URLs, Japanese names) wrap with `overflow-wrap: anywhere`.

## N. Navigation and routing

- N1 Five tabs: Today, Days, Food, Places, Info, in that order, always visible except under a presented sheet. Never disabled, never hidden when empty.
- N2 Routes live in the URL fragment beside the link secret; the back button and edge swipe pop one level; `history` entries exist for push navigation and sheet presentation so Back dismisses a sheet first.
- N3 Each tab remembers its own navigation stack and scroll position; switching tabs does not reset them. Tapping the selected tab again pops to its root and scrolls to top.
- N4 The large title collapses to an inline title on scroll in compact and regular narrow; the inline title is the screen name, under 15 characters where possible.
- N5 Sidebar toggle on regular tiers converts between top tab bar and sidebar; the sidebar can also be revealed by an edge swipe on touch. The default per tier matches L4 to L6.
- N6 Keyboard: Tab order follows visual order; arrow keys move within the rhythm chart, segmented controls and the area picker; Enter or Space activates; Escape closes sheets, popovers and the search field; focus moves to the new view's title on push and returns to the originating control on pop or dismiss.

## S. Screens (content order is normative; see 02-screens.md for layout)

- S1 Locked: states Missing link, Enter password, Unlocking, Could not unlock, Offline before first load; see 04. The password field is `type="password"` with `autocomplete="current-password"`, a show/hide eye button, and the Unlock button is the form's submit so Return unlocks.
- S2 Today pre-trip: countdown in days (Asia/Tokyo), the Next up checklist with local-only ticks, the first day preview card, shortcuts to Bookings, Getting around and Tax-free shopping.
- S3 Today on trip: header (Today, date, day title, place), Now and Next card derived from zone time ranges with a "Today's plan" fallback when no zone is current, quick actions row (Back to the hotel, Food near today's area, Prayer rooms, Taxi card), rest of today as condensed zone rows, Tomorrow preview, first three watch-outs with a "more" disclosure.
- S4 Today post-trip: a short summary and a button to Days.
- S5 Days root: Trip at a glance chart (one column per day, bar height by load, bar colour by type, weekend wash, today ring, open-decision dot, legend) above a grouped list of days (weekday and date, title, place, type and load chips). The chart is keyboard navigable and each column is a 44 px wide hit target or larger.
- S6 Day detail: header (date line, title, place, previous and next day buttons), chips (type, load, walking), summary, To decide callout if `open`, The day (flow items with level glyphs and a legend), Zones (numbered zone cards with Getting there box, stops list, Eat, Something sweet and Shop disclosures), End of the day box, Good to know (pacing note, watch-outs), Questions to settle, Sources (collapsed). Previous and next also respond to left and right arrow keys when the header has focus.
- S7 Place detail (sheet or inspector): name, Japanese name, evidence or dietary chip, what, meta lines (hours, cost or price, booking, walk from hotel when known, certifier, alcohol), pacing note, verified note, actions (Directions by mode, Map, Source). Nothing in it is new information; it is the row expanded.
- S8 Food root: horizontally scrolling category chips with counts; Bakeries sorted by walk minutes then opening time with a Nearest / Opens earliest segmented control shown only when both fields exist; Halal view per S9.
- S9 Halal: area picker defaulting to today's area (Today label on it during the trip), Certified only switch, legend of all five statuses, list ranked by status then walk minutes then source order, Prayer rooms section for the area, Closed or left out disclosure, two "near me" search handoffs (halal restaurant, prayer room) that open the maps provider's search, and the research date caption.
- S10 Places root: search field in the navigation bar (collapses on scroll, expands on tap), kind segmented control (See, Shop, Sweet, Eat), group-by control (Day, Area), Works for {name} switch visible only for Eat, grouped list with an Open day action per group.
- S11 Info root: grouped list in this order: Hotel (with Show taxi card and Back to the hotel), Getting around, Bookings, Airport day, Tax-free shopping, Guides, Decisions, What we want, Sources, App.
- S12 Taxi card: a full-screen view with the hotel's Japanese name at Title 1 in `--font-jp`, the Japanese address, the English name and phone as a `tel:` link, a Close button and the directions actions. High contrast, no material, works in both appearances.
- S13 App group: Keep unlocked switch, Lock now, Maps app (Google Maps or Apple Maps), Add to Home Screen instructions, Offline status with data version and research dates, Update trip link (paste a new private link), About with the privacy summary.
- S14 Every screen has an empty and an error state that explains and offers a next step; none shows a bare "No results".

## C. Components (states in 03-components.md)

- C1 Every interactive element has default, pressed, focused (keyboard only, `:focus-visible`), disabled and selected states where applicable, using only tokens.
- C2 Hit targets are at least 44 by 44 CSS px, including chips, segmented items, tab items, chart columns, Map and Source text buttons and the sheet grabber row.
- C3 Grouped lists use `--radius-md`, inset separators, 44 px minimum rows, a chevron only when the row pushes a view, and no chevron on rows that present a sheet or open an external link (those show the outward arrow glyph).
- C4 Segmented controls are real radio groups (`role="radiogroup"` with `role="radio"` items or native inputs), with the selected segment at `--bg-grouped-secondary` on a `--fill-secondary` track.
- C5 Chips that filter are toggle buttons with `aria-pressed`; chips that only label (evidence, day type) are plain spans, never buttons.
- C6 Disclosures are native `details` and `summary` with a rotating chevron, and the summary row is at least 44 px.
- C7 Primary filled buttons use `--tint` with `--on-tint` text at Headline; at most one per view. Secondary buttons use `--tint-soft` with `--tint` text. Text buttons use `--tint` text only.
- C8 External links open in a new context with `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`.

## Y. Typography and Dynamic Type

- Y1 At the default text size, body text renders at 17 px and nothing renders below 11 px.
- Y2 Verified at three sizes on a real iPhone or in WebKit with the text size emulated: Default, Larger Text (one step below the first accessibility size) and the largest accessibility size. At every size: no clipped text, no overlapping controls, side-by-side layouts stack, chips wrap, and the tab bar labels remain legible (tab labels may be the only text allowed to stay at Caption 2).
- Y3 Headings use the clamped tokens; body uses unclamped rem.
- Y4 Tabular numerals on all times, fares, counts and chart labels.

## A. Accessibility

- A1 Contrast: all text meets 4.5:1 (3:1 at 18 px or bold) in light, dark and Increase Contrast, measured on its actual background (white card, grouped page, tint, chip wash).
- A2 Landmarks: one `main`, `nav` for the tab bar and sidebar with `aria-label`, `header` for the navigation bar; headings nest in order with exactly one `h1` per view.
- A3 Every control has an accessible name that includes its object: "Walk to Sample Garden", "Previous day, Wednesday 8 May", "Certified only, switch, off". Icon-only buttons have `aria-label`.
- A4 Status chips are read as text (they are text). Day type and load are read in the day row text, not inferred from colour.
- A5 Live regions: the Trip updated banner and unlock errors use `role="status"`; the day sheet uses `aria-live="polite"` on day change so VoiceOver announces the new day title.
- A6 Focus management per N6; focus is never trapped except inside a presented sheet, where it cycles and Escape exits.
- A7 `prefers-reduced-motion` honoured per the motion table; `prefers-reduced-transparency` makes bars solid; `prefers-contrast: more` applies the contrast tokens.
- A8 Touch: no hover-only affordances; long-press is never required; swipe actions have a visible alternative.
- A9 VoiceOver rotor headings navigation lands on each section of the day detail (The day, Zones, End of the day, Good to know, Questions to settle, Sources).

## M. Motion

- M1 Transitions use only the token durations and easings and match the table in 01-design-system.md section 7.
- M2 No autonomous animation runs after load; the unlock progress is the only time-based motion and it stops on completion.
- M3 Under reduced motion every translation becomes a crossfade of at most `--dur-fast`.

## U. Unlock, install, offline, update (detail in 04)

- U1 The password is never written to storage, logs, the URL or analytics; there are no analytics.
- U2 Missing link state appears when the fragment carries no secret; it offers Paste link with a text field that accepts the whole URL and extracts the secret client side.
- U3 Unlocking shows an in-button progress state; wrong password and wrong link produce the same calm message after a short delay; the field keeps focus and the typed text is cleared.
- U4 Keep unlocked defaults on; Lock now in Info > App forgets the stored key and returns to the Locked screen.
- U5 After the first successful unlock in a browser tab (not standalone), a one-time Add to Home Screen hint sheet explains the two steps and is dismissible for good.
- U6 In standalone mode with no stored key and no fragment, the Missing link state explains that the Home Screen app needs the private link once, with Paste link.
- U7 Offline: after one successful load, the shell and ciphertext are cached; the navigation bar shows an offline pill while offline and every view works; external links say they need a connection only when tapped offline.
- U8 Update: a new payload version shows the Trip updated banner with a Reload action; nothing reloads automatically.

## P. Privacy in the UI

- P1 No traveller names, hotel name, dates or plan facts exist in the public source, fixture or screenshots; all come from the decrypted payload. Tests run on the synthetic fixture.
- P2 Screenshots used as evidence are taken on the synthetic fixture only, never on the real payload.
- P3 `noindex` meta is present on every served HTML file including 404.
- P4 External link handoff never includes the fragment: links are plain `href`s and `referrerpolicy="no-referrer"` is set.

## Q. QA matrix and evidence

Run on the synthetic fixture with the private link and password for the fixture build only.

| Id | Surface | Viewports (CSS px) | Appearance | Text size | Notes |
| --- | --- | --- | --- | --- | --- |
| Q1 | iPhone portrait | 375 by 667, 393 by 852, 440 by 956 | light and dark | default, larger, largest | all five tabs, day detail, sheet, locked states |
| Q2 | iPhone landscape | 852 by 393 | light | default | tab bar, inline titles, two-column day detail |
| Q3 | iPad Mini | 744 by 1133 and 1133 by 744 | light and dark | default, larger | sidebar collapsed vs expanded, list plus detail |
| Q4 | iPad 11-inch | 834 by 1194 and 1194 by 834 | light | default | inspector column, top tab bar |
| Q5 | iPad 13-inch | 1024 by 1366 and 1366 by 1024 | light and dark | default | three columns, trailing rail |
| Q6 | Split View and Slide Over | 320 by 1133, 507 by 1133, 678 by 1024 | light | default | tier switching, state retention |
| Q7 | Reduced motion and transparency | 393 by 852 | light | default | crossfades, solid bars |
| Q8 | Keyboard | 1194 by 834 | light | default | full Tab traversal, Escape, arrows |
| Q9 | Owner device checklist | real iPhone and iPad | system | system | Dynamic Type follows the system setting, VoiceOver reads chips and day changes, Home Screen install, offline relaunch, Lock now, Trip updated |

Evidence per row: screenshots named `q<id>-<viewport>-<appearance>-<textsize>.png`, stored outside the repository or in a reviewed `handoff/evidence/` folder after a privacy check, plus the Playwright report for Q1 to Q8. Q9 is recorded as the owner's observations, item by item.

## R. Review handoff

When the build is ready for design review the delivery lead sends: the local preview address with the fixture link, the commit hash, the Q1 to Q8 evidence location, and a list of any contract items consciously deferred with reasons. The design role reviews within the HIG eight-principle frame plus this checklist, returns findings by item id and severity, and re-reviews fixes against the same ids.
