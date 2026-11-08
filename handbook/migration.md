# Migration from the original Claude artifacts

The app was migrated on 8 Nov 2026 from two exports of the original holiday work: the "Osaka Trip Planner" artifact (an HTML export that embedded the full planner dataset) and the "Osaka Trip 2026" document (Markdown export). Those originals are retired and must not be edited; this repository is the source of truth.

## Method

- The planner's embedded dataset was extracted verbatim (byte-identical to the export) into the private folder.
- The document was split into its sections and carried as text, so its tables, checklists and source links render in Info without retyping.
- Two independent audits checked source completeness and itinerary logic. Their reports, the field inventory and the per-item counts are private (`../osaka-trip-private/audit/`) because they quote trip content.
- `scripts/prepare-trip.mjs` builds the app dataset. It only adds structure (traveller roles, hotel card fields taken from the planner's own markup), renames two field names so public code stays neutral, and redacts booking references and private Claude links. It does not add or change trip facts.

## Coverage

- Carried: every day with its flow, zones, getting-there notes, stops, food, sweets and shops, end-of-day notes, pacing notes, watch-outs, open questions and sources; the bakery list; the halal index with its evidence labels, certifiers, alcohol notes, verification notes and research date; prayer rooms; the list of places checked and left out; every document section.
- Behaviour carried from the planner: food categories and their rules, halal ranking, sort by nearest or earliest opening, the taxi card, "works for" filtering, Asia/Tokyo day logic.
- Withheld on purpose: booking reference numbers (pending the owner's decision), private Claude links, the document byline.
- Known source gaps kept visible rather than fixed: no coordinates (directions hand off to Maps), free-text hours (shown verbatim, no "open now"), walk minutes only meaningful from the hotel, and a handful of conflicts between sources that the audits list. These are questions for the owner, not app bugs.
