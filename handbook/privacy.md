# Privacy and access design

## Goal

An unlisted, password-protected trip app on free static hosting (GitHub Pages), with a public source repository that never contains the trip in readable form.

## How it works

1. `../osaka-trip-private/trip.json` (plaintext, outside the repo) is gzipped and sealed with AES-256-GCM into `docs/data/trip.enc.json`. The public header (version, salt, iteration count, revision) is bound as authenticated data, so it cannot be altered without detection.
2. The data key is `HKDF-SHA256(linkSecret || PBKDF2-SHA256(password, salt, 600,000 iterations))`.
   - `linkSecret` is 32 random bytes in the private link fragment: `https://osaka.alibeydoun.info/#k=...`. Browsers never send the fragment to the server, so it is absent from GitHub's logs and from `Referer` headers.
   - The password is typed on the unlock screen.
3. All cryptography is the browser's built-in WebCrypto (`crypto.subtle`). No custom cryptography.
4. "Keep unlocked on this device" stores the derived key in IndexedDB as a **non-extractable** `CryptoKey`: page script can decrypt with it but cannot read or export its bytes. "Lock" deletes it. Decrypted trip data is held in memory only, never in storage or the service-worker cache.

## What this protects against, honestly

| Threat | Result |
| --- | --- |
| Someone reads the public repo or site files | Sees app code and ciphertext only. Without the link secret the key space is 2^256, so password guessing is useless. |
| Someone has the full private link but not the password | Must guess the password. Each guess costs 600,000 PBKDF2 iterations, but **a short dictionary-word password can still be guessed offline** by a determined attacker who has the link. The link secret is the main protection; the password is a second gate against casual forwarding or someone seeing the link. A longer passphrase would make the second gate strong. |
| Search engines | Every page has `<meta name="robots" content="noindex, nofollow, noarchive">`. `robots.txt` allows crawling so crawlers can read that tag. Noindex is a request that reputable engines honour; it is not access control. |
| Referrer leakage to external sites (Maps, sources) | `<meta name="referrer" content="no-referrer">` plus `rel="noreferrer"` on external links. The fragment is never sent anyway. |
| Shared device | Use Lock in Info to forget the key. Unremembered sessions need the password on each launch. |
| Lost link | Run `npm run keys` to rotate (new link), then rebuild and redeploy. Old ciphertext in git history stays sealed with the old link secret. |

## Rules

- Never commit, print, paste or screenshot: the password, `keys.local.json`, `access-link.local.txt`, or anything in `../osaka-trip-private/`.
- `npm run check:privacy` scans every repo file against all private strings and key material, without printing them. The pre-commit hook runs it.
- Booking references stay inside the encrypted payload only (owner decision); private Claude links and denylisted strings are stripped (`denylist.local.txt`).
- Government IDs, passports and booking PDFs are never imported.

## Home Screen (PWA) notes

- The manifest has no `start_url`, so Add to Home Screen keeps the current address, including the private link fragment.
- iOS Home Screen apps can keep storage separate from Safari. The first Home Screen launch may need the password again; if the fragment was not kept, the unlock screen accepts a pasted private link.
- Offline: after one successful online load, the shell and the encrypted file are cached; unlock and every view work offline.
