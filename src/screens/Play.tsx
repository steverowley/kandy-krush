import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { Board } from "../game/view/Board";
import { TarotCard } from "../components/TarotCard";
import { useGame, type GameMode } from "../state/game";
import { useSpread } from "../state/spread";
import { useDaily } from "../state/daily";
import { useArcana } from "../state/arcana";
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
import { useQuerent } from "../state/querent";
import { useResume, spreadKey, querentKey } from "../state/resume";
import { outcome as outcomeAudio } from "../subscribers/audio";
import {
  CHAMBER_COUNT,
  chamberByIndex,
  chamberMovesFor,
  classById,
  type Chamber,
  type QuerentClass,
} from "../game/querent";
import { routes } from "../router";
import "./Play.css";

function modeFromQuery(search: string): GameMode {
  const params = new URLSearchParams(search);
  const m = params.get("mode");
  if (m === "free" || m === "spread" || m === "daily" || m === "querent") return m;
  return "free";
}

function levelFromQuery(search: string): number | null {
  return numFromQuery(search, "level");
}

function numFromQuery(search: string, key: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get(key);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
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
  const chamberParam = numFromQuery(search, "chamber");
  const level = useMemo(
    () => (mode === "spread" && levelIdParam ? levelById(levelIdParam) ?? null : null),
    [mode, levelIdParam],
  );
  const today = useMemo(() => todayKey(), []);

  const { score, moves, deadlocked, cleared, busy, lastMove, start, reset, snapshot, restore } =
    useGame();
  const recordSpread = useSpread((s) => s.recordResult);
  const dailyRun = useDaily((s) => s.runs[today]);
  const saveDailySnapshot = useDaily((s) => s.saveSnapshot);
  const finishDailyRun = useDaily((s) => s.finishRun);

  const querentRun = useQuerent((s) => s.run);
  const passChamber = useQuerent((s) => s.passChamber);
  const failRun = useQuerent((s) => s.failRun);
  const finishRun = useQuerent((s) => s.finishRun);
  const saveResume = useResume((s) => s.saveSnapshot);
  const clearResume = useResume((s) => s.clearSnapshot);
  const querentClass: QuerentClass | null = useMemo(
    () => (querentRun ? classById(querentRun.classId) ?? null : null),
    [querentRun?.classId],
  );
  const chamber: Chamber | null = useMemo(
    () => (mode === "querent" && chamberParam ? chamberByIndex(chamberParam) ?? null : null),
    [mode, chamberParam],
  );

  const [outcomeSeen, setOutcomeSeenRaw] = useState<{
    kind: "win" | "loss";
    stars: 0 | 1 | 2 | 3;
    finalScore: number;
  } | null>(null);

  // Fires the win/loss flourish exactly once on outcome resolution.
  function setOutcomeSeen(
    o: { kind: "win" | "loss"; stars: 0 | 1 | 2 | 3; finalScore: number } | null,
  ) {
    if (o && !outcomeSeen) {
      if (o.kind === "win") outcomeAudio.win();
      else outcomeAudio.loss();
    }
    setOutcomeSeenRaw(o);
  }

  // Initial mount: bootstrap whichever mode is active. Daily restores
  // from snapshot if there's an unfinished run today; otherwise starts
  // fresh from today's seed.
  useEffect(() => {
    setOutcomeSeen(null);

    if (mode === "daily") {
      const run = useDaily.getState().getRun(today);
      if (run?.outcome === "won" || run?.outcome === "lost") {
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

    if (mode === "querent") {
      if (!querentRun || !chamber || !querentClass) {
        navigate(routes.querent);
        return;
      }
      const key = querentKey(chamber.index);
      const saved = useResume.getState().getSnapshot(key);
      if (saved) {
        restore(saved);
        return;
      }
      start("querent", {
        scoreMultiplier: querentClass.scoreMultiplier,
        totalMoves: chamberMovesFor(chamber, querentClass),
      });
      return;
    }

    if (mode === "spread" && level) {
      const key = spreadKey(level.id);
      const saved = useResume.getState().getSnapshot(key);
      if (saved) {
        restore(saved);
        return;
      }
      start(mode, { levelId: level.id, totalMoves: level.moves });
      return;
    }

    start(mode, level ? { levelId: level.id, totalMoves: level.moves } : undefined);
  }, [mode, level?.id, today, chamberParam]);

  const effectiveObjective = level
    ? level.objective
    : chamber
      ? chamber.objective
      : null;

  const chamberMoves =
    chamber && querentClass ? chamberMovesFor(chamber, querentClass) : null;

  const progress = effectiveObjective
    ? objectiveProgress(effectiveObjective, score, cleared)
    : null;

  const movesLeft =
    level
      ? Math.max(0, level.moves - moves)
      : mode === "daily"
        ? Math.max(0, DAILY_MOVE_BUDGET - moves)
        : chamberMoves !== null
          ? Math.max(0, chamberMoves - moves)
          : null;

  // Auto-snapshot the daily run after every settled move (busy === false
  // signals "the cascade has resolved").
  useEffect(() => {
    if (mode !== "daily") return;
    if (busy) return;
    if (outcomeSeen) return;
    if (useGame.getState().board.rows === 0) return;
    saveDailySnapshot(today, snapshot());
  }, [mode, busy, moves, score, today, outcomeSeen, saveDailySnapshot, snapshot]);

  // Auto-snapshot Spread + Querent mid-run.
  useEffect(() => {
    if (busy || outcomeSeen) return;
    if (useGame.getState().board.rows === 0) return;
    if (mode === "spread" && level) {
      saveResume(spreadKey(level.id), snapshot());
    } else if (mode === "querent" && chamber) {
      saveResume(querentKey(chamber.index), snapshot());
    }
  }, [
    mode,
    busy,
    moves,
    score,
    outcomeSeen,
    level?.id,
    chamber?.index,
    saveResume,
    snapshot,
  ]);

  // Resolve outcomes.
  useEffect(() => {
    if (outcomeSeen || busy) return;
    if (useGame.getState().board.rows === 0) return;

    // Spread: per-chapter objective + move budget.
    if (level && progress) {
      if (progress.met) {
        const stars = starCount(level, score, true);
        recordSpread(level.id, stars);
        clearResume(spreadKey(level.id));
        setOutcomeSeen({ kind: "win", stars, finalScore: score });
      } else if (movesLeft === 0) {
        clearResume(spreadKey(level.id));
        setOutcomeSeen({ kind: "loss", stars: 0, finalScore: score });
      }
      return;
    }

    // Querent: chamber objective + chamber budget.
    if (mode === "querent" && chamber && querentRun && progress) {
      if (progress.met) {
        passChamber(score);
        clearResume(querentKey(chamber.index));
        const nextIdx = querentRun.chamberIndex + 1;
        if (nextIdx > CHAMBER_COUNT) {
          finishRun();
          setOutcomeSeen({ kind: "win", stars: 3, finalScore: score });
        } else {
          setOutcomeSeen({ kind: "win", stars: chamber.boss ? 3 : 1, finalScore: score });
        }
      } else if (movesLeft === 0) {
        failRun();
        // Failing a chamber ends the whole run — wipe every chamber's
        // pending save so a re-roll doesn't inherit stale state.
        useResume.getState().clearAllForMode("querent");
        setOutcomeSeen({ kind: "loss", stars: 0, finalScore: score });
      }
      return;
    }

    // Daily.
    if (mode === "daily" && movesLeft === 0) {
      finishDailyRun(today, "won", score);
      setOutcomeSeen({ kind: "win", stars: 0, finalScore: score });
    }
  }, [
    level,
    chamber,
    querentRun?.chamberIndex,
    progress?.met,
    movesLeft,
    outcomeSeen,
    busy,
    score,
    mode,
    today,
    finishDailyRun,
    recordSpread,
    passChamber,
    failRun,
    finishRun,
  ]);

  const isDailyRecap = mode === "daily" && (dailyRun?.outcome === "won" || dailyRun?.outcome === "lost");

  return (
    <main class="screen play stack" style={{ "--gap": "var(--space-4)" }}>
      <header class="play__head">
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Leave the reading"
          onClick={() =>
            navigate(
              level
                ? routes.spread
                : mode === "querent"
                  ? routes.querent
                  : routes.home,
            )
          }
        >
          ← Leave
        </button>
        <div class="play__title">
          <p class="eyebrow">{modeTitle[mode]}</p>
          {level ? (
            <p class="play__chapter">
              <span class="numeral">{level.numeral}</span> · {level.name}
            </p>
          ) : chamber ? (
            <p class="play__chapter">
              <span class="numeral">{chamber.numeral}</span> · {chamber.name}
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
              clearResume(spreadKey(level.id));
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

      {mode === "querent" ? <ArcanaStrip /> : null}

      <section class="play__ledger" aria-label="Run status" aria-live="polite">
        <div class="ledger-cell">
          <span class="eyebrow">Fortune</span>
          <span class="ledger-value tabular">
            <RollingNumber value={score} />
          </span>
        </div>
        <div class="ledger-rule" aria-hidden="true" />
        <div class="ledger-cell">
          <span class="eyebrow">{movesLeft !== null ? "Readings left" : "Readings"}</span>
          <span class="ledger-value tabular">
            {movesLeft !== null ? movesLeft : moves}
          </span>
        </div>
        {lastMove.tick > 0 ? (
          <ScoreBurst
            key={lastMove.tick}
            chips={lastMove.chips}
            mult={lastMove.mult}
            score={lastMove.score}
          />
        ) : null}
      </section>

      {progress ? (
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

      {!isDailyRecap ? (
        <div class="play__reveal">
          <Board />
        </div>
      ) : null}

      {deadlocked && !outcomeSeen ? (
        <div class="play__notice" role="status">
          <p class="eyebrow">The Deck Has Frozen</p>
          <p>No legal swap remains.</p>
          <button
            type="button"
            class="btn btn--primary"
            onClick={() => {
              if (mode === "daily") {
                finishDailyRun(today, "won", score);
                setOutcomeSeen({ kind: "win", stars: 0, finalScore: score });
                return;
              }
              if (mode === "querent") {
                failRun();
                setOutcomeSeen({ kind: "loss", stars: 0, finalScore: score });
                return;
              }
              reset();
            }}
          >
            {mode === "daily"
              ? "Finalize the reading"
              : mode === "querent"
                ? "Yield the chamber"
                : "Reshuffle the deck"}
          </button>
        </div>
      ) : null}

      {outcomeSeen ? (
        <Outcome
          mode={mode}
          outcome={outcomeSeen}
          level={level}
          chamber={chamber}
          finalChamber={
            mode === "querent" &&
            chamber !== null &&
            outcomeSeen.kind === "win" &&
            chamber.index === CHAMBER_COUNT
          }
          alreadyRecap={isDailyRecap}
          onAdvance={() => {
            if (mode === "querent" && chamber && outcomeSeen.kind === "win") {
              const next = chamber.index + 1;
              if (next > CHAMBER_COUNT) {
                navigate(routes.querent);
              } else {
                // Insert the Arcana Draw between chambers — pick 1 of 3.
                navigate(`${routes.draw}?next=${next}`);
              }
              return;
            }
            setOutcomeSeen(null);
            reset();
          }}
          onLeave={() => {
            if (level) navigate(routes.spread);
            else if (mode === "querent") navigate(routes.querent);
            else navigate(routes.home);
          }}
        />
      ) : null}
    </main>
  );
}

/** Compact strip of held Arcana — sits above the Fortune ledger in
 *  Querent mode. Each badge shows the Roman numeral and a tooltip name
 *  on hover/focus. Empty state renders a small "no arcana yet" hint. */
function ArcanaStrip() {
  const held = useArcana((s) => s.held());
  if (held.length === 0) {
    return (
      <section class="arcana-strip arcana-strip--empty" aria-label="Held arcana">
        <p class="eyebrow">Arcana</p>
        <p class="arcana-strip__empty script">no card yet — finish a chamber to draw</p>
      </section>
    );
  }
  return (
    <section class="arcana-strip" aria-label="Held arcana">
      <p class="eyebrow">Arcana</p>
      <ul class="arcana-strip__list">
        {held.map((a) => (
          <li
            key={a.id}
            class="arcana-strip__badge"
            style={{ "--card-panel": a.panelColor }}
            title={`${a.name} — ${a.description}`}
          >
            <span class="arcana-strip__numeral numeral">{a.numeral}</span>
            <span class="arcana-strip__name">{a.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Smoothly counts from the previously-displayed number up to `value`
 *  over ~600ms using easeOutQuint. Skips the animation when the OS or
 *  user has asked for reduced motion. */
function RollingNumber({ value, duration = 620 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const toRef = useRef(value);

  useEffect(() => {
    if (value === toRef.current) return;
    const reduced =
      document.documentElement.classList.contains("reduced-motion") ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      fromRef.current = value;
      toRef.current = value;
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    toRef.current = value;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 5);
      const cur = Math.round(fromRef.current + (toRef.current - fromRef.current) * eased);
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

/** Transient Chips × Mult = +Score readout that pops in above the
 *  Fortune ledger when a move resolves, then fades out. Keyed on the
 *  move tick so each new move re-mounts and re-animates. */
function ScoreBurst({
  chips,
  mult,
  score,
}: {
  chips: number;
  mult: number;
  score: number;
}) {
  if (score <= 0) return null;
  return (
    <div class="score-burst" aria-hidden="true">
      <span class="score-burst__chips tabular">{chips.toLocaleString()}</span>
      <span class="score-burst__op">×</span>
      <span class="score-burst__mult tabular">{mult}</span>
      <span class="score-burst__eq">=</span>
      <span class="score-burst__total tabular">+{score.toLocaleString()}</span>
    </div>
  );
}

function Outcome({
  mode,
  outcome,
  level,
  chamber,
  finalChamber,
  alreadyRecap,
  onAdvance,
  onLeave,
}: {
  mode: GameMode;
  outcome: { kind: "win" | "loss"; stars: 0 | 1 | 2 | 3; finalScore: number };
  level: Level | null;
  chamber: Chamber | null;
  finalChamber: boolean;
  alreadyRecap: boolean;
  onAdvance: () => void;
  onLeave: () => void;
}) {
  const isWin = outcome.kind === "win";
  const isDaily = mode === "daily";
  const isQuerent = mode === "querent";

  const panelName = isDaily
    ? alreadyRecap ? "Settled" : "Reading"
    : isQuerent
      ? isWin
        ? finalChamber ? "The Path" : "Cleared"
        : "Broken"
      : isWin ? "Resolved" : "Broken";
  const headline = isDaily
    ? "The Day"
    : isQuerent
      ? isWin
        ? finalChamber ? "Resolved" : "Onward"
        : "The Path Ends"
      : isWin
        ? "The Spread"
        : "The Querent";
  const script = isWin ? "fortune" : "ruin";
  const subtitle = isDaily
    ? "la jornada · return tomorrow"
    : isQuerent
      ? isWin
        ? finalChamber
          ? "el final · nine chambers walked"
          : "un paso más · one step deeper"
        : "el cierre · cards remembered"
      : isWin
      ? "la fortuna · stars settle"
      : "el cierre · readings spent";
  const panelColor = isWin
    ? "var(--panel-gold)"
    : "var(--panel-amethyst)";
  const numeral = level?.numeral ?? chamber?.numeral ?? (isDaily ? "·" : "·");

  // When the modal opens, move keyboard focus to the primary action so
  // Enter / Tab work without hunting.
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstActionRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onLeave();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                <button
                  type="button"
                  class="btn btn--on-card"
                  onClick={onLeave}
                  ref={isDaily ? firstActionRef : undefined}
                >
                  {level
                    ? "Back to the Spread"
                    : isQuerent
                      ? "Back to the Path"
                      : "Leave"}
                </button>
                {!isDaily ? (
                  <button
                    type="button"
                    class="btn btn--on-card btn--primary"
                    onClick={onAdvance}
                    ref={firstActionRef}
                  >
                    {isQuerent
                      ? isWin
                        ? finalChamber
                          ? "Close the path"
                          : "Next chamber"
                        : "Begin again"
                      : isWin
                        ? "Read again"
                        : "Reshuffle"}
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
