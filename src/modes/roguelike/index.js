// Roguelike mode — slot-by-slot run with permadeath, class picker,
// per-run upgrades + relics + mutators, bosses every fifth slot.
// Largest and most stateful mode in the game.
//
// Declares its dependencies explicitly via register(deps) so it has
// no implicit reach into main.js globals. The module exports
// `start`, `playSlot`, and `endRunSoft` for in-file callers
// (run-summary "play again", header restart button, etc.). The
// runtime path uses the same `start` via the registered enter()
// hook, and `endRunSoft` via the registered exit() hook.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    state,
    bus,
    persist,
    sfx,
    speech,
    telemetry,
    haptics,
    // ── state stores (modes-4) ──
    // Roguelike modes read/write their ephemeral run state through
    // this store API. The selectors/mutators wrap the underlying
    // state.X fields so legacy main.js call sites keep working in
    // parallel — incremental migration.
    runStore,
    // helpers from main.js
    refreshRunHud,
    refreshLevelUI,
    cancelHint,
    hideLevelOverlay,
    resetBoard,
    applyLevelObstacles,
    applyRunUpgradesOnSlotStart,
    applyAscensionMods,
    cascadePendingMatches,
    runDeferredSlotEffects,
    scheduleHint,
    renderBoard,
    flashMessage,
    spawnConfetti,
    spawnScreenFlash,
    screenShake,
    showRoguelikeIntro,
    showClassPicker,
    showLevelIntro,
    showBossBanner,
    getRoguelikeLevel,
    runRng,
    hasMeta,
    pickRelicChoices,
    maxLivesForRun,
    CLASSES,
    ARCHETYPES,
    RUN_LENGTH,
  } = deps;

  function start() {
    state.inRoguelikeRun = true;
    if (!state.roguelike.currentSlot || state.roguelike.currentSlot < 1) {
      state.roguelike.currentSlot = 1;
    }
    // Refresh lives if this is a fresh start (slot 1 or zero lives).
    if (state.roguelike.currentSlot === 1 || !state.roguelike.livesRemaining) {
      state.roguelike.livesRemaining = maxLivesForRun();
    }
    if (state.roguelike.currentSlot === 1) {
      state.roguelike.runsStarted = (state.roguelike.runsStarted || 0) + 1;
      state.runUpgrades = [];
      state.runRelics = [];
      state.roguelike.currentClass = null; state.runFreeRerolls = 0;
      // Per-run highlights — surfaced on the run-summary panel when the
      // player finishes (or dies).
      state.runHighlights = {
        maxCascade: 0,
        biggestMatch: 0,
        totalMatches: 0,
        bestSlotScore: 0,
        infiniteCount: 0,
        mutatorsSeen: [],
      };
      // 🔄 Reroll Bank meta — start each run with 3 free upgrade rerolls.
      // Carries between slots; consumed by the upgrade picker.
      state.runFreeRerolls = hasMeta('reroll-bank') ? 3 : 0;
      // 🎒 Pocket Friend meta-skill — start each run with 1 random relic.
      if (hasMeta('pocket-friend')) {
        const choices = pickRelicChoices([], 1, runRng());
        if (choices.length > 0) {
          state.runRelics = [choices[0].id];
          setTimeout(() => {
            flashMessage(`🎒 Pocket Friend: ${choices[0].icon} ${choices[0].name}!`, 1800);
          }, 800);
        }
      }
    }
    if (!state.runHighlights) state.runHighlights = { maxCascade: 0, biggestMatch: 0, totalMatches: 0, bestSlotScore: 0, infiniteCount: 0, mutatorsSeen: [] };
    // Backfill missing fields on resumed runs (forward-compat with old saves).
    if (state.runHighlights.totalMatches == null) state.runHighlights.totalMatches = 0;
    if (state.runHighlights.bestSlotScore == null) state.runHighlights.bestSlotScore = 0;
    if (state.runHighlights.infiniteCount == null) state.runHighlights.infiniteCount = 0;
    if (!Array.isArray(state.runHighlights.mutatorsSeen)) state.runHighlights.mutatorsSeen = [];
    persist();
    // First-ever roguelike run: pop a one-time intro explaining the
    // class / archetype / relic / mutator / enemy systems. Then class.
    if (state.roguelike.currentSlot === 1 && !state.roguelike.currentClass && !state.seenRoguelikeIntro) {
      showRoguelikeIntro(() => {
        state.seenRoguelikeIntro = true;
        persist();
        start(); // re-enter to hit the class picker branch
      });
      return;
    }
    // Fresh run with no class yet — show the class picker. The picker
    // grants free starting upgrades that shape the run's archetype.
    if (state.roguelike.currentSlot === 1 && !state.roguelike.currentClass) {
      showClassPicker(CLASSES, ARCHETYPES, (cls) => {
        state.roguelike.currentClass = cls.id;
        for (const id of (cls.start || [])) state.runUpgrades.push(id);
        telemetry.track('run_start', {
          class: cls.id,
          archetype: cls.archetype,
          starting_upgrades: (cls.start || []).slice(),
          runs_completed_before: state.roguelike?.runsCompleted || 0,
        });
        flashMessage(`${cls.icon} ${cls.name} chosen!`, 1600);
        speech.speak(`${cls.name} chosen.`);
        spawnConfetti(30);
        haptics.specialBirth();
        persist();
        refreshRunHud();
        setTimeout(() => playSlot(state.roguelike.currentSlot, { announce: true }), 400);
      }, state.roguelike.classStats || {});
      return;
    }
    playSlot(state.roguelike.currentSlot, { announce: true });
  }

  function playSlot(slot, { announce = true } = {}) {
    const lvl = applyAscensionMods(getRoguelikeLevel(slot));
    cancelHint();
    hideLevelOverlay();
    state.level = lvl;
    resetBoard();
    applyLevelObstacles(state.level);
    state.movesRemaining = state.level.moves;
    // Apply slot-start mutators / relics FIRST (which is what sets
    // state.slotMutator), THEN emit. With the old order, the
    // mutatorsSeen tracker in run-effects.js was reading the previous
    // slot's mutator instead of the current one — silently empty list
    // for the run summary. Fixed here.
    applyRunUpgradesOnSlotStart();
    bus.emit('slot:start', { slot, isBoss: !!lvl.isBoss, mechanic: lvl.mechanic || null });
    // Defensive: a previous setRunHud({ visible: false }) (e.g. from boot
    // before the run started) could leave the HUD with the `hidden` class
    // even after the run is live. Forcing a refresh here guarantees the
    // build readout is visible from slot 1.
    refreshRunHud();
    refreshLevelUI();
    renderBoard(state.board, state, { intro: true });
    if (announce) {
      state.busy = true;
      const done = async () => {
        state.busy = true;
        try {
          // Fire any visual slot-start FX (Black Hole, Storm Caller, etc.)
          // now that the intro is gone so they don't run under the overlay.
          runDeferredSlotEffects();
          await cascadePendingMatches();
        } finally {
          state.busy = false;
        }
        scheduleHint();
      };
      const p = showLevelIntro(state.level, RUN_LENGTH);
      if (p && typeof p.then === 'function') p.then(done);
      else done();
      if (lvl.isBoss) {
        // Boss intro: dramatic banner overlay + screen flash + shake.
        showBossBanner(lvl, { isFinal: slot === RUN_LENGTH });
        spawnScreenFlash('rgba(255, 0, 110, 0.55)');
        screenShake(10, 520);
        sfx.playBossStinger();
        haptics.epic();
        // Boss music — faster, more aggressive variant of the chiptune.
        sfx.setMusicMode('boss');
        // Red pulsing border on the board for the whole boss fight.
        document.body.classList.add('boss-active');
        if (slot === RUN_LENGTH) document.body.classList.add('boss-final');
      } else {
        // Non-boss slot: back to the standard chip variant.
        sfx.setMusicMode('roguelike');
        document.body.classList.remove('boss-active', 'boss-final');
      }
      speech.speak(
        `Slot ${slot} of ${RUN_LENGTH}.${lvl.isBoss ? ` Boss battle. ${lvl.name}.` : ''} ${lvl.hint}.`
      );
    } else {
      runDeferredSlotEffects();
      cascadePendingMatches().then(() => scheduleHint());
    }
  }

  function endRunSoft() {
    // Drop the run flag + ephemeral run state, refresh the HUD so it
    // hides. We intentionally do NOT call endRoguelikeRun() — that
    // records telemetry + run-history + shows the run-summary modal,
    // which would surprise a player who just switched modes. The
    // persisted roguelike progress (currentSlot, gems, upgrades,
    // relics) stays in state.roguelike for a future Resume path.
    runStore.clearRun();
    refreshRunHud();
  }

  registerMode({
    id: 'roguelike',
    enter() { start(); },
    exit() { endRunSoft(); },
  });

  return { start, playSlot, endRunSoft };
}
