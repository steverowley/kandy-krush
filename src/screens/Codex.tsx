import { useEffect, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { LEVELS } from "../game/levels";
import { CHAMBER_COUNT, CHAMBERS, CLASSES } from "../game/querent";
import { STAKES, stakeById } from "../game/stakes";
import { buildShareText } from "../game/share";
import { useSpread } from "../state/spread";
import { useDaily } from "../state/daily";
import { useQuerent } from "../state/querent";
import "./Codex.css";

type ShareStatus = "idle" | "copied" | "error";

/**
 * The Codex — a single screen that aggregates the player's progress
 * across every mode. Read-only, no live game state. Useful both as a
 * "what have I done" view and as a future telemetry surface.
 */
export function Codex() {
  const [, navigate] = useLocation();
  const spreadStars = useSpread((s) => s.stars);
  const dailyRuns = useDaily((s) => s.runs);
  const querentMeta = useQuerent((s) => s.meta);

  const spreadTotalStars = Object.values(spreadStars).reduce<number>(
    (a, b) => a + b,
    0,
  );
  const spreadPossibleStars = LEVELS.length * 3;
  const dailyHistory = Object.values(dailyRuns)
    .filter((r) => r.outcome !== "in-progress")
    .sort((a, b) => (a.key < b.key ? 1 : -1));
  const dailyTotalScore = dailyHistory.reduce((a, b) => a + b.finalScore, 0);
  const maxStakeTier = stakeById(querentMeta.maxStakeId)?.tier ?? 0;

  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (shareStatus === "idle") return;
    const t = setTimeout(() => setShareStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [shareStatus]);

  async function copyShareText() {
    const text = buildShareText({
      spreadStars,
      querentMeta,
      dailyRuns: Object.values(dailyRuns),
    });
    if (!navigator.clipboard?.writeText) {
      setShareStatus("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  return (
    <main class="screen codex">
      <header class="codex__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="codex__title">
          <p class="eyebrow">The Codex</p>
          <h1>
            <em>Memory</em> of Readings
          </h1>
          <p class="script codex__sub">what you have seen so far</p>
        </div>
        <div class="codex__share">
          <button
            type="button"
            class="btn btn--ghost"
            onClick={copyShareText}
            aria-describedby="codex-share-status"
          >
            Share ↗
          </button>
          <span
            id="codex-share-status"
            class={`codex__share-status codex__share-status--${shareStatus}`}
            role="status"
            aria-live="polite"
          >
            {shareStatus === "copied"
              ? "Copied to clipboard"
              : shareStatus === "error"
                ? "Copy unavailable"
                : ""}
          </span>
        </div>
      </header>

      <div class="rule rule--double" aria-hidden="true" />

      <section class="codex__row" aria-labelledby="codex-spread">
        <header class="codex__row-head">
          <p class="eyebrow">Book Two</p>
          <h2 id="codex-spread">The Spread</h2>
          <p class="codex__row-stat tabular">
            {spreadTotalStars} / {spreadPossibleStars} stars
          </p>
        </header>
        <ul class="codex__list" role="list">
          {LEVELS.map((lvl) => {
            const stars = spreadStars[lvl.id] ?? 0;
            return (
              <li key={lvl.id} class="codex__entry">
                <span class="numeral codex__entry-numeral">{lvl.numeral}</span>
                <span class="codex__entry-name">{lvl.name}</span>
                <span class="codex__entry-stars" aria-label={`${stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      class={`codex__pip ${stars >= n ? "codex__pip--lit" : ""}`}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="codex__row" aria-labelledby="codex-querent">
        <header class="codex__row-head">
          <p class="eyebrow">Book Three</p>
          <h2 id="codex-querent">The Querent's Path</h2>
          <p class="codex__row-stat tabular">
            depth {querentMeta.bestDepth} / {CHAMBER_COUNT} ·{" "}
            {querentMeta.runsCompleted} runs ·{" "}
            {querentMeta.insight.toLocaleString()} insight
          </p>
        </header>
        <div class="codex__sub-grid">
          <div>
            <p class="eyebrow">Classes</p>
            <ul class="codex__list" role="list">
              {CLASSES.map((c) => {
                const unlocked = querentMeta.unlocked.includes(c.id);
                return (
                  <li
                    key={c.id}
                    class={`codex__entry ${unlocked ? "" : "codex__entry--locked"}`}
                  >
                    <span class="numeral codex__entry-numeral">{c.numeral}</span>
                    <span class="codex__entry-name">{c.name}</span>
                    <span class="codex__entry-stars eyebrow">
                      {unlocked ? "Open" : "Sealed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p class="eyebrow">Deepest chambers</p>
            <ul class="codex__list" role="list">
              {CHAMBERS.map((ch) => {
                const reached = querentMeta.bestDepth >= ch.index;
                return (
                  <li
                    key={ch.index}
                    class={`codex__entry ${reached ? "" : "codex__entry--locked"}`}
                  >
                    <span class="numeral codex__entry-numeral">{ch.numeral}</span>
                    <span class="codex__entry-name">{ch.name}</span>
                    <span
                      class="codex__entry-stars eyebrow"
                      style={
                        ch.boss && reached
                          ? { color: "var(--panel-gold)" }
                          : undefined
                      }
                    >
                      {reached ? (ch.boss ? "Faced" : "Reached") : "Sealed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section class="codex__row" aria-labelledby="codex-stakes">
        <header class="codex__row-head">
          <p class="eyebrow">Book Three · Stakes</p>
          <h2 id="codex-stakes">Per-stake bests</h2>
          <p class="codex__row-stat tabular">
            {maxStakeTier + 1} / {STAKES.length} unlocked
          </p>
        </header>
        <ul class="codex__stakes-grid" role="list">
          {STAKES.map((s) => {
            const unlocked = s.tier <= maxStakeTier;
            const rec = querentMeta.records[s.id];
            return (
              <li
                key={s.id}
                class={`codex__stake${unlocked ? "" : " codex__stake--locked"}${
                  rec?.cleared ? " codex__stake--cleared" : ""
                }`}
                style={{ "--card-panel": s.panelColor }}
                aria-label={`${s.name} stake${unlocked ? "" : " (sealed)"}`}
              >
                <p class="codex__stake-name">{s.name}</p>
                {unlocked ? (
                  <dl class="codex__stake-stats">
                    <div>
                      <dt class="eyebrow">Best</dt>
                      <dd class="tabular">
                        {(rec?.bestScore ?? 0).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt class="eyebrow">Depth</dt>
                      <dd class="tabular">
                        {rec?.bestDepth ?? 0} / {CHAMBER_COUNT}
                      </dd>
                    </div>
                    <div>
                      <dt class="eyebrow">Clears</dt>
                      <dd class="tabular">{rec?.runsCompleted ?? 0}</dd>
                    </div>
                  </dl>
                ) : (
                  <p class="codex__stake-sealed eyebrow">Sealed</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section class="codex__row" aria-labelledby="codex-daily">
        <header class="codex__row-head">
          <p class="eyebrow">Book Three</p>
          <h2 id="codex-daily">Daily Draw</h2>
          <p class="codex__row-stat tabular">
            {dailyHistory.length} days · {dailyTotalScore.toLocaleString()} fortune
          </p>
        </header>
        {dailyHistory.length === 0 ? (
          <p class="codex__empty">No daily readings yet.</p>
        ) : (
          <ul class="codex__list" role="list">
            {dailyHistory.slice(0, 30).map((r) => (
              <li key={r.key} class="codex__entry">
                <span class="codex__entry-numeral tabular">{r.key}</span>
                <span class="codex__entry-name">
                  {r.outcome === "won" ? "Settled" : "Broken"}
                </span>
                <span class="codex__entry-stars tabular">
                  {r.finalScore.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
