# Osaka Trip design system

Owner: Fable - Osaka Apple design. v1, 8 Nov 2026. Companion to `tokens.css`, which is the executable form of this document. Where this text and the CSS disagree, the CSS is wrong and must be fixed to match, not the other way round.

Grounding: specific numbers below come from the HIG Accessibility specification table (17pt default text, 11pt minimum, 44 by 44pt default control, 4.5:1 contrast at 17pt and below, 3:1 at 18pt or bold), the Typography and Color foundations, and the Tab bars and Sidebars component pages as read on 8 Nov 2026 (June 2026 revisions). Device widths and iOS palette hex values are reference values from Apple's published resources and are marked where they appear.

## 1. How to use the tokens

- The app imports `design/tokens.css` first and never redefines a token outside it. App CSS uses tokens only; literal colours, font sizes, durations and radii in component CSS are a review finding.
- Tokens are semantic (`--label-secondary`, `--ev-certified-text`), not visual (`--gray-60`). A new colour need is met by adding a semantic token here, not by reusing one for a different meaning. A separator colour is never used as text; a tint is never used as a background wash except through `--tint-soft`.
- Light, dark and Increase Contrast are complete sets. Any token added later must get all three values.
- Layout dimensions are in px and do not scale with text. Inline paddings inside text controls (chips, buttons) use em so they grow with Dynamic Type.

## 2. Typography

### 2.1 System font and Dynamic Type

- `html { font: -apple-system-body }` asks WebKit for the Body text style at the person's current text size (Settings > Display & Brightness > Text Size, including the accessibility sizes). From then on `1rem` equals that size and every text style is a ratio of it. Other engines fall back to 17px through the `@supports not` rule. This must be verified on a real iPhone during QA: change the text size and confirm the app follows without reload.
- Font family is the system stack. SF Pro is never embedded or downloaded; it arrives through `-apple-system`. Japanese text spans carry `lang="ja"` so Safari picks Hiragino Sans and the correct glyph forms.
- Weights used: Regular 400, Medium 500, Semibold 600, Bold 700. Light and Thin are never used.
- Numerals in times, fares, counts and the rhythm chart use `font-variant-numeric: tabular-nums`.

### 2.2 Scale and usage

Ratios are the iOS Large (default) sizes divided by 17; the px column is the result at the default setting.

| Style | Token | px at default | Weight | Where it is used |
| --- | --- | --- | --- | --- |
| Large Title | `--fs-large-title` | 34 | Bold | Root screen title (Today, Days, Food, Places, Info) before scroll on compact width |
| Title 1 | `--fs-title1` | 28 | Bold | Pre-trip countdown number; taxi card hotel name |
| Title 2 | `--fs-title2` | 22 | Bold | Day detail title; inspector title; sheet title |
| Title 3 | `--fs-title3` | 20 | Semibold | Zone names; section cards on iPad |
| Headline | `--fs-headline` | 17 | Semibold | Row titles (place names), inline navigation title, primary button labels |
| Body | `--fs-body` | 17 | Regular | Descriptions, summaries, getting-there text, document sections |
| Callout | `--fs-callout` | 16 | Regular | Secondary descriptions in dense iPad columns only |
| Subheadline | `--fs-subheadline` | 15 | Regular or Semibold | Row subtitles, chip text at the larger chip size, segmented control labels |
| Footnote | `--fs-footnote` | 13 | Regular | Meta lines (hours, price, fare), captions under rows, section footers |
| Caption 1 | `--fs-caption1` | 12 | Regular or Semibold | Chip text, section headers in small caps style, legend |
| Caption 2 | `--fs-caption2` | 11 | Semibold | Tab bar labels, rhythm chart axis. Nothing is smaller than this |

Large Title, Title 1, Title 2 and Title 3 are clamped (see tokens) so the accessibility text sizes grow headings less than body text, as iOS itself does; body text is never clamped.

### 2.3 Rules

- Text never truncates in a scrolling list unless the full text is one tap away (a row whose detail view shows it). Meta lines wrap; they do not ellipsise.
- Multi-column text (iPad rails, two-column day detail) collapses to one column at the first accessibility size (`1rem` at or above 23px, which the app can read from `getComputedStyle(document.documentElement).fontSize`).
- Section headers use Caption 1 Semibold, uppercase, `--tracking-caps`, `--label-secondary`, exactly like grouped list headers in Settings. Section footers use Footnote, sentence case, `--label-secondary`.
- Headline and Body share a size; hierarchy inside a row comes from weight and colour, not size jumps.
- Japanese place names sit after the English name in the same line at Footnote size with `--label-secondary`, or as the primary line on the taxi card at Title 1 in `--font-jp`.

## 3. Colour

### 3.1 Backgrounds and labels

The app uses the grouped background system throughout: `--bg-grouped` as the page, `--bg-grouped-secondary` for cards and grouped list cells, `--bg-grouped-tertiary` for a sub-group inside a card (a getting-there box inside a zone card). Sheets, popovers and the iPad inspector use `--bg-elevated`. Nothing else introduces a background colour.

Label tokens map one to one to iOS: `--label` for primary text, `--label-secondary` for subtitles, meta and section headers, `--label-tertiary` only for text at 18px or larger or for glyphs (chevrons, disclosure arrows), `--label-quaternary` only for disabled or decorative strokes.

Light secondary label is 0.72 alpha rather than the iOS 0.60 so that Footnote and Caption text on both white cards and the grouped page meets 4.5:1. Dark keeps the iOS 0.60 because it already exceeds 5:1 on `#1C1C1E`.

### 3.2 Tint

One tint. Light `#006AD6` (5.2:1 on white, 4.65:1 on the grouped page), dark `#0A84FF` (iOS dark system blue, 5.8:1 on black and 4.7:1 on `#1C1C1E`). Increase Contrast switches to Apple's higher-contrast blues `#0040DD` and `#409CFF` (reference values). The tint is used for: interactive text, selected tab icon and label, the today ring, primary filled buttons (`--on-tint` text), focus rings, and the To decide callout wash via `--tint-soft`. It is never used for body text, backgrounds or decoration.

### 3.3 Status and category colours

Every status colour exists as a trio: fill (the iOS system colour), text (a darker light-mode or lighter dark-mode variant that passes 4.5:1 on white, the grouped page and `#1C1C1E`), and soft (a low-alpha wash for chip backgrounds). A chip uses soft as background, text for its label and icon, and never the raw fill behind text.

| Meaning | Trio | Icon (own SVG, SF Symbol name for reference) | Label text |
| --- | --- | --- | --- |
| Halal certified | `--ev-certified-*` green | checkmark.seal | Halal certified |
| Halal, own claim | `--ev-claim-*` orange | checkmark.circle | Halal (own claim) |
| Halal menu | `--ev-menu-*` teal | list.bullet.rectangle | Halal menu |
| Muslim-friendly | `--ev-friendly-*` gray | hand.raised | Muslim-friendly |
| Not halal, fallback (fish, prawn, veg) | `--ev-fallback-*` indigo | fish | Fish, prawn or veg options / Not halal: fallback |
| Not for a traveller | `--ev-no-*` red | xmark.circle | Not for {name} |
| Day type: shopping | `--type-shop` orange | bag | Shopping |
| Day type: sightseeing | `--type-sight` indigo | building.columns | Sightseeing |
| Day type: rest | `--type-rest` green | leaf | Rest |
| Day type: travel | `--type-travel` gray | airplane | Travel |
| Watch out | `--yellow-*` | exclamationmark.triangle | Watch out |
| To decide / open | `--tint-soft` wash with `--tint` label | questionmark.circle | To decide |

Colour never carries meaning alone: every status has an icon and a text label, and day types in the rhythm chart have a legend plus a text label in the day row.

Certifier and alcohol are not colours. They are Footnote lines: "Certified by {certifier}", "Alcohol served: Yes / No / Unknown". The `verified` note renders as Footnote in `--label-secondary` prefixed by "Checked {as_of}:".

### 3.4 Uncertainty notes

Inline qualifiers already in the text stay in the text. When a field is structured (booking status, decision status) the chip is neutral: `--fill-secondary` background with `--label` text for Not booked, To decide, Not needed. A dedicated "Sources disagree" note style is a Footnote line with the exclamationmark.triangle icon in `--yellow-text`, used only where the data flags conflicting sources. Nothing uses red except "Not for {name}".

### 3.5 Dark Mode and Increase Contrast

`color-scheme: light dark` is declared so form controls, scrollbars and the status bar follow. Dark surfaces use the iOS elevated greys (`#1C1C1E`, `#2C2C2E`) rather than tinted darks. Under Increase Contrast, separators strengthen, secondary labels darken and status text variants darken; nothing changes layout. A `data-theme` attribute on `html` allows a forced appearance for screenshots and tests; the app ships without a user-facing theme switch because the system setting is the switch.

## 4. Materials, bars and layers

The HIG separates a content layer from a floating control layer. On the web there is no Liquid Glass, so the control layer is approximated with a standard material: `background: color-mix(in srgb, var(--bg-bar) calc(var(--material-alpha) * 100%), transparent)` plus `-webkit-backdrop-filter: saturate(180%) blur(20px)`. Under `prefers-reduced-transparency` `--material-alpha` becomes 1 and the bars are solid. The material is used only for: the navigation bar, the floating tab bar, the iPad top tab bar and sidebar when content scrolls beneath, and sheet headers. The content layer never uses it.

- **Navigation bar:** material background, `--hairline` bottom separator that appears only once content has scrolled under it (scroll edge effect). Inline title Headline centred; leading back control is a chevron plus the previous title; trailing holds at most two glyph buttons.
- **Floating tab bar (compact):** a capsule `--tabbar-h` tall, inset `--tabbar-inset-x` from the sides and `--tabbar-inset-b` from the bottom, `--radius-pill`, material background, `--shadow-float`. Items are five equal columns; each item is at least `--hit` square, icon `--icon-tab` above a Caption 2 label; selected item uses `--tint` for icon and label with a `--tint-soft` capsule behind it; unselected items use `--label-secondary`. Content scrolls under the capsule, so every scroll container has bottom padding of `--tabbar-h` plus `--tabbar-inset-b` plus 16px.
- **Top tab bar (regular):** centred in the navigation bar, a segmented-style capsule where each item shows icon and label side by side (regular size class shows both, per the HIG). A sidebar toggle button at the leading edge converts it to the sidebar. Selected item: `--tint` label with `--tint-soft` capsule.
- **Sidebar:** `--sidebar-w` or `--sidebar-w-wide`, page background, rows at least `--hit` tall, icon then label, selected row `--tint-soft` with `--tint` label; second level under Days is a disclosure group listing day rows. Never hidden by default on wide and extra wide tiers; collapsed by default on regular narrow.
- **Sheet (compact place detail):** `--bg-elevated`, top corners `--radius-xl`, a grabber (36 by 5px, `--fill`) centred 8px from the top, medium detent at `--sheet-detent-medium`, expands to full height minus the status bar, dims the content behind with `rgba(0,0,0,0.2)` light or `0.4` dark, `--shadow-sheet`. Swipe down and the Close button both dismiss; Escape dismisses on hardware keyboards.
- **Inspector (regular place detail):** a trailing column `--inspector-w` with `--bg-elevated`, a `--hairline` leading separator and its own scroll.

## 5. Shape, spacing and density

- Layout margin: 16px compact, 20px regular and above. Grouped list inset: the same values.
- Grouped list corner radius `--radius-md` (10px), card radius `--radius-lg` (14px), sheet and large containers `--radius-xl` (20px), chips and pills `--radius-pill`.
- Cell padding `--cell-pad-x` by `--cell-pad-y`; cells are at least `--hit` tall. Separators are `--hairline` in `--separator`, inset to align with the text start, never full bleed inside a card.
- Minimum hit target `--hit` on both axes for every control including chips that act as filters and the small Map and Source actions. Visual size may be smaller than the hit area; the hit area is padded. Bezeled controls keep at least `--hit-gap` between them.
- iPad is read from about three feet. Lists keep the 17px body size but rows may use 48px minimum height and 20px padding on wide tiers, and two columns of content are preferred to wider single rows. Cards never exceed `--measure-wide` in a single column.
- Safe areas: `viewport-fit=cover` with `env(safe-area-inset-*)` applied to the navigation bar top, the tab bar bottom, and both horizontal edges in landscape. The home-indicator area is never tappable content.

## 6. Iconography

SF Symbols cannot be shipped in a web app (their licence limits them to Apple-platform apps and forbids use as logos). The app ships its own inline SVG set drawn to the same conventions so the result reads as native:

- 24 by 24 viewBox, 1.75 stroke (`--icon-stroke`), round caps and joins, optical centring, `currentColor` fill and stroke so icons take the text colour.
- Sizes: `--icon-inline` beside text, `--icon-toolbar` in bars, `--icon-tab` in tab bars, `--icon-large` on empty states. Icons scale with `em` when inline so they follow Dynamic Type.
- Each tab icon has an outline and a filled variant; the filled variant marks the selected tab, matching the platform convention for tab bars.
- Set (reference SF Symbol names): sun.max, calendar, fork.knife, mappin.and.ellipse, info.circle, chevron.left, chevron.right, chevron.down, chevron.up.chevron.down, sidebar.leading, magnifyingglass, xmark, xmark.circle, checkmark, checkmark.seal, checkmark.circle, list.bullet.rectangle, hand.raised, fish, bag, building.columns, leaf, airplane, figure.walk, tram, car, map, arrow.triangle.turn.up.right.diamond (directions), link, exclamationmark.triangle, questionmark.circle, lock, lock.open, key, eye, eye.slash, square.and.arrow.up, plus.app (add to home screen), wifi.slash, arrow.clockwise, clock, yensign.circle, phone, doc.on.doc (copy), person, person.2, cup.and.saucer, birthday.cake, building.2 (hotel), moon.stars (prayer room).
- The prototype ships `prototype/icons.svg` as a symbol sprite with these ids; the app may copy it as is.

## 7. Motion

| Transition | Duration | Easing | Movement | Reduced motion |
| --- | --- | --- | --- | --- |
| Push / pop | `--dur-slow` | `--ease-standard` | New view slides in from trailing edge, old view shifts 30% and dims; reverse on pop and on edge swipe | Crossfade `--dur-fast`, no translation |
| Tab switch | none | | Instant, as iOS | none |
| Sheet present / dismiss | `--dur-slow` | `--ease-sheet` | Slide up from bottom; dim fades in | Fade only |
| Day change (prev/next, strip tap) | `--dur-base` | `--ease-standard` | Content crossfade with a 4px vertical settle | Crossfade |
| Large title collapse | tied to scroll | | Title scales from Large Title to Headline and the hairline appears | Same (scroll-driven, no autonomous motion) |
| Chip select | `--dur-fast` | `--ease-standard` | Background and colour change only | Same |
| Tab selection capsule | `--dur-base` | `--ease-standard` | Capsule slides to the selected item | Appears in place |
| Unlock success | `--dur-base` | `--ease-decelerate` | Lock screen fades out, Today fades in; no zoom | Same |
| Trip updated banner | `--dur-base` | `--ease-decelerate` | Slides down under the navigation bar, stays until dismissed | Fades |
| Pressed state | immediate | | Opacity 0.6 on text buttons, `--tint-pressed` on filled buttons, `--fill-tertiary` highlight on rows | Same |

No parallax, no bouncing, no autonomous looping animation anywhere. Progress during unlock is a determinate-looking bar inside the button that advances over the expected derive time and completes on success; it never spins.

## 8. Voice and copy

- Tab labels are single words. Button labels start with a verb or name the destination: Directions, Walk, Train, Taxi, Map, Source, Open day, Show taxi card, Back to the hotel, Unlock, Lock now.
- Headings and buttons use Title Case for navigation titles and tab labels, sentence case for everything else, including section headers once rendered (they are uppercased by CSS, not in the source).
- Uncertainty phrases are fixed: "To decide", "Not booked", "Not needed", "Could not confirm", "Sources disagree", "Estimate", "Checked {as_of}". Hours and prices are reproduced verbatim from the data.
- Empty states explain and offer the next step: "No certified places in this area. Turn off Certified only to see more."
- No em dashes anywhere. No exclamation marks in UI copy.
- Traveller names are always interpolated from the payload: "Works for {name}", "Not for {name}", "{name}'s picks".

## 9. App icon and PWA appearance

- Icon: a two-layer mark, a deep night-blue rounded field (`#1E2A5A` to `#2F4B8F` vertical gradient) with a single warm vermilion disc (`#E8553D`) offset to the upper right, representing a lantern at dusk. No text, no SF Symbols, no transparency, square artwork; iOS applies the mask. Sizes: 180 by 180 `apple-touch-icon`, 192 and 512 manifest icons, 512 maskable with the disc inside the 80% safe zone. Source SVG in `prototype/icon.svg`.
- `theme-color` is `#F2F2F7` light and `#000000` dark via two meta tags with `media` attributes; status bar style `black-translucent` so the page extends under it and the app pads with the safe-area inset.
- Home Screen name "Osaka Trip", short name "Osaka".
