# Release and hosting

## Hosting

- GitHub Pages, repository `ali-beydoun/osaka-trip` (public: free Pages needs a public repo; it holds only app code and ciphertext).
- Source: branch `main`, folder `/docs`. Custom domain from `docs/CNAME`: `osaka.alibeydoun.info`.
- DNS (GoDaddy, nameservers `ns41/ns42.domaincontrol.com`): one record, `CNAME osaka -> ali-beydoun.github.io.` Nothing else in the zone changes. After GitHub issues the certificate, turn on Enforce HTTPS.
- The personal site (`ali-beydoun/alibeydoun_au`) and DJ Wasabi site are separate repositories and are not touched.

## Publishing a change

```bash
npm run prepare-data   # only when the private source inputs changed
npm run build          # copies design tokens, encrypts the trip, stamps the service worker revision
npm test && npm run test:e2e
node scripts/smoke-real.mjs   # real data, headless, prints counts only
npm run check:privacy
git add -A && git commit && git push
```

Pages republishes within a minute or two. Open devices show "Trip updated" with a Reload button.

## Verifying a deployment

- `curl -sI https://osaka.alibeydoun.info/` returns 200 over HTTPS.
- `curl -s https://osaka.alibeydoun.info/ | grep noindex` finds the robots meta tag; `robots.txt` contains `Allow: /` and no `Disallow`.
- `curl -s https://osaka.alibeydoun.info/data/trip.enc.json` is ciphertext only.
- Opening the bare address shows the "private trip link" screen; the private link plus password opens the trip.

## Rotating access

- New password, same link: `npm run keys -- --keep-link`, then build and push.
- New link (old one leaked): `npm run keys`, then build and push. Share the new link from `../osaka-trip-private/access-link.local.txt` privately. Devices with "Keep unlocked" need the new link once.
