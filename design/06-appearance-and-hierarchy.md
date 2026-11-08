# 06. Appearance and hierarchy revision (v2)

Owner: Fable - Osaka Apple design. Date: 9 Nov 2026. Status: handed to Opus for implementation. Supersedes the colour section of `01-design-system.md` and the manifest and status bar lines of `04` and `05` where they differ.

## 1. Owner feedback and diagnosis

Owner feedback, paraphrased: the app looks very dark, surfaces blend into each other, menus are hard to tell from content, and the visual and information hierarchy is weak. Wanted: a lighter, attractive, practical scheme with clear separation between page, grouped surfaces, navigation, selected states, headings, body and secondary text.

Diagnosis on the synthetic fixture build:

1. The app had no appearance of its own. `tokens.css` followed `prefers-color-scheme`, so a device in Dark Mode got a pure black page with near-black cards, a near-black tab bar and a black navigation band. That is the "very dark website".
2. In both appearances the bars did not separate from the page: the navigation bar material was a 1-step lighter grey over the page, and the floating tab bar sat on the page with the same material, so the capsule read as part of the content.
3. The page and the surfaces differed by luminance only (iOS system grey against white, or black against graphite), with no edge, so in daylight and in dark they merged.
4. Unchecked native checkboxes rendered as dark filled squares on some browsers, the heaviest marks on the Today screen.
5. The sidebar on iPad used the page colour with only a hairline, so navigation and content were one surface.

## 2. Decisions

1. **Light is the app default.** Appearance is an app setting: Light (default), Automatic, Dark. HIG prefers following the device, and Automatic keeps that available; the owner has asked for a reliable light presentation for daylight travel use, which is the accepted reason to offer the setting. Dark stays coherent and accessible for people who choose it.
2. **One accent.** Cobalt `#1F4FC7` light, `#6FA3FF` dark, used for links, glyphs, selection and filled controls. It is distinct from iOS system blue, does not collide with the status greens, oranges, teals, indigos and reds, and passes 7.0:1 on white. Status and category hues are unchanged so every chip keeps its meaning.
3. **Warm neutrals.** Page `#F3F1EC`, sidebar `#E9E7E1`, surfaces white, text `#1C1C1E`. White cards read as paper on a desk rather than a blank screen, and the sidebar is visibly a different place from the content.
4. **Five layers, always distinguishable without hue:** sidebar, page, bar material, surface, elevated. Each surface carries a hairline edge (`--card-edge`) and a 1px soft shadow so it holds in sunlight and in dark.
5. **Hierarchy comes from type and spacing first, colour second.** Large title 34 bold; section titles 22 bold; group headers caption uppercase secondary; row titles headline semibold; body 17; secondary 15 in `--label-secondary`; meta 13. No new sizes.

## 3. Appearance mechanism (engineering contract)

- `html[data-theme]` holds the choice: `light` | `auto` | `dark`. Stored in device prefs as `appearance`. Default `light`.
- `html[data-appearance]` holds the resolved value `light` | `dark`. `docs/js/theme.js` (classic same-origin script in `<head>` before `tokens.css`, allowed by the CSP) sets both before first paint. `auto` resolves through `matchMedia('(prefers-color-scheme: dark)')` and updates live when the device changes.
- `tokens.css` reads only `data-appearance`. No attribute means light. `color-scheme` is set to `light` on `:root` and `dark` under `[data-appearance="dark"]`, so form controls and scrollbars follow the app, not the device.
- `theme.js` keeps `<meta name="theme-color">` equal to `--theme-color`: light `#F3F1EC`, dark `#111113`. Remove the two media-qualified theme-color metas and keep one.
- Status bar for Home Screen launches: `apple-mobile-web-app-status-bar-style="default"`. iOS draws the status bar in the theme-color and picks legible text for it. `black-translucent` is withdrawn because it forces white status text over a light bar.
- Control: Info > App, a new group **Appearance** with a segmented control, three segments: Light, Automatic, Dark. Footer: "Automatic follows the iPhone or iPad setting." Changing it applies immediately with no reload. Segmented, not a select, because three short options with one tap is the iOS pattern for this.
- The locked screen and the Taxi card use the same tokens, so they follow the choice too. The Taxi card stays high contrast in both appearances.

## 4. Palette v2 (from `tokens.css`; ratios are WCAG 2 contrast)

| Role | Light | Dark | Evidence |
|---|---|---|---|
| Page `--bg-grouped` | #F3F1EC | #111113 | theme-color follows this |
| Surface `--bg-grouped-secondary` | #FFFFFF | #1F1F23 | page to surface step 1.14 light, 1.15 dark, plus `--card-edge` |
| Surface inner `--bg-grouped-tertiary` | #F4F2EE | #2A2A2F | sub-groups inside a card |
| Elevated `--bg-elevated` | #FFFFFF | #232328 | sheets, inspector, toasts |
| Bar material base `--bg-bar` | #FFFFFF | #1B1B1F | at `--material-alpha` 0.84 light, 0.88 dark |
| Sidebar `--bg-sidebar` | #E9E7E1 | #161619 | sidebar to content 1.24 light |
| Edge `--card-edge` | rgba(60,60,67,.12) | rgba(255,255,255,.07) | hairline on surfaces, bars and the tab capsule |
| Label | #1C1C1E | #F5F5F7 | 15:1 |
| Secondary | rgba(60,60,67,.76) | rgba(235,235,245,.64) | 5.2:1 white, 4.8:1 page, 4.6:1 sidebar; dark 6.4:1 |
| Tint (text, glyphs) | #1F4FC7 | #6FA3FF | 7.0:1 white, 6.2:1 page; dark 6.5:1 on surface |
| Tint fill (filled controls) | #1F4FC7 | #2F6FE0 | white on it 7.0:1 light, 4.7:1 dark |
| Tint soft (selection) | rgba(31,79,199,.12) | rgba(111,163,255,.20) | tint text on it 5.8:1 light, 4.6:1 dark |
| Separator | rgba(60,60,67,.24) | rgba(255,255,255,.10) | inset hairlines |
| Check ring | rgba(60,60,67,.34) | rgba(235,235,245,.36) | unchecked round control |
| Scrim | rgba(28,28,30,.32) | rgba(0,0,0,.5) | behind sheets and overlays |

Status and category colours are unchanged from v1 (text variants 5.0:1 or better on white; dark variants 5.8:1 or better on surfaces). Increase Contrast overrides remain and now also strengthen `--card-edge` and `--check-ring`.

## 5. Hierarchy rules

1. **Navigation is a different material from content.** Bars use `--bg-bar` at `--material-alpha` with blur and a bottom (nav) or full (tab capsule) `--card-edge` hairline. Content never uses bar material.
2. **The navigation bar is transparent at the top of a scroll view and becomes material once content scrolls under it.** The large title sits on the page colour. This removes the grey band above the title.
3. **Selected means tint plus shape, never tint alone.** Selected tab: filled glyph, tint label, `--tint-soft` pill. Selected sidebar row and selected list row: `--tint-soft` fill with tint label. Selected segment: white (or `--bg-elevated`) pill with shadow. Selected filter chip: `--tint-fill` with `--on-tint`.
4. **Every surface has an edge.** Cards, grouped lists, chips that sit on the page, the tab capsule and the inspector get `box-shadow: 0 0 0 var(--hairline) var(--card-edge), var(--shadow-card)`. Rows inside a list separate with inset hairlines in `--separator`.
5. **Group headers are labels, not titles.** Caption 1, uppercase, `--label-secondary`, 8px above the surface, 24px below the previous surface. Section titles (Title 2, bold, `--label`) are used only when a screen has true sub-sections (Today's Now, Next up, First day).
6. **Secondary text is secondary by colour and size together.** Subheadline 15 in `--label-secondary`. Tertiary is reserved for glyphs and large numerals.
7. **Interactive text is tint; informational text is label.** A row that pushes shows a chevron in `--label-tertiary`; a row that leaves the app shows the outward arrow in tint.
8. **Filled controls use `--tint-fill` with `--on-tint`; text-only controls use `--tint`.** Destructive stays `--red-text` on a surface.
9. **Checks are round.** 22px ring in `--check-ring`, 1.5px; checked fills `--tint-fill` with a white checkmark glyph. Completed items keep their text in `--label-secondary` without strikethrough on Today (strikethrough stays in the To book list).

## 6. Component deltas for `docs/app.css` and `docs/js` (ids for the review)

| Id | Component | Change |
|---|---|---|
| V1 | `html`, `theme.js`, `index.html` | Appearance mechanism and metas as in section 3. Default Light. |
| V2 | Info > App | Appearance group: segmented Light / Automatic / Dark with footer copy; persists; applies live. |
| V3 | `.navbar` | Transparent background and no hairline at scroll top; `--bg-bar` material plus bottom `--card-edge` hairline once scrolled (reuse the existing scrolled state). Title fade unchanged. |
| V4 | `.tabbar` | Material from `--bg-bar` at `--material-alpha`; `box-shadow: 0 0 0 var(--hairline) var(--card-edge), var(--shadow-float)`. |
| V5 | `.tab[aria-current]` | Filled glyph, `--tint` label, `--tint-soft` pill (keep); unselected `--label-secondary`. |
| V6 | `.sidebar` (regular wide and extra wide) | Background `--bg-sidebar`; right hairline `--separator`; selected row `--tint-soft` fill with `--tint` label and filled glyph; unselected rows `--label`. Overlay sidebar (regular narrow) uses `--bg-sidebar` too. |
| V7 | iPad top tab bar strip (regular narrow) | Strip background `--bg-sidebar`; selected tab `--tint-soft` pill with `--tint` label. |
| V8 | `.card`, `.grouped`, `.hero`, `.now-card`, `.day-card`, `.rhythm`, `.flow`, `.disclosure`, `.bullets`, `.note`, `.empty`, `.quick-btn`, `.getting`, `.inspector` | Add `box-shadow: 0 0 0 var(--hairline) var(--card-edge), var(--shadow-card)`. Radii follow the new tokens (md 12, lg 16, xl 22). |
| V9 | `.group-title`, `.group` | Spacing per rule 5; colour `--label-secondary`. |
| V10 | `.task input`, `.book-check` | Replace native checkboxes with the round check control (rule 9): hidden input, 22px ring span, checkmark glyph from `icons.svg`; `aria-checked` through the input. |
| V11 | `.btn`, `.filter-chip[aria-pressed="true"]`, `.lock-mark`, primary buttons | Background `--tint-fill`, text `--on-tint`. Text buttons and links stay `--tint`. |
| V12 | `.segmented button[aria-checked="true"]` | `--bg-elevated` pill, `--shadow-card`, plus `0 0 0 var(--hairline) var(--card-edge)`. |
| V13 | `.scrim` | `background: var(--scrim)`; delete the literal rgba and the media query. |
| V14 | `.update-banner`, `.toast`, `.sheet`, `.taxi` | `--bg-elevated` with `--card-edge` hairline; sheet keeps `--shadow-sheet`. |
| V15 | `.hero-number`, `.today-title` | Countdown numeral `--tint`; title `--label`. No change in size. |
| V16 | Locked screen | Page `--bg-grouped`; card-free layout stays; field on `--bg-grouped-secondary` with `--card-edge`; Continue uses `--tint-fill`. |
| V17 | Taxi card | Unchanged layout; verify both appearances keep 7:1 for the Japanese address block. |

Everything else keeps its tokens; the token values alone lift the light appearance.

## 7. Evidence and acceptance

- Prototype: `design/prototype/index.html` renders v2 in light by default; `#a=dark` in the hash shows dark. Synthetic data only.
- Fixture site for Opus screenshots: `tests/e2e/serve-fixture.mjs`, both appearances, iPhone 393 wide and iPad 1366 wide, screens Today, Days, Food, Places, Info, Locked.
- Acceptance for my re-review: V1 to V17 visible on the fixture site; Playwright and privacy checks pass; theme-color and status bar verified in a Home Screen launch by Ali (added to the Q9 device list).
- Not in scope: content, itinerary data, routing, offline, privacy behaviour.
