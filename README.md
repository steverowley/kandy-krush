# Kandy Krush — rebuild (working title)

Fresh foundations for the next version of the game. The previous game
(**Arcana Cascada**, v1) has been cleared from the working tree but is fully
recoverable — see [Where v1 went](#where-v1-went).

## Status

- [x] Best-practice scaffold: app skeleton, tests, lint, format, CI
- [ ] Design brief — fill in [`docs/DESIGN_BRIEF.md`](docs/DESIGN_BRIEF.md)
- [ ] Name the game (then rename `package.json` and this README)
- [ ] Build the game

## Commands

```sh
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:5173
npm test           # one-shot test run
npm run test:watch # tests in watch mode
npm run lint       # ESLint
npm run format     # Prettier, write mode
npm run typecheck  # tsc -b --noEmit
npm run build      # production build to dist/
npm run preview    # serve dist/ locally
```

## Stack

- **Vite** — build + dev server
- **Preact** — ~10kb React-compatible UI library
- **TypeScript (strict)** — full strict mode, no unused locals/parameters
- **Vitest** + **happy-dom** + **@testing-library/preact** — test runner with one placeholder test to build on
- **ESLint (flat config)** + **Prettier** — linting and formatting, enforced in CI

## Continuous integration

`.github/workflows/ci.yml` runs lint → format check → typecheck → test → build
on every pull request.

`.github/workflows/deploy.yml` deploys to GitHub Pages **manually only**
(Actions tab → Deploy to GitHub Pages → Run workflow). It is deliberately not
triggered by pushes to `main`, so the live v1 game stays up until the new game
is ready to replace it.

## Where v1 went

Nothing was destroyed. The full v1 app — engine, 5 game modes, 382 tests —
lives in git history. The last v1 commit is `5ecda1a`.

- Browse it on GitHub: `https://github.com/steverowley/kandy-krush/tree/5ecda1a`
- Recover any file or folder into the working tree:

  ```sh
  git checkout 5ecda1a -- src/game/engine   # example: the match-3 engine
  ```

- The live GitHub Pages site keeps serving v1 until someone runs the manual
  deploy workflow.

## Notes

- **License:** no LICENSE file means "all rights reserved" — the right default
  for a private project. Decide consciously before making the repo public.
- **Environment variables:** none required.
