import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../../state/game";
import { areAdjacent } from "../engine/board";
import type { Cell, Suit } from "../engine/types";
import { SuitGlyph, SUIT_COLORS } from "./suit-glyphs";
import "./Board.css";

export function Board() {
  const { board, selected, busy, nudge, select, attemptSwap } = useGame();
  const [focus, setFocus] = useState<Cell>({ row: 0, col: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (nudge === 0) return;
    const el = document.querySelector<HTMLElement>(".tile-card--just-nudged");
    if (!el) return;
    el.classList.remove("tile-card--just-nudged");
    void el.offsetWidth;
    el.classList.add("tile-card--just-nudged");
  }, [nudge]);

  // Move DOM focus to the currently-focused cell so keyboard users see
  // where they are.
  useEffect(() => {
    if (board.rows === 0 || !wrapRef.current) return;
    const idx = focus.row * board.cols + focus.col;
    const cell = wrapRef.current.querySelectorAll<HTMLElement>(
      ".tile-card",
    )[idx];
    if (cell && document.activeElement?.closest(".board")) {
      cell.focus();
    }
  }, [focus.row, focus.col, board.rows, board.cols]);

  function onCellClick(cell: Cell) {
    setFocus(cell);
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

  function onKeyDown(e: KeyboardEvent) {
    if (board.rows === 0) return;
    let { row, col } = focus;
    switch (e.key) {
      case "ArrowUp":
        row = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        row = Math.min(board.rows - 1, row + 1);
        break;
      case "ArrowLeft":
        col = Math.max(0, col - 1);
        break;
      case "ArrowRight":
        col = Math.min(board.cols - 1, col + 1);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        onCellClick(focus);
        return;
      }
      case "Escape":
        select(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    setFocus({ row, col });
  }

  if (board.rows === 0) return null;

  return (
    <div
      ref={wrapRef}
      class="board"
      role="grid"
      aria-label="Match-three board. Arrow keys move, Enter swaps with the selected card."
      onKeyDown={onKeyDown}
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
        const isFocused = focus.row === row && focus.col === col;
        return (
          <button
            type="button"
            key={tile?.id ?? `e-${idx}`}
            class={`tile-card${isSelected ? " tile-card--selected" : ""}${
              busy ? " tile-card--busy" : ""
            }`}
            role="gridcell"
            style={{
              "--tile-color": tile ? SUIT_COLORS[tile.suit] : "var(--bone-200)",
            }}
            aria-label={`${suitLabel(tile?.suit)} at row ${row + 1}, column ${col + 1}`}
            aria-pressed={isSelected}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => onCellClick(here)}
            onFocus={() => setFocus(here)}
          >
            <span class="tile-card__panel" aria-hidden="true" />
            {tile ? (
              <span class="tile-card__glyph" aria-hidden="true">
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
