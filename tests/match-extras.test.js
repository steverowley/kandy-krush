// match.js — coverage for the 4 functions outside findMatches.
// (findMatches is covered in tests/match.test.js.)
//
// deriveNewSpecials → which kind of special spawns from each match group
// detectCombo       → which combo type fires when two specials swap
// applyCombo        → which positions a combo clears
// activationClears  → which positions a struck special adds to the clear
//
// Run with: node --test tests/match-extras.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/game/board.js';
import {
  deriveNewSpecials,
  detectCombo,
  applyCombo,
  activationClears,
} from '../src/game/match.js';

// --- deriveNewSpecials ---

test("deriveNewSpecials returns nothing for groups of length <= 3", () => {
  const groups = [
    { orientation: 'h', length: 3, type: 0, positions: [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }] },
  ];
  assert.deepEqual(deriveNewSpecials(groups, null), []);
});

test("deriveNewSpecials picks the swap target's position when it's in the group", () => {
  // Length 4 horizontal — should spawn a line-h at the swap target.
  const groups = [
    { orientation: 'h', length: 4, type: 1, positions: [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 3, r: 0 }] },
  ];
  const swapTarget = { c: 2, r: 0 };
  const specials = deriveNewSpecials(groups, swapTarget);
  assert.equal(specials.length, 1);
  assert.deepEqual(specials[0], { c: 2, r: 0, type: 1, kind: 'line-h' });
});

test("deriveNewSpecials picks the middle of the group when swap target is missing", () => {
  const groups = [
    { orientation: 'v', length: 4, type: 2, positions: [{ c: 0, r: 0 }, { c: 0, r: 1 }, { c: 0, r: 2 }, { c: 0, r: 3 }] },
  ];
  const specials = deriveNewSpecials(groups, null);
  assert.equal(specials.length, 1);
  // Math.floor(4/2) = index 2 → position (0, 2)
  assert.equal(specials[0].c, 0);
  assert.equal(specials[0].r, 2);
  assert.equal(specials[0].kind, 'line-v');
});

test("deriveNewSpecials spawns a 'rainbow' for length-5+ matches", () => {
  const groups = [
    { orientation: 'h', length: 5, type: 3, positions: [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 3, r: 0 }, { c: 4, r: 0 }] },
  ];
  const specials = deriveNewSpecials(groups, null);
  assert.equal(specials[0].kind, 'rainbow');
});

test("deriveNewSpecials processes longer groups first (biggest-wins)", () => {
  // A length-5 + a length-4 group; sorted longest-first.
  const g5 = { orientation: 'h', length: 5, type: 0, positions: [
    { c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 3, r: 0 }, { c: 4, r: 0 },
  ]};
  const g4 = { orientation: 'h', length: 4, type: 1, positions: [
    { c: 0, r: 1 }, { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 },
  ]};
  // Pass them out-of-order; deriveNewSpecials should sort by length desc.
  const specials = deriveNewSpecials([g4, g5], null);
  assert.equal(specials.length, 2);
  assert.equal(specials[0].kind, 'rainbow', 'length-5 spawns rainbow first');
  assert.equal(specials[1].kind, 'line-h', 'length-4 spawns line-h second');
});

test("deriveNewSpecials avoids spawning two specials on the same cell", () => {
  // Two overlapping groups sharing one position.
  const g1 = { orientation: 'h', length: 4, type: 0, positions: [
    { c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 3, r: 0 },
  ]};
  const g2 = { orientation: 'v', length: 4, type: 0, positions: [
    { c: 2, r: 0 }, { c: 2, r: 1 }, { c: 2, r: 2 }, { c: 2, r: 3 },
  ]};
  // Both want to plant at (2, 0) given swapTarget = (2, 0).
  const specials = deriveNewSpecials([g1, g2], { c: 2, r: 0 });
  // Only one special at that cell; the second is skipped.
  assert.equal(specials.length, 1);
});

// --- detectCombo ---

test("detectCombo returns null for plain (no-special) cells", () => {
  assert.equal(detectCombo({ type: 0 }, { type: 1 }, { c: 0, r: 0 }, { c: 1, r: 0 }), null);
});

test("detectCombo returns null when either cell is missing", () => {
  assert.equal(detectCombo(null, { type: 1 }, { c: 0, r: 0 }, { c: 1, r: 0 }), null);
  assert.equal(detectCombo({ type: 1 }, null, { c: 0, r: 0 }, { c: 1, r: 0 }), null);
});

test("detectCombo: two rainbows → double-rainbow", () => {
  const c = detectCombo(
    { type: 0, special: 'rainbow' },
    { type: 1, special: 'rainbow' },
    { c: 0, r: 0 }, { c: 1, r: 0 }
  );
  assert.equal(c.kind, 'double-rainbow');
});

test("detectCombo: rainbow + stripe → rainbow-stripes (carries the stripe's type)", () => {
  const c = detectCombo(
    { type: 0, special: 'rainbow' },
    { type: 4, special: 'line-h' },
    { c: 0, r: 0 }, { c: 1, r: 0 }
  );
  assert.equal(c.kind, 'rainbow-stripes');
  assert.equal(c.type, 4);
});

test("detectCombo: stripe + rainbow → rainbow-stripes (order doesn't matter)", () => {
  const c = detectCombo(
    { type: 3, special: 'line-v' },
    { type: 0, special: 'rainbow' },
    { c: 0, r: 0 }, { c: 1, r: 0 }
  );
  assert.equal(c.kind, 'rainbow-stripes');
  assert.equal(c.type, 3);
});

test("detectCombo: rainbow + plain → rainbow-type (carries plain cell's type)", () => {
  const c = detectCombo(
    { type: 0, special: 'rainbow' },
    { type: 2 },
    { c: 0, r: 0 }, { c: 1, r: 0 }
  );
  assert.equal(c.kind, 'rainbow-type');
  assert.equal(c.type, 2);
});

test("detectCombo: two stripes → stripes-pair", () => {
  const c = detectCombo(
    { type: 1, special: 'line-h' },
    { type: 2, special: 'line-v' },
    { c: 3, r: 3 }, { c: 4, r: 3 }
  );
  assert.equal(c.kind, 'stripes-pair');
});

test("detectCombo: stripe + plain → null (not a combo)", () => {
  const c = detectCombo(
    { type: 1, special: 'line-h' },
    { type: 2 },
    { c: 0, r: 0 }, { c: 1, r: 0 }
  );
  assert.equal(c, null);
});

// --- applyCombo ---

function makeFullBoard(cols, rows) {
  const b = new Board(cols, rows, 6);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) b.setType(c, r, (c + r) % 6);
  }
  return b;
}

test("applyCombo: double-rainbow clears the entire board", () => {
  const b = makeFullBoard(4, 4);
  const cleared = applyCombo(b, { kind: 'double-rainbow', a: { c: 0, r: 0 }, b: { c: 1, r: 0 } });
  // 16 cells total — every position should be included.
  assert.equal(cleared.length, 16);
});

test("applyCombo: rainbow-type clears every tile of one type (plus the two cells of the combo)", () => {
  // 4×4 board with diagonal pattern (c+r)%6. Type 0 occurs at:
  // (0,0), (4,2)→out, etc. Hard to count exactly without enumerating.
  // We'll verify the positions returned are ALL of the targeted type
  // PLUS the combo-cell positions.
  const b = makeFullBoard(4, 4);
  const combo = { kind: 'rainbow-type', type: 0, a: { c: 0, r: 0 }, b: { c: 1, r: 0 } };
  const cleared = applyCombo(b, combo);
  // Build expected: every position where typeAt === 0, plus combo a & b.
  const expected = new Set();
  expected.add('0,0');
  expected.add('1,0');
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (b.typeAt(c, r) === 0) expected.add(`${c},${r}`);
    }
  }
  const actual = new Set(cleared.map((p) => `${p.c},${p.r}`));
  assert.deepEqual(actual, expected);
});

test("applyCombo: rainbow-stripes clears every row+col of every tile of one type", () => {
  // 4×4 board. Type 0 occurs at (0,0). rainbow-stripes should clear
  // row 0 (cols 0..3) AND col 0 (rows 0..3) — 7 unique positions —
  // PLUS the combo-cell positions if they're not already included.
  const b = new Board(4, 4, 6);
  // Custom setup: type 0 only at (0, 0). Everything else type 1.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) b.setType(c, r, 1);
  }
  b.setType(0, 0, 0);
  const combo = { kind: 'rainbow-stripes', type: 0, a: { c: 2, r: 2 }, b: { c: 2, r: 3 } };
  const cleared = applyCombo(b, combo);
  const keys = new Set(cleared.map((p) => `${p.c},${p.r}`));
  // Row 0 fully: 0,0 1,0 2,0 3,0
  assert.ok(keys.has('0,0'));
  assert.ok(keys.has('1,0'));
  assert.ok(keys.has('2,0'));
  assert.ok(keys.has('3,0'));
  // Col 0 fully: 0,0 0,1 0,2 0,3
  assert.ok(keys.has('0,1'));
  assert.ok(keys.has('0,2'));
  assert.ok(keys.has('0,3'));
  // Combo cells themselves:
  assert.ok(keys.has('2,2'));
  assert.ok(keys.has('2,3'));
});

test("applyCombo: stripes-pair clears the row + col of both combo cells", () => {
  const b = makeFullBoard(4, 4);
  const combo = { kind: 'stripes-pair', a: { c: 1, r: 1 }, b: { c: 2, r: 3 } };
  const cleared = applyCombo(b, combo);
  const keys = new Set(cleared.map((p) => `${p.c},${p.r}`));
  // Row 1 (a.r): 0,1 1,1 2,1 3,1
  for (let c = 0; c < 4; c++) assert.ok(keys.has(`${c},1`));
  // Row 3 (b.r): 0,3 1,3 2,3 3,3
  for (let c = 0; c < 4; c++) assert.ok(keys.has(`${c},3`));
  // Col 1 (a.c) and col 2 (b.c):
  for (let r = 0; r < 4; r++) {
    assert.ok(keys.has(`1,${r}`));
    assert.ok(keys.has(`2,${r}`));
  }
});

// --- activationClears ---

test("activationClears: a stripe cell with line-h adds its entire row to the clear", () => {
  const b = new Board(5, 3, 6);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) b.setType(c, r, 0);
  }
  b.set(2, 1, { type: 0, special: 'line-h' });
  const extra = activationClears(b, [{ c: 2, r: 1 }]);
  const keys = new Set(extra.map((p) => `${p.c},${p.r}`));
  // Whole row 1 (cols 0..4) should be in extra.
  for (let c = 0; c < 5; c++) assert.ok(keys.has(`${c},1`));
});

test("activationClears: a stripe cell with line-v adds its entire column to the clear", () => {
  const b = new Board(3, 5, 6);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) b.setType(c, r, 0);
  }
  b.set(1, 2, { type: 0, special: 'line-v' });
  const extra = activationClears(b, [{ c: 1, r: 2 }]);
  const keys = new Set(extra.map((p) => `${p.c},${p.r}`));
  for (let r = 0; r < 5; r++) assert.ok(keys.has(`1,${r}`));
});

test("activationClears: a rainbow adds every tile of its type to the clear", () => {
  const b = new Board(4, 4, 6);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) b.setType(c, r, 1);
  }
  // Plant a rainbow tagged as type=3 at (0,0), and a couple type-3 tiles.
  b.set(0, 0, { type: 3, special: 'rainbow' });
  b.setType(2, 2, 3);
  b.setType(3, 1, 3);
  const extra = activationClears(b, [{ c: 0, r: 0 }]);
  const keys = new Set(extra.map((p) => `${p.c},${p.r}`));
  // Should include every position where typeAt === 3.
  assert.ok(keys.has('0,0'));
  assert.ok(keys.has('2,2'));
  assert.ok(keys.has('3,1'));
});

test("activationClears: plain cells produce no extra clears", () => {
  const b = new Board(4, 4, 6);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) b.setType(c, r, 0);
  }
  const extra = activationClears(b, [{ c: 0, r: 0 }, { c: 1, r: 1 }]);
  assert.equal(extra.length, 0);
});

test("activationClears: missing cells (out of bounds) are skipped", () => {
  const b = new Board(4, 4, 6);
  const extra = activationClears(b, [{ c: 99, r: 99 }]);
  assert.equal(extra.length, 0);
});
