import { useEffect, useMemo } from "preact/hooks";
import { useGame } from "../../state/game";
import { areAdjacent } from "../engine/board";
import type { Cell, Suit } from "../engine/types";
import { SuitGlyph } from "./suit-glyphs";
import "./Board.css";

export function Board() {
  const { board, selected, busy, nudge, select, attemptSwap } = useGame();

  const cellSize = useMemo(() => {
    // Card grid fits within --board-size via CSS; nothing dynamic needed.
    return undefined;
  }, []);
  void cellSize;

  useEffect(() => {
    // Trigger a small shake on the selected cell when nudge increments.
    if (nudge === 0) return;
    const el = document.querySelector<HTMLElement>(".board__cell--just-nudged");
    if (!el) return;
    el.classList.remove("board__cell--just-nudged");
    void el.offsetWidth;
    el.classList.add("board__cell--just-nudged");
  }, [nudge]);

  function onCellClick(cell: Cell) {
    if (busy) return;
    if (!selected) {
      select(cell);
      return;
    }
    if (selected.row === cell.row && selected.col === cell.col) {
      select(null);
      return;
    }
    if (areAdjacent(selected, cell)) {
      attemptSwap(selected, cell);
      return;
    }
    // Non-adjacent: re-select instead of swap-fail.
    select(cell);
  }

  if (board.rows === 0) return null;

  return (
    <div
      class="board"
      role="grid"
      aria-label="Match-three board"
      style={{
        "--board-rows": board.rows,
        "--board-cols": board.cols,
      }}
    >
      {board.tiles.map((tile, idx) => {
        const row = Math.floor(idx / board.cols);
        const col = idx % board.cols;
        const here: Cell = { row, col };
        const isSelected =
          !!selected && selected.row === row && selected.col === col;
        const isBusy = busy;
        return (
          <button
            type="button"
            key={tile?.id ?? `e-${idx}`}
            class={`board__cell board__cell--${tile?.suit ?? "empty"}${
              isSelected ? " board__cell--selected" : ""
            }${isBusy ? " board__cell--busy" : ""}`}
            data-suit={tile?.suit}
            aria-label={`${suitLabel(tile?.suit)} at row ${row + 1}, column ${col + 1}`}
            aria-pressed={isSelected}
            onClick={() => onCellClick(here)}
          >
            <span class="board__cell-frame" aria-hidden="true" />
            {tile ? (
              <SuitGlyph suit={tile.suit} class="board__cell-glyph" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function suitLabel(suit: Suit | undefined): string {
  if (!suit) return "empty cell";
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}
