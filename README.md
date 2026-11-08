# Osaka Trip

A private trip companion web app for a Kansai trip, built to feel like a native iPhone and iPad app in Safari. It is published as a static, encrypted site on GitHub Pages at `https://osaka.alibeydoun.info/`.

## Source of truth (read first)

- **This repository and the deployed app are the only place to change the trip app.** Do not edit the original Claude artifact ("Osaka Trip Planner"), the "Osaka Trip 2026" document or the holiday chat sessions. They were migration input only and are now historical.
- Plaintext trip data lives **outside** this repo in the sibling private folder `../osaka-trip-private/` (never committed, never pasted into issues, PRs, logs or screenshots). The repo holds only the app code and an encrypted data file.
- Current work state and resume points: [`handoff/`](handoff/). Design specification: [`design/`](design/) (owned by the design role). Engineering notes: [`handbook/`](handbook/).

## Privacy model

- The trip dataset is published only as `docs/data/trip.enc.json`, an AES-256-GCM envelope.
- Opening it needs **both** the private link (it carries a 256-bit secret in the URL `#` fragment, which browsers never send to servers) **and** the site password. The key is derived with PBKDF2-SHA256 plus HKDF-SHA256 in the browser's built-in WebCrypto. Details and limits: [`handbook/privacy.md`](handbook/privacy.md).
- Search indexing is disabled with `noindex` meta tags. `robots.txt` deliberately allows crawling so crawlers can see `noindex`. `noindex` is a request, not access control; the encryption is the protection.
- The site is not linked from alibeydoun.info navigation, sitemap or blog.

## Layout

| Path | Purpose |
| --- | --- |
| `docs/` | The deployed static site (GitHub Pages serves this folder). App code, styles, service worker, manifest, encrypted data. |
| `docs/js/vault.js` | Encryption and key derivation (shared by browser, build and tests). |
| `scripts/` | `init-keys.mjs` (create or rotate link and password key), `build-data.mjs` (encrypt private data), `check-privacy.mjs`, `serve.mjs`. |
| `tests/` | Unit tests (`node --test`) and browser tests (Playwright, WebKit and Chromium). |
| `design/` | Apple HIG design specification and prototype. |
| `handbook/` | Privacy, data model, migration coverage, QA and release notes. |
| `handoff/` | Role status JSON and the current resume point. |

## Run, test, deploy

```bash
npm install
npm run keys          # first time or password change; prompts for the password without echo
npm run build         # encrypts ../osaka-trip-private/trip.json into docs/data/trip.enc.json
npm test              # unit tests
npm run test:e2e      # browser tests against fixture data (no real data or password)
npm run check:privacy # must pass before every commit (pre-commit hook runs it)
npm run serve         # http://localhost:8787/ then open the private link with that host
```

Deploy: commit the rebuilt `docs/` to `main`; GitHub Pages publishes `main:/docs` to the custom domain in `docs/CNAME`. See [`handbook/release.md`](handbook/release.md).

## Updating the trip

1. Edit `../osaka-trip-private/trip.json` (or ask an agent to, in this repo's project).
2. `npm run build && npm test && npm run check:privacy`.
3. Commit and push `docs/data/trip.enc.json` and `docs/sw.js` (the revision stamp). Open devices show a quiet "Trip updated" notice.

Never use em dashes in user-facing copy. Use Asia/Tokyo for all trip dates.
