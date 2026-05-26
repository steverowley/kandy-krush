// Board primitive tests — exercises the small grid utility class that
// every other game module reads from.
//
// Board is intentionally tiny: cols/rows, an idx function, get/set/swap,
// a no-match fill, and a clear. Bugs here would silently corrupt every
// match the player sees, so even though it's small it deserves explicit
// coverage of every edge.
//
// Run with: node --test tests/board.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, makeCell } from '../src/game/board.js';

// --- makeCell helper ---

test("makeCell returns { type, special }", () => {
  assert.deepEqual(makeCell(0), { type: 0, special: null });
  assert.deepEqual(makeCell(3, 'rainbow'), { type: 3, special: 'rainbow' });
});

// --- Board construction + indexing ---

test("Board constructor allocates a grid of cols × rows nulls", () => {
  const b = new Board(8, 7, 6);
  assert.equal(b.cols, 8);
  assert.equal(b.rows, 7);
  assert.equal(b.candyTypes, 6);
  assert.equal(b.grid.length, 56);
  for (const v of b.grid) assert.equal(v, null);
});

test("Board.idx is row-major", () => {
  const b = new Board(8, 8, 6);
  assert.equal(b.idx(0, 0), 0);
  assert.equal(b.idx(7, 0), 7);
  assert.equal(b.idx(0, 1), 8);
  assert.equal(b.idx(3, 4), 35);
  assert.equal(b.idx(7, 7), 63);
});

test("Board.inBounds rejects negatives and overflow", () => {
  const b = new Board(8, 8, 6);
  assert.equal(b.inBounds(0, 0), true);
  assert.equal(b.inBounds(7, 7), true);
  assert.equal(b.inBounds(-1, 0), false);
  assert.equal(b.inBounds(0, -1), false);
  assert.equal(b.inBounds(8, 0), false);
  assert.equal(b.inBounds(0, 8), false);
  assert.equal(b.inBounds(100, 100), false);
});

// --- cell / at / typeAt accessors ---

test("Board.cell returns null for out-of-bounds requests", () => {
  const b = new Board(4, 4, 6);
  assert.equal(b.cell(-1, 0), null);
  assert.equal(b.cell(0, -1), null);
  assert.equal(b.cell(4, 0), null);
  assert.equal(b.cell(0, 4), null);
});

test("Board.cell and Board.at agree", () => {
  const b = new Board(4, 4, 6);
  b.setType(1, 2, 3);
  assert.deepEqual(b.cell(1, 2), b.at(1, 2));
});

test("Board.typeAt returns the cell's type when set", () => {
  const b = new Board(4, 4, 6);
  b.setType(2, 1, 4);
  assert.equal(b.typeAt(2, 1), 4);
});

test("Board.typeAt returns null for unset cells", () => {
  const b = new Board(4, 4, 6);
  assert.equal(b.typeAt(0, 0), null);
});

test("Board.typeAt returns null for ingredient cells (they can't match)", () => {
  const b = new Board(4, 4, 6);
  // Ingredient flag lives on the cell; typeAt treats it like empty.
  b.set(1, 1, { type: 2, ingredient: true });
  assert.equal(b.typeAt(1, 1), null);
  assert.equal(b.isIngredient(1, 1), true);
});

test("Board.isIngredient is false for non-ingredient cells (including empty)", () => {
  const b = new Board(4, 4, 6);
  assert.equal(b.isIngredient(0, 0), false);
  b.setType(0, 0, 1);
  assert.equal(b.isIngredient(0, 0), false);
});

test("Board.specialAt returns the cell's special tag", () => {
  const b = new Board(4, 4, 6);
  b.set(2, 2, { type: 1, special: 'rainbow' });
  assert.equal(b.specialAt(2, 2), 'rainbow');
});

test("Board.specialAt returns null for empty cells", () => {
  const b = new Board(4, 4, 6);
  assert.equal(b.specialAt(0, 0), null);
});

// --- set / setType writers ---

test("Board.set stores the cell verbatim", () => {
  const b = new Board(4, 4, 6);
  const cell = { type: 5, special: 'striped-h' };
  b.set(1, 1, cell);
  assert.equal(b.cell(1, 1), cell);
});

test("Board.setType replaces with a fresh no-special cell", () => {
  const b = new Board(4, 4, 6);
  b.set(1, 1, { type: 5, special: 'rainbow' });
  b.setType(1, 1, 2);
  assert.deepEqual(b.cell(1, 1), { type: 2, special: null });
});

// --- fillNoMatches: never creates a 3-in-a-row at fill time ---

test("Board.fillNoMatches produces a grid with no horizontal 3-in-a-rows", () => {
  // Run the fill ten times; each output must be match-free in both
  // directions. Probabilistic: 6 candy types × 8×8 grid, so brute-force
  // verification is fine.
  for (let trial = 0; trial < 10; trial++) {
    const b = new Board(8, 8, 6);
    b.fillNoMatches();
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols - 2; c++) {
        const a = b.typeAt(c, r);
        const m = b.typeAt(c + 1, r);
        const z = b.typeAt(c + 2, r);
        assert.notEqual(
          a === m && m === z, true,
          `horizontal match at (${c},${r}) trial ${trial}`
        );
      }
    }
  }
});

test("Board.fillNoMatches produces a grid with no vertical 3-in-a-rows", () => {
  for (let trial = 0; trial < 10; trial++) {
    const b = new Board(8, 8, 6);
    b.fillNoMatches();
    for (let c = 0; c < b.cols; c++) {
      for (let r = 0; r < b.rows - 2; r++) {
        const a = b.typeAt(c, r);
        const m = b.typeAt(c, r + 1);
        const z = b.typeAt(c, r + 2);
        assert.notEqual(
          a === m && m === z, true,
          `vertical match at (${c},${r}) trial ${trial}`
        );
      }
    }
  }
});

test("Board.fillNoMatches sets every cell to a valid candy type", () => {
  const b = new Board(8, 8, 6);
  b.fillNoMatches();
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const t = b.typeAt(c, r);
      assert.ok(t !== null, `cell (${c},${r}) should be set`);
      assert.ok(t >= 0 && t < 6, `cell (${c},${r}) type ${t} out of range`);
    }
  }
});

// --- swap: exchanges two cells in place ---

test("Board.swap exchanges two cells", () => {
  const b = new Board(4, 4, 6);
  b.setType(1, 1, 0); // value A
  b.setType(2, 1, 5); // value B
  b.swap({ c: 1, r: 1 }, { c: 2, r: 1 });
  assert.equal(b.typeAt(1, 1), 5);
  assert.equal(b.typeAt(2, 1), 0);
});

test("Board.swap is symmetric — swapping back restores the original", () => {
  const b = new Board(4, 4, 6);
  b.setType(0, 0, 1);
  b.setType(3, 3, 4);
  b.swap({ c: 0, r: 0 }, { c: 3, r: 3 });
  b.swap({ c: 0, r: 0 }, { c: 3, r: 3 });
  assert.equal(b.typeAt(0, 0), 1);
  assert.equal(b.typeAt(3, 3), 4);
});

// --- adjacent: 4-way neighborhood ---

test("Board.adjacent is true for horizontal + vertical neighbors only", () => {
  const b = new Board(4, 4, 6);
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 2, r: 1 }), true);
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 0, r: 1 }), true);
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 1, r: 2 }), true);
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 1, r: 0 }), true);
  // Diagonals are NOT adjacent.
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 2, r: 2 }), false);
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 0, r: 0 }), false);
  // Same cell is not adjacent to itself.
  assert.equal(b.adjacent({ c: 1, r: 1 }, { c: 1, r: 1 }), false);
  // Far cells aren't adjacent.
  assert.equal(b.adjacent({ c: 0, r: 0 }, { c: 3, r: 3 }), false);
});

// --- clear: nulls every requested position ---

test("Board.clear sets every requested cell to null", () => {
  const b = new Board(4, 4, 6);
  b.setType(0, 0, 1);
  b.setType(1, 1, 2);
  b.setType(2, 2, 3);
  b.clear([{ c: 0, r: 0 }, { c: 1, r: 1 }, { c: 2, r: 2 }]);
  assert.equal(b.typeAt(0, 0), null);
  assert.equal(b.typeAt(1, 1), null);
  assert.equal(b.typeAt(2, 2), null);
  assert.equal(b.cell(0, 0), null);
});

test("Board.clear with an empty list is a no-op", () => {
  const b = new Board(4, 4, 6);
  b.setType(0, 0, 1);
  b.clear([]);
  assert.equal(b.typeAt(0, 0), 1);
});
