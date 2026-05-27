import { useLocation } from "wouter-preact";
import type { ComponentChildren } from "preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";
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

  return (
    <main class="screen home">
      <header class="home__masthead">
        <p class="eyebrow home__eyebrow">The Reading Room</p>
        <h1 class="home__title">
          Arcana <em>Cascada</em>
        </h1>
        <p class="home__subtitle script">choose your spread</p>
      </header>

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
      {/* Reading table cloth draped with three cards splayed out */}
      <path d="M10 96l100 6v18a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" />
      <rect x="22" y="38" width="22" height="52" rx="3" transform="rotate(-12 33 64)" />
      <rect x="50" y="34" width="22" height="52" rx="3" />
      <rect x="76" y="38" width="22" height="52" rx="3" transform="rotate(12 87 64)" />
      <circle cx="60" cy="22" r="6" />
      <circle cx="60" cy="22" r="2.5" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

function CardFigureBook() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Open book / codex with eight pages */}
      <path d="M16 36c14-6 32-6 44 4v82c-12-10-30-10-44-4z" />
      <path d="M104 36c-14-6-32-6-44 4v82c12-10 30-10 44-4z" />
      <rect x="58" y="40" width="4" height="78" rx="1" />
      {/* Page lines */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="22"
          y={56 + i * 12}
          width="32"
          height="3"
          fill="var(--card-panel, transparent)"
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="66"
          y={56 + i * 12}
          width="32"
          height="3"
          fill="var(--card-panel, transparent)"
        />
      ))}
    </svg>
  );
}

function CardFigureSun() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Sun radiating across an eye */}
      <circle cx="60" cy="68" r="26" />
      <g>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const x1 = 60 + Math.cos(a) * 32;
          const y1 = 68 + Math.sin(a) * 32;
          const x2 = 60 + Math.cos(a) * 48;
          const y2 = 68 + Math.sin(a) * 48;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              stroke-width="4"
              stroke-linecap="round"
            />
          );
        })}
      </g>
      {/* Eye in the middle */}
      <ellipse cx="60" cy="68" rx="14" ry="8" fill="var(--card-panel, transparent)" />
      <circle cx="60" cy="68" r="4" />
    </svg>
  );
}

function CardFigureMoon() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Crescent moon with path of stars descending */}
      <path d="M82 60a30 30 0 1 1-38-28 22 22 0 0 0 38 28z" />
      {/* Star path */}
      <circle cx="34" cy="98" r="3" />
      <circle cx="48" cy="110" r="2.5" />
      <circle cx="64" cy="118" r="3" />
      <circle cx="80" cy="124" r="2.5" />
      <circle cx="96" cy="128" r="2" />
    </svg>
  );
}
