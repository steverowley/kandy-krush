import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useGame } from "../../state/game";
import { areAdjacent, inBounds, obscuredRevealSet } from "../engine/board";
import type { Board as BoardState, Cell, Suit, Tile } from "../engine/types";
import { SuitGlyph, SUIT_COLORS } from "./suit-glyphs";
import "./Board.css";

/**
 * The Board renders each tile as an absolutely-positioned card keyed by
 * its stable `tile.id`. Two input affordances:
 *
 *   - Tap a tile, then tap an adjacent neighbour, to swap.
 *   - Press and drag a tile in one of the four cardinal directions; if
 *     the displacement clears the swap threshold, the tile trades with
 *     the neighbour in that direction.
 *
 * Drag wins when the pointer movement exceeds DRAG_THRESHOLD px;
 * otherwise the gesture is treated as a click and the tap flow runs.
 */

const DRAG_THRESHOLD = 18;

type Drag = {
  cell: Cell;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
};

export function Board() {
  const { board, restriction, selected, busy, nudge, select, attemptSwap, lastClearedCells } =
    useGame();
  const lastMoveTick = useGame((s) => s.lastMove.tick);
  const targetingMode = useGame((s) => s.targetingMode);
  const pickTarget = useGame((s) => s.pickTarget);
  const cancelTargeting = useGame((s) => s.cancelTargeting);
  const [focus, setFocus] = useState<Cell>({ row: 0, col: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const prevPositionsRef = useRef<Map<number, { row: number; col: number }>>(
    new Map(),
  );
  // Tracks which tile ids were already wilds last render. When a tile
  // freshly becomes a wild (match-5+ promotion preserves the id), we
  // briefly pulse the halo around it for the first render after the
  // transition.
  const prevWildIdsRef = useRef<Set<number>>(new Set());
  const currentWildIds = new Set<number>();
  for (const t of board.tiles) {
    if (t && t.kind === "wild") currentWildIds.add(t.id);
  }
  const justPlantedWildIds = new Set<number>();
  for (const id of currentWildIds) {
    if (!prevWildIdsRef.current.has(id)) justPlantedWildIds.add(id);
  }
  useEffect(() => {
    prevWildIdsRef.current = currentWildIds;
  });

  // Moon boss restriction: tiles render face-down until adjacent to a
  // wild. The reveal set recomputes any time the board changes — cheap
  // (O(rows × cols)) and the engine state stays untouched.
  const revealSet = useMemo(() => {
    if (!restriction?.obscureUntilAdjacentTo) return null;
    return obscuredRevealSet(board, restriction.obscureUntilAdjacentTo);
  }, [board, restriction?.obscureUntilAdjacentTo]);

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

  function tapClick(cell: Cell) {
    setFocus(cell);
    // Targeting mode: route taps to pickTarget; ignore busy/select gates.
    if (targetingMode) {
      pickTarget(cell);
      return;
    }
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

  function onPointerDown(e: PointerEvent, cell: Cell) {
    if (busy) return;
    // Only respond to primary pointer.
    if (e.button !== undefined && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({
      cell,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
    });
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dx, dy });
  }

  function onPointerUp(e: PointerEvent, cell: Cell) {
    // In targeting mode, taps always go through tapClick — drags
    // shouldn't trigger a swap when the board's being used as a picker.
    if (targetingMode) {
      setDrag(null);
      tapClick(cell);
      return;
    }
    if (!drag || drag.pointerId !== e.pointerId) {
      tapClick(cell);
      return;
    }
    const { dx, dy } = drag;
    const settled = drag.cell;
    setDrag(null);

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < DRAG_THRESHOLD) {
      tapClick(settled);
      return;
    }

    let target: Cell;
    if (absX > absY) {
      target = { row: settled.row, col: settled.col + (dx > 0 ? 1 : -1) };
    } else {
      target = { row: settled.row + (dy > 0 ? 1 : -1), col: settled.col };
    }
    if (!inBounds(board, target)) {
      tapClick(settled);
      return;
    }
    attemptSwap(settled, target);
  }

  function onPointerCancel() {
    setDrag(null);
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
        tapClick(focus);
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

  // Compute the constrained drag offset for visual feedback — only
  // the dominant axis carries, so the card reads as snapping to a
  // direction rather than sliding diagonally.
  let dragDx = 0;
  let dragDy = 0;
  if (drag) {
    const absX = Math.abs(drag.dx);
    const absY = Math.abs(drag.dy);
    if (absX > absY) dragDx = Math.max(-60, Math.min(60, drag.dx));
    else dragDy = Math.max(-60, Math.min(60, drag.dy));
  }

  return (
    <>
      {targetingMode ? (
        <div class="board__targeting-banner" role="status" aria-live="polite">
          <p class="eyebrow">
            {targetingMode.kind === "destroy"
              ? "Mark for destruction"
              : "Mark to promote"}
          </p>
          <p class="script">
            {targetingMode.kind === "destroy"
              ? `Tap ${targetingMode.needed - targetingMode.selected.length} more tile${targetingMode.needed - targetingMode.selected.length === 1 ? "" : "s"} to cut`
              : "Tap one tile to make it a wild"}
          </p>
          <button
            type="button"
            class="btn btn--ghost board__targeting-cancel"
            onClick={cancelTargeting}
          >
            Cancel
          </button>
        </div>
      ) : null}
      <div
        ref={wrapRef}
        class="board"
        role="grid"
        aria-label="Match-three board. Arrow keys move, Enter swaps with the selected card. Drag a card in any direction to swap with its neighbour."
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
        const targetingSelected =
          targetingMode?.selected.some(
            (c) => c.row === row && c.col === col,
          ) ?? false;
        const isSelected =
          targetingSelected ||
          (!!selected && selected.row === row && selected.col === col);
        const isFocused = focus.row === row && focus.col === col;
        const prev = prevPositionsRef.current.get(tile.id);
        const isNew = !prev;
        const isDragging =
          drag !== null && drag.cell.row === row && drag.cell.col === col;
        const obscured = revealSet !== null && !revealSet.has(idx);
        const justPlantedWild = justPlantedWildIds.has(tile.id);
        return (
          <TileButton
            key={tile.id}
            tile={tile}
            row={row}
            col={col}
            isNew={isNew}
            isSelected={isSelected}
            isFocused={isFocused}
            isDragging={isDragging}
            dragDx={isDragging ? dragDx : 0}
            dragDy={isDragging ? dragDy : 0}
            obscured={obscured}
            justPlantedWild={justPlantedWild}
            busy={busy}
            onPointerDown={(e) => onPointerDown(e, here)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, here)}
            onPointerCancel={onPointerCancel}
            onFocus={() => setFocus(here)}
          />
        );
      })}
      <ParticleLayer
        cells={lastClearedCells}
        tick={lastMoveTick}
        board={board}
      />
      </div>
    </>
  );
}

function TileButton({
  tile,
  row,
  col,
  isNew,
  isSelected,
  isFocused,
  isDragging,
  dragDx,
  dragDy,
  obscured,
  justPlantedWild,
  busy,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onFocus,
}: {
  tile: Tile;
  row: number;
  col: number;
  isNew: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDragging: boolean;
  dragDx: number;
  dragDy: number;
  obscured: boolean;
  justPlantedWild: boolean;
  busy: boolean;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      class={`tile-card${isSelected ? " tile-card--selected" : ""}${
        busy ? " tile-card--busy" : ""
      }${isNew ? " tile-card--entering" : ""}${isDragging ? " tile-card--dragging" : ""}${
        tile.kind === "spark" ? " tile-card--spark" : ""
      }${tile.kind === "wild" ? " tile-card--wild" : ""}${obscured ? " tile-card--obscured" : ""}${justPlantedWild ? " tile-card--wild-just-planted" : ""}`}
      role="gridcell"
      style={{
        "--tile-color": SUIT_COLORS[tile.suit],
        "--row": row,
        "--col": col,
        "--drag-x": `${dragDx}px`,
        "--drag-y": `${dragDy}px`,
      }}
      aria-label={obscured ? `Hidden tile at row ${row + 1}, column ${col + 1}` : tileAriaLabel(tile, row, col)}
      aria-pressed={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onFocus={onFocus}
    >
      {obscured ? (
        <span class="tile-card__back" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.85" />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <line
                key={deg}
                x1="12"
                y1="12"
                x2="12"
                y2="3"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                opacity="0.6"
                transform={`rotate(${deg} 12 12)`}
              />
            ))}
          </svg>
        </span>
      ) : (
        <>
          <span class="tile-card__panel" aria-hidden="true" />
          <span class="tile-card__glyph" aria-hidden="true">
            {tile.kind === "wild" ? <WildGlyph /> : <SuitGlyph suit={tile.suit} />}
          </span>
          {tile.kind === "spark" ? (
            <span class="tile-card__spark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 6.6L21 9l-5 4.3L17.6 20 12 16.8 6.4 20 8 13.3 3 9l6.6-.4z" />
              </svg>
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

function suitLabel(suit: Suit): string {
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}

function tileAriaLabel(tile: Tile, row: number, col: number): string {
  const pos = `at row ${row + 1}, column ${col + 1}`;
  if (tile.kind === "wild") return `Wild card ${pos}`;
  if (tile.kind === "spark") return `Spark of ${suitLabel(tile.suit)} ${pos}`;
  return `${suitLabel(tile.suit)} ${pos}`;
}

function WildGlyph() {
  // Four-point compass of small suit dots — reads as "any suit".
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="4" r="2.6" />
      <circle cx="12" cy="20" r="2.6" />
      <circle cx="4" cy="12" r="2.6" />
      <circle cx="20" cy="12" r="2.6" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  );
}

/** Cascade-step particles — emitted from the cells cleared on the most
 *  recent move. Caps at 8 dots to keep the GPU happy; if more cells
 *  cleared than that, picks a deterministic slice. Re-renders on every
 *  `tick` change (one per scored move), so the CSS animation re-fires
 *  cleanly. */
function ParticleLayer({
  cells,
  tick,
  board,
}: {
  cells: readonly Cell[];
  tick: number;
  board: BoardState;
}) {
  // Look up each cell's recent suit color via the current board. The
  // tile is gone at this point (refilled), but the index resolves to
  // whatever's there now — close enough for a small dot that fades.
  if (tick === 0 || cells.length === 0) return null;
  const MAX = 8;
  const step = Math.max(1, Math.floor(cells.length / MAX));
  const sampled: Cell[] = [];
  for (let i = 0; i < cells.length && sampled.length < MAX; i += step) {
    sampled.push(cells[i]!);
  }
  return (
    <div class="board__particles" key={tick} aria-hidden="true">
      {sampled.map((c, i) => {
        const idx = c.row * board.cols + c.col;
        const t = board.tiles[idx];
        const color = t
          ? SUIT_COLORS[t.suit as Suit]
          : "var(--accent-gold)";
        return (
          <span
            key={`${tick}-${i}`}
            class="board__particle"
            style={{
              "--row": c.row,
              "--col": c.col,
              "--particle-color": color,
            }}
          />
        );
      })}
    </div>
  );
}
