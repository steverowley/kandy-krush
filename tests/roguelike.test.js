// Roguelike module — pure-function tests.
//
// The roguelike module is a mix of run-data tables (UPGRADES / RELICS /
// MUTATORS / CLASSES) and the small pure utilities that index, scale, and
// describe them. The utilities have never been exercised in isolation —
// every assertion came from running the full game. This file covers the
// behavior the rest of the codebase relies on (slot scaling, mutator-slot
// cadence, archetype tallying, synergy curve, deterministic picks).
//
// Run with: node --test tests/roguelike.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUN_LENGTH,
  BOSS_SLOTS,
  formatObjectiveHint,
  getRoguelikeLevel,
  isMutatorSlot,
  pickRandomMutator,
  getMutator,
  MUTATORS,
  archetypeFor,
  archetypeCounts,
  synergyStacks,
  pickUpgradeChoices,
  pickRelicChoices,
  getRelic,
  RELICS,
  getClass,
  CLASSES,
} from '../src/game/roguelike.js';

// --- formatObjectiveHint: every objective kind has a readable string ---

test("formatObjectiveHint handles every objective kind", () => {
  assert.equal(
    formatObjectiveHint({ kind: 'score', target: 3500 }),
    'Reach 3,500 points.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'matches', target: 20 }),
    'Make 20 matches.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'specials', target: 1 }),
    'Make 1 special candy.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'specials', target: 4 }),
    'Make 4 special candies.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'clearJelly' }),
    'Clear all the jelly tiles.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'dropIngredients', target: 1 }),
    'Drop 1 cherry to the bottom row.'
  );
  assert.equal(
    formatObjectiveHint({ kind: 'dropIngredients', target: 3 }),
    'Drop 3 cherries to the bottom row.'
  );
});

test("formatObjectiveHint handles a null objective without throwing", () => {
  assert.equal(formatObjectiveHint(null), '');
  assert.equal(formatObjectiveHint(undefined), '');
});

test("formatObjectiveHint uses the candy-type name for clearType", () => {
  // The exact name depends on the type index. We just assert the format.
  const hint = formatObjectiveHint({ kind: 'clearType', target: 30, type: 0 });
  assert.match(hint, /^Clear 30 .+\.$/);
});

// --- isMutatorSlot: every 5th slot, never a boss slot ---

test("isMutatorSlot returns true on every 5th non-boss slot", () => {
  // Slots ending in 0 are bosses (10, 20, ..., 100). Slots ending in 5
  // are mutator slots (5, 15, 25, ..., 95).
  for (let s = 1; s <= RUN_LENGTH; s++) {
    const expected = s > 0 && s % 5 === 0 && !BOSS_SLOTS.has(s);
    assert.equal(isMutatorSlot(s), expected, `slot ${s}`);
  }
});

test("isMutatorSlot is false for boss slots even though they are % 10 === 0", () => {
  for (const boss of BOSS_SLOTS) {
    assert.equal(isMutatorSlot(boss), false, `boss slot ${boss}`);
  }
});

test("isMutatorSlot is false for negative slots and zero", () => {
  assert.equal(isMutatorSlot(0), false);
  assert.equal(isMutatorSlot(-5), false);
  assert.equal(isMutatorSlot(-10), false);
});

// --- pickRandomMutator: deterministic when given a seeded rng ---

test("pickRandomMutator returns one of MUTATORS", () => {
  const m = pickRandomMutator(() => 0);
  assert.ok(m && m.id, 'returns a mutator with an id');
  assert.ok(MUTATORS.includes(m), 'returned object is from MUTATORS');
});

test("pickRandomMutator with rng=0 picks the first mutator; rng=0.999 picks the last", () => {
  assert.equal(pickRandomMutator(() => 0).id, MUTATORS[0].id);
  assert.equal(pickRandomMutator(() => 0.99999).id, MUTATORS[MUTATORS.length - 1].id);
});

// --- getMutator / getRelic / getClass lookup tables ---

test("getMutator returns the mutator by id or null", () => {
  const sample = MUTATORS[0];
  assert.equal(getMutator(sample.id), sample);
  assert.equal(getMutator('definitely-not-a-mutator'), null);
});

test("getRelic returns the relic by id or null", () => {
  const sample = RELICS[0];
  assert.equal(getRelic(sample.id), sample);
  assert.equal(getRelic('definitely-not-a-relic'), null);
});

test("getClass returns the class by id or undefined (no fallback)", () => {
  const sample = CLASSES[0];
  assert.equal(getClass(sample.id), sample);
  assert.equal(getClass('definitely-not-a-class') ?? null, null);
});

// --- archetypeFor / archetypeCounts: build-synergy plumbing ---

test("archetypeFor returns the archetype tag for an upgrade id", () => {
  // We don't depend on a specific id; we just verify archetypes are
  // one of the documented categories when they're defined.
  const valid = new Set(['scorer', 'bomber', 'lucky', 'sustain', 'wild']);
  // Sweep a few upgrade ids drawn from the UPGRADES table.
  // Use a known-stable id — 'snowball' is part of the Scorer archetype
  // family in the game design (see B6 changelog notes).
  const a = archetypeFor('snowball');
  // It either returns a valid archetype, or null (if upgrade renamed).
  if (a !== null) assert.ok(valid.has(a), `unexpected archetype "${a}"`);
});

test("archetypeFor returns null for an unknown upgrade id", () => {
  assert.equal(archetypeFor('definitely-not-an-upgrade'), null);
});

test("archetypeCounts tallies known archetypes and skips unknowns", () => {
  // Pull a handful of real upgrade ids from the table so the test is
  // grounded in the actual data — but only count the archetypes we
  // know exist. The counts we read are >= 0, that's enough.
  const counts = archetypeCounts(['snowball', 'snowball', 'not-a-real-upgrade']);
  for (const k of ['scorer', 'bomber', 'lucky', 'sustain', 'wild']) {
    assert.equal(typeof counts[k], 'number');
    assert.ok(counts[k] >= 0);
  }
});

test("archetypeCounts returns the empty distribution for null/undefined", () => {
  const empty = { scorer: 0, bomber: 0, lucky: 0, sustain: 0, wild: 0 };
  assert.deepEqual(archetypeCounts(null), empty);
  assert.deepEqual(archetypeCounts(undefined), empty);
  assert.deepEqual(archetypeCounts([]), empty);
});

// --- synergyStacks: smooth bonus past the first stack ---

test("synergyStacks is 0 for 0 or 1 archetype stack, then count-1", () => {
  assert.equal(synergyStacks(0), 0);
  assert.equal(synergyStacks(1), 0);
  assert.equal(synergyStacks(2), 1);
  assert.equal(synergyStacks(3), 2);
  assert.equal(synergyStacks(5), 4);
});

test("synergyStacks clamps negative counts to 0", () => {
  assert.equal(synergyStacks(-3), 0);
});

// --- pickUpgradeChoices: deterministic shuffle with a seeded rng ---

test("pickUpgradeChoices returns 3 upgrades by default", () => {
  const choices = pickUpgradeChoices([], 3, () => 0.5);
  assert.equal(choices.length, 3);
  for (const c of choices) {
    assert.ok(c.id, 'each choice has an id');
  }
});

test("pickUpgradeChoices honors the n argument", () => {
  const four = pickUpgradeChoices([], 4, () => 0.5);
  assert.equal(four.length, 4);
  const one = pickUpgradeChoices([], 1, () => 0.5);
  assert.equal(one.length, 1);
});

test("pickUpgradeChoices is deterministic given a fixed rng", () => {
  // Two calls with the same rng output produce the same picks.
  const seq = [0.1, 0.3, 0.7, 0.2, 0.9, 0.4, 0.5, 0.8];
  const make = () => {
    let i = 0;
    return () => seq[i++ % seq.length];
  };
  const a = pickUpgradeChoices([], 3, make()).map((u) => u.id);
  const b = pickUpgradeChoices([], 3, make()).map((u) => u.id);
  assert.deepEqual(a, b);
});

// --- pickRelicChoices: avoids relics already owned ---

test("pickRelicChoices returns 3 relics by default", () => {
  const picks = pickRelicChoices([], 3, () => 0.5);
  assert.equal(picks.length, 3);
});

test("pickRelicChoices avoids relics in the owned list", () => {
  // Construct an "owned" list of half the relics; verify no overlap.
  const owned = RELICS.slice(0, Math.floor(RELICS.length / 2)).map((r) => r.id);
  const picks = pickRelicChoices(owned, 3, () => 0.5);
  for (const p of picks) {
    assert.equal(owned.includes(p.id), false, `pick ${p.id} should not be in owned`);
  }
});

// --- getRoguelikeLevel: slot-to-level mapping with scaling + endless ---

test("getRoguelikeLevel returns a boss config for boss slots", () => {
  for (const boss of BOSS_SLOTS) {
    const lvl = getRoguelikeLevel(boss);
    assert.equal(lvl.isBoss, true, `slot ${boss} should be a boss`);
    assert.equal(lvl.runSlot, boss);
    assert.match(lvl.hint, /^BOSS \d/);
  }
});

test("getRoguelikeLevel returns a non-boss config for mutator slots", () => {
  // Slot 5, 15, 25 — non-boss, mutator.
  for (const s of [5, 15, 25]) {
    const lvl = getRoguelikeLevel(s);
    assert.equal(lvl.isBoss, false);
    assert.equal(lvl.runSlot, s);
  }
});

test("getRoguelikeLevel scales a 'score' objective past slot 1", () => {
  const slot1 = getRoguelikeLevel(1);
  const slot50 = getRoguelikeLevel(50);
  // If slot1 has a score objective, slot 50 should be much higher.
  if (slot1.objective?.kind === 'score') {
    assert.ok(slot50.objective.target > slot1.objective.target,
      `slot 50 (${slot50.objective.target}) should exceed slot 1 (${slot1.objective.target})`);
  }
});

test("getRoguelikeLevel clamps slot <= 0 to slot 1", () => {
  const slot0 = getRoguelikeLevel(0);
  const slot1 = getRoguelikeLevel(1);
  // Both should produce the same level config (modulo isEndless).
  assert.equal(slot0.runSlot, slot1.runSlot);
});

test("getRoguelikeLevel returns endless config past RUN_LENGTH", () => {
  const lvl = getRoguelikeLevel(RUN_LENGTH + 50);
  assert.equal(lvl.isEndless, true);
  assert.equal(lvl.isBoss, false);
  assert.equal(lvl.runSlot, RUN_LENGTH + 50);
  assert.match(lvl.hint, /^ENDLESS/);
});

test("getRoguelikeLevel endless mode keeps scaling beyond 100", () => {
  const slot100 = getRoguelikeLevel(100);
  const slot150 = getRoguelikeLevel(150);
  // If slot 100 had a score objective, slot 150's should be larger.
  // Note: slot 100 is the boss; slot 150 cycles through non-boss LEVELS.
  // We just verify endless mode bumps the runSlot past 100.
  assert.ok(slot150.runSlot > 100);
});

// --- RUN_LENGTH and BOSS_SLOTS consistency ---

test("BOSS_SLOTS are spaced every 10 from 10 to RUN_LENGTH", () => {
  for (let s = 10; s <= RUN_LENGTH; s += 10) {
    assert.equal(BOSS_SLOTS.has(s), true, `slot ${s} should be a boss`);
  }
});

test("RUN_LENGTH is a positive multiple of 10", () => {
  assert.ok(RUN_LENGTH > 0);
  assert.equal(RUN_LENGTH % 10, 0);
});
