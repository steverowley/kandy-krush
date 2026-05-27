# Arcana Cascada

A fortune-telling match-three in four suits. Cards fall, fortunes settle, the querent reads what remains.

Modern poster-art tarot: vivid jewel-tone color blocks, bold flat figures, multilingual headline stack (English + Spanish), cursive flourish overlays, on a near-black page.

## Modes

| | Mode | What it is |
|---|---|---|
| I | **Free Reading** | Endless practice. No budget, no objective. The cloth, unlimited. |
| II | **The Spread** | Twelve Major-Arcana chapters (I–XII) with score / suit-clear objectives, fixed move budgets, and up to three stars per chapter. Progress persists; chapters unlock as you earn stars. |
| III | **Daily Draw** | One fixed seed every UTC day. Same deck worldwide. Mid-day save so you can pause and resume across devices. |
| IV | **The Querent's Path** | Roguelike. Pick a class, walk thirteen chambers (Major Arcana IX–XXI) in order. Boss chambers punctuate the walk; The World is the final read. Permanent loss on failure; class unlocks across runs. The Spread and the Path share the same Major Arcana — same cards, different reading. |

## Stack

- **Vite 6** — build + dev server, zero-config TypeScript
- **Preact 10** — ~10kb React-compatible component shell
- **wouter-preact** — hash-based router with browser back-button
- **Zustand 5** — small persisted global state
- **Vitest 3** + **happy-dom** + **@testing-library/preact** — unit + component tests
- **vite-plugin-pwa** — service worker + manifest at build time

Total framework runtime: **~12kb gzipped.**

## Commands

```sh
npm install
npm run dev        # local dev server at http://localhost:5173
npm test           # one-shot test run
npm run typecheck  # tsc -b --noEmit
npm run build      # production build to dist/
npm run preview    # serve dist/ locally
```

## Architecture

Screen-routed: every screen lives in `src/screens/*.tsx` and registers a route in `src/router.ts`. Navigation goes through `wouter-preact`'s `useLocation` hook, so the browser back-button works.

```
/                 Splash      — first impression card
/home             Home        — Reading Room, four mode cards
/spread           Spread      — eight chapter cards with star progression
/querent          Querent     — class-select / chamber-walk lobby
/play             Play        — the board (mode chosen via ?mode=...)
/how-to-play      HowToPlay   — four-step tutorial walkthrough
/codex            Codex       — aggregate progress across every mode
/settings         Settings    — sound, haptics, motion, telemetry
/about            About       — colophon
*                 NotFound    — "The Fool" card
```

### Engine

`src/game/engine/` is the headless match-three engine. Pure TypeScript, no Preact dependency, deterministic when seeded.

- `rng.ts` — mulberry32 PRNG with state capture / restore so runs survive reloads
- `types.ts` — `Suit`, `Tile { id, suit, kind? }`, `Board`, `MatchGroup`, `ResolveResult`. Tiles can be normal, `"spark"`, or `"wild"`.
- `board.ts` — generation + helpers
- `match.ts` — `findMatches` (3+ in rows/cols, wilds count as any suit), `swapMakesMatch`
- `cascade.ts` — `resolveCascades` clears, expands via spark blasts, promotes match-4 into sparks and match-5+ into wilds, collapses, refills, chains
- `engine.ts` — `newGame`, `tryMove`, `isDeadlocked` orchestrators

**Special tiles**

- **Spark** — a match-4 plants a spark at the middle of the run. When the spark is later cleared as part of any match, it sweeps its row + column.
- **Wild** — a match-5+ plants a wild at the middle of the run. A wild matches any suit (a run with at least one non-wild defines the suit). No special clear effect.

### Visual system

Tokens in `src/styles/tokens.css`:

- **Page** — near-black with a soft violet+coral radial wash
- **Cards** — bone cream cardstock (`#F5EFDC`) with ink border, 2-card stack shadow
- **Panels** — eight saturated poster tones (amethyst, coral, saffron, gold, emerald, teal, cobalt, pink)
- **Ink** — warm near-black (`#15131F`) for figures + line work
- **Type** — Playfair Display (heavy display serif), Inter (bold sans labels), Caveat (cursive flourish) — three voices

Reusable primitives in `src/styles/primitives.css`: `.screen`, `.card`, `.tile-card`, `.eyebrow`, `.numeral`, `.script`, `.rule`, `.btn`, `.stack`, `.cluster`.

The `TarotCard` component in `src/components/TarotCard.tsx` is the centerpiece: cardstock frame, corner tick + numeral, colored inner panel with cursive flourish behind a figure, bold uppercase name + italic Spanish caption, then a heavy serif headline with cursive echo and a tiny multilingual subtitle underneath.

### State stores (Zustand + persist)

| Store | Lives at | What it tracks |
|---|---|---|
| `useGame` | `src/state/game.ts` | Active board, rng, score, moves, cleared counts, selection. Snapshot / restore for cross-mode resume. |
| `useSettings` | `src/state/settings.ts` | Sound, haptics, reduced motion, telemetry toggles. |
| `useSpread` | `src/state/spread.ts` | Stars per chapter. Forward-only unlocks. |
| `useDaily` | `src/state/daily.ts` | Per-day snapshot + outcome history. |
| `useQuerent` | `src/state/querent.ts` | Active run + persistent meta (runsCompleted, bestDepth, insight, unlocked classes). |
| `useResume` | `src/state/resume.ts` | Mid-run snapshots for Spread chapters and Querent chambers. |
| `useTutorial` | `src/state/tutorial.ts` | Has the player seen the How-to-Play yet. |

### Audio + haptics

`src/audio/synth.ts` synthesizes the entire sound vocabulary at runtime — no audio files. Web Audio is unlocked on the first user gesture (iOS Safari requirement). Suits map to a pentatonic so cascades stay consonant.

`src/audio/haptics.ts` wraps the Vibration API with feature detection.

`src/subscribers/audio.ts` mirrors `useGame` + `useSettings` deltas into the sound + haptic layer.

### Telemetry

`src/telemetry/bus.ts` is a local-only event ring (200-entry cap, localStorage-backed). No network, no IDs, no third-party. `src/subscribers/telemetry.ts` mirrors store deltas into the bus. Settings has a viewer + clear button so the player can audit and wipe at any time.

## Accessibility

- Skip-link at the top of every page
- Full keyboard navigation on the board (arrow keys, Enter, Escape) with a roving tabindex
- `aria-live` on the Play screen ledger so score / readings updates are spoken
- Outcome modal focuses its primary action and closes on Escape
- Reduced-motion respected via both OS preference and a Settings toggle
- Pointer events for drag-to-swap on touch + mouse + pen

## Tests

`npm test` runs Vitest. The engine, every Zustand store, the telemetry bus, haptics, and the router all have unit tests. ~90 tests, all pure, no flake.

## Deploy

`.github/workflows/deploy.yml` runs `typecheck` → `test` → `build` on every push to main and publishes `dist/` to GitHub Pages.

`.github/workflows/ci.yml` runs the same gates on every PR.
