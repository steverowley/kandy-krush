# Sweet Match — tests

Tests use Node's built-in `node:test` runner (no extra dependencies) so
the suite runs against the same source the browser does, with no build
step and no `npm install`.

## Run all

```sh
./tests/run.sh
```

(equivalent to `node --test tests/*.test.js` — see `tests/run.sh`.)

## Run one file

```sh
node --test tests/score.test.js
```

## Adding tests

- ES modules only — match the codebase. Tests import directly from `../src/`.
- Pure-game modules are easiest to test (`src/game/*.js`).
- DOM-dependent modules (`src/ui/*.js`, anything that touches `window` /
  `document` / `localStorage`) need polyfills. See `tests/save.test.js`
  for a minimal in-memory `localStorage` shim.
- Keep each `test()` focused — one assertion or one tight cluster. The
  output is more useful when a single failure points at a single test.

## Current coverage

| File | What it covers |
|---|---|
| `score.test.js` | `calcScore` — base score, length bonus, cascade multiplier, empty match |
| `match.test.js` | `findMatches` — 3-in-row detection, no-match boards, 5-in-row grouping |
| `rng.test.js` | mulberry32 determinism, daily-seed stability across UTC days, rng utility helpers |
| `i18n.test.js` | `t()` lookup, key-fallback, `{token}` interpolation, `formatNumber` digit grouping |
| `purchases.test.js` | unconfigured fallback, grant-handler forwarding, provider swap |
| `save.test.js` | round-trip persist, corrupt-save backup, sanitizer rejections |
| `event-bus.test.js` | on / off / emit, handler isolation, payload integrity |
| `sw-shell.test.js` | every SHELL entry resolves to a real file, no duplicates |

Run them before every PR that touches pure-game modules or the save layer.
