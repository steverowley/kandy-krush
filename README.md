# Arcana Cascada

A fortune-telling match-three in three suits, set in editorial bone, parchment, oxblood, and gold.

## Stack

- **Vite** — build + dev server, zero-config TypeScript
- **Preact** — ~10kb React-compatible component shell
- **wouter-preact** — hash-based router with browser back-button support
- **Zustand** — small global state with `persist` middleware
- **Vitest** + **happy-dom** + **@testing-library/preact** — unit + component tests
- **vite-plugin-pwa** — generates the service worker and manifest at build time

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

The app is **screen-routed**. Every screen lives in `src/screens/*.tsx` and registers a route in `src/router.ts`. Navigation goes through `wouter-preact`'s `useLocation` hook, so the browser back-button works out of the box.

```
/         Splash    — first impression, branding, "Begin the Reading"
/home     Home      — the Reading Room, mode selection
/modes    Modes     — index of spreads
/play     Play      — the game board (game logic ports in a later PR)
/settings Settings  — sound, haptics, motion
/about    About     — colophon
*         NotFound  — "The Fool's Page"
```

Cross-screen state (settings, save data, run state) lives in `src/state/*.ts` as Zustand stores with `persist` so reloads survive.

## Visual system

Tokens in `src/styles/tokens.css`:

- **Bone / parchment** — paper grounds (`--bone-50`, `--bone-100`, `--bone-200`)
- **Ink** — body and headers (`--ink-900`, `--ink-700`, `--ink-500`)
- **Oxblood** — accents and primary actions (`--oxblood-500/600/700`)
- **Gold leaf** — hairlines, rules, ornament (`--gold-400/500/600`)

Type pairing: **Playfair Display** for display headers, **Cinzel** (small caps) for engraved labels, **Inter** for body. Minimal ornament — single hairline rules and double rules carry the editorial rhythm.

Primitives in `src/styles/primitives.css`: `.screen`, `.leaf`, `.eyebrow`, `.numeral`, `.rule`, `.btn`, `.stack`, `.cluster`.

## Roadmap (open)

This PR lands the foundation. Subsequent PRs:

1. ~~Foundation~~ — _this PR_
2. Match-three engine + board renderer ported as a TypeScript module
3. Free Reading mode (endless / practice)
4. The Spread (levels with objectives)
5. Daily Draw (fixed seed, save/restore)
6. The Querent's Path (roguelike runs, classes, bosses)
7. Audio + haptics
8. Telemetry + accessibility audit
