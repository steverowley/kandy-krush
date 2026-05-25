// Match detection — pure board functions.
// Run with: node --test tests/match.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/game/board.js';
import { findMatches } from '../src/game/match.js';

const COLS = 6;
const ROWS = 6;
const TYPES = 6;

function makeBoardWithRow(row, types) {
  const b = new Board(COLS, ROWS, TYPES);
  // Fill the board with a non-matching pattern first, then override the row.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      b.set(c, r, { type: (c + r * 2) % TYPES });
    }
  }
  for (let c = 0; c < COLS && c < types.length; c++) {
    b.set(c, row, { type: types[c] });
  }
  return b;
}

test('3 in a horizontal row is detected', () => {
  const b = makeBoardWithRow(2, [1, 1, 1, 4, 5, 0]);
  const result = findMatches(b);
  assert.ok(result.positions.length >= 3, `expected ≥3, got ${result.positions.length}`);
  const hasRow2 = result.positions.some((p) => p.r === 2);
  assert.ok(hasRow2, 'expected matches in row 2');
});

test('no match returns empty positions', () => {
  const b = new Board(COLS, ROWS, TYPES);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Alternating pattern, no 3-in-a-row possible.
      b.set(c, r, { type: (c + r) % TYPES });
    }
  }
  const result = findMatches(b);
  assert.equal(result.positions.length, 0);
});

test('5-in-a-row is detected as one big group', () => {
  const b = makeBoardWithRow(0, [2, 2, 2, 2, 2, 0]);
  const result = findMatches(b);
  const inRow0 = result.positions.filter((p) => p.r === 0 && [0, 1, 2, 3, 4].includes(p.c));
  assert.equal(inRow0.length, 5);
});
