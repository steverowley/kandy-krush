// 🚌 Game event bus.
//
// Today every relic / upgrade / mutator / boss-mechanic effect lives
// as a hard-coded `if (hasMutator('foo')) { ... }` branch inside the
// big functions in main.js — processMatchRound is 360 lines, half of
// which is "if condition X, fire effect Y." Every new relic adds
// another branch in another place, and the entropy compounds.
//
// This is the seed for the refactor (Phase B6). The bus is the join
// point: effects subscribe to named events (`onMatch`, `onSlotStart`,
// `onCascade`, `onSpecialBirth`, `onSwap`, etc.); the cascade pipeline
// emits those events at the right moments. New relics become a single
// `bus.on('cascade', ctx => { ... })` registration — no edits to the
// 360-line monolith.
//
// Phase 17v ships the bus + emits a few canonical events; rewiring the
// existing relic / upgrade branches to subscribers is a follow-up that
// can land incrementally (one branch at a time, no big-bang rewrite).
//
// Event payloads are plain objects — see the per-event docs below.

const handlers = new Map(); // eventName -> Set<fn>

export function on(eventName, fn) {
  if (typeof eventName !== 'string' || typeof fn !== 'function') return () => {};
  let set = handlers.get(eventName);
  if (!set) { set = new Set(); handlers.set(eventName, set); }
  set.add(fn);
  return () => { set.delete(fn); };
}

export function off(eventName, fn) {
  const set = handlers.get(eventName);
  if (set) set.delete(fn);
}

export function emit(eventName, payload) {
  const set = handlers.get(eventName);
  if (!set || set.size === 0) return;
  // Snapshot so handlers can on/off without disturbing iteration.
  const snapshot = [...set];
  for (const fn of snapshot) {
    try {
      fn(payload);
    } catch (err) {
      // Handlers must not be able to brick the game — log + swallow.
      // eslint-disable-next-line no-console
      console.error(`[event-bus] handler for "${eventName}" threw:`, err);
    }
  }
}

// Wipe every handler. Useful at run-end or test teardown so stale
// closures don't linger across runs (or between tests).
export function clear() {
  handlers.clear();
}

// Test helper — never used in app code.
export function _handlerCount(eventName) {
  if (eventName) return (handlers.get(eventName) || new Set()).size;
  let n = 0;
  for (const set of handlers.values()) n += set.size;
  return n;
}

/* Canonical event names (no enforcement, just docs):
 *
 *   'match'        { positions, cascadeLevel, allCleared, specialsCreated, matchSize }
 *                   fired once per cascade round.
 *
 *   'cascade'      { cascadeLevel, totalCleared }
 *                   fired when cascadeLevel >= 2.
 *
 *   'slot:start'   { slot, isBoss, mechanic }
 *                   fired at the top of playRoguelikeSlot.
 *
 *   'slot:complete'{ slot, isBoss, score, movesUsed }
 *                   fired in advanceRoguelikeAfterWin.
 *
 *   'special:birth'{ type, c, r, kind }
 *                   fired when a new line / wrapped / rainbow special is made.
 *
 *   'swap'         { a, b }
 *                   fired after a player swap completes.
 *
 *   'run:start'    { class, archetype, dailySeed }
 *                   fired in startRoguelikeRun.
 *
 *   'run:end'      { outcome, slot, gems, class }
 *                   fired in endRoguelikeRun / advanceRoguelikeAfterWin.
 */
