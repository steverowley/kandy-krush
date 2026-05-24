// Roguelike mode — a 30-slot run with bosses every 10 slots.
// PR A scaffolds the mode (state + flow); upgrades and bosses are
// added in follow-up PRs.
import { LEVELS, getLevel } from './levels.js';

export const RUN_LENGTH = 30;
export const BOSS_SLOTS = new Set([10, 20, 30]);

// Map a roguelike slot (1..30) to a base level config. For now this
// just walks the first 30 hand-tuned levels; later we'll tag boss
// slots and tune difficulty per slot.
export function getRoguelikeLevel(slot) {
  const idx = Math.max(1, Math.min(RUN_LENGTH, slot));
  const base = LEVELS[(idx - 1) % LEVELS.length] || getLevel(1);
  const isBoss = BOSS_SLOTS.has(idx);
  // Construct a slot-specific level wrapper so the visible name and
  // hint reflect "Slot N of 30" rather than the underlying level's
  // own title. We keep all of base's mechanics + obstacles.
  return {
    ...base,
    runSlot: idx,
    isBoss,
    name: isBoss
      ? `Boss ${BOSS_SLOTS.size > 0 ? Math.ceil(idx / 10) : 1} — ${base.name}`
      : base.name,
    hint: isBoss
      ? `BOSS · ${base.hint}`
      : base.hint,
  };
}

// Gems earned for finishing a run at a given level (whether by clearing
// the final boss or running out of moves earlier). Roughly: 1 per
// regular level cleared, +5 bonus per boss cleared, +20 grand bonus
// if the whole run completes.
export function gemsEarned(reachedLevel, runComplete) {
  const cleared = Math.max(0, Math.min(RUN_LENGTH, reachedLevel - 1));
  let gems = cleared;
  for (const boss of BOSS_SLOTS) {
    if (cleared >= boss) gems += 5;
  }
  if (runComplete) gems += 20;
  return gems;
}
