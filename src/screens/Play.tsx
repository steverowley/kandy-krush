import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { Board } from "../game/view/Board";
import { TarotCard } from "../components/TarotCard";
import { useGame, type GameMode } from "../state/game";
import { useSpread } from "../state/spread";
import { useDaily } from "../state/daily";
import {
  levelById,
  objectiveProgress,
  starCount,
  type Level,
} from "../game/levels";
import {
  DAILY_COLS,
  DAILY_MOVE_BUDGET,
  DAILY_ROWS,
  dailySeed,
  todayKey,
} from "../game/daily";
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
  const today = useMemo(() => todayKey(), []);

  const { score, moves, deadlocked, cleared, busy, start, reset, snapshot, restore } =
    useGame();
  const recordSpread = useSpread((s) => s.recordResult);
  const dailyRun = useDaily((s) => s.runs[today]);
  const saveDailySnapshot = useDaily((s) => s.saveSnapshot);
  const finishDailyRun = useDaily((s) => s.finishRun);

  const [outcomeSeen, setOutcomeSeen] = useState<{
    kind: "win" | "loss";
    stars: 0 | 1 | 2 | 3;
    finalScore: number;
  } | null>(null);

  // Initial mount: bootstrap whichever mode is active. Daily restores
  // from snapshot if there's an unfinished run today; otherwise starts
  // fresh from today's seed.
  useEffect(() => {
    setOutcomeSeen(null);

    if (mode === "daily") {
      const run = useDaily.getState().getRun(today);
      if (run?.outcome === "won" || run?.outcome === "lost") {
        // Already played today — flash the result, no live board.
        setOutcomeSeen({
          kind: run.outcome === "won" ? "win" : "loss",
          stars: 0,
          finalScore: run.finalScore,
        });
        return;
      }
      if (run?.snapshot) {
        restore(run.snapshot);
        return;
      }
      start("daily", {
        seed: dailySeed(today),
        rows: DAILY_ROWS,
        cols: DAILY_COLS,
      });
      return;
    }

    start(mode, level ? { levelId: level.id } : undefined);
  }, [mode, level?.id, today]);

  const progress = level ? objectiveProgress(level.objective, score, cleared) : null;
  const movesLeft =
    level
      ? Math.max(0, level.moves - moves)
      : mode === "daily"
        ? Math.max(0, DAILY_MOVE_BUDGET - moves)
        : null;

  // Auto-snapshot the daily run after every settled move (busy === false
  // signals "the cascade has resolved").
  useEffect(() => {
    if (mode !== "daily") return;
    if (busy) return;
    if (outcomeSeen) return;
    // Don't snapshot the empty pre-start state.
    if (useGame.getState().board.rows === 0) return;
    saveDailySnapshot(today, snapshot());
  }, [mode, busy, moves, score, today, outcomeSeen, saveDailySnapshot, snapshot]);

  // Resolve outcomes.
  useEffect(() => {
    if (outcomeSeen || busy) return;

    if (level && progress) {
      if (progress.met) {
        const stars = starCount(level, score, true);
        recordSpread(level.id, stars);
        setOutcomeSeen({ kind: "win", stars, finalScore: score });
      } else if (movesLeft === 0) {
        setOutcomeSeen({ kind: "loss", stars: 0, finalScore: score });
      }
      return;
    }

    if (mode === "daily" && movesLeft === 0 && useGame.getState().board.rows > 0) {
      // The Daily Draw resolves on budget exhaustion. Any final score
      // counts as a "win" in the sense of completing the reading — the
      // outcome modal celebrates a score regardless.
      finishDailyRun(today, "won", score);
      setOutcomeSeen({ kind: "win", stars: 0, finalScore: score });
    }
  }, [level, progress?.met, movesLeft, outcomeSeen, busy, score, mode, today, finishDailyRun, recordSpread]);

  const isDailyRecap = mode === "daily" && (dailyRun?.outcome === "won" || dailyRun?.outcome === "lost");

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
          ) : mode === "daily" ? (
            <p class="play__chapter"><span class="numeral">·</span> {today}</p>
          ) : null}
        </div>
        {mode === "free" ? (
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
        ) : level ? (
          <button
            type="button"
            class="btn btn--ghost"
            aria-label="Restart this chapter"
            onClick={() => {
              setOutcomeSeen(null);
              reset();
            }}
          >
            ↻ Restart
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      <section class="play__ledger" aria-label="Run status">
        <div class="ledger-cell">
          <span class="eyebrow">Fortune</span>
          <span class="ledger-value tabular">{score.toLocaleString()}</span>
        </div>
        <div class="ledger-rule" aria-hidden="true" />
        <div class="ledger-cell">
          <span class="eyebrow">{movesLeft !== null ? "Readings left" : "Readings"}</span>
          <span class="ledger-value tabular">
            {movesLeft !== null ? movesLeft : moves}
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

      {!isDailyRecap ? <Board /> : null}

      {deadlocked && !outcomeSeen ? (
        <div class="play__notice" role="status">
          <p class="eyebrow">The Deck Has Frozen</p>
          <p>No legal swap remains.</p>
          <button type="button" class="btn btn--primary" onClick={() => {
            // Daily mode shouldn't reshuffle (would change seed); resolve as won.
            if (mode === "daily") {
              finishDailyRun(today, "won", score);
              setOutcomeSeen({ kind: "win", stars: 0, finalScore: score });
              return;
            }
            reset();
          }}>
            {mode === "daily" ? "Finalize the reading" : "Reshuffle the deck"}
          </button>
        </div>
      ) : null}

      {outcomeSeen ? (
        <Outcome
          mode={mode}
          outcome={outcomeSeen}
          level={level}
          alreadyRecap={isDailyRecap}
          onRetry={() => {
            setOutcomeSeen(null);
            reset();
          }}
          onLeave={() => navigate(level ? routes.spread : routes.home)}
        />
      ) : null}
    </main>
  );
}

function Outcome({
  mode,
  outcome,
  level,
  alreadyRecap,
  onRetry,
  onLeave,
}: {
  mode: GameMode;
  outcome: { kind: "win" | "loss"; stars: 0 | 1 | 2 | 3; finalScore: number };
  level: Level | null;
  alreadyRecap: boolean;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const isWin = outcome.kind === "win";
  const isDaily = mode === "daily";

  const panelName = isDaily
    ? alreadyRecap ? "Settled" : "Reading"
    : isWin ? "Resolved" : "Broken";
  const headline = isDaily
    ? "The Day"
    : isWin
      ? "The Spread"
      : "The Querent";
  const script = isWin ? "fortune" : "ruin";
  const subtitle = isDaily
    ? "la jornada · return tomorrow"
    : isWin
      ? "la fortuna · stars settle"
      : "el cierre · readings spent";
  const panelColor = isWin
    ? "var(--panel-gold)"
    : "var(--panel-amethyst)";
  const numeral = level?.numeral ?? (isDaily ? "·" : "·");

  return (
    <div class="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
      <div class="outcome__card-wrap">
        <TarotCard
          numeral={numeral}
          panelName={panelName}
          panelCaption={`${outcome.finalScore.toLocaleString()} fortune`}
          headline={headline}
          script={script}
          subtitle={subtitle}
          panelColor={panelColor}
          figure={<OutcomeFigure win={isWin} />}
          footer={
            <>
              {isWin && level ? (
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
              <div class="outcome__actions">
                <button type="button" class="btn btn--on-card" onClick={onLeave}>
                  {level ? "Back to the Spread" : "Leave"}
                </button>
                {!isDaily ? (
                  <button
                    type="button"
                    class="btn btn--on-card btn--primary"
                    onClick={onRetry}
                  >
                    {isWin ? "Read again" : "Reshuffle"}
                  </button>
                ) : null}
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}

function OutcomeFigure({ win }: { win: boolean }) {
  if (win) {
    return (
      <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
        {/* Hand presenting a star */}
        <path d="M44 110c-8 0-14-4-16-12l-4-26c-1-6 3-9 7-9s8 3 8 8v10h2v-20c0-5 4-8 8-8s8 3 8 8v18h2v-20c0-5 4-8 8-8s8 3 8 8v14h2v-10c0-4 3-7 7-7s8 3 8 9l-3 24c-1 8-8 14-16 14H44z" />
        {/* Star */}
        <path d="M60 18l5.3 13.7L80 32.8l-11.4 8.4L72 56l-12-7.5L48 56l3.4-14.8L40 32.8l14.7-1.1z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Empty hands */}
      <path d="M30 80c-3-3-2-8 2-9l8-2-4-18c-1-5 3-8 7-7s5 4 5 8l3 15 14-2-2-14c-1-5 3-8 7-7s5 4 5 8l4 24c2 12-6 20-18 20-9 0-18-6-31-16z" />
      {/* Broken thread */}
      <path d="M68 110l-8 14m-2-18l-4 6m18-2l4 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" />
    </svg>
  );
}
