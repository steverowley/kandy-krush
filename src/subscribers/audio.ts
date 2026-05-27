import { useGame } from "../state/game";
import { useSettings } from "../state/settings";
import * as sounds from "../audio/sounds";
import * as haptics from "../audio/haptics";
import { setEnabled as setSoundEnabled } from "../audio/synth";
import { setEnabled as setHapticsEnabled } from "../audio/haptics";
import type { Suit } from "../game/engine/types";

/**
 * Wires the game store + settings store to the audio + haptics engines.
 * Call once on app boot from main.tsx.
 *
 * Mode-agnostic — every cue keys off generic game-store changes (score,
 * moves, nudge, deadlocked, selected) so all four modes share the same
 * sound vocabulary.
 */
export function registerAudioSubscribers() {
  // Mirror settings → engine enable flags.
  const applySettings = (s: { sound: boolean; haptics: boolean }) => {
    setSoundEnabled(s.sound);
    setHapticsEnabled(s.haptics);
  };
  applySettings(useSettings.getState());
  useSettings.subscribe((s) => applySettings(s));

  // Track the previous game state so we can diff per change.
  let prev = useGame.getState();

  useGame.subscribe((next) => {
    // Selection tick.
    const prevSel = prev.selected;
    const nextSel = next.selected;
    const sameCell =
      prevSel && nextSel && prevSel.row === nextSel.row && prevSel.col === nextSel.col;
    if (nextSel && !sameCell) {
      sounds.selectTick();
      haptics.tap();
    }

    // Illegal swap → nudge counter incremented.
    if (next.nudge > prev.nudge) {
      sounds.illegalSwap();
      haptics.reject();
    }

    // Score increased → a swap resolved. Use the cleared-counts delta to
    // pick the dominant suit and figure out cascade depth.
    if (next.moves > prev.moves) {
      const delta = diffCleared(prev.cleared, next.cleared);
      const dominant = pickDominantSuit(delta);
      if (dominant) sounds.matchChime(dominant);
      const totalNew = delta.cups + delta.pentacles + delta.swords + delta.wands;
      // Approx cascade-depth: every 3-cell match is one step. Beyond
      // step 1 we layer the cascade ladder.
      const steps = Math.max(0, Math.floor(totalNew / 3) - 1);
      for (let i = 1; i <= Math.min(6, steps); i++) {
        // Schedule via setTimeout — synth handles the actual timing via
        // its `delay` option already, but staggering here keeps the
        // call count clean.
        setTimeout(() => sounds.cascadeStep(i), i * 90);
      }
      haptics.bump();
    }

    // Deadlock entered.
    if (next.deadlocked && !prev.deadlocked) {
      sounds.deadlock();
      haptics.loss();
    }

    prev = next;
  });
}

function diffCleared(
  a: Record<Suit, number>,
  b: Record<Suit, number>,
): Record<Suit, number> {
  return {
    cups: Math.max(0, b.cups - a.cups),
    pentacles: Math.max(0, b.pentacles - a.pentacles),
    swords: Math.max(0, b.swords - a.swords),
    wands: Math.max(0, b.wands - a.wands),
  };
}

function pickDominantSuit(delta: Record<Suit, number>): Suit | null {
  let best: Suit | null = null;
  let bestCount = 0;
  for (const k of Object.keys(delta) as Suit[]) {
    if (delta[k] > bestCount) {
      bestCount = delta[k];
      best = k;
    }
  }
  return best;
}

/** Fire-and-forget hooks for mode-specific outcomes — Play screen calls
 *  these when surfacing the outcome modal. */
export const outcome = {
  win: () => {
    sounds.winFlourish();
    haptics.win();
  },
  loss: () => {
    sounds.lossFlourish();
    haptics.loss();
  },
};
