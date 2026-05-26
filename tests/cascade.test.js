// Cascade / gravity tests — exercises src/game/cascade.js's applyGravity.
//
// applyGravity is the engine that makes match-3 feel right. After a
// match clears tiles, every remaining tile above falls down to occupy
// the gaps, then the top of each column gets fresh random tiles. Every
// frame the player sees, every cascade chain, every new specials birth
// depends on this function being correct.
//
// Run with: node --test tests/cascade.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, makeCell } from '../src/game/board.js';
import { applyGravity } from '../src/game/cascade.js';

// Helper: build a tiny board with known contents.
function makeBoard(grid, candyTypes = 4) {
  // grid is array-of-arrays, row 0 is top. Each cell is a type number
  // or null. The Board class stores row 0 at indexes 0..cols-1.
  const rows = grid.length;
  const cols = grid[0].length;
  const b = new Board(cols, rows, candyTypes);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) b.setType(c, r, grid[r][c]);
    }
  }
  return b;
}

function toGrid(board) {
  const out = [];
  for (let r = 0; r < board.rows; r++) {
    const row = [];
    for (let c = 0; c < board.cols; c++) row.push(board.typeAt(c, r));
    out.push(row);
  }
  return out;
}

// --- core gravity: tiles fall to the bottom; gaps fill from above ---

test("applyGravity drops a single hole at the bottom of a column", () => {
  // Column 0: [A, B, C, null] before. After: top fills, A,B,C all shift
  // down by 1, top cell gets a fresh random tile.
  const b = makeBoard([
    [1, 2, 3, 4],
    [2, 2, 3, 4],
    [3, 2, 3, 4],
    [null, 2, 3, 4],
  ]);
  applyGravity(b, 4);
  // Column 0: existing tiles should be at rows 1, 2, 3 (in original order).
  // Old row 0..2 values were 1, 2, 3 — those should now be at rows 1, 2, 3.
  assert.equal(b.typeAt(0, 1), 1);
  assert.equal(b.typeAt(0, 2), 2);
  assert.equal(b.typeAt(0, 3), 3);
  // Row 0 of column 0 should be a fresh tile in [0, candyTypes).
  const t = b.typeAt(0, 0);
  assert.ok(t !== null && t >= 0 && t < 4);
});

test("applyGravity handles a hole in the middle — tiles above fall to fill", () => {
  // Column 0: [A, B, null, D] — D doesn't move; A,B drop into the gap
  // by 1; new tile fills row 0.
  const b = makeBoard([
    [1, 2, 3, 4],
    [2, 2, 3, 4],
    [null, 2, 3, 4],
    [4, 2, 3, 4],
  ]);
  applyGravity(b, 4);
  // Column 0: D (4) stays at row 3, then 2 above, then 1 above that,
  // then a new tile at row 0.
  assert.equal(b.typeAt(0, 3), 4);
  assert.equal(b.typeAt(0, 2), 2);
  assert.equal(b.typeAt(0, 1), 1);
  const t = b.typeAt(0, 0);
  assert.ok(t !== null && t >= 0 && t < 4);
});

test("applyGravity refills an entirely empty column with fresh tiles", () => {
  // Column 0 is all null — every row should get a fresh tile.
  const b = makeBoard([
    [null, 2, 3, 4],
    [null, 2, 3, 4],
    [null, 2, 3, 4],
    [null, 2, 3, 4],
  ]);
  applyGravity(b, 4);
  for (let r = 0; r < 4; r++) {
    const t = b.typeAt(0, r);
    assert.ok(t !== null, `row ${r} should be filled`);
    assert.ok(t >= 0 && t < 4);
  }
});

test("applyGravity does nothing when the board is full", () => {
  const before = [
    [0, 1, 2, 3],
    [1, 2, 3, 0],
    [2, 3, 0, 1],
    [3, 0, 1, 2],
  ];
  const b = makeBoard(before);
  const fallen = applyGravity(b, 4);
  assert.deepEqual(toGrid(b), before, "board contents unchanged");
  assert.equal(fallen.length, 0, "no fallenCells recorded");
});

// --- fallenCells reporting ---

test("applyGravity reports fallenCells for every shifted-or-spawned tile", () => {
  // 1 column of 4 with one gap at the top → no shifts but 1 new spawn.
  const b = makeBoard([[null], [1], [2], [3]], 4);
  const fallen = applyGravity(b, 4);
  // Only the new tile at (0,0) was added — no existing tile moved.
  assert.equal(fallen.length, 1);
  assert.deepEqual(fallen[0], { c: 0, r: 0 });
});

test("applyGravity reports falls AND new spawns when the gap is mid-column", () => {
  const b = makeBoard([[1], [null], [2], [3]], 4);
  const fallen = applyGravity(b, 4);
  // Tile that fell: (c=0, r=0) → (c=0, r=1). That's one fall.
  // Plus one new tile at (c=0, r=0). Total 2 entries.
  assert.equal(fallen.length, 2);
  const keys = new Set(fallen.map((p) => `${p.c},${p.r}`));
  assert.ok(keys.has('0,1'), 'old tile lands at row 1');
  assert.ok(keys.has('0,0'), 'new tile spawns at row 0');
});

test("applyGravity reports correctly across multiple columns", () => {
  // Three columns: col 0 has 2 gaps (rows 2, 3), col 1 full, col 2 has 1 gap (row 3).
  const b = makeBoard([
    [1, 1, 1],
    [2, 2, 2],
    [null, 3, 3],
    [null, 4, null],
  ]);
  const fallen = applyGravity(b, 4);
  // Col 0: 2 new tiles at rows 0,1 + the existing 1 at row 0 falls to 2, the existing 2 at row 1 falls to 3 → 4 fallen entries.
  // Col 1: full, no falls.
  // Col 2: tile 1 at row 0 → row 1, tile 2 at row 1 → row 2, tile 3 at row 2 → row 3; new tile at row 0 → 4 entries.
  // Total: 4 + 0 + 4 = 8 entries.
  assert.equal(fallen.length, 8);
});

// --- determinism with stubbed RNG ---

test("applyGravity uses Math.random for new-tile pick", () => {
  // Stub Math.random to a fixed value so every new tile gets the same type.
  const b = makeBoard([
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ]);
  const realRandom = Math.random;
  Math.random = () => 0; // → Math.floor(0 * 4) = 0
  try {
    applyGravity(b, 4);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        assert.equal(b.typeAt(c, r), 0);
      }
    }
  } finally {
    Math.random = realRandom;
  }
});

test("applyGravity respects the candyTypes ceiling", () => {
  // Math.random just under 1 with candyTypes=6 picks type 5 (Math.floor(0.99*6)=5).
  const b = makeBoard([
    [null],
    [null],
  ], 6);
  const realRandom = Math.random;
  Math.random = () => 0.99;
  try {
    applyGravity(b, 6);
    assert.equal(b.typeAt(0, 0), 5);
    assert.equal(b.typeAt(0, 1), 5);
  } finally {
    Math.random = realRandom;
  }
});

// --- preserves cell-level metadata (specials, etc.) ---

test("applyGravity preserves the cell object on tiles that just shift down", () => {
  // A tile with a `special` tag should keep that tag after falling.
  const b = makeBoard([[null]], 4);
  b.set(0, 0, { type: 1, special: 'rainbow' });
  const fallen = applyGravity(b, 4); // 1×1 board — nothing falls, but the api returns ok
  // Nothing falls because the cell is at the bottom. Build a different
  // setup that forces the fall.
  const b2 = new Board(1, 2, 4);
  b2.set(0, 0, { type: 1, special: 'rainbow' });
  b2.set(0, 1, null);
  applyGravity(b2, 4);
  // The cell with special='rainbow' should now be at row 1 (fallen).
  assert.deepEqual(b2.cell(0, 1), { type: 1, special: 'rainbow' });
});
