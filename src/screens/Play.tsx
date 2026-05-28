import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { Board } from "../game/view/Board";
import { TarotCard } from "../components/TarotCard";
import { useGame, type GameMode } from "../state/game";
import { useSpread } from "../state/spread";
import { useDaily } from "../state/daily";
import { useArcana } from "../state/arcana";
import { useMinorArcana } from "../state/minor-arcana";
import { useCoins } from "../state/coins";
import type { MinorArcana } from "../game/minor-arcana";
import { coinsForChamber, isParlourChamber } from "../game/parlour";
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
  chamberEffectiveObjective,
  chamberMovesFor,
  classById,
  type Chamber,
  type QuerentClass,
} from "../game/querent";
import { stakeById } from "../game/stakes";
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

  const {
    score,
    moves,
    deadlocked,
    cleared,
    busy,
    lastMove,
    nextMoveScoreMul,
    start,
    reset,
    snapshot,
    restore,
    grantMoves,
    grantScore,
    armNextMoveMul,
    armNextMoveMultMul,
    armNextMoveChipsBonus,
    destroyRandomRow,
    destroyRandomCol,
    convertBoardSuit,
    reshuffleBoard,
    pentaclePayout,
  } = useGame();
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
  const activeStake = useMemo(
    () => (querentRun ? stakeById(querentRun.stakeId) ?? null : null),
    [querentRun?.stakeId],
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
        totalMoves: chamberMovesFor(chamber, querentClass, activeStake),
        restriction: chamber.restriction ?? null,
        stakeRule: activeStake?.rule ?? null,
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

  // Bosses can multiply the objective target — chamberEffectiveObjective
  // applies the restriction AND the active stake so progress + win-check
  // both see the adjusted threshold.
  const effectiveObjective = level
    ? level.objective
    : chamber
      ? chamberEffectiveObjective(chamber, activeStake)
      : null;

  const chamberMoves =
    chamber && querentClass
      ? chamberMovesFor(chamber, querentClass, activeStake)
      : null;

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
        // Boss reward: a random Minor Arcana consumable (if the player
        // has room in their consumables tray). Blue stake rule disables
        // this — bosses still pay coins but no consumable drops.
        if (chamber.boss && (activeStake?.rule?.bossMinorReward ?? true)) {
          useMinorArcana.getState().grantRandom();
        }
        // Coin payout — every chamber win pays a base; bosses pay extra.
        // Orange stake halves payouts.
        useCoins.getState().grant(
          coinsForChamber({
            isBoss: chamber.boss,
            multiplier: activeStake?.rule?.coinMultiplier,
          }),
        );
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

      {mode === "querent" ? (
        <MinorTray
          onUse={(minor) => {
            switch (minor.effect.kind) {
              case "add-moves":
                grantMoves(minor.effect.amount);
                break;
              case "add-score":
                grantScore(minor.effect.amount);
                break;
              case "next-move-score-mul":
                armNextMoveMul(minor.effect.multiplier);
                break;
              case "next-move-mult-mul":
                armNextMoveMultMul(minor.effect.multiplier);
                break;
              case "next-move-chips-per-cell": {
                const board = useGame.getState().board;
                armNextMoveChipsBonus(
                  minor.effect.perCell * board.rows * board.cols,
                );
                break;
              }
              case "convert-suit":
                convertBoardSuit(minor.effect.from, minor.effect.to);
                break;
              case "destroy-random-row":
                destroyRandomRow();
                break;
              case "destroy-random-col":
                destroyRandomCol();
                break;
              case "reshuffle-board":
                reshuffleBoard();
                break;
              case "pentacle-payout":
                pentaclePayout(minor.effect.perPentacle);
                break;
            }
            useMinorArcana.getState().consume(minor.id);
          }}
          armed={nextMoveScoreMul > 1}
        />
      ) : null}

      {chamber?.restriction ? (
        <aside class="boss-banner" role="note">
          <p class="boss-banner__chip eyebrow">{chamber.restriction.name}</p>
          <p class="boss-banner__body">{chamber.restriction.description}</p>
          <p class="boss-banner__flavor">{chamber.restriction.flavor}</p>
        </aside>
      ) : null}

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
              } else if (isParlourChamber(chamber.index)) {
                // Every third chamber routes to the Parlour shop
                // instead of the standard Arcana Draw.
                navigate(`${routes.parlour}?next=${next}`);
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
 *  on hover/focus. Empty state renders a small "no arcana yet" hint.
 *  Players can drag a badge to reorder firing order, or use the ◂ ▸
 *  buttons for keyboard / no-pointer access. A coin chip at the right
 *  tracks Parlour earnings. */
function ArcanaStrip() {
  const held = useArcana((s) => s.held());
  const reorder = useArcana((s) => s.reorder);
  const coins = useCoins((s) => s.balance);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  function onPointerDown(e: PointerEvent, idx: number) {
    if (held.length < 2) return;
    const target = e.currentTarget as HTMLLIElement;
    target.setPointerCapture?.(e.pointerId);
    setDraggingIdx(idx);
  }

  function onPointerMove(e: PointerEvent) {
    if (draggingIdx === null) return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const sibling = under?.closest<HTMLLIElement>("[data-arcana-idx]");
    if (!sibling) return;
    const overIdx = Number(sibling.dataset.arcanaIdx);
    if (Number.isFinite(overIdx) && overIdx !== draggingIdx) {
      reorder(draggingIdx, overIdx);
      setDraggingIdx(overIdx);
    }
  }

  function onPointerEnd() {
    if (draggingIdx !== null) setDraggingIdx(null);
  }

  return (
    <section class="arcana-strip" aria-label="Held arcana">
      <div class="arcana-strip__head">
        <p class="eyebrow">Arcana</p>
        <p class="arcana-strip__coins" aria-label={`${coins} coins in your purse`}>
          <span class="eyebrow">Coins</span>
          <span class="arcana-strip__coins-value tabular">{coins}</span>
        </p>
      </div>
      {held.length === 0 ? (
        <p class="arcana-strip__empty script">
          no card yet — finish a chamber to draw
        </p>
      ) : (
        <ul class="arcana-strip__list">
          {held.map((a, i) => (
            <li
              key={a.id}
              data-arcana-idx={i}
              class={`arcana-strip__badge${
                draggingIdx === i ? " arcana-strip__badge--dragging" : ""
              }`}
              style={{ "--card-panel": a.panelColor }}
              title={`${a.name} — ${a.description}`}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              {held.length > 1 ? (
                <button
                  type="button"
                  class="arcana-strip__nudge"
                  aria-label={`Move ${a.name} left`}
                  disabled={i === 0}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => reorder(i, i - 1)}
                >
                  ◂
                </button>
              ) : null}
              <span class="arcana-strip__numeral numeral">{a.numeral}</span>
              <span class="arcana-strip__name">{a.name}</span>
              {held.length > 1 ? (
                <button
                  type="button"
                  class="arcana-strip__nudge"
                  aria-label={`Move ${a.name} right`}
                  disabled={i === held.length - 1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => reorder(i, i + 1)}
                >
                  ▸
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Minor Arcana consumables tray. Each held Minor renders as a tappable
 *  badge. When the next-move-mul is "armed" (after using Page of Wands),
 *  a small notice marks the next move as charged. */
function MinorTray({
  onUse,
  armed,
}: {
  onUse: (m: MinorArcana) => void;
  armed: boolean;
}) {
  const held = useMinorArcana((s) => s.held());
  if (held.length === 0 && !armed) return null;
  return (
    <section class="minor-tray" aria-label="Consumables">
      <p class="eyebrow">Consumables</p>
      {armed ? (
        <p class="minor-tray__armed script">next move doubled</p>
      ) : null}
      {held.length > 0 ? (
        <ul class="minor-tray__list">
          {held.map((m, i) => (
            <li key={`${m.id}-${i}`}>
              <button
                type="button"
                class="minor-tray__badge"
                style={{ "--card-panel": m.panelColor }}
                onClick={() => onUse(m)}
                title={`${m.name} — ${m.description}`}
              >
                <span class="minor-tray__numeral numeral">{m.numeral}</span>
                <span class="minor-tray__name">{m.name.replace(/^The /, "")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
