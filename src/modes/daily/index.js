// Daily mode — a roguelike run with a deterministic seed derived
// from today's date. Every player gets the same board sequence,
// upgrade pool, mutator rolls, and relics for the day. Their best
// slot is recorded against the daily-seed leaderboard.
//
// Daily is a composition of Roguelike: it seeds the run-rng + flags
// the run as daily, then delegates to the roguelike mode's start().
//
// Modes-7 — Daily no longer clobbers an in-progress Roguelike run.
// The previous design overwrote `roguelike.currentSlot`, `currentClass`,
// `livesRemaining`, and the run-store fields when Daily started, so
// a player on Roguelike slot 5 who tapped Daily would lose their
// progression. Now Daily snapshots the roguelike slice on enter()
// and restores it on exit(). The two modes still share the *runtime*
// run state (one cascade engine, one HUD), but the persisted slots
// stay isolated by mode.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    bus,
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

  // 📸 Snapshot of the Roguelike slice taken at Daily's enter() and
  // restored at Daily's exit(). null while Daily isn't active.
  let _roguelikeSnapshot = null;

  function takeRoguelikeSnapshot() {
    _roguelikeSnapshot = {
      progression: {
        currentSlot: progressionStore.currentSlot(),
        currentClass: progressionStore.currentClass(),
        livesRemaining: progressionStore.livesRemaining(),
      },
      run: {
        wasActive: runStore.isActive(),
        upgrades: [...runStore.upgrades()],
        relics: [...runStore.relics()],
        freeRerolls: runStore.freeRerolls(),
      },
    };
  }

  function restoreRoguelikeSnapshot() {
    if (!_roguelikeSnapshot) return;
    progressionStore.setCurrentSlot(_roguelikeSnapshot.progression.currentSlot);
    progressionStore.setCurrentClass(_roguelikeSnapshot.progression.currentClass);
    progressionStore.setLivesRemaining(_roguelikeSnapshot.progression.livesRemaining);
    runStore.setUpgrades(_roguelikeSnapshot.run.upgrades);
    runStore.setRelics(_roguelikeSnapshot.run.relics);
    runStore.setFreeRerolls(_roguelikeSnapshot.run.freeRerolls);
    // Re-flag the run as active only if it WAS active before Daily
    // hijacked the slot. This lets the start-menu show "Resume Run"
    // after the player returns from a daily attempt.
    runStore.setActive(_roguelikeSnapshot.run.wasActive);
    _roguelikeSnapshot = null;
  }

  function start() {
    takeRoguelikeSnapshot();
    const seed = dailySeed();
    runStore.setRng(createRng(seed));
    runStore.setDaily(true);
    runStore.setDailyStamp(dailySeedStamp());
    // Analytics is a bus subscriber — see src/subscribers/telemetry.js.
    bus.emit('daily:start', { stamp: runStore.dailyStamp() });
    // Reset run state so a daily can't inherit upgrades from a previous run.
    runStore.setActive(false);
    progressionStore.setCurrentSlot(1);
    runStore.setUpgrades([]);
    runStore.setRelics([]);
    progressionStore.setCurrentClass(null);
    runStore.setFreeRerolls(0);
    roguelikeStart();
  }

  function exit() {
    // Soft-end the daily run, then restore whatever Roguelike state
    // we snapshotted on entry. Restoration order matters: clear
    // ephemeral run fields first (so cascadeAbort + daily flags are
    // gone) then write the snapshot back over the progression slice.
    roguelikeEndRunSoft();
    restoreRoguelikeSnapshot();
  }

  registerMode({
    id: 'daily',
    enter() { start(); },
    exit,
  });

  return { start, exit };
}
