import { useLocation } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";
import "./Splash.css";

export function Splash() {
  const [, navigate] = useLocation();

  return (
    <main class="screen splash">
      <p class="splash__overhead eyebrow">An oracle of small fortunes</p>

      <div class="splash__card-wrap">
        <TarotCard
          numeral="0"
          panelName="Arcana Cascada"
          panelCaption="a match-three reading"
          headline="The Fool"
          script="cascada"
          subtitle="el loco · cinque suite · una lettura"
          panelColor="var(--panel-amethyst)"
          figure={<SplashFigure />}
          footer={
            <button
              type="button"
              class="btn btn--primary btn--on-card splash__cta"
              onClick={() => navigate(routes.home)}
            >
              Begin the Reading
            </button>
          }
        />
      </div>

      <p class="splash__footnote">
        <span class="script">read</span> · <span class="script">choose</span> ·{" "}
        <span class="script">divine</span>
      </p>
    </main>
  );
}

function SplashFigure() {
  // A bold pose: a hand holding a candle / sparking divination. Filled
  // silhouette in ink against the panel.
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Hand */}
      <path d="M52 110c-8 0-14-4-16-12l-2-22c-1-6 3-9 7-9s6 3 6 7v10h2V70c0-5 4-8 8-8s8 3 8 8v15h2V70c0-5 4-8 8-8s8 3 8 8v15h2V72c0-4 3-7 7-7s7 3 7 7l-3 28c-1 8-8 14-16 14H52z" />
      {/* Candle */}
      <rect x="50" y="22" width="6" height="20" rx="1" transform="rotate(-8 53 32)" />
      {/* Flame */}
      <path d="M48 14c1 3 3 4 3 7a4 4 0 0 1-8 0c0-3 2-4 5-7z" transform="rotate(-8 53 32)" />
      {/* Sparkles */}
      <circle cx="80" cy="30" r="2" />
      <circle cx="92" cy="46" r="2" />
      <circle cx="22" cy="48" r="2" />
      <circle cx="30" cy="28" r="1.5" />
    </svg>
  );
}
