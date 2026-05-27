import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { TarotCard } from "../components/TarotCard";
import { LEVELS, type Level } from "../game/levels";
import { useSpread } from "../state/spread";
import "./Spread.css";

// Each chapter gets a signature jewel color, cycling through the palette.
const CHAPTER_COLORS = [
  "var(--panel-amethyst)",
  "var(--panel-coral)",
  "var(--panel-emerald)",
  "var(--panel-gold)",
  "var(--panel-cobalt)",
  "var(--panel-pink)",
  "var(--panel-saffron)",
  "var(--panel-teal)",
];

const CHAPTER_FIGURES = [
  ChapterMagician,
  ChapterPriestess,
  ChapterEmpress,
  ChapterEmperor,
  ChapterHierophant,
  ChapterLovers,
  ChapterChariot,
  ChapterStrength,
];

export function Spread() {
  const [, navigate] = useLocation();
  const stars = useSpread((s) => s.stars);
  const isUnlocked = useSpread((s) => s.isUnlocked);

  return (
    <main class="screen spread">
      <header class="spread__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="spread__title">
          <p class="eyebrow">Book Two · El Libro</p>
          <h1>
            The <em>Spread</em>
          </h1>
          <p class="script spread__sub">eight chapters of escalating omens</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <section class="spread__deck" aria-label="Chapter index">
        {LEVELS.map((level, idx) => {
          const earned = stars[level.id] ?? 0;
          const unlocked = isUnlocked(level.id);
          const Figure = CHAPTER_FIGURES[idx] ?? ChapterMagician;
          return (
            <TarotCard
              key={level.id}
              numeral={level.numeral}
              panelName={level.name}
              panelCaption={level.epigraph}
              headline={level.name.replace(/^The /, "")}
              script={level.name.toLowerCase().replace(/^the /, "")}
              subtitle={`${formatObjective(level)} · ${level.moves} readings`}
              panelColor={CHAPTER_COLORS[idx] ?? "var(--panel-amethyst)"}
              figure={<Figure />}
              className={unlocked ? "" : "card--disabled"}
              footer={
                <>
                  <StarRow value={earned} />
                  <button
                    type="button"
                    class="btn btn--on-card btn--primary"
                    disabled={!unlocked}
                    onClick={() =>
                      navigate(`${routes.play}?mode=spread&level=${level.id}`)
                    }
                  >
                    {unlocked ? "Open" : "Sealed"}
                  </button>
                </>
              }
            />
          );
        })}
      </section>
    </main>
  );
}

function formatObjective(level: Level): string {
  if (level.objective.type === "score") {
    return `Reach ${level.objective.target.toLocaleString()} fortune`;
  }
  const suit = level.objective.suit;
  return `Clear ${level.objective.target} ${suit.charAt(0).toUpperCase()}${suit.slice(1)}`;
}

function StarRow({ value }: { value: 0 | 1 | 2 | 3 }) {
  return (
    <span class="stars" aria-label={`${value} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          class={`stars__pip ${value >= n ? "stars__pip--lit" : ""}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Chapter figures (filled silhouettes) ──────────────────────────────

function ChapterMagician() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Wand + infinity */}
      <rect x="58" y="20" width="4" height="60" rx="1" />
      <path d="M44 20l32 0" stroke="currentColor" stroke-width="3" fill="none" />
      <path d="M44 80l32 0" stroke="currentColor" stroke-width="3" fill="none" />
      <path
        d="M30 100c12-10 24-10 30 0s18 10 30 0"
        stroke="currentColor"
        stroke-width="4"
        fill="none"
      />
      <circle cx="60" cy="10" r="4" />
    </svg>
  );
}

function ChapterPriestess() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      <path d="M30 24h60v8H30zM30 100h60v8H30z" />
      <rect x="42" y="32" width="4" height="68" />
      <rect x="74" y="32" width="4" height="68" />
      {/* Crescent veil */}
      <path d="M60 50c-12 0-22 8-22 22h44c0-14-10-22-22-22z" />
      <circle cx="60" cy="68" r="5" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

function ChapterEmpress() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Crown of stars + draped robe */}
      <path d="M40 24l8-10 12 8 12-8 8 10v6H40z" />
      <path d="M30 50c10-8 50-8 60 0v60H30z" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={40 + i * 20} cy="20" r="2.5" />
      ))}
    </svg>
  );
}

function ChapterEmperor() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Throne + arm with scepter */}
      <rect x="26" y="44" width="68" height="60" />
      <rect x="20" y="40" width="14" height="76" />
      <rect x="86" y="40" width="14" height="76" />
      <circle cx="60" cy="68" r="14" fill="var(--card-panel, transparent)" />
      <rect x="58" y="14" width="4" height="20" />
      <circle cx="60" cy="12" r="5" />
    </svg>
  );
}

function ChapterHierophant() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Mitered figure with two keys */}
      <path d="M60 18l16 16-6 6v18H50V40l-6-6z" />
      <rect x="40" y="60" width="40" height="50" />
      <circle cx="50" cy="100" r="4" fill="var(--card-panel, transparent)" />
      <circle cx="70" cy="100" r="4" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

function ChapterLovers() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Two figures + sun above */}
      <circle cx="40" cy="50" r="10" />
      <path d="M28 64h24v44H28z" />
      <circle cx="80" cy="50" r="10" />
      <path d="M68 64h24v44H68z" />
      <circle cx="60" cy="22" r="8" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={60 + Math.cos(a) * 12}
            y1={22 + Math.sin(a) * 12}
            x2={60 + Math.cos(a) * 18}
            y2={22 + Math.sin(a) * 18}
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        );
      })}
    </svg>
  );
}

function ChapterChariot() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Driver behind a square chariot */}
      <rect x="24" y="60" width="72" height="40" />
      <circle cx="38" cy="106" r="10" />
      <circle cx="38" cy="106" r="4" fill="var(--card-panel, transparent)" />
      <circle cx="82" cy="106" r="10" />
      <circle cx="82" cy="106" r="4" fill="var(--card-panel, transparent)" />
      <circle cx="60" cy="40" r="12" />
      <path d="M48 56h24v8H48z" />
    </svg>
  );
}

function ChapterStrength() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Lion with hand on muzzle, infinity above */}
      <circle cx="60" cy="76" r="26" />
      <ellipse cx="60" cy="84" rx="10" ry="6" fill="var(--card-panel, transparent)" />
      {/* Mane spikes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 60 + Math.cos(a) * 28;
        const y1 = 76 + Math.sin(a) * 28;
        const x2 = 60 + Math.cos(a) * 38;
        const y2 = 76 + Math.sin(a) * 38;
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
      <path
        d="M40 26c8-8 16-8 20 0s12 8 20 0"
        stroke="currentColor"
        stroke-width="4"
        fill="none"
      />
    </svg>
  );
}
