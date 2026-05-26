// Daily mode — a roguelike run with a deterministic seed derived
// from today's date. Every player gets the same board sequence,
// upgrade pool, mutator rolls, and relics for the day. Their best
// slot is recorded against the daily-seed leaderboard.
//
// Daily is a composition of Roguelike: it seeds the run-rng + flags
// the run as daily, then delegates to the roguelike mode's start().
// Sharing run state with Roguelike is intentional — there's only
// ever one run in flight, and the runtime enforces that one mode is
// active at a time.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    state,
    telemetry,
    dailySeed,
    dailySeedStamp,
    createRng,
    // Roguelike module's public API — daily composes it.
    roguelikeStart,
    roguelikeEndRunSoft,
  } = deps;

  function start() {
    const seed = dailySeed();
    state.runRng = createRng(seed);
    state.runIsDaily = true;
    state.runDailyStamp = dailySeedStamp();
    telemetry.track('daily_seed_start', { stamp: state.runDailyStamp });
    // Reset run state so a daily can't inherit upgrades from a previous run.
    state.inRoguelikeRun = false;
    state.roguelike.currentSlot = 1;
    state.runUpgrades = [];
    state.runRelics = [];
    state.roguelike.currentClass = null; state.runFreeRerolls = 0;
    roguelikeStart();
  }

  registerMode({
    id: 'daily',
    enter() { start(); },
    // Daily shares run state with Roguelike — same soft-end teardown.
    exit() { roguelikeEndRunSoft(); },
  });

  return { start };
}
