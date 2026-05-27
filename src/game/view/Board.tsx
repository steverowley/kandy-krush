import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../../state/game";
import { areAdjacent } from "../engine/board";
import type { Cell, Suit, Tile } from "../engine/types";
import { SuitGlyph, SUIT_COLORS } from "./suit-glyphs";
import "./Board.css";

/**
 * The Board renders each tile as an absolutely-positioned card keyed by
 * its stable `tile.id`. Because the engine carries ids across cascades,
 * Preact's reconciler keeps the DOM node for a surviving tile across
 * renders, and CSS transitions on `transform` make it slide visibly
 * between grid positions. New tiles fade in from above; dying tiles
 * unmount instantly (the next pass shows the refill).
 */
export function Board() {
  const { board, selected, busy, nudge, select, attemptSwap } = useGame();
  const [focus, setFocus] = useState<Cell>({ row: 0, col: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const prevPositionsRef = useRef<Map<number, { row: number; col: number }>>(
    new Map(),
  );

  // Capture each tile's previous (row, col) so a fresh entry can be
  // distinguished from a survivor. Survivors get transitions; entrants
  // get an entrance animation from one cell above their landing slot.
  const positions = new Map<number, { row: number; col: number }>();
  board.tiles.forEach((tile, idx) => {
    if (!tile) return;
    positions.set(tile.id, {
      row: Math.floor(idx / board.cols),
      col: idx % board.cols,
    });
  });

  useEffect(() => {
    prevPositionsRef.current = positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  useEffect(() => {
    if (nudge === 0) return;
    const el = document.querySelector<HTMLElement>(".tile-card--just-nudged");
    if (!el) return;
    el.classList.remove("tile-card--just-nudged");
    void el.offsetWidth;
    el.classList.add("tile-card--just-nudged");
  }, [nudge]);

  useEffect(() => {
    if (board.rows === 0 || !wrapRef.current) return;
    const idx = focus.row * board.cols + focus.col;
    const cells = wrapRef.current.querySelectorAll<HTMLElement>(".tile-card");
    const cell = cells[idx];
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
      case " ":
        e.preventDefault();
        onCellClick(focus);
        return;
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
        if (!tile) return null;
        const row = Math.floor(idx / board.cols);
        const col = idx % board.cols;
        const here: Cell = { row, col };
        const isSelected =
          !!selected && selected.row === row && selected.col === col;
        const isFocused = focus.row === row && focus.col === col;
        const prev = prevPositionsRef.current.get(tile.id);
        const isNew = !prev;
        return (
          <TileButton
            key={tile.id}
            tile={tile}
            row={row}
            col={col}
            isNew={isNew}
            isSelected={isSelected}
            isFocused={isFocused}
            busy={busy}
            onClick={() => onCellClick(here)}
            onFocus={() => setFocus(here)}
          />
        );
      })}
    </div>
  );
}

function TileButton({
  tile,
  row,
  col,
  isNew,
  isSelected,
  isFocused,
  busy,
  onClick,
  onFocus,
}: {
  tile: Tile;
  row: number;
  col: number;
  isNew: boolean;
  isSelected: boolean;
  isFocused: boolean;
  busy: boolean;
  onClick: () => void;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      class={`tile-card${isSelected ? " tile-card--selected" : ""}${
        busy ? " tile-card--busy" : ""
      }${isNew ? " tile-card--entering" : ""}`}
      role="gridcell"
      style={{
        "--tile-color": SUIT_COLORS[tile.suit],
        "--row": row,
        "--col": col,
      }}
      aria-label={`${suitLabel(tile.suit)} at row ${row + 1}, column ${col + 1}`}
      aria-pressed={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onClick={onClick}
      onFocus={onFocus}
    >
      <span class="tile-card__panel" aria-hidden="true" />
      <span class="tile-card__glyph" aria-hidden="true">
        <SuitGlyph suit={tile.suit} />
      </span>
    </button>
  );
}

function suitLabel(suit: Suit): string {
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}
