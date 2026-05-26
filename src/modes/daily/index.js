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
    telemetry,
    dailySeed,
    dailySeedStamp,
    createRng,
    // ── state stores (modes-4) ──
    runStore,         // ephemeral run state (shared with Roguelike)
    progressionStore, // persistent roguelike progression
    // Roguelike module's public API — daily composes it.
    roguelikeStart,
    roguelikeEndRunSoft,
  } = deps;

  function start() {
    const seed = dailySeed();
    runStore.setRng(createRng(seed));
    runStore.setDaily(true);
    runStore.setDailyStamp(dailySeedStamp());
    telemetry.track('daily_seed_start', { stamp: runStore.dailyStamp() });
    // Reset run state so a daily can't inherit upgrades from a previous run.
    runStore.setActive(false);
    progressionStore.setCurrentSlot(1);
    runStore.setUpgrades([]);
    runStore.setRelics([]);
    progressionStore.setCurrentClass(null);
    runStore.setFreeRerolls(0);
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
