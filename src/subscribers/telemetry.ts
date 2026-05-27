import { useGame } from "../state/game";
import { useSettings } from "../state/settings";
import { emit, setEnabled } from "../telemetry/bus";

/**
 * Mirrors useGame + useSettings into the telemetry event bus. Mode-
 * agnostic — every event keys off store deltas so all four modes share
 * a consistent stream.
 */
export function registerTelemetrySubscribers() {
  // Settings → enable/disable the bus + record the toggle event.
  const initial = useSettings.getState();
  setEnabled(initial.telemetry);

  emit("app_open", {});

  let prevSettings = useSettings.getState();
  useSettings.subscribe((s) => {
    setEnabled(s.telemetry);
    if (s.sound !== prevSettings.sound) {
      emit("settings_toggled", { setting: "sound", value: s.sound });
    }
    if (s.haptics !== prevSettings.haptics) {
      emit("settings_toggled", { setting: "haptics", value: s.haptics });
    }
    if (s.reducedMotion !== prevSettings.reducedMotion) {
      emit("settings_toggled", { setting: "reducedMotion", value: s.reducedMotion });
    }
    if (s.telemetry !== prevSettings.telemetry) {
      emit("settings_toggled", { setting: "telemetry", value: s.telemetry });
    }
    prevSettings = s;
  });

  // Game store deltas.
  let prev = useGame.getState();
  useGame.subscribe((next) => {
    // Mode (re)start: board grows from 0 → N.
    if (prev.board.rows === 0 && next.board.rows > 0) {
      emit("mode_start", {
        mode: next.mode,
        levelId: next.levelId ?? 0,
        seed: next.seed,
        rows: next.board.rows,
        cols: next.board.cols,
      });
    }

    // Move resolved.
    if (next.moves > prev.moves) {
      const gained = next.score - prev.score;
      const delta =
        next.cleared.cups - prev.cleared.cups +
        next.cleared.pentacles - prev.cleared.pentacles +
        next.cleared.swords - prev.cleared.swords +
        next.cleared.wands - prev.cleared.wands;
      emit("swap_made", { gained, cleared: delta });
      emit("match_resolved", { score: next.score, moves: next.moves });
    }

    // Deadlock entered.
    if (next.deadlocked && !prev.deadlocked) {
      emit("deadlock", { score: next.score, moves: next.moves });
    }

    prev = next;
  });
}

/** Outcome hooks called from the Play screen so we can record the
 *  reason the run ended without the game store needing to know. */
export const telemetryOutcome = {
  modeWon: (mode: string, finalScore: number, extra?: Record<string, string | number>) =>
    emit("mode_won", { mode, finalScore, ...(extra ?? {}) }),
  modeLost: (mode: string, finalScore: number, extra?: Record<string, string | number>) =>
    emit("mode_lost", { mode, finalScore, ...(extra ?? {}) }),
  chamberPassed: (chamberIndex: number, gained: number) =>
    emit("chamber_passed", { chamberIndex, gained }),
  chamberFailed: (chamberIndex: number, gained: number) =>
    emit("chamber_failed", { chamberIndex, gained }),
};
