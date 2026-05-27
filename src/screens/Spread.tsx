import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { LEVELS, type Level } from "../game/levels";
import { useSpread } from "../state/spread";
import "./Spread.css";

export function Spread() {
  const [, navigate] = useLocation();
  const stars = useSpread((s) => s.stars);
  const isUnlocked = useSpread((s) => s.isUnlocked);

  return (
    <main class="screen spread stack" style={{ "--gap": "var(--space-6)" }}>
      <header class="spread__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div>
          <p class="eyebrow">Book Two</p>
          <h1>The Spread</h1>
        </div>
        <span aria-hidden="true" />
      </header>

      <p class="spread__intro">
        Eight chapters of escalating omens. Each spread sets a single
        intent and a fixed budget of readings. Pass with three stars to
        master the page.
      </p>

      <div class="rule rule--double" aria-hidden="true" />

      <section class="spread__levels" aria-label="Chapter index">
        {LEVELS.map((level) => {
          const earned = stars[level.id] ?? 0;
          const unlocked = isUnlocked(level.id);
          return (
            <article
              key={level.id}
              class={`leaf chapter ${unlocked ? "" : "chapter--locked"}`}
            >
              <header class="leaf__head">
                <span class="numeral chapter__numeral">{level.numeral}</span>
                <StarRow value={earned} />
              </header>
              <h2 class="chapter__name">{level.name}</h2>
              <p class="chapter__epigraph">{level.epigraph}</p>
              <p class="chapter__objective">
                {formatObjective(level)} <span class="chapter__moves">· {level.moves} readings</span>
              </p>
              <button
                type="button"
                class="btn"
                disabled={!unlocked}
                onClick={() => navigate(`${routes.play}?mode=spread&level=${level.id}`)}
              >
                {unlocked ? "Open" : "Sealed"}
              </button>
            </article>
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
  return `Clear ${level.objective.target} ${capitalize(suit)}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
