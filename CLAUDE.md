# Osaka Trip: agent instructions

Read README.md first. Non-negotiable rules:

- Future edits happen in this repository and its deployed app only. NEVER edit or rely on the old Claude artifact, the "Osaka Trip 2026" document or the holiday chat sessions; they are retired migration input.
- Plaintext trip data, keys and the access link live in ../osaka-trip-private/ and must never be committed, printed, pasted into issues/PRs/logs/screenshots, or sent anywhere. Never print or persist the site password.
- Run `npm test` and `npm run check:privacy` before every commit. The pre-commit hook (core.hooksPath=.githooks) enforces the privacy check; set it with `git config core.hooksPath .githooks` on a fresh clone.
- Preserve source uncertainty: do not invent bookings, opening hours, halal status or verification. Mark unverified data as such.
- Apple HIG for iPhone and iPad (Safari, Home Screen). Design authority is design/; current state is handoff/.
- Do not change alibeydoun.info, the DJ Wasabi site, DNS or account settings from this repo's work without Ali's explicit approval.
- No em dashes in user-facing copy.
