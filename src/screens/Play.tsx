import { useEffect } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { Board } from "../game/view/Board";
import { useGame, type GameMode } from "../state/game";
import { routes } from "../router";
import "./Play.css";

function modeFromQuery(search: string): GameMode {
  const params = new URLSearchParams(search);
  const m = params.get("mode");
  if (m === "free" || m === "spread" || m === "daily" || m === "querent") return m;
  return "free";
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

  const { score, moves, deadlocked, board, start, reset } = useGame();

  useEffect(() => {
    if (board.rows === 0 || useGame.getState().mode !== mode) {
      start(mode);
    }
  }, [mode, board.rows, start]);

  return (
    <main class="screen play stack" style={{ "--gap": "var(--space-4)" }}>
      <header class="play__head">
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Leave the reading"
          onClick={() => navigate(routes.home)}
        >
          ← Leave
        </button>
        <p class="eyebrow">{modeTitle[mode]}</p>
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Shuffle the deck"
          onClick={() => reset()}
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
          <span class="eyebrow">Readings</span>
          <span class="ledger-value tabular">{moves}</span>
        </div>
      </section>

      <Board />

      {deadlocked ? (
        <div class="play__deadlock" role="status">
          <p class="eyebrow">The Deck Has Frozen</p>
          <p>No legal swap remains.</p>
          <button type="button" class="btn btn--primary" onClick={() => reset()}>
            Reshuffle the deck
          </button>
        </div>
      ) : null}
    </main>
  );
}
