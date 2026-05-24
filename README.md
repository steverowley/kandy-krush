# Sweet Match

A match-3 puzzle game built for Grandma.

> **Naming note:** "Candy Crush" is a trademark of King.com. The match-3 *gameplay* isn't protected, but the name, art style, and character designs are. "Sweet Match" is a placeholder — Grandma picks the real name once she plays the prototype.

## Who it's for

The primary user is one person: Grandma. Every design decision answers to her.

| Her need | Our response |
|---|---|
| Terrible eyesight | Huge tiles, very high contrast, distinct shapes (not just colors) |
| Loves Candy Crush | Match-3 gameplay with cascades and special pieces |
| Hates waiting for tokens | No energy system, no lives, no waiting, ever |
| Older hands, possible tremor | Tap-to-select swap (no required dragging) |

## Accessibility-first design

This is the heart of the project. If only one thing is right, it's this.

**Visual**
- 6×6 grid (fewer, bigger tiles)
- Minimum tile size: 100px on phone, 140px+ on tablet
- High-contrast palette: bright yellow, deep blue, white, hot pink, black, orange — distinct in both hue *and* brightness
- Every candy has a **unique shape** as well as a color (works for color-blind eyes): circle, square, triangle, diamond, star, heart
- 2–3px black outlines on every tile
- UI text minimum 32px; score counter 60px+
- Font: [Atkinson Hyperlegible](https://fonts.google.com/specimen/Atkinson+Hyperlegible) — designed by the Braille Institute for low vision

**Interaction**
- Tap-to-select, then tap an adjacent tile to swap (drag optional, never required)
- Generous tap zones with padding around each tile
- No time limits, ever
- No "you lost" — only "you matched!"

**Audio**
- Cheerful sound effect on every match (clear volume control + mute)
- Optional spoken feedback ("Three in a row!", "Big match, Grandma!") via the browser's built-in speech synthesis

**Friction-free**
- No login, no account
- No ads, no purchases
- Auto-saves progress to her device
- Single "Play" button on the home screen

## Tech stack

Web-based, runs in any browser, free to host, installable on her tablet as a real-looking app.

| Layer | Choice | Why |
|---|---|---|
| Core | Vanilla HTML/CSS/JavaScript | Simple, no build step |
| Styling | Tailwind CSS (via CDN) | Fast styling without a CSS pipeline |
| Sound | [Howler.js](https://howlerjs.com/) | Reliable audio across devices |
| Storage | `localStorage` | No database needed |
| Hosting | Netlify or Vercel (free tier) | Drag-and-drop deploy |
| Install on tablet | PWA | Adds a home-screen icon |

Game engines like Phaser are intentionally skipped — overkill for match-3.

## Project structure (target)

```
sweet-match/
├── README.md
├── index.html            ← the page Grandma sees
├── manifest.json         ← PWA settings (icon, name)
├── service-worker.js     ← lets it work offline
├── src/
│   ├── main.js           ← starts the game
│   ├── game/
│   │   ├── board.js      ← grid data and swap logic
│   │   ├── match.js      ← detects 3+ in a row
│   │   ├── cascade.js    ← tiles fall down after a match
│   │   └── score.js      ← scoring rules
│   ├── ui/
│   │   ├── render.js     ← draws the board
│   │   ├── input.js      ← handles taps
│   │   └── settings.js   ← size, sound, contrast toggles
│   └── storage/
│       └── save.js       ← saves progress to the browser
├── styles/
│   └── main.css          ← any custom styles beyond Tailwind
└── assets/
    ├── icons/            ← SVG shapes for each candy
    └── sounds/           ← match sound, cascade sound, etc.
```

## Build phases

Built in order — each phase is playable on its own. **Don't skip ahead.**

### Phase 1 — Playable MVP
Grandma can match candies and watch the score go up.
- 6×6 grid of 6 distinct candy types (shape + color)
- Tap a tile → tap an adjacent tile → they swap
- Detect 3+ in a row (horizontal and vertical)
- Matched tiles disappear; tiles above fall; new tiles appear at the top
- Score counter, big and bold
- "Start over" button

### Phase 2 — Polish
- Sound effects on match and cascade
- Gentle animations (no jarring motion)
- Settings panel: tile size slider, sound on/off, high-contrast mode
- Local high score saved between sessions

### Phase 3 — Delight
- Special candies:
  - 4-in-a-row → "line clear" candy (clears its row when matched)
  - 5-in-a-row → "rainbow" candy (clears all of one color when tapped)
- Achievement pop-ups ("Wow, Grandma!", "Sweet match!", "You're on fire!")
- Optional spoken feedback (settings toggle)
- PWA install — adds an icon to her tablet's home screen
- Friendly daily streak counter (no penalty for missing days)

## Running locally

Once Phase 1 lands, open `index.html` in any browser, or serve the folder with any static server, e.g.:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no install, no toolchain.

## Playtest with Grandma

The most important step. Show her after Phase 1, *before* any polish — then again after each phase.

**Watch silently.** Don't help, don't explain. Notice:
- Where does she squint?
- Does she tap once or twice?
- What makes her smile?
- What makes her frown?

**Then ask:**
- "Can you tell the candies apart easily?"
- "Is anything hard to see?"
- "Is anything frustrating?"
- "What would make this more fun?"

Her feedback becomes the next prompt. That loop is the whole game.

## Deployment

Hosted on **GitHub Pages**, built from GitHub Actions. Every push to `main` runs `.github/workflows/deploy.yml`, which stages the site (`index.html`, `manifest.json`, `service-worker.js`, `src/`, `styles/`, `assets/`) into a `_site/` artifact and publishes it via `actions/deploy-pages`.

The live URL appears in the **Pages** tab of the repo and on the latest workflow run.

On Grandma's tablet:
1. Open the Pages URL in her browser.
2. Use the browser menu → "Add to Home Screen" (Android Chrome offers "Install app"). The manifest + service worker mean it then launches like a real app and works offline.

## Commit conventions

All commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

| Type | Example |
|---|---|
| `feat` | `feat: add 6x6 board with tap-to-swap` |
| `feat` (scoped) | `feat(a11y): add high-contrast mode toggle` |
| `fix` | `fix: prevent matches from chaining infinitely` |
| `style` | `style: bump tile size to 120px minimum` |
| `chore` | `chore: add PWA manifest` |
| `docs` | `docs: add playtest notes to README` |

## Status

Phases 1–3 are shipped and live on GitHub Pages:

- **Phase 1 — Playable MVP**: 6x6 board, six shape+color candies, tap-to-swap, match detection, gravity cascade, scoring, Start Over.
- **Phase 2 — Polish**: Web Audio sound effects, FLIP swap motion + pop/fall animations, score bump, Settings panel (Sound / High Contrast / Tile size), Best score persisted in `localStorage`.
- **Phase 3 — Delight**: striped candies (4-match) and rainbow candies (5-match) with activation effects, achievement pop-ups, optional spoken cheers, PWA install (manifest + service worker + icons), daily streak counter.

Next: playtest with Grandma and feed her reactions back as the next prompt — that loop is the whole game.
