# Sweet Match — Consumer-Product Roadmap

> Working roadmap to get Sweet Match from "polished demo" to "shippable PC-quality roguelike that also runs on mobile". Lives in-repo so it's tracked alongside the work it describes.

**Framing:** PC roguelike that ships everywhere — Steam, App Store, Play Store, web PWA — with the same depth and run length on every surface. Mobile is "play wherever," not a watered-down session-friendly cut.

**Companion documents:** the four review reports synthesized into this plan covered architecture, gameplay design, perf, and UX. Findings referenced inline as `[arch]`, `[design]`, `[perf]`, `[ux]`.

---

## Phase A — Launch blockers (P0)

Nothing ships to a wider audience until these land.

| # | Item | Why | Where |
|---|---|---|---|
| A1 | **Telemetry + crash tracking** stub | Flying blind on retention, funnel, crashes. `[arch][ux]` | new `src/telemetry.js` + boot wire-up |
| A2 | **Drop Tailwind CDN, add build step** | Tailwind play CDN is unsupported in production. +200KB transfer, +600ms TTI on slow 4G. `[arch][perf]` | new `package.json` / esbuild / `dist/main.css` |
| A3 | **Bulletproof mid-run save/resume** | PC-game framing → players close mid-run on purpose. Must resume cleanly from any state. `[design]` | `src/storage/save.js`, `state.busy`, slot-boundary checkpoint |
| A4 | **`try/finally` on `state.busy`** | One thrown error in a cascade currently bricks input forever. `[arch]` | every site that sets `state.busy = true` in `src/main.js` |
| A5 | **Save versioning + corruption telemetry** | Today: corrupt save = silent full progress wipe. `[arch]` | `src/storage/save.js` |
| A6 | **Header overflow on iPhone** | 🏠 button literally clipped off-screen on 390px viewport — the only in-game return-to-menu is unreachable. `[ux]` | `index.html` header |
| A7 | **Install-toast gate** | iOS install prompt currently fires over an active game. `[ux]` | `src/main.js` `showInstallToast` call |
| A8 | **iOS layout** (`100dvh` / `touch-action`) | `min-h-screen` overshoots when URL bar is up; board scroll competes with swipes. `[perf][ux]` | `index.html`, `styles/main.css` |
| A9 | **Audio unlock on first-tap** | First SFX silent on iOS if `unlockAudio()` isn't wired to a real gesture. `[perf]` | `src/audio/sfx.js` + `main.js` boot |
| A10 | **"What's New" rewire + Run HUD always visible** | The start-screen button currently opens the welcome modal; run HUD hidden at slot 1 hides the build the player is meant to plan around. `[ux]` | `src/main.js` openStartMenu, `refreshRunHud` |

---

## Phase B — Before paid acquisition (P1)

Polish + balance + scale. No dollar of UA should hit the game until these are done.

| # | Item | Why | Where |
|---|---|---|---|
| B1 | **Daily seed run** | Single highest-leverage retention feature in the genre. Trivial on top of existing streak code. `[design]` | `src/game/roguelike.js` choice helpers + new seeded RNG |
| B2 | **Wild archetype rebalance** | Stormbringer / Comet / Crazy Cat are non-viable. Players who pick them lose more and bounce. `[design]` | `src/game/roguelike.js` UPGRADES + ability scaling in `main.js` |
| B3 | **Wormhole crazy tile redesign** | Pop → nothing happens → player thinks game is broken. `[design]` | `src/main.js` `triggerCrazyEffect` (wormhole branch) |
| B4 | **Bosses get actual kits** | 5/10 bosses are reskinned regular slots. No telegraphed mechanics. `[design]` | `src/game/roguelike.js` BOSSES + new boss-mechanic hooks in `main.js` |
| B5 | **Scorer dominance** | Snowball compounds to ~×5.9 standalone; non-Scorer builds feel punished. `[design]` | `src/main.js` score multipliers + Snowball cap |
| B6 | **Refactor `main.js`** into modules + **hook bus** | 5,786 LoC. `processMatchRound` is 360 lines with 25 inline relic hooks. Each new relic compounds entropy. `[arch]` | extract to `run-effects.js`, `run-loop.js`, `powerups.js`, `match-pipeline.js`, `meters.js` + `onMatch / onCascade / onSlotStart / onSpecialBirth` bus |
| B7 | **Diff-render the DOM board** | Full-replace pattern destroys/rebuilds 720 tile DOM nodes in a chain-10 cascade. Canvas-renderer already shows the right pattern. `[perf]` | `src/ui/render.js` `renderBoard` |
| B8 | ~~Cascade pacing tightening~~ | **DROPPED** under PC-game framing. Current 220/340ms reads well for players who value cascade visualization. | n/a |
| B9 | **`purchases.js` scaffolding** | No IAPs yet — just plumbing so RevenueCat / native IAP is later a swap, not a rewrite. `[ux]` | new `src/purchases.js` with stub `grantGems / grantPowerup / unlockSkip` |
| B10 | **i18n primitives** | Every UI string is hardcoded EN. Wrap as `t('key')` against `strings.en.json` so LATAM/JP unblock for v1.x. `[ux]` | new `src/i18n.js` + `strings.en.json` |
| B11 | **PWA manifest prod fields** | Missing `screenshots`, `categories`, `id`, `shortcuts`, privacy policy URL, 1024×1024 marketing icon. `[ux]` | `manifest.json` + new assets |
| B12 | **Tests** (Vitest + Playwright) | Cascade determinism, save round-trip, busy invariant, slot transition with reload, match detection. `[arch]` | new `tests/` |
| B13 | **HC mode second pass** | Body dark but modal cards/toggles/level chip stay white — contrast hierarchy inverts. `[ux]` | `styles/main.css` HC tokens |
| B14 | **Renderer unification** | `Renderer` interface with `DomRenderer` + `PixiRenderer` implementations. Specials/crazies/jelly/locks/particles currently DOM-only even in canvas mode. `[arch][perf]` | `src/ui/canvas-renderer.js` + `src/ui/dom-renderer.js` |

---

## Phase C — PC-game-on-mobile specifics

These exist because of the user's framing: "treat this like a PC game that runs on mobile."

| # | Item | Why |
|---|---|---|
| C1 | **Keyboard input** | Arrow keys / space / enter / Esc / `1-3` for power-ups. Makes desktop browser feel native. |
| C2 | **Run statistics screen** | StS-style end-of-run breakdown: longest cascade, total matches, biggest single match, build composition, mutator history. PC roguelike players obsess over this. |
| C3 | **Mid-run pause menu** | Currently restart-only. Need Resume / Save & Quit / Settings / Quit-to-menu modal on Esc or 🏠. |
| C4 | **Native packaging research** | Tauri for desktop (~10MB, way smaller than Electron). Capacitor for App/Play Store. PWA stays as dev/browser. Spike, decide path. |
| C5 | **Cloud save infrastructure design** | If the game travels desktop ↔ mobile, the save has to too. Anonymous device id → backend JSON blob. Auth later. |

---

## Phase D — P2 polish

Long-tail items. Tackle after Phases A-C land.

| # | Item |
|---|---|
| D1 | Run-history journal (last 10 runs) |
| D2 | Class-mastery quests for cosmetics |
| D3 | Skill tree 4-5 "system unlock" nodes (vs. all numeric) |
| D4 | Onboarding tooltip tour on first slot |
| D5 | Service-worker: cache-first with revalidate, auto-generate SHELL from build |
| D6 | Replay system on top of seeded RNG |
| D7 | Particle cap on chain-≥5 cascades |
| D8 | Bundle Atkinson Hyperlegible locally |
| D9 | `apple-mobile-web-app-status-bar-style: black-translucent` |
| D10 | Run-summary "Rate us" / "Share with a friend" beat |
| D11 | Leaderboard MVP (daily seed makes this trivial) |
| D12 | Ascensions / difficulty modifiers (post-clear replay loop) |

---

## PR sequencing

| PR | Items | Size |
|---|---|---|
| 17a (this PR) | A6, A7, A8, A9, A10 + this plan | small |
| 17b | A4 (try/finally on `state.busy`) | small |
| 17c | A5 (save versioning + corruption telemetry) | small |
| 17d | A1 (telemetry scaffolding) | medium |
| 17e | A3 (bulletproof save/resume) | medium |
| 17f | A2 (Tailwind build step) — **needs design decision on bundler** | large |
| 18a | B3 (Wormhole redesign) + B5 (Scorer cap) | small |
| 18b | B2 (Wild archetype rebalance) | medium |
| 18c | B4 (Bosses get kits) | large |
| 18d | B1 (Daily seed) | medium |
| 19a | B6 (main.js refactor + hook bus) | large |
| 19b | B7 (DOM diff-render) | medium |
| 19c | B14 (Renderer unification) | large |
| 20a | B9, B10, B11 (purchases stub, i18n, manifest) | medium |
| 20b | B12 (tests) | medium |
| 20c | B13 (HC pass) | small |
| 21a | C1 (keyboard) + C3 (pause menu) | medium |
| 21b | C2 (stats screen) | small |
| 21c | C4 (native research) — **research PR, no code** | small |
| 22… | Phase D items in clusters | various |

PRs land sequentially; each is rebased onto whatever's in main when it lands so the diff stays clean. Mid-PR breaks are fine — pick up by reading this file and the PR titles.

---

## Decisions still open

Surfaced for explicit yes/no from product owner before the corresponding PR starts:

1. **Bundler for A2.** Default plan: esbuild (fastest, simplest, plays well with vanilla JS modules). Vite is the alternative if we want HMR for free. Either way: add a `npm run build` that emits `dist/`, switch index.html to load from `dist/`, and keep `src/` source-of-truth.
2. **Telemetry provider for A1.** Stub framework lands without a provider; product owner picks PostHog vs. Plausible vs. Mixpanel vs. a self-hosted endpoint when they're ready.
3. **Crash tracking provider.** Sentry self-host vs. cloud vs. roll-your-own.
4. **Native packaging for C4.** Tauri (Rust core, smaller) vs. Capacitor (Cordova-lineage, more plugins, web-first).
5. **Cloud save backend for C5.** Supabase / Firebase / custom JSON blob endpoint? Anonymous-by-default or required signup?

These don't block A6-A10 / B-phase / C1-C3, so the plan can run continuously until any of those decisions are needed.
