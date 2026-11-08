# QA

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | Encryption round trip needs both link secret and password; tampering and wrong keys fail; Tokyo dates; now/next; food rules; halal ranking. |
| Browser | `npm run test:e2e` | Synthetic fixture only. WebKit at iPhone portrait and landscape, iPad Mini, iPad Pro landscape, Split View width; Chromium iPhone. Lock states, every destination, sheets and Back, filters, search, taxi card, local checklist, no horizontal scroll, 44px targets, referrer policy, noindex and robots, offline (Chromium). |
| Real data | `node scripts/smoke-real.mjs` | Every view renders with the real encrypted payload, headless; prints counts only. |
| Privacy | `npm run check:privacy` | No private string, key or link in any repo file (pre-commit runs the staged variant). |
| Owner device checklist | manual | Safari on iPhone and iPad: Dynamic Type follows the system text size, VoiceOver reads chips and day changes, Add to Home Screen first launch (paste link once), offline relaunch, Lock now, Trip updated. |

Playwright cannot run the real iOS Safari, Home Screen mode or VoiceOver, and its WebKit service-worker support is limited, so those items stay on the owner checklist until observed on a device.
