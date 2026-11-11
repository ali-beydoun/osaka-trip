# Screens by tier

Owner: Fable - Osaka Apple design. v1, 8 Nov 2026. Content order is normative; `05-implementation-contract.md` section S lists the same screens as acceptance items. Tier names are from `00-brief-and-ia.md` section 4: compact (up to 599 px), compact height (height up to 500 px), regular narrow (600 to 899), regular wide (900 to 1179), extra wide (1180 and up). Examples use the synthetic fixture. The static prototype in `prototype/` renders every screen below.

## Shared frame

| Element | Compact | Regular narrow | Regular wide and extra wide |
| --- | --- | --- | --- |
| Navigation bar | Material bar, large title on root screens that collapses to an inline Headline title on scroll; back control with previous title on pushed screens | Material bar; leading sidebar button; centred top tab bar with icon and label per item; no large title row when the top tab bar is shown, the screen title is the first heading in content | Same bar; sidebar open by default so the top tab bar is hidden and the title sits in the bar centre |
| Primary navigation | Floating bottom tab bar, five items, icon above Caption 2 label, selected item tinted with a soft capsule | Top tab bar in the navigation bar; sidebar available behind the leading button and the edge swipe | Sidebar 280 px (300 px extra wide) with Sections, then a Days group listing each day (day number disc, title, date), today ringed |
| Content width | Full width minus 16 px margins | Readable measure 680 px centred, or a list column plus a detail column | Measure 680 to 820 px plus a rail or inspector, never a single stretched column |
| Place detail | Sheet from the bottom, medium detent, grabber, Close | Inspector column beside a list (Food, Places); form sheet centred over Days or Today | Same, with the list widening to use the spare width |
| Transient | Banners stack under the navigation bar inside the scroll content: Viewing as (yellow), Trip updated, Add to Home Screen hint | Same, constrained to the measure | Same |

Every scroll container reserves bottom space for the floating tab bar on compact so the last row is never hidden under it.

## Locked

See `04-unlock-pwa-offline.md` section 1. Full screen on every tier, pane at most 420 px wide, vertically centred, no sidebar or tab bar.

## Today

Order on trip: date line (date, Day n of N), day title and place as the first heading block; the Now card; Confirmed today cards when the day has structured `status: "confirmed"` reservations; quick actions; Not booked yet warning for genuine remaining unbooked items; To decide callout if the day has an unresolved open decision; Rest of today; Watch out (first three plus more); Tomorrow.

- **Now card.** Caption label "Now" with the zone time range, zone name at Title 3, purpose at Subheadline, a Next box when another zone follows (label "Next" with its time, zone name, the getting-there sentence and one primary directions button for its mode). When no zone is current the card's label is "Today's plan" with the day title and summary; the "Then" box shows End of the day when the last zone has passed. A text button "Open the full day" closes the card.
- **Confirmed reservation card.** Shown whenever structured `bookings` includes `status: "confirmed"` for that day (never inferred from prose). Plain "Confirmed" chip with check-circle glyph, time and meal label, venue name (plus Japanese name in `lang="ja"`), guest count and area, context link to the itinerary zone or venue notes, directions buttons to that exact venue, and a collapsed "Reference & policy" disclosure holding confirmation reference, booked-under traveller, details, cancellation policy and booking/venue links.
- **Quick actions.** Four equal tiles: Back to the hotel (directions, taxi mode after 20:00 Tokyo, transit otherwise), Food near here (Food tab, Halal, today's area), Prayer rooms (same, scrolled to Prayer rooms), Taxi card. Icon over a two-line Caption 1 label. On iPad the tiles keep four columns; at accessibility text sizes they become two columns.
- **Rest of today.** One row per zone: time range, zone name, purpose, Confirmed chip when the zone holds a confirmed reservation, Now chip when active, chevron; opens the day detail.
- **Pre-trip.** A countdown card (large tinted number and "days to go", the start date and a Japan time note), Confirmed reservations across the trip when present, To book pending items (excluding slots already covered by a confirmed meal or dining zone), Next up checklist (round check controls, local ticks), First day row, Before you go rows (Bookings, Getting around, Tax-free shopping).
- **Post-trip.** A single centred card: sun glyph, "Trip complete", "The plan stays here for next time.", a secondary button to Days.

Regular tiers: identical content at the readable measure. The Now card and quick actions do not spread into columns; the day is one column of priorities.

## Days

Root (compact): Trip at a glance card (title, one column per day with the load bar in the type colour, weekday kanji, day number in a ring for today and a filled disc when selected, weekend wash, open-decision dot for unresolved decisions, legend) then the Days grouped list (day number badge, date, title, place, chips for type, load, Confirmed when applicable and To decide when unresolved, chevron). Tapping a day pushes the day detail.

Root (regular narrow and wide): a two-column split. Left column 320 to 340 px holds the chart and the list; the right column holds the selected day's detail with the chart column and the sidebar day rows both marking the selection. Default selection is today during the trip, otherwise the first day. Extra wide adds the day's secondary rail (see below).

### Day detail

Compact day jump strip appears only below 600 px where neither the list column nor the sidebar is visible. Header: day count eyebrow (with Weekend when applicable), title at Title 2 (the `h1`, focus target on push), date and place line, previous and next day buttons in the navigation bar (44 px, disabled at ends, left and right arrow keys also work on the header). Chips: Today when applicable, type, load, walking. Summary at Body.

Near-top status and alerts, in order:
1. **Confirmed** section when the day has one or more structured `status: "confirmed"` bookings: each booking card shows the plain "Confirmed" chip, time and meal, venue, guest count, jump button to its itinerary zone, venue notes sheet trigger when matched, exact venue directions buttons, and collapsed "Reference & policy" disclosure.
2. **Not booked yet** callout only for genuinely unbooked `need: "needs"` items on that day (dining alternatives in a meal or zone already covered by a confirmed reservation are suppressed).
3. **To decide** callout when `open` remains unresolved.

Then **The day** as a single unified chronological itinerary:
1. **Itinerary overview (`ol.flow`):** compact chronological beats (when label and pace level in the leading column; description, inline Confirmed chip on the matching beat, and a 44 px jump button to the numbered Zone stage in the body column).
2. **Numbered Zone stages (`#zone-0`, `#zone-1`, ...):** numbered disc, zone name at Title 3, linked beat labels plus time range, purpose; pinned `.zone-confirmed` row(s) when the zone holds a confirmed reservation (with Confirmed chip, time, venue, guests and direct venue directions); collapsed "Getting there" disclosure (previewing duration, fare and station in the summary, expanding to route prose and directions buttons); visible `See` (`stops`) rows; concise `what_to_look_for` callout and collapsed `Zone tips & entry details`; and **always-collapsed** optional disclosures (`Optional dinner/lunch/breakfast alternatives (N)` when a dining booking is confirmed in that zone, excluding duplicate of the confirmed venue while keeping backup options accessible, else `Eat (N)`; plus `Something sweet` and `Shop`).

Followed immediately in the primary column by **End of the day** (card with the home sentence and hotel directions buttons).

Secondary reference sections follow calmly via progressive disclosure (stacked below on compact and regular narrow/wide; placed in the trailing rail `.day-secondary` on extra wide when no place detail pane is open): **Practical notes & options** (Halal and Prayer area links with counts, plus disclosures for Optional massage, facial & spa, Route & pacing, Entrances, tickets & practical logistics, and Rain & low-energy alternatives), **Good to know** (pacing note and watch-outs), **Questions to settle**, and **Sources** (checked-on caption and collapsed source links).

## Food

Root: horizontally scrolling category chips with counts (Bakeries, Breakfast, Pancakes, Halal and any further data-driven category). Each category shows a header card (category title, one-line blurb, a sort segmented control for bakery-type lists: Nearest the hotel, Opens earliest) and a grouped list of place rows. Bakery rows show the opens chip, the why line in medium weight, signature, area and walk minutes when known, seats, coffee and queue notes, hours and closed day, price, tags.

Halal: header card with title, "Researched and checked {as_of}" caption, the area picker (horizontal chips with counts, Today marker on the current area, default from `dayGroup`), the Certified only switch, the five-status legend, and two search handoffs (Halal near me, Prayer room near me). Then the list for the chosen area ranked by status, then walk minutes, then source order; each row shows the status chip, cuisine and area meta, what, hours and closed day and price, certifier and alcohol lines where present, the verified note as "Checked {as_of}: …" and the uncertainty note style when the note contains the qualifier words. Then Prayer rooms for the area (name, where, hours, Walk, Map, Source). Then the Closed or left out disclosure.

Regular tiers: the category chips, header card and list form the left column; the inspector column shows the selected place with a Close control, or a placeholder "Select a place to see its details." The inspector scrolls independently and stays sticky.

## Places

Root: search field (search type, placeholder "Search names and notes", results filter as you type after a short pause), kind segmented control (See, Shop, Sweet, Eat), group-by segmented control (By day, By area), the Works for {name} switch when Eat is selected, then grouped lists. Group headers are the day date and title (with an Open day action) or the area name. Rows are the same place rows as elsewhere, with the zone or date as the first meta item so each row keeps its context.

Regular tiers: search, segmented controls and the switch sit above the grouped lists in the list column, with a places count; the inspector column shows the selected place, exactly as in Food.

## Info

Grouped lists in this order: Hotel (name and address, check-in and check-out, nearest stations; Show taxi card; Call the hotel as a `tel:` link; a directions row with Taxi, Train, Walk, Map), Getting around (title, detail, Train and Map actions per row), Bookings (title, status chip, detail; footer "Status from the trip notes. References are in the confirmation emails."), Airport day (numbered steps), Tax-free shopping (bulleted rows with the yen glyph), Guides (rows that push a guide page), Decisions (open first, status chip Decided or Open, detail, lean), What we want (compass rows), Sources (external link rows), App (Keep unlocked switch, Lock now, Maps app segmented control, Add to Home Screen instructions, Offline ready with data version and research dates, Update trip link, About).

Status chips in Info are neutral: Booked and Decided take the green text trio with a check glyph; Open, Not booked and Not needed use the plain fill chip with the question glyph. Nothing in Info is red.

Deep links from Today open Info scrolled to the named group (`x=bookings`, `x=getting-around`, `x=tax-free`, `x=appgroup`).

## Taxi card

Full screen, elevated background, no material. Top line: label "Show this to the driver" and a Close control. The hotel's Japanese name at about 1.15 times Title 1 in the Japanese font, the Japanese address at Title 2, then a box with the English name, address and phone, then Taxi, Map and Call actions, then a footnote that it works offline. Light and dark both high contrast. Escape and Close return to Info.

## Empty and error states

- Search with no matches: card with the magnifier glyph, "No {kind} places match "{query}"." and a Clear search button.
- Halal area with no places: "Nothing verified in this area yet." or, with Certified only on, "No certified places in this area. Turn off Certified only to see more."
- Category with no items: glyph plus "Nothing here yet."
- Place detail without a selection (inspector): "Select a place to see its details."
- Offline before first load and unlock failures: see 04.
