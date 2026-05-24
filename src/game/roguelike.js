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

// Per-run upgrade pool. Each upgrade is picked once after a non-boss
// slot win. Stacking is allowed — picking the same upgrade twice
// doubles its effect.
export const UPGRADES = [
  // Stat buffs — apply every slot start until the run ends
  { id: 'moves+2',     category: 'buff',       name: '+2 Moves',       desc: 'Every slot starts with 2 extra moves.' },
  { id: 'hammer+1',    category: 'buff',       name: 'Extra Hammer',   desc: 'Each slot starts with +1 free hammer in your bank.' },
  { id: 'lucky-fast',  category: 'buff',       name: 'Lucky Fast',     desc: 'Lucky bar fills 50% faster per swap.' },
  { id: 'score+25',    category: 'buff',       name: 'Score Boost',    desc: 'Matches and combos score 25% more.' },
  // Per-slot consumables — refilled at the start of every slot
  { id: 'slot-bomb',   category: 'consumable', name: 'Slot Bomb',      desc: 'Start of each slot, gain +1 Color Bomb.' },
  { id: 'slot-shuffle',category: 'consumable', name: 'Slot Shuffle',   desc: 'Start of each slot, gain +1 Shuffle.' },
  { id: 'slot-plus3',  category: 'consumable', name: 'Slot +3 Moves',  desc: 'Start of each slot, gain +1 "+3 Moves" charge.' },
  // Synergies — pair with existing systems
  { id: 'lucky-strike',category: 'synergy',    name: 'Lucky Strike',   desc: 'When Lucky fires, also gain +1 hammer.' },
  { id: 'cascade-king',category: 'synergy',    name: 'Cascade King',   desc: 'Cascades (chain ≥2) score 50% more on top of the usual bonus.' },
  { id: 'big-match',   category: 'synergy',    name: 'Big Match',      desc: 'Matches of 5+ tiles score double.' },
];

const CATEGORY_COLORS = { buff: '#06A77D', consumable: '#FB5607', synergy: '#8338EC' };
export function categoryColor(cat) { return CATEGORY_COLORS[cat] || '#FFD60A'; }

// Pick 3 distinct upgrades from the pool. Bias slightly toward
// categories the player has fewer of, so the choice menu doesn't
// always show the same boring three.
export function pickUpgradeChoices(picked = []) {
  const taken = new Set(picked);
  // Allow repeats — stacking is a feature.
  const pool = UPGRADES.slice();
  // Fisher-Yates shuffle then take first 3
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
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
