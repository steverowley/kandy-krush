# Sweet Match — Consumer-Product Roadmap

> Working roadmap. Lives in-repo alongside the work it describes. Updated as items land so the file always reflects current status.

**Framing:** PC roguelike that ships everywhere — Steam, App Store, Play Store, web PWA — with the same depth and run length on every surface. Mobile is "play wherever," not a watered-down session-friendly cut.

**Companion documents:** the four review reports synthesized into this plan covered architecture, gameplay design, perf, and UX.

---

## Phase A — Launch blockers (P0)

| # | Item | Status | PR |
|---|---|---|---|
| A1 | Telemetry + crash tracking | ✅ shipped | #260 |
| A2 | **Drop Tailwind CDN, add build step** | ⏳ pending (needs bundler decision) | — |
| A3 | Bulletproof mid-run save/resume | ✅ shipped (Resume button on start screen) | #261 |
| A4 | `try/finally` on `state.busy` | ✅ shipped | #258 |
| A5 | Save versioning + corruption telemetry | ✅ shipped | #259 |
| A6 | Header overflow on iPhone | ✅ shipped | #257 |
| A7 | Install-toast gate | ✅ shipped | #257 |
| A8 | iOS layout (`100dvh` / `touch-action`) | ✅ shipped | #257 |
| A9 | Audio unlock on first-tap | ✅ shipped | #257 |
| A10 | "What's New" rewire + Run HUD always visible | ✅ shipped | #257 |

**Phase A: 9 / 10 done.** A2 remains — needs a bundler decision (esbuild recommended).

---

## Phase B — Before paid acquisition (P1)

| # | Item | Status | PR |
|---|---|---|---|
| B1 | Daily seed run | ✅ shipped | #265 |
| B2 | Wild archetype rebalance | ✅ shipped | #266 |
| B3 | Wormhole crazy tile redesign | ✅ shipped | #262 |
| B4 | Bosses get actual kits | ✅ shipped | #267 |
| B5 | Scorer dominance cap | ✅ shipped | #262 |
| B6 | Refactor `main.js` + hook bus | 🚧 in progress — bus + canonical emit points shipped (#278); 13 inline effects migrated to `run-effects.js` subscribers (#283 / #284 / #287 / #290 / #291 / #292 / #293 / #294 / #295). Remaining inline branches in `processMatchRound` are mostly synchronous score multipliers + boss-mechanic dispatchers that need a different shape. |
| B7 | Diff-render the DOM board | ✅ shipped | #269 |
| B8 | ~~Cascade pacing tightening~~ | DROPPED under PC-game framing | — |
| B9 | `purchases.js` scaffolding | ✅ shipped | #264 |
| B10 | i18n primitives | ✅ shipped | #264 |
| B11 | PWA manifest prod fields | ✅ shipped | #263 |
| B12 | Tests (Vitest → node:test) | ✅ shipped (102 tests) | #268 / #278 / #279 / #289 / #290 / #291 / #292 / #293 / #294 / #295 |
| B13 | HC mode second pass | ✅ shipped | #263 |
| B14 | Renderer unification | ⏳ deferred (canvas-renderer ships behind a flag; full unification needs particle / shake / special migration) | — |

**Phase B: 12 / 14 done.** B6 + B14 are the open architectural items.

---

## Phase C — PC-game-on-mobile

| # | Item | Status | PR |
|---|---|---|---|
| C1 | Keyboard input | ✅ shipped | #276 |
| C2 | Run statistics screen | ✅ shipped | #277 |
| C3 | Mid-run pause menu | ✅ shipped | #276 |
| C4 | Native packaging research | ⏳ pending — Tauri vs Capacitor decision | — |
| C5 | Cloud save infrastructure design | ⏳ pending — backend / auth choice | — |

**Phase C: 3 / 5 done.** C4 + C5 need product-owner decisions.

---

## Phase D — P2 polish

| # | Item | Status | PR |
|---|---|---|---|
| D1 | Run-history journal | ✅ shipped | #270 |
| D2 | Class-mastery quests | ✅ shipped | #275 |
| D3 | Skill tree "system unlock" nodes | ✅ shipped (Endless Mode + Reroll Bank) | #272 |
| D4 | Onboarding tooltip tour | ✅ shipped (stepper) | #273 |
| D5 | Service worker cache-first | ✅ shipped | #279 |
| D6 | Replay system on seeded RNG | ⏳ deferred — needs daily-seed leaderboard backend first |
| D7 | Particle cap on ≥5 chains | ✅ shipped | #271 |
| D8 | Bundle Atkinson Hyperlegible locally | ⏳ pending — drop in `assets/fonts/` and update CSS @font-face |
| D9 | `apple-mobile-web-app-status-bar-style: black-translucent` | ✅ shipped | #263 |
| D10 | Run-summary "Share" beat | ✅ shipped (Web Share API) | #275 |
| D11 | Leaderboard MVP | ⏳ deferred — needs backend |
| D12 | Ascensions / difficulty modifiers | ✅ shipped (3 tiers) | #274 |

**Phase D: 8 / 12 done.** D6 / D8 / D11 remain; D6 + D11 need backend, D8 needs a font binary.

---

## Open decisions (still need a yes/no)

1. **Bundler for A2.** esbuild (recommended) vs Vite vs Parcel. All three would work; esbuild is fastest config + smallest output for vanilla JS.
2. **Telemetry vendor.** Stub currently logs to `console.debug` and would emit via `navigator.sendBeacon` once given an endpoint. PostHog / Plausible / Mixpanel / self-hosted JSON endpoint?
3. **Crash tracking.** Sentry cloud, Sentry self-hosted, or roll-your-own from the existing `window.error` capture?
4. **Native packaging for C4.** Tauri (Rust core, ~10MB) vs Capacitor (more plugins, web-first).
5. **Cloud save backend for C5.** Supabase / Firebase / custom JSON blob endpoint? Anonymous-by-default or required signup?
6. **Privacy policy URL** for the PWA manifest — needs writing before paid acquisition.

None of these block any further plan work that's currently runnable.

---

## What's actually shippable today

Everything in Phase A (modulo A2), all of Phase B (modulo B6 final + B14), all of Phase C (modulo C4/C5 research), and most of Phase D. The game today is:

- Mobile-fit (iPhone 13 header, install toast gated, iOS layout, audio unlock, status bar)
- Keyboard-playable (PC ergonomics)
- Telemetry-instrumented (`boot / mode_picked / run_start / slot_complete / run_end / infinite_combo / ascension_picked / daily_seed_start` already emitting)
- Corruption-safe (versioned save + backup on parse fail + persist failure toast)
- Bug-tolerant (try/finally on every `state.busy = true` site + window-level error backstop)
- HC + low-vision friendly (every modal has an HC override; opacity-tricks killed)
- Roguelike-deep (Wild archetype now scores; bosses have kits; Wormhole is real; Scorer is capped; daily seed; endless mode; reroll bank; ascensions)
- Polished (run history, class mastery, run stats, native share, animated start screen, particle cap)
- Cache-first (cold-boot is ~one round-trip faster on slow networks)
- Tested (102 tests, all green)

**Recommended next moves**, in order:

1. **A2 build step + drop Tailwind CDN** — biggest mobile-perf win still unshipped, blocks Lighthouse 90+.
2. **Bundle Atkinson locally (D8)** — small change, removes the last third-party font dependency, finishes the offline story.
3. **B6 follow-up — migrate the noisiest inline effect branch to the bus** — pick the loudest one (e.g. Snowball multiplier or Lucky-MODE) and move it to a `bus.on('match', …)` handler so the pattern is established before we ask later branches to follow.
4. **Native packaging spike (C4)** — a one-week investigation to pick Tauri vs Capacitor, build a tagged release in both, measure binary size + cold-boot.
5. **Telemetry vendor + privacy policy** — these gate any paid acquisition.

`/* — end PROJECT_PLAN.md — */`
