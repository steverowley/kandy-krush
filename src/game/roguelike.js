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
// doubles its effect. Each upgrade is tagged with one of five
// ARCHETYPES, which drive build-synergy bonuses (see synergyBonus).
//   🎯 scorer  — pile up points
//   💣 bomber  — crazy tiles + explosions
//   🍀 lucky   — Lucky bar engine
//   🛡 sustain — endurance, moves, bank
//   ⚡ wild    — auto-fire chaos abilities
export const UPGRADES = [
  // Stat buffs
  { id: 'moves+2',     category: 'buff',       archetype: 'sustain', name: '+2 Moves',       desc: 'Every slot starts with 2 extra moves.' },
  { id: 'hammer+1',    category: 'buff',       archetype: 'sustain', name: 'Extra Hammer',   desc: 'Each slot starts with +1 free hammer in your bank.' },
  { id: 'lucky-fast',  category: 'buff',       archetype: 'lucky',   name: 'Lucky Fast',     desc: 'Lucky bar fills 50% faster per swap.' },
  { id: 'score+25',    category: 'buff',       archetype: 'scorer',  name: 'Score Boost',    desc: 'Matches and combos score 25% more.' },
  // Per-slot consumables
  { id: 'slot-bomb',   category: 'consumable', archetype: 'bomber',  name: 'Slot Bomb',      desc: 'Start of each slot, gain +1 Color Bomb.' },
  { id: 'slot-shuffle',category: 'consumable', archetype: 'sustain', name: 'Slot Shuffle',   desc: 'Start of each slot, gain +1 Shuffle.' },
  { id: 'slot-plus3',  category: 'consumable', archetype: 'sustain', name: 'Slot +3 Moves',  desc: 'Start of each slot, gain +1 "+3 Moves" charge.' },
  // Synergies — pair with existing systems
  { id: 'lucky-strike',category: 'synergy',    archetype: 'lucky',   name: 'Lucky Strike',   desc: 'When Lucky fires, also gain +1 hammer.' },
  { id: 'cascade-king',category: 'synergy',    archetype: 'scorer',  name: 'Cascade King',   desc: 'Cascades (chain ≥2) score 50% more on top of the usual bonus.' },
  { id: 'big-match',   category: 'synergy',    archetype: 'scorer',  name: 'Big Match',      desc: 'Matches of 5+ tiles score double.' },
  // Wild abilities — they FIRE on their own with big animated effects
  { id: 'lightning',   category: 'synergy',    archetype: 'wild',    name: 'Lightning Strike', desc: '⚡ Every 4 matches a lightning bolt clears a random row.' },
  { id: 'black-hole',  category: 'consumable', archetype: 'wild',    name: 'Black Hole',       desc: '🌀 At the start of each slot, a black hole devours 5 random candies.' },
  { id: 'hungry-snake',category: 'synergy',    archetype: 'wild',    name: 'Hungry Snake',     desc: '🐍 Make a special candy and a snake slithers across, eating 4 random tiles.' },
  // Crazy-tile spawners
  { id: 'bomb-maker',  category: 'synergy',    archetype: 'bomber',  name: 'Bomb Maker',       desc: '💣 Every special candy you make also spawns a TNT tile somewhere on the board.' },
  { id: 'void-touched',category: 'synergy',    archetype: 'bomber',  name: 'Void Touched',     desc: '🌀 Void crazy-tiles spawn twice as often after big matches.' },
  { id: 'storm-caller',category: 'consumable', archetype: 'bomber',  name: 'Storm Caller',     desc: '⚡ Start of every slot, a Bolt crazy-tile appears on the board for you to pop.' },
];

const CATEGORY_COLORS = { buff: '#06A77D', consumable: '#FB5607', synergy: '#8338EC' };
export function categoryColor(cat) { return CATEGORY_COLORS[cat] || '#FFD60A'; }

// ===== Build archetypes =====
// Five archetypes drive the synergy system. Each card is tagged with
// one of these. The more cards you hold in an archetype, the stronger
// its passive synergy bonus.
export const ARCHETYPES = {
  scorer:  { icon: '🎯', name: 'Scorer',  color: '#FFD60A',
             desc: 'Stacking scorers ramp your score multiplier.' },
  bomber:  { icon: '💣', name: 'Bomber',  color: '#FB5607',
             desc: 'Stacking bombers grow TNT blast radius.' },
  lucky:   { icon: '🍀', name: 'Lucky',   color: '#06A77D',
             desc: 'Stacking luckies make the Lucky bar fill faster.' },
  sustain: { icon: '🛡', name: 'Sustain', color: '#3A86FF',
             desc: 'Stacking sustain raises your power-up bank cap.' },
  wild:    { icon: '⚡', name: 'Wild',    color: '#8338EC',
             desc: 'Stacking wild speeds up the auto-fire abilities.' },
};
// ===== Starting classes =====
// Picked once at run start. Each class grants free starting upgrades
// that push the run in a particular direction — without locking the
// player out of any pivot. Wanderer is the neutral pick.
export const CLASSES = [
  { id: 'wanderer',     icon: '🎲', name: 'Wanderer',     archetype: null,
    desc: 'No starting bonus. Total freedom to pick any path.',          start: [] },
  { id: 'bombardier',   icon: '💣', name: 'Bombardier',   archetype: 'bomber',
    desc: 'Start with Bomb Maker — every special drops a TNT crazy tile.', start: ['bomb-maker'] },
  { id: 'charmer',      icon: '🍀', name: 'Charmer',      archetype: 'lucky',
    desc: 'Start with Lucky Fast — Lucky bar fills 50% faster.',          start: ['lucky-fast'] },
  { id: 'ironclad',     icon: '🛡', name: 'Ironclad',     archetype: 'sustain',
    desc: 'Start with +2 Moves — every slot is roomier.',                  start: ['moves+2'] },
  { id: 'stormbringer', icon: '🌪', name: 'Stormbringer', archetype: 'wild',
    desc: 'Start with Lightning — bolts auto-clear rows every 4 matches.', start: ['lightning'] },
  { id: 'champion',     icon: '⚔', name: 'Champion',     archetype: 'scorer',
    desc: 'Start with Score Boost — all scoring +25%.',                    start: ['score+25'] },
];
export function getClass(id) {
  return CLASSES.find((c) => c.id === id) || null;
}

// ===== Relics =====
// Awarded after every boss win — pick 1 of 3 random relics. Each
// relic is rare (max ~9 per run) and gives the run a distinct twist
// distinct from the stacking upgrade system.
export const RELICS = [
  { id: 'top-hat',     icon: '🎩', name: 'Top Hat',
    desc: 'Every 5 swaps, a random power-up appears in your bank.' },
  { id: 'slow-turtle', icon: '🐢', name: 'Slow Turtle',
    desc: 'Start each slot with +5 extra moves.' },
  { id: 'sugar-rush',  icon: '🍰', name: 'Sugar Rush',
    desc: 'First 3 matches of every slot score 3×.' },
  { id: 'crown',       icon: '👑', name: 'Crown of Sweetness',
    desc: 'On slot win, every leftover move converts to 50 bonus points.' },
  { id: 'slot-machine',icon: '🎰', name: 'Slot Machine',
    desc: 'Every swap has an 8% chance to spawn a random crazy tile.' },
  { id: 'iron-tongue', icon: '🦴', name: 'Iron Tongue',
    desc: 'Slot start: one random lock auto-breaks one level.' },
  { id: 'echo-drone',  icon: '🛰', name: 'Echo Drone',
    desc: 'Every special candy you make also adds +10% to the Lucky bar.' },
  { id: 'mirror',      icon: '🪞', name: 'Mirror Shard',
    desc: '4-in-a-row matches score 50% more on top of any other bonuses.' },
];

export function pickRelicChoices(owned = [], n = 3) {
  const ownedSet = new Set(owned);
  const pool = RELICS.filter((r) => !ownedSet.has(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // If the player has somehow collected every relic, recycle the pool
  // (lets the run keep awarding picks even past the cap).
  if (pool.length < n) return RELICS.slice(0, n);
  return pool.slice(0, n);
}

export function getRelic(id) {
  return RELICS.find((r) => r.id === id) || null;
}

// ===== Slot mutators =====
// Random "weather" events that fire on every 5th slot (skipping
// bosses). They last for that one slot only and grant a powerful
// short-term buff that changes how the slot plays.
export const MUTATORS = [
  { id: 'golden-hour', icon: '☀️', name: 'Golden Hour',
    desc: 'ALL scores ×2 this slot.' },
  { id: 'diamond-day', icon: '💎', name: 'Diamond Day',
    desc: 'Every match earns a flat +100 bonus.' },
  { id: 'lucky-day',   icon: '🍀', name: 'Lucky Day',
    desc: 'Lucky bar starts at FULL charge — first match is a triple.' },
  { id: 'quick-slot',  icon: '🌪', name: 'Quick Slot',
    desc: '+5 free moves and the move counter feels fast.' },
  { id: 'crazy-rain',  icon: '💫', name: 'Crazy Rain',
    desc: 'A crazy tile spawns every 4 swaps.' },
  { id: 'big-spender', icon: '🏆', name: 'Big Spender',
    desc: 'Matches of 5+ score 3× more.' },
];

export function isMutatorSlot(slot) {
  // Every slot ending in 5 (5, 15, 25, ...) and never a boss slot.
  return slot > 0 && slot % 5 === 0 && !BOSS_SLOTS.has(slot);
}

export function pickRandomMutator() {
  return MUTATORS[Math.floor(Math.random() * MUTATORS.length)];
}

export function getMutator(id) {
  return MUTATORS.find((m) => m.id === id) || null;
}

export function archetypeFor(id) {
  const u = UPGRADES.find((x) => x.id === id);
  return u ? u.archetype : null;
}
export function archetypeCounts(activeIds) {
  const counts = { scorer: 0, bomber: 0, lucky: 0, sustain: 0, wild: 0 };
  if (!activeIds) return counts;
  for (const id of activeIds) {
    const a = archetypeFor(id);
    if (a && counts[a] !== undefined) counts[a]++;
  }
  return counts;
}
// Synergy curve — flat below 2 in an archetype, then a smooth bonus
// per additional stack. Returns a normalised "stack-above-baseline"
// number so callers can compute their own scaling.
export function synergyStacks(archCount) {
  return Math.max(0, archCount - 1);
}

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
