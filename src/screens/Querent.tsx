import { useLocation } from "wouter-preact";
import type { ComponentChildren } from "preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";
import {
  CHAMBERS,
  CHAMBER_COUNT,
  CLASSES,
  chamberByIndex,
  chamberMovesFor,
  classById,
  type QuerentClass,
  type Chamber,
} from "../game/querent";
import { useQuerent } from "../state/querent";
import { useResume } from "../state/resume";
import { STAKES, stakeById } from "../game/stakes";
import "./Querent.css";

export function Querent() {
  const [, navigate] = useLocation();
  const run = useQuerent((s) => s.run);
  const meta = useQuerent((s) => s.meta);
  const beginRun = useQuerent((s) => s.beginRun);
  const abandonRun = useQuerent((s) => s.abandonRun);
  const isUnlocked = useQuerent((s) => s.isUnlocked);
  const setStake = useQuerent((s) => s.setStake);
  const currentStake = stakeById(meta.currentStakeId) ?? STAKES[0]!;
  const maxStake = stakeById(meta.maxStakeId) ?? STAKES[0]!;

  if (run) {
    return (
      <RunInProgress
        navigate={navigate}
        runClassId={run.classId}
        onAbandon={() => {
          useResume.getState().clearAllForMode("querent");
          abandonRun();
        }}
      />
    );
  }

  return (
    <main class="screen querent">
      <header class="querent__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="querent__title">
          <p class="eyebrow">Book Three · El Camino</p>
          <h1>
            The <em>Querent's</em> Path
          </h1>
          <p class="script querent__sub">choose your class · walk the line</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <section class="querent__meta" aria-label="Path memory">
        <Stat label="Runs completed" value={meta.runsCompleted.toString()} />
        <Stat label="Deepest chamber" value={`${meta.bestDepth} / ${CHAMBER_COUNT}`} />
        <Stat label="Insight" value={meta.insight.toLocaleString()} />
      </section>

      <section class="querent__stakes" aria-label="Stake">
        <header class="querent__stakes-head">
          <p class="eyebrow">Stake</p>
          <p class="querent__stakes-current script">
            {currentStake.name.toLowerCase()} · {currentStake.flavor}
          </p>
        </header>
        <ul class="querent__stakes-list">
          {STAKES.map((s) => {
            const unlocked = s.tier <= maxStake.tier;
            const selected = s.id === currentStake.id;
            const rec = meta.records[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  class={`querent__stake-chip${selected ? " querent__stake-chip--selected" : ""}${
                    unlocked ? "" : " querent__stake-chip--locked"
                  }`}
                  style={{ "--card-panel": s.panelColor }}
                  disabled={!unlocked}
                  onClick={() => setStake(s.id)}
                  aria-pressed={selected}
                  aria-label={`${s.name} stake${unlocked ? "" : " (sealed)"}`}
                  title={
                    unlocked
                      ? rec && rec.bestScore > 0
                        ? `${s.name} — ${formatStakeEffect(s)} · Best ${rec.bestScore.toLocaleString()} · ${rec.runsCompleted} ${rec.runsCompleted === 1 ? "clear" : "clears"}`
                        : `${s.name} — ${formatStakeEffect(s)}`
                      : "Sealed — clear a run at the prior stake to unlock"
                  }
                >
                  <span class="querent__stake-numeral numeral">{toRoman(s.tier + 1)}</span>
                  <span class="querent__stake-name">{s.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="querent__classes" aria-label="Classes">
        {CLASSES.map((klass) => {
          const unlocked = isUnlocked(klass.id);
          return (
            <TarotCard
              key={klass.id}
              numeral={klass.numeral}
              panelName={klass.panelName}
              panelCaption={klass.panelCaption}
              headline={klass.name.replace(/^The /, "")}
              script={klass.id}
              subtitle={klass.subtitle}
              panelColor={klass.panelColor}
              figure={<ClassFigure id={klass.id} />}
              className={unlocked ? "" : "card--disabled"}
              footer={
                <>
                  <p class="querent-class__body">{klass.body}</p>
                  <button
                    type="button"
                    class="btn btn--on-card btn--primary"
                    disabled={!unlocked}
                    onClick={() => {
                      beginRun(klass.id);
                      navigate(`${routes.play}?mode=querent&chamber=1`);
                    }}
                  >
                    {unlocked ? "Walk this path" : "Sealed"}
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

function RunInProgress({
  navigate,
  runClassId,
  onAbandon,
}: {
  navigate: (to: string) => void;
  runClassId: QuerentClass["id"];
  onAbandon: () => void;
}) {
  const run = useQuerent((s) => s.run)!;
  const klass = classById(runClassId)!;

  return (
    <main class="screen querent">
      <header class="querent__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="querent__title">
          <p class="eyebrow">Run in progress · {klass.name}</p>
          <h1>
            <em>The Path</em>
          </h1>
          <p class="script querent__sub">{run.chamberIndex} of {CHAMBER_COUNT}</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <section class="querent__meta" aria-label="Run status">
        <Stat label="Chamber" value={`${run.chamberIndex} / ${CHAMBER_COUNT}`} />
        <Stat label="Fortune so far" value={run.totalScore.toLocaleString()} />
        <Stat label="Chambers cleared" value={run.cleared.toString()} />
      </section>

      <section class="querent__chambers" aria-label="Chambers">
        {CHAMBERS.map((ch) => {
          const status =
            ch.index < run.chamberIndex
              ? "past"
              : ch.index === run.chamberIndex
                ? "current"
                : "future";
          return (
            <TarotCard
              key={ch.index}
              numeral={ch.numeral}
              panelName={ch.name}
              panelCaption={ch.epigraph}
              headline={ch.name.replace(/^The /, "")}
              script={ch.name.toLowerCase().replace(/^the /, "")}
              subtitle={
                ch.restriction
                  ? `${formatObjective(ch)} · ${chamberMovesFor(ch, klass)} readings · ${ch.restriction.name}`
                  : `${formatObjective(ch)} · ${chamberMovesFor(ch, klass)} readings`
              }
              panelColor={ch.panelColor}
              figure={<ChamberFigure index={ch.index} />}
              className={`chamber chamber--${status}${ch.boss ? " chamber--boss" : ""}`}
              footer={
                status === "current" ? (
                  <button
                    type="button"
                    class="btn btn--on-card btn--primary"
                    onClick={() =>
                      navigate(`${routes.play}?mode=querent&chamber=${ch.index}`)
                    }
                  >
                    {ch.boss ? "Face the Arcanum" : "Enter"}
                  </button>
                ) : status === "past" ? (
                  <span class="chamber__badge eyebrow">Cleared</span>
                ) : (
                  <span class="chamber__badge eyebrow">Sealed</span>
                )
              }
            />
          );
        })}
      </section>

      <div class="querent__abandon">
        <button type="button" class="btn btn--ghost" onClick={onAbandon}>
          Abandon this path
        </button>
      </div>
    </main>
  );
}

function formatObjective(ch: Chamber | NonNullable<ReturnType<typeof chamberByIndex>>): string {
  const o = ch.objective;
  const mult = ch.restriction?.targetMultiplier ?? 1;
  if (o.type === "score") {
    const adjusted = Math.round(o.target * mult);
    return `Reach ${adjusted.toLocaleString()} fortune`;
  }
  return `Clear ${o.target} ${capitalize(o.suit)}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatStakeEffect(stake: { targetMultiplier: number; moveDelta: number }): string {
  if (stake.targetMultiplier === 1 && stake.moveDelta === 0) return "baseline";
  const parts: string[] = [];
  if (stake.targetMultiplier !== 1) {
    parts.push(`targets ×${stake.targetMultiplier.toFixed(2)}`);
  }
  if (stake.moveDelta !== 0) {
    parts.push(`${stake.moveDelta > 0 ? "+" : ""}${stake.moveDelta} readings`);
  }
  return parts.join(" · ");
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
function toRoman(n: number): string {
  return ROMAN[n - 1] ?? n.toString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div class="stat">
      <span class="eyebrow">{label}</span>
      <span class="stat__value tabular">{value}</span>
    </div>
  );
}

// ── Class figures ────────────────────────────────────────────────────

function ClassFigure({ id }: { id: QuerentClass["id"] }): ComponentChildren {
  if (id === "seer") {
    return (
      <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
        {/* All-seeing eye in a triangle */}
        <path d="M60 18l42 72H18z" />
        <ellipse cx="60" cy="68" rx="20" ry="12" fill="var(--card-panel, transparent)" />
        <circle cx="60" cy="68" r="6" />
        <circle cx="60" cy="68" r="2.5" fill="var(--card-panel, transparent)" />
      </svg>
    );
  }
  if (id === "maker") {
    return (
      <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
        {/* Hand holding a flame */}
        <path d="M44 110c-6 0-12-4-12-12V60c0-5 4-8 8-8s8 3 8 8v18h2V46c0-5 4-8 8-8s8 3 8 8v32h2V52c0-5 4-8 8-8s8 3 8 8v36h2V60c0-4 3-7 7-7s7 3 7 9v32c0 8-6 14-14 14H44z" />
        <path d="M60 24c4 8 10 12 10 22a10 10 0 0 1-20 0c0-10 6-14 10-22z" />
        <path
          d="M60 36c2 4 4 6 4 10a4 4 0 0 1-8 0c0-4 2-6 4-10z"
          fill="var(--card-panel, transparent)"
        />
      </svg>
    );
  }
  // walker
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Path with steps + tiny figure */}
      <path d="M22 110l8-16h12l8-16h12l8-16h12l8-16h12v8h-8l-8 16h-12l-8 16h-12l-8 16H30l-8 16z" />
      <circle cx="86" cy="40" r="6" />
      <path d="M80 50h12v18H80z" />
      <path d="M76 70l4-2 4 4 4-4 4 2" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
    </svg>
  );
}

// ── Chamber figures (lightweight; the rich illustrations are placeholders
// for now, each chamber gets a distinct silhouette so they're not all
// identical on the deck view) ───────────────────────────────────────

function ChamberFigure({ index }: { index: number }): ComponentChildren {
  switch (index) {
    case 1: // Hermit — lantern
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <rect x="50" y="40" width="20" height="40" />
          <rect x="44" y="34" width="32" height="8" />
          <rect x="48" y="80" width="24" height="6" />
          <rect x="58" y="18" width="4" height="20" />
          <circle cx="60" cy="14" r="6" />
          <rect x="58" y="86" width="4" height="36" />
          <circle cx="60" cy="60" r="4" fill="var(--card-panel, transparent)" />
        </svg>
      );
    case 2: // Wheel — spoked circle
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <circle cx="60" cy="70" r="30" />
          <circle cx="60" cy="70" r="20" fill="var(--card-panel, transparent)" />
          <circle cx="60" cy="70" r="4" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * 6}
                y1={70 + Math.sin(a) * 6}
                x2={60 + Math.cos(a) * 28}
                y2={70 + Math.sin(a) * 28}
                stroke="currentColor"
                stroke-width="3"
              />
            );
          })}
        </svg>
      );
    case 3: // Justice — scales
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <rect x="58" y="20" width="4" height="80" />
          <path d="M20 50h80" stroke="currentColor" stroke-width="3" fill="none" />
          <path d="M30 50l-8 16h16z" />
          <path d="M90 50l-8 16h16z" />
          <rect x="40" y="100" width="40" height="6" />
        </svg>
      );
    case 4: // Hanged Man — inverted figure
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <rect x="34" y="14" width="52" height="4" />
          <rect x="58" y="14" width="4" height="20" />
          <circle cx="60" cy="40" r="8" />
          <rect x="56" y="48" width="8" height="32" />
          <path d="M52 80l-12 24m20-24l12 24" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" />
        </svg>
      );
    case 5: // Death — skull + scythe
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <ellipse cx="48" cy="56" rx="22" ry="20" />
          <rect x="40" y="74" width="16" height="6" />
          <circle cx="42" cy="58" r="4" fill="var(--card-panel, transparent)" />
          <circle cx="54" cy="58" r="4" fill="var(--card-panel, transparent)" />
          <rect x="78" y="22" width="4" height="100" transform="rotate(8 80 72)" />
          <path d="M82 22l16 18-22 4z" />
        </svg>
      );
    case 6: // Temperance — pouring vessel
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <path d="M38 28h22l4 24a14 14 0 0 1-30 0z" />
          <path d="M60 50c10 8 18 12 18 24" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" />
          <path d="M62 110a22 22 0 0 0 32 0c-4-14-12-22-32-32z" />
        </svg>
      );
    case 7: // Devil — horned silhouette
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <path d="M40 18c4 6 6 12 8 18c8-4 16-4 24 0c2-6 4-12 8-18l-4 22a18 18 0 0 1-32 0z" />
          <ellipse cx="60" cy="58" rx="20" ry="14" />
          <circle cx="52" cy="56" r="3" fill="var(--card-panel, transparent)" />
          <circle cx="68" cy="56" r="3" fill="var(--card-panel, transparent)" />
          <path d="M50 76l10-4 10 4" stroke="var(--card-panel, transparent)" stroke-width="3" fill="none" />
          <rect x="44" y="78" width="32" height="36" />
        </svg>
      );
    case 8: // Tower — crumbling tower
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <rect x="42" y="20" width="36" height="100" />
          <path d="M42 14h36v8H42z" />
          <path d="M52 30l-8 8 8 8M68 50l8 8-8 8M52 68l-8 8 8 8" stroke="var(--card-panel, transparent)" stroke-width="4" fill="none" stroke-linecap="round" />
          <path d="M30 8l8 12-4 4-8-12z" />
          {/* Falling debris */}
          <circle cx="22" cy="100" r="4" />
          <circle cx="96" cy="106" r="3" />
        </svg>
      );
    case 9: // Star — radiant figure
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <path d="M60 14l8 22 22 4-16 16 4 22-18-12-18 12 4-22-16-16 22-4z" />
          {[
            [22, 80],
            [98, 80],
            [38, 110],
            [82, 110],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
          ))}
        </svg>
      );
    case 10: // Moon — crescent with two pillars
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <path d="M70 28a32 32 0 1 0 0 64a26 26 0 1 1 0-64z" />
          <rect x="24" y="80" width="10" height="36" />
          <rect x="86" y="80" width="10" height="36" />
          <path d="M40 110h40v6H40z" />
        </svg>
      );
    case 11: // Sun — radiant disc
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <circle cx="60" cy="70" r="20" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * 26}
                y1={70 + Math.sin(a) * 26}
                x2={60 + Math.cos(a) * 38}
                y2={70 + Math.sin(a) * 38}
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
              />
            );
          })}
        </svg>
      );
    case 12: // Judgement — horn over a circle
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <path d="M20 30l60 18-60 18z" />
          <circle cx="86" cy="48" r="6" fill="var(--card-panel, transparent)" />
          <rect x="40" y="78" width="40" height="40" />
          <path d="M30 100l60 0" stroke="var(--card-panel, transparent)" stroke-width="3" fill="none" />
        </svg>
      );
    case 13: // World — laurel ring around an orb
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <circle cx="60" cy="70" r="34" />
          <circle cx="60" cy="70" r="22" fill="var(--card-panel, transparent)" />
          <circle cx="60" cy="70" r="10" />
          {[
            [60, 28],
            [60, 112],
            [22, 70],
            [98, 70],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
          ))}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          <circle cx="60" cy="70" r="24" />
        </svg>
      );
  }
}
