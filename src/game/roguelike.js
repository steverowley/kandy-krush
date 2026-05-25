// Roguelike mode — a 30-slot run with bosses every 10 slots.
// PR A scaffolds the mode (state + flow); upgrades and bosses are
// added in follow-up PRs.
import { LEVELS, getLevel } from './levels.js';

export const RUN_LENGTH = 100;
export const BOSS_SLOTS = new Set([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

// Dedicated boss layouts. Each is a fully-formed level config with its
// own name, hint, objective, moves, obstacles, and tip. Slot 30 is the
// final boss — everything thrown in at once.
const BOSS_LEVELS = {
  10: {
    id: 'boss-1',
    name: 'Jelly Guardian',
    moves: 28,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 1 — clear every jelly tile to defeat the Guardian.',
    tip: 'The Guardian protects 16 hits of jelly. Stack matches over the centre to break through.',
    obstacles: {
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [0, 2, 1], [2, 2, 1], [3, 2, 1], [5, 2, 1],
        [0, 3, 1], [2, 3, 1], [3, 3, 1], [5, 3, 1],
        [1, 4, 2], [4, 4, 2],
      ],
    },
  },
  20: {
    id: 'boss-2',
    name: 'Lock Tyrant',
    moves: 32,
    objective: { kind: 'score', target: 3000 },
    hint: 'BOSS 2 — reach 3,000 points through the Tyrant’s locks.',
    tip: 'Locks block swaps. Free them with adjacent matches, then push for the score.',
    obstacles: {
      locks: [
        [0, 1, 2], [5, 1, 2],
        [0, 4, 2], [5, 4, 2],
        [2, 0, 1], [3, 0, 1],
        [2, 5, 1], [3, 5, 1],
      ],
      jelly: [
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  30: {
    id: 'boss-3',
    name: 'Sweet King',
    moves: 40,
    objective: { kind: 'score', target: 5000 },
    hint: 'BOSS 3 — reach 5,000 to dethrone the Sweet King.',
    tip: 'Jelly, locks, and cherries all at once. Use everything in your bank.',
    obstacles: {
      jelly: [
        [0, 0, 2], [5, 0, 2],
        [0, 5, 2], [5, 5, 2],
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
      locks: [
        [1, 1, 1], [4, 1, 1],
        [1, 4, 1], [4, 4, 1],
      ],
      ingredients: [[2, 0], [3, 0]],
    },
  },
  40: {
    id: 'boss-4',
    name: 'Chocolate Snail',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 4 — peel the Snail\'s shell off. Clear every jelly tile.',
    tip: 'The Snail wears a 20-jelly shell. Cascades crack it fastest.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [4, 0, 2], [5, 0, 2],
        [2, 1, 2], [3, 1, 2],
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
        [2, 4, 2], [3, 4, 2],
        [0, 5, 2], [1, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },
  50: {
    id: 'boss-5',
    name: 'Padlock Pharaoh',
    moves: 38,
    objective: { kind: 'score', target: 6000 },
    hint: 'BOSS 5 — break the Pharaoh\'s sarcophagus. Reach 6,000.',
    tip: 'Halfway through the run. The Pharaoh hides behind a wall of locks. Wrapped + striped combos blast through.',
    obstacles: {
      locks: [
        [0, 1, 2], [1, 1, 2], [4, 1, 2], [5, 1, 2],
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [0, 4, 2], [1, 4, 2], [4, 4, 2], [5, 4, 2],
      ],
      jelly: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  60: {
    id: 'boss-6',
    name: 'Cherry Hydra',
    moves: 44,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'BOSS 6 — drop all six of the Hydra\'s cherry-heads.',
    tip: 'Six cherries, jelly clogging the lower rows. Drop the corners first to open lanes.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 3, 1], [5, 3, 1],
        [1, 4, 1], [4, 4, 1],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },
  70: {
    id: 'boss-7',
    name: 'Echo Wraith',
    moves: 30,
    objective: { kind: 'clearType', type: 5, target: 30 },
    hint: 'BOSS 7 — clear 30 purple hearts to silence the Wraith.',
    tip: 'The Wraith feeds on purple. Drain its colour and it fades.',
    obstacles: {
      locks: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  80: {
    id: 'boss-8',
    name: 'Lattice Queen',
    moves: 42,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 8 — dismantle the Queen\'s lattice. Clear all jelly.',
    tip: 'Double-jelly weave with sentry locks. Free the locks to flow the matches.',
    obstacles: {
      jelly: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2], [4, 2, 2],
        [1, 3, 2], [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
      ],
    },
  },
  90: {
    id: 'boss-9',
    name: 'The Confectioner',
    moves: 44,
    objective: { kind: 'score', target: 8000 },
    hint: 'BOSS 9 — beat the Confectioner at her own game. 8,000 points.',
    tip: 'She bakes obstacles into the recipe. Cherries fall, locks bind, jelly slows. Score through it all.',
    obstacles: {
      ingredients: [[1, 0], [4, 0]],
      jelly: [
        [0, 0, 1], [5, 0, 1],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [0, 5, 1], [5, 5, 1],
      ],
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
      ],
    },
  },
  100: {
    id: 'boss-10',
    name: 'Candy Kraken',
    moves: 60,
    objective: { kind: 'score', target: 12000 },
    hint: 'FINAL BOSS — the Candy Kraken. 12,000 points. 60 moves. No mercy.',
    tip: 'The kraken brings every obstacle the run threw at you. Cash in EVERY power-up. Survivors live for this.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },
};

// Map a roguelike slot (1..30) to a base level config. For now this
// just walks the first 30 hand-tuned levels; later we'll tag boss
// slots and tune difficulty per slot.
export function getRoguelikeLevel(slot) {
  const idx = Math.max(1, Math.min(RUN_LENGTH, slot));
  if (BOSS_LEVELS[idx]) {
    return { ...BOSS_LEVELS[idx], runSlot: idx, isBoss: true };
  }
  const base = LEVELS[(idx - 1) % LEVELS.length] || getLevel(1);
  return {
    ...base,
    runSlot: idx,
    isBoss: false,
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
  // Wild abilities — they FIRE on their own with big animated effects
  { id: 'lightning',   category: 'synergy',    name: 'Lightning Strike', desc: '⚡ Every 4 matches a lightning bolt clears a random row.' },
  { id: 'black-hole',  category: 'consumable', name: 'Black Hole',       desc: '🌀 At the start of each slot, a black hole devours 5 random candies.' },
  { id: 'hungry-snake',category: 'synergy',    name: 'Hungry Snake',     desc: '🐍 Make a special candy and a snake slithers across, eating 4 random tiles.' },
  // Crazy-tile spawners — they make rare poppable tiles appear more
  // often. Crazy tiles are the BEST: pop one to trigger huge effects.
  { id: 'bomb-maker',  category: 'synergy',    name: 'Bomb Maker',       desc: '💣 Every special candy you make also spawns a TNT tile somewhere on the board.' },
  { id: 'void-touched',category: 'synergy',    name: 'Void Touched',     desc: '🌀 Void crazy-tiles spawn twice as often after big matches.' },
  { id: 'storm-caller',category: 'consumable', name: 'Storm Caller',     desc: '⚡ Start of every slot, a Bolt crazy-tile appears on the board for you to pop.' },
];

const CATEGORY_COLORS = { buff: '#06A77D', consumable: '#FB5607', synergy: '#8338EC' };
export function categoryColor(cat) { return CATEGORY_COLORS[cat] || '#FFD60A'; }

// Pick 3 distinct upgrades from the pool. Bias slightly toward
// categories the player has fewer of, so the choice menu doesn't
// always show the same boring three.
export function pickUpgradeChoices(picked = [], n = 3) {
  // Allow repeats with previously-picked stack — stacking is a feature.
  const pool = UPGRADES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

// Meta skill tree — bought with gems, permanent across runs.
export const SKILL_TREE = [
  { id: 'sweet-start',  cost: 15, name: 'Sweet Start',  desc: 'Every run starts with +1 free hammer in your bank.' },
  { id: 'lucky-soul',   cost: 20, name: 'Lucky Soul',   desc: 'Lucky bar starts at 25% on every slot.' },
  { id: 'bigger-bank',  cost: 25, name: 'Bigger Bank',  desc: 'Power-up bank cap raised from 9 to 12.' },
  { id: 'wider-choice', cost: 40, name: 'Wider Choice', desc: 'Upgrade picker shows 4 choices instead of 3.' },
  { id: 'score-sage',   cost: 35, name: 'Score Sage',   desc: 'All scores in roguelike runs +10%.' },
  { id: 'boss-bonus',   cost: 50, name: 'Boss Slayer',  desc: 'Each boss cleared grants +5 extra gems.' },
  { id: 'extra-life-1', cost: 35, name: 'Extra Life',   desc: 'Start each run with one extra life (total 4).' },
  { id: 'extra-life-2', cost: 70, name: 'Two Extra Lives', desc: 'Start each run with two extra lives (total 5).' },
];

export const RUN_LIVES_BASE = 3;

export function ownedSkills(skillMap) {
  if (!skillMap || typeof skillMap !== 'object') return new Set();
  return new Set(Object.keys(skillMap).filter((id) => skillMap[id]));
}

// Gems earned for finishing a run at a given level (whether by clearing
// the final boss or running out of moves earlier). Roughly: 1 per
// regular level cleared, +5 bonus per boss cleared, +20 grand bonus
// if the whole run completes.
export function gemsEarned(reachedLevel, runComplete, skillSet = null) {
  const cleared = Math.max(0, Math.min(RUN_LENGTH, reachedLevel - 1));
  const bossBonus = (skillSet && skillSet.has && skillSet.has('boss-bonus')) ? 10 : 5;
  let gems = cleared;
  for (const boss of BOSS_SLOTS) {
    if (cleared >= boss) gems += bossBonus;
  }
  if (runComplete) gems += 50;
  return gems;
}
