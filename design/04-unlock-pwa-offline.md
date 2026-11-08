# Unlock, install, offline and update

Owner: Fable - Osaka Apple design. v1, 8 Nov 2026. Mechanism facts come from the delivery lead: the payload is an AES-GCM envelope; the key is derived in the browser from the password plus a link secret carried in the URL fragment; deriving takes roughly 0.3 to 1.5 seconds on an iPhone; a wrong password and a wrong link are indistinguishable; a remembered key can be stored on the device; the service worker caches the shell and the ciphertext; a new payload arrives as a new version. The design never needs or shows the password or the secret.

## 1. Locked screen

One screen, four states, same layout: a centred pane at most 420 px wide, a 72 px rounded mark, a Title 2 heading, a Subheadline explanation in secondary colour, then the controls, then a Footnote line that says what happens to the data. The content layer is the grouped background; no material, no imagery, no marketing. It must look as calm in dark as in light.

| State | When | Heading | Explanation | Controls | Footnote |
| --- | --- | --- | --- | --- | --- |
| Enter password | Fragment carries a secret, no remembered key | Osaka Trip | Enter the password to open the plan. | Password field, Keep unlocked switch (default on), Unlock primary button | Both the private link and the password are needed. Nothing is sent to a server. |
| Unlocking | After submit | unchanged | unchanged | Button label changes to Unlocking, a progress fill advances inside the button over about one second and completes on success; the field and switch are disabled | unchanged |
| Could not unlock | Derivation produced no valid payload | unchanged | unchanged | Error line under the field: "That password didn't work. Check it and try again." Field is cleared and refocused. The button is re-enabled after a short delay (about 600 ms) so repeated guesses are slowed without a counter | unchanged |
| Missing link | No secret in the fragment, no remembered key | Open this from your private trip link | This address on its own cannot unlock the trip. Open the full link you were sent, or paste it here once. | Trip link field (URL keyboard), Continue primary button. Pasting a full URL extracts the secret client side and moves to Enter password without reloading | The link is kept on this device only and is never sent anywhere. |
| Offline before first load | No network and nothing cached | You're offline | The trip has not been loaded on this device yet, so it needs a connection once. After that it works offline. | Try again primary button | none |

Rules:

- The password field is `type="password"`, `autocomplete="current-password"`, with `autocapitalize`, `autocorrect` and `spellcheck` off, a trailing show or hide button (eye glyph, `aria-pressed`), and it is the first focused element. Return submits. iOS password managers may offer to fill; nothing in the markup prevents that.
- The error line is a `role="status"` live region so VoiceOver reads the failure without moving focus.
- The Keep unlocked label names the device class ("this iPhone" or "this iPad") when the user agent is clear, otherwise "this device".
- No lockout, no attempt counter, no captcha, no hints about the password's form.
- The unlock button is the only primary button on the screen. The progress fill is the only motion and it never loops.
- Pre-trip, on-trip and post-trip make no difference to the locked screen.

## 2. After unlock

- The locked screen fades out over `--dur-base` and Today appears, scrolled to the top. Focus moves to the Today heading.
- If Keep unlocked was on, nothing else happens now or on later launches: the app opens straight to the last tab.
- Once per browser profile, in a Safari tab (not standalone), Today shows the Add to Home Screen hint as a dismissible banner under the navigation bar: "Add to Home Screen for full screen and offline use. Share, then Add to Home Screen." Dismiss is remembered. The same instructions live permanently in Info > App.

## 3. Lock

Info > App has Lock now as a tinted text row. Tapping it forgets the remembered key, clears any decrypted data from memory, and shows the Enter password state. There is no confirmation dialog because the cost of a mistake is typing the password again. Keep unlocked is a switch in the same group and on the locked screen; the two are the same setting.

## 4. Home Screen app

- Manifest: name Osaka Trip, short name Osaka, `display: standalone`, scope `/`, no `start_url` so iOS saves the exact address the app is added from, including the private link fragment and the current view; light and dark theme colours, icons from `prototype/icon.svg` rendered at 192, 512 and 512 maskable, plus the 180 px `apple-touch-icon`.
- Status bar style black-translucent; the app pads the navigation bar by the top safe-area inset and the tab bar by the bottom inset so nothing sits under the status bar or home indicator.
- Add from the unlocked Today view in Safari so the saved address carries the private link. The Home Screen app has its own storage, separate from Safari, so its first launch asks for the password once; Keep unlocked then holds it on that device. If the saved address ever lacks the fragment, the Missing link state applies, worded for standalone mode: heading unchanged, explanation adds "The Home Screen app needs the private link once." The paste field accepts the whole URL.
- Standalone mode has no browser back control, so every pushed view has a visible Back control and every sheet has a Close button; the system edge swipe also pops.
- External links in standalone mode open Safari. Rows that leave the app show the outward arrow glyph, not a chevron, so the hand-off is expected.

## 5. Offline

- After one successful load the shell and ciphertext are cached. Every view, the taxi card and the maps buttons (which only build URLs) work offline; unlocking works offline when the ciphertext is cached.
- While offline the navigation bar shows an Offline pill at the trailing edge (glyph plus the word), secondary colour, no red. It disappears when the connection returns.
- Tapping an external link while offline opens the maps app or Safari as usual; the app does not intercept it or warn, because the maps app may have its own cache.
- Nothing in the UI depends on network timing: there are no spinners for content, because content is local once unlocked.

## 6. Update

- When the service worker finds a new payload or shell version, Today (or whichever tab is open) shows a Trip updated banner under the navigation bar: glyph, "Trip updated. Reload to see the latest plan.", and a Reload text button. It is a `role="status"` region, it does not block, and it stays until Reload or Dismiss.
- Reload applies the new version and returns to the same route. The remembered key keeps working if the password and link did not change; if they did, the Enter password or Missing link state appears with its usual wording. No special "your link has changed" message exists because the app cannot know which part changed.
- Info > App shows the data version, the research date and the halal check date so the owner can confirm what is loaded.

## 7. Reviewer simulation

For QA only, an `asof` fragment parameter sets trip time (`asof=2030-05-09T10:30` on the fixture, or the words `pre` and `post`). While active, a yellow Viewing as banner shows the simulated time with a Stop action. The banner uses the warning hue because the screen is not real time. The parameter is never written to storage.

## 8. Privacy copy in the UI

Info > App > About says, in full: "Private, unlisted and encrypted. Opening the trip needs both the private link and the password. Nothing is tracked." It does not claim that search engines cannot find the address, and it does not explain the cryptography; the handbook does that.
