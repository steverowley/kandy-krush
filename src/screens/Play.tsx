import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { Board } from "../game/view/Board";
import { useGame, type GameMode } from "../state/game";
import { useSpread } from "../state/spread";
import {
  levelById,
  objectiveProgress,
  starCount,
  type Level,
} from "../game/levels";
import { routes } from "../router";
import "./Play.css";

function modeFromQuery(search: string): GameMode {
  const params = new URLSearchParams(search);
  const m = params.get("mode");
  if (m === "free" || m === "spread" || m === "daily" || m === "querent") return m;
  return "free";
}

function levelFromQuery(search: string): number | null {
  const params = new URLSearchParams(search);
  const id = params.get("level");
  if (!id) return null;
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

const modeTitle: Record<GameMode, string> = {
  free: "Free Reading",
  spread: "The Spread",
  daily: "Daily Draw",
  querent: "The Querent's Path",
};

export function Play() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const mode = modeFromQuery(search);
  const levelIdParam = levelFromQuery(search);
  const level = useMemo(
    () => (mode === "spread" && levelIdParam ? levelById(levelIdParam) ?? null : null),
    [mode, levelIdParam],
  );

  const { score, moves, deadlocked, cleared, busy, start, reset } = useGame();
  const recordResult = useSpread((s) => s.recordResult);

  // Outcome modal — sticky once the run resolves so the player can read it.
  const [outcomeSeen, setOutcomeSeen] = useState<{
    kind: "win" | "loss";
    stars: 0 | 1 | 2 | 3;
    finalScore: number;
  } | null>(null);

  useEffect(() => {
    // Reset whenever route key (mode + level) changes.
    setOutcomeSeen(null);
    start(mode, level ? { levelId: level.id } : undefined);
  }, [mode, level?.id]);

  const progress = level ? objectiveProgress(level.objective, score, cleared) : null;
  const movesLeft = level ? Math.max(0, level.moves - moves) : null;

  // Resolve outcome when the run reaches a terminal state.
  useEffect(() => {
    if (!level || outcomeSeen || busy) return;
    if (!progress) return;
    if (progress.met) {
      const stars = starCount(level, score, true);
      recordResult(level.id, stars);
      setOutcomeSeen({ kind: "win", stars, finalScore: score });
    } else if (movesLeft === 0) {
      setOutcomeSeen({ kind: "loss", stars: 0, finalScore: score });
    }
  }, [level, progress?.met, movesLeft, outcomeSeen, busy, score, recordResult]);

  return (
    <main class="screen play stack" style={{ "--gap": "var(--space-4)" }}>
      <header class="play__head">
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Leave the reading"
          onClick={() => navigate(level ? routes.spread : routes.home)}
        >
          ← Leave
        </button>
        <div class="play__title">
          <p class="eyebrow">{modeTitle[mode]}</p>
          {level ? (
            <p class="play__chapter">
              <span class="numeral">{level.numeral}</span> · {level.name}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Shuffle the deck"
          onClick={() => {
            setOutcomeSeen(null);
            reset();
          }}
        >
          ↻ Reshuffle
        </button>
      </header>

      <section class="play__ledger" aria-label="Run status">
        <div class="ledger-cell">
          <span class="eyebrow">Fortune</span>
          <span class="ledger-value tabular">{score.toLocaleString()}</span>
        </div>
        <div class="ledger-rule" aria-hidden="true" />
        <div class="ledger-cell">
          <span class="eyebrow">{level ? "Readings left" : "Readings"}</span>
          <span class="ledger-value tabular">
            {level ? movesLeft : moves}
          </span>
        </div>
      </section>

      {level && progress ? (
        <section class="play__objective" aria-label="Objective">
          <header class="play__objective-head">
            <span class="eyebrow">{progress.label}</span>
            <span class="tabular play__objective-count">
              {progress.value} / {progress.target}
            </span>
          </header>
          <div
            class="play__objective-bar"
            role="progressbar"
            aria-valuenow={progress.value}
            aria-valuemin={0}
            aria-valuemax={progress.target}
          >
            <div
              class="play__objective-fill"
              style={{
                width: `${Math.min(100, (progress.value / progress.target) * 100)}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      <Board />

      {deadlocked && !outcomeSeen ? (
        <div class="play__notice" role="status">
          <p class="eyebrow">The Deck Has Frozen</p>
          <p>No legal swap remains.</p>
          <button type="button" class="btn btn--primary" onClick={() => reset()}>
            Reshuffle the deck
          </button>
        </div>
      ) : null}

      {outcomeSeen ? <Outcome
        outcome={outcomeSeen}
        level={level}
        onRetry={() => {
          setOutcomeSeen(null);
          reset();
        }}
        onLeave={() => navigate(level ? routes.spread : routes.home)}
      /> : null}
    </main>
  );
}

function Outcome({
  outcome,
  level,
  onRetry,
  onLeave,
}: {
  outcome: { kind: "win" | "loss"; stars: 0 | 1 | 2 | 3; finalScore: number };
  level: Level | null;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const isWin = outcome.kind === "win";
  return (
    <div class="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
      <div class="outcome__card leaf">
        <p class="numeral">— {level?.numeral ?? "—"} —</p>
        <h2 id="outcome-title" class="outcome__title">
          {isWin ? "The Spread Resolves" : "The Reading Breaks"}
        </h2>
        <p class="outcome__sub">
          {isWin
            ? "Stars settle on the cloth."
            : "The querent runs out of patience."}
        </p>

        {isWin ? (
          <div class="outcome__stars" aria-label={`${outcome.stars} of 3 stars`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                class={`outcome__star ${outcome.stars >= n ? "outcome__star--lit" : ""}`}
                aria-hidden="true"
              >
                ★
              </span>
            ))}
          </div>
        ) : null}

        <p class="outcome__score">
          <span class="eyebrow">Final fortune</span>{" "}
          <span class="tabular outcome__score-num">
            {outcome.finalScore.toLocaleString()}
          </span>
        </p>

        <div class="outcome__actions">
          <button type="button" class="btn" onClick={onLeave}>
            {level ? "Back to the Spread" : "Leave"}
          </button>
          <button type="button" class="btn btn--primary" onClick={onRetry}>
            {isWin ? "Read again" : "Reshuffle"}
          </button>
        </div>
      </div>
    </div>
  );
}
