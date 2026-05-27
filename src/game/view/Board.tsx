import { useEffect } from "preact/hooks";
import { useGame } from "../../state/game";
import { areAdjacent } from "../engine/board";
import type { Cell, Suit } from "../engine/types";
import { SuitGlyph, SUIT_COLORS } from "./suit-glyphs";
import "./Board.css";

export function Board() {
  const { board, selected, busy, nudge, select, attemptSwap } = useGame();

  useEffect(() => {
    if (nudge === 0) return;
    const el = document.querySelector<HTMLElement>(".tile-card--just-nudged");
    if (!el) return;
    el.classList.remove("tile-card--just-nudged");
    void el.offsetWidth;
    el.classList.add("tile-card--just-nudged");
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
        return (
          <button
            type="button"
            key={tile?.id ?? `e-${idx}`}
            class={`tile-card${isSelected ? " tile-card--selected" : ""}${
              busy ? " tile-card--busy" : ""
            }`}
            style={{
              "--tile-color": tile ? SUIT_COLORS[tile.suit] : "var(--bone-200)",
            }}
            aria-label={`${suitLabel(tile?.suit)} at row ${row + 1}, column ${col + 1}`}
            aria-pressed={isSelected}
            onClick={() => onCellClick(here)}
          >
            <span class="tile-card__panel" aria-hidden="true" />
            {tile ? (
              <span class="tile-card__glyph">
                <SuitGlyph suit={tile.suit} />
              </span>
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
