import { useLocation } from "wouter-preact";
import type { ComponentChildren } from "preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";
import { useTutorial } from "../state/tutorial";
import "./Home.css";

type Mode = {
  numeral: string;
  panelName: string;
  panelCaption: string;
  headline: string;
  script: string;
  subtitle: string;
  cta: string;
  to: string;
  status?: string;
  panelColor: string;
  figure: ComponentChildren;
};

const modes: Mode[] = [
  {
    numeral: "I",
    panelName: "Free Reading",
    panelCaption: "sin límite",
    headline: "The Cloth",
    script: "loose",
    subtitle: "el paño · practice the suits",
    cta: "Open the cloth",
    to: `${routes.play}?mode=free`,
    status: "Playable",
    panelColor: "var(--panel-coral)",
    figure: <CardFigureCloth />,
  },
  {
    numeral: "II",
    panelName: "The Spread",
    panelCaption: "ocho lecturas",
    headline: "The Book",
    script: "spread",
    subtitle: "el libro · eight chapters of escalating omens",
    cta: "Open the book",
    to: routes.spread,
    status: "Playable",
    panelColor: "var(--panel-amethyst)",
    figure: <CardFigureBook />,
  },
  {
    numeral: "III",
    panelName: "Daily Draw",
    panelCaption: "una lectura · cada día",
    headline: "Today",
    script: "today",
    subtitle: "la jornada · same seed worldwide",
    cta: "Draw today",
    to: `${routes.play}?mode=daily`,
    status: "Playable",
    panelColor: "var(--panel-gold)",
    figure: <CardFigureSun />,
  },
  {
    numeral: "IV",
    panelName: "The Querent's Path",
    panelCaption: "nueve cámaras",
    headline: "The Path",
    script: "walk",
    subtitle: "el camino · roguelike journey",
    cta: "Walk the path",
    to: routes.querent,
    status: "Playable",
    panelColor: "var(--panel-teal)",
    figure: <CardFigureMoon />,
  },
];

export function Home() {
  const [, navigate] = useLocation();
  const tutorialSeen = useTutorial((s) => s.seen);

  return (
    <main class="screen home">
      <header class="home__masthead">
        <p class="eyebrow home__eyebrow">The Reading Room</p>
        <h1 class="home__title">
          Arcana <em>Cascada</em>
        </h1>
        <p class="home__subtitle script">choose your spread</p>
      </header>

      {!tutorialSeen ? (
        <aside class="home__nudge" role="note">
          <p class="eyebrow">First reading?</p>
          <p class="home__nudge-body script">
            new to the cloth — read the four steps first
          </p>
          <button
            type="button"
            class="btn btn--primary home__nudge-cta"
            onClick={() => navigate(routes.howto)}
          >
            How to play
          </button>
        </aside>
      ) : null}

      <section class="home__deck" aria-label="Modes">
        {modes.map((mode) => (
          <TarotCard
            key={mode.headline}
            numeral={mode.numeral}
            panelName={mode.panelName}
            panelCaption={mode.panelCaption}
            headline={mode.headline}
            script={mode.script}
            subtitle={mode.subtitle}
            panelColor={mode.panelColor}
            figure={mode.figure}
            footer={
              <button
                type="button"
                class="btn btn--on-card btn--primary home__cta"
                onClick={() => navigate(mode.to)}
              >
                {mode.cta}
              </button>
            }
          />
        ))}
      </section>

      <footer class="home__foot">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.howto)}
        >
          How to play
        </button>
        <span aria-hidden="true" class="home__foot-sep">·</span>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.codex)}
        >
          Codex
        </button>
        <span aria-hidden="true" class="home__foot-sep">·</span>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.settings)}
        >
          Settings
        </button>
        <span aria-hidden="true" class="home__foot-sep">·</span>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.about)}
        >
          About
        </button>
      </footer>
    </main>
  );
}

// ── Mode figures ─────────────────────────────────────────────────────
// Each one is a bold flat silhouette appropriate to its panel concept.
// Drawn in currentColor — the card's --ink token tints them.

function CardFigureCloth() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Hand of fortune-teller above three splayed cards */}
      <path
        d="M22 38c-2 6 0 12 4 14l8 6 10 4 12 2 14-2 10-4 8-6c4-2 6-8 4-14-6 4-12 6-18 6h-34c-6 0-12-2-18-6z"
      />
      {/* Wrist */}
      <rect x="46" y="14" width="28" height="22" />
      {/* Cards splayed */}
      <rect
        x="22"
        y="62"
        width="22"
        height="58"
        rx="3"
        transform="rotate(-14 33 92)"
      />
      <rect
        x="50"
        y="60"
        width="22"
        height="62"
        rx="3"
        transform="rotate(2 61 92)"
      />
      <rect
        x="76"
        y="62"
        width="22"
        height="58"
        rx="3"
        transform="rotate(14 87 92)"
      />
      {/* Suit markers on the middle card */}
      <circle cx="61" cy="92" r="5" fill="var(--card-panel, transparent)" />
      {/* Eye above wrist (cuff ornament) */}
      <ellipse cx="60" cy="22" rx="7" ry="4" fill="var(--card-panel, transparent)" />
      <circle cx="60" cy="22" r="1.6" />
    </svg>
  );
}

function CardFigureBook() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Aureole behind the book */}
      <circle cx="60" cy="74" r="48" fill="var(--card-panel, transparent)" />
      <circle cx="60" cy="74" r="42" />
      <circle cx="60" cy="74" r="36" fill="var(--card-panel, transparent)" />
      {/* Open book / codex */}
      <path d="M14 50c14-6 32-6 46 4v66c-14-10-32-10-46-4z" />
      <path d="M106 50c-14-6-32-6-46 4v66c14-10 32-10 46-4z" />
      <rect x="58" y="54" width="4" height="62" rx="1" />
      {/* Quill across the spine */}
      <path
        d="M40 30l34 34"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path d="M36 26l8 8-2 4-10-10z" />
      {/* Page lines */}
      {[0, 1, 2].map((i) => (
        <rect
          key={`l${i}`}
          x="22"
          y={70 + i * 12}
          width="30"
          height="2.5"
          fill="var(--card-panel, transparent)"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <rect
          key={`r${i}`}
          x="66"
          y={70 + i * 12}
          width="30"
          height="2.5"
          fill="var(--card-panel, transparent)"
        />
      ))}
    </svg>
  );
}

function CardFigureSun() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Outer wavy rays — alternating short / long like a sun-poster motif */}
      <g>
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * 22.5 * Math.PI) / 180;
          const inner = 38;
          const outer = i % 2 === 0 ? 60 : 50;
          const x1 = 60 + Math.cos(a) * inner;
          const y1 = 68 + Math.sin(a) * inner;
          const x2 = 60 + Math.cos(a) * outer;
          const y2 = 68 + Math.sin(a) * outer;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              stroke-width={i % 2 === 0 ? 5 : 3}
              stroke-linecap="round"
            />
          );
        })}
      </g>
      {/* Sun disc */}
      <circle cx="60" cy="68" r="32" />
      {/* Eye in the middle */}
      <ellipse cx="60" cy="68" rx="18" ry="10" fill="var(--card-panel, transparent)" />
      <circle cx="60" cy="68" r="6" />
      <circle cx="60" cy="68" r="2.4" fill="var(--card-panel, transparent)" />
      {/* Smiling sun mouth */}
      <path
        d="M50 80c4 4 16 4 20 0"
        stroke="var(--card-panel, transparent)"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}

function CardFigureMoon() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Crescent moon */}
      <path d="M86 56a32 32 0 1 1-42-30 24 24 0 0 0 42 30z" />
      {/* Moon's quiet eye */}
      <circle cx="56" cy="48" r="3" fill="var(--card-panel, transparent)" />
      {/* Path of stars descending — alternating 5-point + circle */}
      <path d="M24 96l2.4 5.6 6 .4-4.6 4 1.4 5.8-5.2-3-5.2 3 1.4-5.8-4.6-4 6-.4z" />
      <circle cx="44" cy="112" r="2.5" />
      <path d="M62 118l1.8 4.2 4.4.4-3.4 3 1 4.4-3.8-2.2-3.8 2.2 1-4.4-3.4-3 4.4-.4z" />
      <circle cx="82" cy="124" r="2.2" />
      <path d="M100 126l1.4 3.2 3.4.4-2.6 2.2.8 3.4-3-1.6-3 1.6.8-3.4-2.6-2.2 3.4-.4z" />
    </svg>
  );
}
