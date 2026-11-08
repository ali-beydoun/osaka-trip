# Components

Owner: Fable - Osaka Apple design. v1, 8 Nov 2026. Every component below exists in `prototype/proto.css` and `prototype/app.js` under the class names given, built only from `tokens.css`. Sizes are CSS px at the default text size; text-bearing parts scale with Dynamic Type through rem and em.

## Navigation bar (`.navbar`, `.nav-row`, `.large-title`)

- Material background, sticky, padded by the top safe-area inset. Row height 44. Three zones: leading (back control or sidebar button), centre (inline title or the iPad top tab bar), trailing (offline pill, simulation stop button, at most two glyph buttons).
- Large title row (Large Title Bold) below the bar on root screens; the row disappears and the inline Headline title fades in once the content has scrolled 36 px. A hairline separator appears in the same condition.
- Back control: chevron plus the previous screen's title, tint colour, 44 px minimum height, label truncates at 40 percent of the width.
- States: default, scrolled (hairline and inline title), inline (pushed screens and compact height), reduced transparency (solid).
- Accessibility: `header` landmark; the back control has `aria-label="Back to {title}"`; the inline title is not a heading (the content `h1` is).

## Floating tab bar (`.tabbar`)

- Fixed, capsule, 56 px tall (48 at compact height), inset 12 px from the sides and `max(8px, safe-area-bottom)` from the bottom, max width 520 centred, material background with a hairline inner stroke and the float shadow.
- Five items in equal columns, each at least 44 px tall; outline glyph 24 px over a Caption 2 Semibold label; selected item in tint with a soft tint capsule and the filled glyph variant; unselected in secondary label colour.
- Tapping the current tab pops its stack to the root and scrolls to top (app behaviour; the prototype re-renders the root).
- Accessibility: `nav aria-label="Sections"`, links with `aria-current="page"` on the selected tab. No `role="tablist"`, because these are navigation links, not panel tabs.

## Top tab bar (`.toptabs`) and sidebar (`.sidebar`)

- Top tab bar: a capsule track in the navigation bar centre, items with glyph and Subheadline label side by side, selected item on an elevated capsule in tint. Hidden while the sidebar is open.
- Sidebar button: leading glyph button, `aria-expanded`, label "Show sidebar" or "Hide sidebar".
- Sidebar: 280 px (300 at extra wide), page background, trailing hairline, title at Title 2, Sections rows (glyph in tint, Body label, selected row in soft tint), a Days group header in Caption 1 caps, day rows with a 28 px day-number disc (ringed for today), title and date subline. Rows are 44 px minimum with 10 px radius selection.
- Width animates over `--dur-slow`; under reduced motion it snaps.

## Grouped list (`.list`, `.cell`, `.row`)

- Container radius 10, secondary grouped background, overflow hidden. Section header `.group-h` (Caption 1 Semibold caps, secondary, 16 px inset, optional trailing text action) and footer `.group-f` (Footnote).
- `.cell`: three-column grid (leading glyph, body, trailing), 44 px minimum (48 on regular tiers), 16 by 11 px padding, hairline separators inset to the text start (or past the glyph when `.icon-lead`). Body holds a Body title (Semibold when `.b`) and a Subheadline subtitle. Trailing holds a chevron (push), a value in secondary colour, a switch or a segmented control.
- `.row`: a richer cell for places: name line (Headline name as a link to the detail, Japanese name in Footnote beside it, chip at the trailing edge), what line, meta lines (Footnote secondary, tabular numerals, middle-dot separated), booking line, pacing note, uncertainty note, actions row.
- Pressed state: tertiary fill highlight. Selected (regular tiers): soft tint background.
- Accessibility: a cell that navigates is an `a`; a cell that toggles is a `label` wrapping its control; purely informational cells are `div`s. Chevron glyphs are hidden from assistive technology.

## Chips (`.chip`, `.chips`)

- Pill, Caption 1 Semibold, 0.25em by 0.7em padding, glyph 1.1em before the text. Variants: evidence (`cert`, `claim`, `menu`, `friendly`, `fallback`, `no`), day type (`type-shop`, `type-sight`, `type-rest`, `type-travel`), `decide` (soft tint), default (secondary fill). Each variant pairs a soft background with the matching text colour; the glyph takes the text colour.
- Chips never act. They are spans. Filter controls are `.fchip` (below).
- Minimum text 11 px; chips wrap in `.chips` rather than truncate.

## Filter chips (`.filter-chips`, `.fchip`)

- Horizontal scroller with hidden scrollbar, chips 36 px tall with an invisible 4 px hit extension above and below to reach 44, Subheadline Semibold, count in secondary weight, optional Today marker in Caption 2 caps.
- Selected: tint background, on-tint text. Behaviour: single selection within a `role="radiogroup"` (category, area) using `role="radio"` and `aria-checked`.

## Segmented control (`.seg`)

- Track in secondary fill, radius 10, 2 px padding; segments equal width, 36 px tall with hit extension, Subheadline Semibold; selected segment on the secondary grouped background with a 1 px shadow and hairline.
- `role="radiogroup"` with `role="radio"` buttons and `aria-checked`; arrow keys move selection in the app.

## Switch (`.switch`)

- 51 by 31 track, 27 px knob, green track when on, fill track when off; the native checkbox is visually hidden but keeps focus and VoiceOver semantics; focus ring on the track.
- Always labelled by the row text; the input also carries `aria-label` where the row text is not a `label`.

## Buttons

- `.btn.primary`: full width, 44 px minimum, radius 14, tint background, on-tint Headline label; pressed uses `--tint-pressed`; optional `.prog` fill for the unlock progress. At most one per view.
- `.btn.secondary`: soft tint background, tint label. `.btn.plain`: tint text only.
- `.act-btn`: the small pill action (Walk, Train, Taxi, Map, Source), Footnote Semibold, 32 px visual height with a 6 px invisible hit extension above and below to reach 44, soft tint by default, `.solid` for the one preferred mode in a group. Glyph before the label.
- `.nav-btn`: glyph button in the bar, 44 px square, tint.
- `.close-btn`: 30 px round secondary fill with an x glyph and a 7 px hit extension (44 total), used on sheets, the inspector and the taxi card.
- `.quick a`: 72 px minimum tiles in a four-column grid, glyph in tint over a two-line Caption 1 Semibold label, secondary grouped background, radius 14.
- All buttons have `:active` feedback (opacity or background) and `:focus-visible` rings.

## Disclosure (`details.disc`)

- Native `details` and `summary`; summary 44 px minimum with the title, a count in secondary weight and a chevron that rotates 180 degrees when open; content is a nested list with a hairline above its first row.
- Compact: Eat, Something sweet and Shop closed by default. Regular: Eat open by default.

## Cards and boxes (`.card`, `.box`, `.zone`)

- `.card`: radius 14, 16 px padding, secondary grouped background, vertical gap 12. `.card.tint` for the To decide callout (soft tint background, tint label).
- `.box`: radius 10, tertiary grouped background, used inside cards and zones for Getting there, Next and End of the day.
- `.zone`: a card with a numbered 28 px disc in the day type colour, Title 3 name, Footnote time range, Subheadline purpose, then the box, stops list and disclosures.

## Rhythm chart (`.rhythm`)

- One column per day in a grid, each column a link at least 44 px wide and tall: an open-decision dot, an 84 px track with a bar whose height is load over 4 and whose colour is the day type, the weekday kanji at Caption 2, the day number in a 26 px disc (ring for today, filled tint when selected). Weekend columns carry a faint wash. A legend below pairs every colour and glyph with a word.
- Accessibility: `role="list"` with `role="listitem"` links whose `aria-label` reads "{date}, {title}, {load}, decision open" and `aria-current="true"` on the selected day. Arrow keys move the selection when focus is inside the chart.

## Flow timeline (`.flow`)

- Rows of a 96 px when-column (level glyph plus label in Footnote Semibold secondary) and the text at Subheadline, hairline separated; a legend of the three level glyphs. Stacks to one column at accessibility sizes.

## Sheet (`.sheet`) and form sheet (`.formsheet`)

- Sheet: fixed to the bottom, elevated background, 20 px top radius, sheet shadow, grabber (36 by 5 in fill colour, 20 px tall grab row), header with the place name at Title 2, Japanese name, and the close control; scrolling body with 16 px padding. Medium detent is 50dvh; the grabber toggles full height; dragging down 40 px dismisses, up 40 px expands. A scrim at 0.2 (0.45 dark) sits behind; tapping it dismisses.
- Form sheet (regular tiers over Days and Today): a centred pane 560 px wide at most, 720 px tall at most, radius 20, float shadow, same header and body; scale and fade in.
- Both: `role="dialog"`, `aria-modal`, `aria-labelledby` the title, focus moves to the close control on open and returns to the originating row on close, Escape closes, a history entry is pushed so Back closes first.

## Inspector (`.inspector`)

- A sticky elevated panel with radius 14 and a hairline, its own scroll, a header row with the title and close control, then the place detail body. Placeholder state: centred glyph and "Select a place to see its details."

## Banner (`.banner`)

- Full-width row inside the content measure: glyph, text at Subheadline, a trailing text action. Variants: default (elevated background with hairline) for Trip updated and the Add to Home Screen hint; `viewing` (yellow soft background and yellow text) for the simulated time. `role="status"`.

## Field (`.field`)

- Footnote Semibold label above, a 44 px input in the secondary grouped background with a hairline, placeholder in placeholder colour, a focus ring on the wrapper, an optional trailing 44 px glyph button (show or hide password), and a Footnote error line in red text with a warning glyph. The error line is a live region.

## Place detail body (`placeDetail`)

- Chips row (evidence or dietary, zone or area), what text at Body, a grouped list of facts each with a glyph (hours and closed day, price or cost, booking, walk from hotel, certifier, alcohol, pacing note), the verified caption "Checked {as_of}: …", the actions row (Walk solid, Train, Taxi, Map, Source), and the standing footnote "Names are suggestions, not bookings. Hours change, so check on the day."

## Taxi card (`.taxi`)

- Full-screen elevated surface, label and close control, Japanese name at about 1.15 times Title 1 in the Japanese font, Japanese address at Title 2, a box with the English details, Taxi, Map and Call actions, a footnote. No material, no colour beyond tint on actions.

## Icons (`icons.svg`)

- Symbol sprite referenced with `<use href="#i-name">`, `aria-hidden`, sized by the `.ic` classes (17 inline, 22 toolbar, 24 tab, 28 large) and by em inside chips so they follow text size. Filled variants exist for the five tab glyphs and are used only for the selected tab.
