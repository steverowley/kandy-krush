import { useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";
import { useTutorial } from "../state/tutorial";
import "./HowToPlay.css";

type Step = {
  numeral: string;
  panelName: string;
  panelCaption: string;
  headline: string;
  script: string;
  subtitle: string;
  panelColor: string;
  body: string;
  figure: preact.ComponentChildren;
};

const STEPS: Step[] = [
  {
    numeral: "I",
    panelName: "The Cloth",
    panelCaption: "el paño",
    headline: "Read the Cards",
    script: "look",
    subtitle: "buscar · find three cards in a row",
    panelColor: "var(--panel-amethyst)",
    body: "Each card carries a suit — cups, pentacles, swords, or wands. Line three of the same suit in a row or column to make a match.",
    figure: <StepRow />,
  },
  {
    numeral: "II",
    panelName: "Swap",
    panelCaption: "intercambiar",
    headline: "Trade Two Cards",
    script: "swap",
    subtitle: "intercambia · tap a card, then tap an adjacent one",
    panelColor: "var(--panel-coral)",
    body: "Tap a card to lift it. Tap any orthogonal neighbour to trade places. If the trade would make a match, both cards settle. Otherwise they nudge back.",
    figure: <StepSwap />,
  },
  {
    numeral: "III",
    panelName: "Cascade",
    panelCaption: "la cascada",
    headline: "Watch the Fall",
    script: "fall",
    subtitle: "cae · cards drop and chain",
    panelColor: "var(--panel-gold)",
    body: "Matched cards leave the cloth and fresh ones drop from above. If the fall makes new matches, the chain multiplies your fortune.",
    figure: <StepCascade />,
  },
  {
    numeral: "IV",
    panelName: "Four Suits",
    panelCaption: "cuatro palos",
    headline: "Know the Deck",
    script: "suits",
    subtitle: "los palos · each suit tints its own color",
    panelColor: "var(--panel-teal)",
    body: "Cups are cobalt water. Pentacles are gold earth. Swords are amethyst air. Wands are coral fire. Some readings ask for a specific suit.",
    figure: <StepSuits />,
  },
];

export function HowToPlay() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const markSeen = useTutorial((s) => s.markSeen);
  const s = STEPS[step]!;
  const lastStep = step === STEPS.length - 1;

  function dismiss() {
    markSeen();
    navigate(routes.home);
  }

  return (
    <main class="screen howto">
      <header class="howto__head">
        <button type="button" class="btn btn--ghost" onClick={dismiss}>
          ← Skip
        </button>
        <div class="howto__title">
          <p class="eyebrow">How to play</p>
          <h1>
            <em>Read</em> the Cards
          </h1>
          <p class="script howto__sub">{step + 1} of {STEPS.length}</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <div class="howto__card-wrap">
        <TarotCard
          numeral={s.numeral}
          panelName={s.panelName}
          panelCaption={s.panelCaption}
          headline={s.headline}
          script={s.script}
          subtitle={s.subtitle}
          panelColor={s.panelColor}
          figure={s.figure}
          footer={<p class="howto__body">{s.body}</p>}
        />
      </div>

      <nav class="howto__nav" aria-label="Walkthrough">
        <button
          type="button"
          class="btn"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← Back
        </button>
        <div class="howto__pips" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              class={`howto__pip ${i === step ? "howto__pip--active" : ""}`}
            />
          ))}
        </div>
        {lastStep ? (
          <button type="button" class="btn btn--primary" onClick={dismiss}>
            Begin reading
          </button>
        ) : (
          <button
            type="button"
            class="btn btn--primary"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next →
          </button>
        )}
      </nav>
    </main>
  );
}

// ── Step figures ─────────────────────────────────────────────────────

function StepRow() {
  return (
    <svg viewBox="0 0 160 140" fill="currentColor" class="card__figure-svg" style={{ width: "85%" }}>
      <rect x="14" y="40" width="36" height="60" rx="6" />
      <rect x="62" y="40" width="36" height="60" rx="6" />
      <rect x="110" y="40" width="36" height="60" rx="6" />
      <circle cx="32" cy="70" r="9" fill="var(--card-panel, transparent)" />
      <circle cx="80" cy="70" r="9" fill="var(--card-panel, transparent)" />
      <circle cx="128" cy="70" r="9" fill="var(--card-panel, transparent)" />
      {/* Connect line */}
      <path d="M40 70h80" stroke="var(--card-panel, transparent)" stroke-width="3" fill="none" />
    </svg>
  );
}

function StepSwap() {
  return (
    <svg viewBox="0 0 160 140" fill="currentColor" class="card__figure-svg" style={{ width: "85%" }}>
      <rect x="22" y="40" width="44" height="60" rx="6" />
      <rect x="92" y="40" width="44" height="60" rx="6" />
      {/* Swap arrows */}
      <path
        d="M76 56l8-8 8 8M84 48v12M82 92l-8 8-8-8M74 100V88"
        stroke="var(--card-panel, transparent)"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
      <circle cx="44" cy="70" r="6" fill="var(--card-panel, transparent)" />
      <circle cx="114" cy="70" r="6" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

function StepCascade() {
  return (
    <svg viewBox="0 0 160 140" fill="currentColor" class="card__figure-svg" style={{ width: "85%" }}>
      {[0, 1, 2].map((c) =>
        [0, 1, 2].map((r) => (
          <rect
            key={`${r}-${c}`}
            x={28 + c * 40}
            y={20 + r * 36}
            width="28"
            height="28"
            rx="4"
            opacity={r === 2 ? 1 : 0.45}
          />
        )),
      )}
      {/* Falling arrow */}
      <path
        d="M80 110l8 12 8-12M88 80v40"
        stroke="var(--card-panel, transparent)"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}

function StepSuits() {
  return (
    <svg viewBox="0 0 160 140" fill="currentColor" class="card__figure-svg" style={{ width: "85%" }}>
      <g>
        {/* Cup */}
        <path d="M22 40h28l-2 18a12 12 0 0 1-24 0z" />
        {/* Pentacle */}
        <circle cx="80" cy="50" r="18" />
        <circle cx="80" cy="50" r="6" fill="var(--card-panel, transparent)" />
        {/* Sword */}
        <rect x="108" y="32" width="6" height="38" />
        <rect x="100" y="62" width="22" height="4" />
        {/* Wand */}
        <rect x="140" y="32" width="6" height="42" />
        <path d="M138 32c2-6 6-8 6-14 0 6 4 8 6 14a6 6 0 0 1-12 0z" />
      </g>
      {/* All-suit row label */}
      <path
        d="M22 100h120"
        stroke="var(--card-panel, transparent)"
        stroke-width="2"
        fill="none"
      />
    </svg>
  );
}
