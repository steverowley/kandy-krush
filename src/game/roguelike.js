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
    moves: 24,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 1 — clear every jelly tile to defeat the Guardian.',
    tip: 'The Guardian protects 16 hits of jelly. Stack matches over the centre to break through.',
    taunt: 'You shall not pass my walls of jelly!',
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
    moves: 28,
    objective: { kind: 'score', target: 3500 },
    hint: 'BOSS 2 — reach 3,500 points through the Tyrant’s locks.',
    tip: 'Locks block swaps. Free them with adjacent matches, then push for the score.',
    taunt: 'Click. Click. CLOCKED.',
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
    moves: 34,
    objective: { kind: 'score', target: 6000 },
    hint: 'BOSS 3 — reach 6,000 to dethrone the Sweet King.',
    tip: 'Jelly, locks, and cherries all at once. Use everything in your bank.',
    taunt: 'Bow before sucrose royalty.',
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
    moves: 30,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 4 — peel the Snail\'s shell off. Clear every jelly tile.',
    tip: 'The Snail wears a 20-jelly shell. Cascades crack it fastest.',
    taunt: 'Slow… and unstoppable.',
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
    moves: 32,
    objective: { kind: 'score', target: 7500 },
    hint: 'BOSS 5 — break the Pharaoh\'s sarcophagus. Reach 7,500.',
    tip: 'Halfway through the run. The Pharaoh hides behind a wall of locks. Wrapped + striped combos blast through.',
    taunt: 'Forty centuries entombed in candy.',
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
    moves: 36,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'BOSS 6 — drop all six of the Hydra\'s cherry-heads.',
    tip: 'Six cherries, jelly clogging the lower rows. Drop the corners first to open lanes.',
    taunt: 'Cut one — six grow back.',
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
    moves: 26,
    objective: { kind: 'clearType', type: 5, target: 36 },
    hint: 'BOSS 7 — clear 36 purple hearts to silence the Wraith.',
    tip: 'The Wraith feeds on purple. Drain its colour and it fades.',
    taunt: 'I am every flavor you ever forgot.',
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
    moves: 34,
    objective: { kind: 'clearJelly' },
    hint: 'BOSS 8 — dismantle the Queen\'s lattice. Clear all jelly.',
    tip: 'Double-jelly weave with sentry locks. Free the locks to flow the matches.',
    taunt: 'My web binds every move you make.',
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
    moves: 36,
    objective: { kind: 'score', target: 10000 },
    hint: 'BOSS 9 — beat the Confectioner at her own game. 10,000 points.',
    tip: 'She bakes obstacles into the recipe. Cherries fall, locks bind, jelly slows. Score through it all.',
    taunt: 'I baked this whole game from scratch, dear.',
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
    moves: 48,
    objective: { kind: 'score', target: 16000 },
    hint: 'FINAL BOSS — the Candy Kraken. 16,000 points. 48 moves. No mercy.',
    tip: 'The kraken brings every obstacle the run threw at you. Cash in EVERY power-up. Survivors live for this.',
    taunt: 'TASTE THE ABYSS.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
        [0, 5, 1], [5, 5, 1],
      ],
      locks: [
        [0, 2, 3], [5, 2, 3],
        [0, 3, 3], [5, 3, 3],
        [2, 5, 2], [3, 5, 2],
      ],
    },
  },
};

// Scale objective targets for roguelike runs so late-slot objectives
// keep up with the player's compounding multipliers, cascades, and
// power-ups. Players have been hitting 200k score on slots where the
// base target is ~5k — way too easy.
//
// Score targets scale linearly with slot: target * (1 + slot * 0.5).
//   Slot 1:   1.5×   (5k → 7.5k)
//   Slot 25: 13.5×   (5k → 67k)
//   Slot 50:   26×   (5k → 130k)
//   Slot 100:  51×   (5k → 255k)
// Matches / clearType scale more gently. clearJelly and dropIngredients
// are absolute board counts (tiles/cherries placed) and stay as-is.
function scaleObjective(obj, slot, isBoss) {
  if (!obj) return obj;
  // Bosses are hand-tuned but still bump them so they don't fall behind.
  // Boss scaling is half the non-boss curve.
  const scoreFactor = isBoss ? 1 + slot * 0.15 : 1 + slot * 0.50;
  const matchFactor = isBoss ? 1 + slot * 0.08 : 1 + slot * 0.20;
  if (obj.kind === 'score') {
    return { ...obj, target: Math.round(obj.target * scoreFactor) };
  }
  if (obj.kind === 'matches' || obj.kind === 'clearType') {
    return { ...obj, target: Math.max(obj.target, Math.round(obj.target * matchFactor)) };
  }
  return obj;
}

// For clearJelly / dropIngredients slots the obstacle count is tied
// to the board layout and we can't scale the *target* — so we
// instead reduce the move budget per-slot to make the same target
// harder to reach late game.
//   Slot 1:   -0.4% (basically unchanged)
//   Slot 25:  -10%
//   Slot 50:  -20%
//   Slot 100: -40% (capped)
// Boss slots are exempt (they're hand-tuned).
function scaleMovesForObstacleSlot(moves, slot, isBoss, objKind) {
  if (isBoss) return moves;
  if (objKind !== 'clearJelly' && objKind !== 'dropIngredients') return moves;
  const reduction = Math.min(0.40, slot * 0.004);
  return Math.max(8, Math.round(moves * (1 - reduction)));
}

// Regenerate the player-facing hint string from a (possibly scaled)
// objective. Without this, the hint text bundled into the base level
// config still reads the un-scaled target ("Reach 1,500 points.") even
// when the roguelike scaling has pushed the real target to 75,000.
// Voiceover, intro card, and level info all rely on this string.
const CANDY_TYPE_NAMES = [
  'yellow circles',
  'blue squares',
  'pink triangles',
  'orange hexagons',
  'green stars',
  'purple hearts',
];
export function formatObjectiveHint(obj) {
  if (!obj) return '';
  switch (obj.kind) {
    case 'score':
      return `Reach ${obj.target.toLocaleString()} points.`;
    case 'matches':
      return `Make ${obj.target} matches.`;
    case 'specials':
      return obj.target === 1
        ? 'Make 1 special candy.'
        : `Make ${obj.target} special candies.`;
    case 'clearType':
      return `Clear ${obj.target} ${CANDY_TYPE_NAMES[obj.type] || 'tiles of one color'}.`;
    case 'clearJelly':
      return 'Clear all the jelly tiles.';
    case 'dropIngredients':
      return obj.target === 1
        ? 'Drop 1 cherry to the bottom row.'
        : `Drop ${obj.target} cherries to the bottom row.`;
  }
  return '';
}

// Map a roguelike slot (1..100) to a base level config. Score-style
// objectives get scaled up per-slot so the late game stays challenging.
export function getRoguelikeLevel(slot) {
  const idx = Math.max(1, Math.min(RUN_LENGTH, slot));
  if (BOSS_LEVELS[idx]) {
    const boss = { ...BOSS_LEVELS[idx], runSlot: idx, isBoss: true };
    const scaledObj = scaleObjective(boss.objective, idx, true);
    boss.objective = scaledObj;
    // Boss hints have flavor text like "BOSS 5 — break the Pharaoh's
    // sarcophagus. Reach 6,000." Replace the trailing target with the
    // scaled one. Keep the flavor + boss number prefix intact.
    const bossNum = Math.floor(idx / 10);
    boss.hint = `BOSS ${bossNum} — ${formatObjectiveHint(scaledObj)}`;
    return boss;
  }
  const base = LEVELS[(idx - 1) % LEVELS.length] || getLevel(1);
  const objective = scaleObjective(base.objective, idx, false);
  const moves = scaleMovesForObstacleSlot(base.moves, idx, false, objective?.kind);
  return {
    ...base,
    objective,
    moves,
    hint: formatObjectiveHint(objective),
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
  // Phase-8k expansion — deeper archetype synergies
  { id: 'combo-streak',category: 'synergy',    archetype: 'scorer',  name: 'Combo Streak',     desc: 'Cascades of chain ≥3 score double on top of other bonuses.' },
  { id: 'chain-bomb',  category: 'synergy',    archetype: 'bomber',  name: 'Chain Bomb',       desc: 'When TNT pops, 30% chance to spawn another TNT in its blast zone.' },
  { id: 'first-free',  category: 'buff',       archetype: 'sustain', name: 'First Swap Free',  desc: 'First swap of every slot doesn\'t cost a move.' },
  { id: 'meteor',      category: 'synergy',    archetype: 'wild',    name: 'Meteor Shower',    desc: '☄️ Every 8 matches, 3 random tiles explode in a flash.' },
  { id: 'prism-maker', category: 'synergy',    archetype: 'bomber',  name: 'Prism Maker',      desc: '🌈 Every special candy you make has a 15% chance per stack to also spawn a Prism crazy tile.' },
  { id: 'gold-rush',   category: 'buff',       archetype: 'scorer',  name: 'Gold Rush',         desc: 'Every match earns a flat +20 score per stack on top of the multiplier.' },
  { id: 'thunder-foot',category: 'consumable', archetype: 'sustain', name: 'Thunder Foot',      desc: 'Every 8 swaps in a slot, gain +2 moves automatically.' },
  { id: 'crazy-magnet',category: 'synergy',    archetype: 'bomber',  name: 'Crazy Magnet',       desc: 'Every 3rd match (per slot) automatically spawns a random crazy tile.' },
  { id: 'free-bomb',   category: 'consumable', archetype: 'bomber',  name: 'Free Bomb',          desc: 'The first N Color Bombs per slot are free (N = stack count).' },
  { id: 'snowball',    category: 'synergy',    archetype: 'scorer',  name: 'Snowball',           desc: 'Each match in a slot boosts the next match\'s score by 3% per stack (compounds — late slot matches are huge).' },
  { id: 'greedy-brain',category: 'buff',       archetype: 'scorer',  name: 'Greedy Brain',       desc: 'All scores +5% per stack — a mild but always-on multiplier.' },
  { id: 'bee-storm',   category: 'synergy',    archetype: 'wild',    name: 'Bee Storm',          desc: '🐝 Every 10 matches a buzzing swarm clears 6 random tiles. Threshold drops per stack.' },
  { id: 'mover+3',     category: 'buff',       archetype: 'sustain', name: '+3 Moves',           desc: 'Every slot starts with 3 extra moves (stronger than +2 Moves).' },
  { id: 'frost',       category: 'synergy',    archetype: 'sustain', name: 'Frost',              desc: 'Every 7 swaps, every lock on the board loses 1 level per stack — auto-cracks locks over time.' },
  { id: 'hammer-rain', category: 'consumable', archetype: 'sustain', name: 'Hammer Shower',      desc: 'Start of each slot, gain +2 Hammers per stack to your bank.' },
  { id: 'lucky-magnet',category: 'synergy',    archetype: 'lucky',   name: 'Lucky Magnet',       desc: 'Each match has a 5% chance per stack to instantly fill the Lucky bar (+100).' },
  { id: 'lucky-fast-2',category: 'buff',       archetype: 'lucky',   name: 'Lucky Fast II',      desc: 'Lucky bar fills 100% faster per stack (stronger than Lucky Fast).' },
  { id: 'voodoo-doll', category: 'synergy',    archetype: 'lucky',   name: 'Voodoo Doll',        desc: 'When Lucky bar reaches READY, also gain +1 of every power-up.' },
  { id: 'mind-reader', category: 'buff',       archetype: 'lucky',   name: 'Mind Reader',        desc: 'Lucky burst multiplier is +1 per stack (×3 → ×4 → ×5 → ...).' },
  { id: 'time-freeze', category: 'synergy',    archetype: 'lucky',   name: 'Time Freeze',        desc: 'While Lucky-MODE is active, The Eater is frozen and won\'t attack.' },
  { id: 'caretaker',   category: 'buff',       archetype: 'sustain', name: 'Caretaker',          desc: 'Power-up bank cap +1 per stack. Stacks with Bigger Bank meta and Sustain synergy.' },
  { id: 'buttered',    category: 'consumable', archetype: 'sustain', name: 'Buttered Bread',     desc: 'When you would run out of moves, gain +3 moves per stack — once per slot.' },
  { id: 'heart-beat',  category: 'buff',       archetype: 'sustain', name: 'Heart Beat',         desc: 'Adds +1 to your run\'s max lives per stack. Bigger life pool for the marathon.' },
  { id: 'cascade-splash',category: 'synergy',  archetype: 'wild',    name: 'Cascade Splash',     desc: '🌊 Every cascade chain ≥2 has a 60% chance per stack to spawn a random crazy tile.' },
  { id: 'echo-match',  category: 'synergy',    archetype: 'lucky',   name: 'Echo Match',         desc: '🪞 Cascade chains ≥4 also fill your Lucky bar by +50% per stack.' },
  { id: 'tongue-tie',  category: 'synergy',    archetype: 'sustain', name: 'Tongue Tie',         desc: '👅 The Eater attacks +1 move slower per stack. Stacks with Slow Down mutator and Time Freeze.' },
  { id: 'gold-pile',   category: 'buff',       archetype: 'scorer',  name: 'Gold Pile',          desc: '💰 Each boss kill grants +5 gems per stack. Boss-rush economy.' },
  { id: 'plus-more',   category: 'buff',       archetype: 'sustain', name: 'Plus More',          desc: '➕ Each "+3 Moves" power-up gives +1 extra per stack (so +4, +5, +6, etc.).' },
  { id: 'sweet-treat', category: 'synergy',    archetype: 'scorer',  name: 'Sweet Treat',        desc: '🍬 3-tile matches score +25% per stack. Tiny matches add up.' },
  { id: 'cherry-reload',category: 'synergy',   archetype: 'lucky',   name: 'Cherry Reload',      desc: '🍒 When Lucky fires, gain +1 Shuffle per stack. Lucky-focused builds get a stream of shuffles.' },
  { id: 'wild-card',   category: 'synergy',    archetype: 'wild',    name: 'Wild Card',          desc: '🎴 Slot start: spawn 1 random crazy tile per stack. Always start with chaos.' },
  { id: 'bee-tonic',   category: 'buff',       archetype: 'lucky',   name: 'Bee Tonic',          desc: '🐝 Slot start: Lucky bar +20% per stack. Stacks with Lucky Soul and Lucky Day.' },
  { id: 'sweet-steady',category: 'buff',       archetype: 'sustain', name: 'Sweet Steady',       desc: '🍬 Slot start: gain +1 random power-up per stack. Drip restock.' },
  { id: 'power-surge', category: 'synergy',    archetype: 'scorer',  name: 'Power Surge',        desc: '⚡ 6+ tile matches score ×2 per stack. Big-match scoring explosion.' },
  { id: 'sweet-glow',  category: 'synergy',    archetype: 'lucky',   name: 'Sweet Glow',         desc: '🌅 Lucky-MODE lasts +1 extra match per stack. Stretch the burst window.' },
  { id: 'bigger-bomb', category: 'synergy',    archetype: 'bomber',  name: 'Bigger Bomb',        desc: '💥 TNT explosion radius +1 per stack (on top of Bomber synergy). Stack 2 → 5×5 → 7×7 → 9×9.' },
  { id: 'heart-steal', category: 'buff',       archetype: 'sustain', name: 'Heart Steal',        desc: '❤️ Boss kills restore +1 life per stack. Keep your hearts full through the marathon.' },
  { id: 'spark-strike',category: 'synergy',    archetype: 'wild',    name: 'Spark Strike',       desc: '✨ Every 12 matches in a slot, fire a free Lightning bolt (no Lightning upgrade required).' },
  { id: 'sweet-roar',  category: 'synergy',    archetype: 'wild',    name: 'Sweet Roar',         desc: '🐝 Slot start: fire a free Bee Storm per stack. Open big.' },
  { id: 'bomb-splash', category: 'synergy',    archetype: 'bomber',  name: 'Bomb Splash',        desc: '💧 TNT pop fills Lucky bar +15% per stack. Bomber → Lucky bridge.' },
  { id: 'lucky-reload',category: 'synergy',    archetype: 'lucky',   name: 'Lucky Reload',       desc: '🚀 When Lucky-MODE fires, +1 "+3 Moves" power-up per stack. Stacks with Cherry Reload.' },
  { id: 'furnace',     category: 'synergy',    archetype: 'wild',    name: 'Furnace',            desc: '🔥 Cascade chain ≥3 spawns a TNT crazy tile per stack. Cascade-bomber bridge.' },
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
    desc: 'No starting bonus. Total freedom to pick any path.',
    awaken: 'Awakens at 3+ upgrades of any archetype: +1 upgrade pick per slot.', start: [] },
  { id: 'bombardier',   icon: '💣', name: 'Bombardier',   archetype: 'bomber',
    desc: 'Start with Bomb Maker — every special drops a TNT crazy tile.',
    awaken: 'Awakens at 2+ 💣 Bomber upgrades: every TNT crazy tile also spawns a 🎁 power-up nearby.', start: ['bomb-maker'] },
  { id: 'charmer',      icon: '🍀', name: 'Charmer',      archetype: 'lucky',
    desc: 'Start with Lucky Fast — Lucky bar fills 50% faster.',
    awaken: 'Awakens at 2+ 🍀 Lucky upgrades: Lucky-MODE (×1.5 sustain) lasts +3 extra matches.', start: ['lucky-fast'] },
  { id: 'ironclad',     icon: '🛡', name: 'Ironclad',     archetype: 'sustain',
    desc: 'Start with +2 Moves — every slot is roomier.',
    awaken: 'Awakens at 2+ 🛡 Sustain upgrades: hammers cost no power-up on the first use per slot.', start: ['moves+2'] },
  { id: 'stormbringer', icon: '🌪', name: 'Stormbringer', archetype: 'wild',
    desc: 'Start with Lightning — bolts auto-clear rows every 4 matches.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['lightning'] },
  { id: 'champion',     icon: '⚔', name: 'Champion',     archetype: 'scorer',
    desc: 'Start with Score Boost — all scoring +25%.',
    awaken: 'Awakens at 2+ 🎯 Scorer upgrades: the FIRST match of every slot scores 5×.', start: ['score+25'] },
  // Phase 8v — additional class variety, one per archetype
  { id: 'pyromaniac',   icon: '🔥', name: 'Pyromaniac',   archetype: 'bomber',
    desc: 'Start with Chain Bomb — TNT pops have a 30% chance to chain another TNT.',
    awaken: 'Awakens at 2+ 💣 Bomber upgrades: every TNT crazy tile also spawns a 🎁 power-up nearby.', start: ['chain-bomb'] },
  { id: 'comet',        icon: '🌟', name: 'Comet',        archetype: 'wild',
    desc: 'Start with Meteor Shower — every 8 matches, 3 random tiles explode.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['meteor'] },
  { id: 'merchant',     icon: '💰', name: 'Merchant',     archetype: 'scorer',
    desc: 'Start with Combo Streak — cascade chain ≥3 doubles score.',
    awaken: 'Awakens at 2+ 🎯 Scorer upgrades: the FIRST match of every slot scores 5×.', start: ['combo-streak'] },
  { id: 'druid',        icon: '🍃', name: 'Druid',        archetype: 'sustain',
    desc: 'Start with First Swap Free — first swap of every slot is free.',
    awaken: 'Awakens at 2+ 🛡 Sustain upgrades: hammers cost no power-up on the first use per slot.', start: ['first-free'] },
  { id: 'gambler',      icon: '🃏', name: 'Gambler',      archetype: 'lucky',
    desc: 'Start with Lucky Strike — when Lucky fires, also gain +1 hammer.',
    awaken: 'Awakens at 2+ 🍀 Lucky upgrades: Lucky-MODE (×1.5 sustain) lasts +3 extra matches.', start: ['lucky-strike'] },
  // Phase 11a — hybrid class: starts with TWO upgrades from different archetypes
  { id: 'wizard',       icon: '🧙', name: 'Wizard',       archetype: 'wild',
    desc: 'Hybrid start: Combo Streak (Scorer) + Lightning (Wild). The mage life.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['combo-streak', 'lightning'] },
  // Phase 11b — more hybrids
  { id: 'ninja',        icon: '🥷', name: 'Ninja',        archetype: 'sustain',
    desc: 'Hybrid start: First Swap Free (Sustain) + Bomb Maker (Bomber). Silent and explosive.',
    awaken: 'Awakens at 2+ 🛡 Sustain upgrades: hammers cost no power-up on the first use per slot.', start: ['first-free', 'bomb-maker'] },
  { id: 'royal',        icon: '👑', name: 'Royal',        archetype: 'scorer',
    desc: 'Hybrid start: Score Boost (Scorer) + Lucky Strike (Lucky). Born of wealth and luck.',
    awaken: 'Awakens at 2+ 🎯 Scorer upgrades: the FIRST match of every slot scores 5×.', start: ['score+25', 'lucky-strike'] },
  { id: 'witch',        icon: '🔮', name: 'Witch',        archetype: 'lucky',
    desc: 'Hybrid start: Lucky Strike (Lucky) + Hungry Snake (Wild). Channels chaos magic.',
    awaken: 'Awakens at 2+ 🍀 Lucky upgrades: Lucky-MODE (×1.5 sustain) lasts +3 extra matches.', start: ['lucky-strike', 'hungry-snake'] },
  // Phase 12h — cascade-focused hybrids
  { id: 'cascadesmith', icon: '🌊', name: 'Cascadesmith',  archetype: 'wild',
    desc: 'Hybrid start: Cascade King (Scorer) + Cascade Splash (Wild). Build a chain reactor.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['cascade-king', 'cascade-splash'] },
  { id: 'sorcerer',     icon: '🌀', name: 'Sorcerer',      archetype: 'wild',
    desc: 'Hybrid start: Echo Match (Lucky) + Meteor Shower (Wild). Ride the cascades into Lucky-MODE.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['echo-match', 'meteor'] },
  // Phase 12z — hybrids using the latest upgrade additions
  { id: 'hivemind',     icon: '🐝', name: 'Hivemind',      archetype: 'lucky',
    desc: 'Hybrid start: Bee Tonic (Lucky) + Lucky Magnet (Lucky). Lucky-MODE on tap.',
    awaken: 'Awakens at 2+ 🍀 Lucky upgrades: Lucky-MODE (×1.5 sustain) lasts +3 extra matches.', start: ['bee-tonic', 'lucky-magnet'] },
  { id: 'crazy-cat',    icon: '🐱', name: 'Crazy Cat',     archetype: 'wild',
    desc: 'Hybrid start: Wild Card (Wild) + Storm Caller (Wild). Slot start is pure chaos.',
    awaken: 'Awakens at 2+ ⚡ Wild upgrades: every Lightning bolt clears a column too — full cross blast.', start: ['wild-card', 'storm-caller'] },
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
  { id: 'penny-pincher',icon: '🪙', name: 'Penny Pincher',
    desc: 'Earn +2 extra gems for every boss you defeat.' },
  { id: 'phoenix',     icon: '❤️‍🔥', name: 'Phoenix',
    desc: 'Once per run, when you would lose your last life, you instead keep 1 — and the relic is consumed.' },
  { id: 'hawkeye',     icon: '🦅', name: 'Hawkeye',
    desc: 'Hint sparkles appear after 3 idle seconds instead of the usual 8.' },
  { id: 'free-reroll', icon: '🐘', name: 'Elephant Memory',
    desc: 'Upgrade rerolls are FREE — no Shuffle cost.' },
  { id: 'prism-lens',  icon: '🔭', name: 'Prism Lens',
    desc: '🌈 Prism crazy tiles clear TWO random colors instead of one — boardwipe potential.' },
  { id: 'pinata',      icon: '🪅', name: 'Piñata',
    desc: 'Every 5 matches drops a random power-up into your bank.' },
  { id: 'big-brain',   icon: '🧠', name: 'Big Brain',
    desc: 'Every cascade level adds +25% to your score multiplier on top of the usual cascade bonus.' },
  { id: 'second-wind', icon: '🌬', name: 'Second Wind',
    desc: 'If you start a slot with only 1 life, you\'re restored to 2 instead.' },
  { id: 'whirlpool',   icon: '🌀', name: 'Whirlpool',
    desc: 'Every 10 matches the board re-shuffles in place — preserves specials, opens new opportunities.' },
  { id: 'stardust',    icon: '✨', name: 'Stardust',
    desc: 'Every cascade chain of 4 or more earns you a free 💎 mid-run.' },
  { id: 'quick-draw',  icon: '🤠', name: 'Quick Draw',
    desc: 'The first power-up you use each slot is free — doesn\'t decrement your bank.' },
  { id: 'goldfish',    icon: '🐟', name: 'Goldfish',
    desc: 'Hint sparkles appear after just 1.5 seconds idle (vs 3s with Hawkeye, 7s default).' },
  { id: 'strong-drink',icon: '🥃', name: 'Strong Drink',
    desc: 'Lucky-MODE multiplier doubles — ×3 sustain instead of ×1.5.' },
  { id: 'bottomless',  icon: '🍴', name: 'Bottomless Stomach',
    desc: 'Every match counts as 2 toward the slot\'s objective (huge for matches / clearType targets).' },
  { id: 'sweet-smith', icon: '🛠', name: 'Sweet Smith',
    desc: 'Every 5 swaps, your most-depleted power-up gets +1. Keeps every slot topped up.' },
  { id: 'coin-purse',  icon: '👛', name: 'Coin Purse',
    desc: 'Every 10 matches in a slot earns you +1 💎 right away.' },
  { id: 'lucky-twin',  icon: '👯', name: 'Lucky Twin',
    desc: 'Lucky Strike now grants TWO hammers per Lucky fire instead of one.' },
  { id: 'twin-mirror', icon: '🪞', name: 'Twin Mirror',
    desc: 'Matches of 5+ tiles score ×3. Stacks with Big Match upgrade (×2 per stack).' },
  { id: 'crimson-rose',icon: '🌹', name: 'Crimson Rose',
    desc: 'The very first match of every slot scores ×5. Use specials early for huge openings.' },
  { id: 'ladybug',     icon: '🐞', name: 'Lucky Ladybug',
    desc: 'Every 11 matches in a slot, a random power-up appears in your bank.' },
  { id: 'sweet-spell', icon: '📖', name: 'Sweet Spell',
    desc: 'Every 7 swaps in a slot, your Lucky bar gains +25%.' },
  { id: 'spice-box',   icon: '🌶', name: 'Spice Box',
    desc: 'Every 12 matches in a slot, a random crazy tile spawns somewhere on the board.' },
  { id: 'honey-trap',  icon: '🍯', name: 'Honey Trap',
    desc: 'On BOSS slots only, the first 3 matches score ×3. Big-opener for boss fights.' },
  { id: 'confectionery',icon: '🧁', name: 'Confectionery',
    desc: 'Each special candy created also drops a random power-up into your bank.' },
  { id: 'cracked-mirror',icon: '🪞', name: 'Cracked Mirror',
    desc: 'Matches of 5+ tiles also fill your Lucky bar by +20%.' },
  { id: 'sundae-saturday',icon: '🍨', name: 'Sundae Saturday',
    desc: 'Every 8 matches in a slot, gain +1 "+3 Moves" power-up. Slow drip of move income.' },
  { id: 'sugar-crash',  icon: '💥', name: 'Sugar Crash',
    desc: 'Every 14 matches in a slot, spawn a TNT crazy tile somewhere. Mid-late slot bursts.' },
  { id: 'sunrise-hour', icon: '🌅', name: 'Sunrise Hour',
    desc: 'On slots 1-10, all scores ×1.5. Early-game ramp.' },
  { id: 'sunset-hour',  icon: '🌇', name: 'Sunset Hour',
    desc: 'On slots 96-100, all scores ×2. End-game payoff for the long haul.' },
  { id: 'bone-charm',   icon: '🦴', name: 'Bone Charm',
    desc: 'Locks decrement by 2 per hit instead of 1. Lock-heavy boards melt fast.' },
  { id: 'sweet-reset',  icon: '🔄', name: 'Sweet Reset',
    desc: 'Shuffles are FREE during boss slots. Reorganize the board for free big-match openings.' },
  { id: 'pixie-pouch',  icon: '👜', name: 'Pixie Pouch',
    desc: 'Every 18 matches in a slot, gain +1 of EVERY power-up. Burst restock for marathon slots.' },
  { id: 'sour-drop',    icon: '🍋', name: 'Sour Drop',
    desc: 'Every 13 swaps in a slot, your Lucky bar gains +50%. Bigger jolts than Sweet Spell.' },
  { id: 'fairy-light',  icon: '🧚', name: 'Fairy Light',
    desc: 'Hint sparkles appear after just 0.8 sec idle. The fastest hint relic.' },
  { id: 'sweet-memory', icon: '🧠', name: 'Sweet Memory',
    desc: 'Every power-up use grants +5% Lucky bar. Build Lucky-MODE off your power-up bank.' },
  { id: 'glow-stick',   icon: '🌟', name: 'Glow Stick',
    desc: 'Cascade chains ≥6 instantly trigger Lucky-MODE, regardless of the Lucky bar.' },
  { id: 'bee-wing',     icon: '🐝', name: 'Bee Wing',
    desc: 'Every Lucky-MODE match also spawns a random crazy tile. Lucky-MODE turns into chaos-mode.' },
  { id: 'bomb-squad',   icon: '💣', name: 'Bomb Squad',
    desc: 'When TNT pops, also drop a random power-up into your bank. Stacks with Bombardier awakening.' },
  { id: 'frosty-crown', icon: '❄️', name: 'Frosty Crown',
    desc: 'Slot start: every lock on the board loses 1 level. Lock-heavy boards open up faster.' },
  { id: 'lucky-whistle',icon: '🎺', name: 'Lucky Whistle',
    desc: 'When Lucky-MODE triggers, also drop a random power-up into your bank.' },
  { id: 'healing-hum',  icon: '🎶', name: 'Healing Hum',
    desc: 'When Lucky-MODE ends naturally (window expires), gain +1 max life.' },
  { id: 'cherry-wand',  icon: '🌸', name: 'Cherry Wand',
    desc: 'Each special candy created also fills your Lucky bar by +25%.' },
  { id: 'tea-time',     icon: '🫖', name: 'Tea Time',
    desc: 'Slot start: Lucky bar +30%. Gentle opening sip.' },
  { id: 'sweet-wreath', icon: '🎄', name: 'Sweet Wreath',
    desc: 'Slot start: every jelly tile loses 1 level. Mass jelly-decrement (mirrors Frosty Crown for locks).' },
  { id: 'storm-heart',  icon: '⛈', name: 'Storm Heart',
    desc: 'At 1 life remaining, ALL matches score ×2. High-stakes comeback.' },
  { id: 'sweet-cushion',icon: '🛏', name: 'Sweet Cushion',
    desc: 'Slot starts at 1 life: +5 moves AND +50% Lucky bar. Last-stand cushion.' },
  { id: 'sweet-throne', icon: '👑', name: 'Sweet Throne',
    desc: 'On boss kill, gain +1 of EVERY power-up. Bigger restock than Boss Bounty.' },
  { id: 'joker',        icon: '🃏', name: 'Joker',
    desc: 'Crossroads events show 4 options instead of 3. More choice, more strategy.' },
  { id: 'sweet-smile',  icon: '😊', name: 'Sweet Smile',
    desc: '25% chance to keep a life when you would lose one. Anti-frustration cushion.' },
  { id: 'power-up',     icon: '🔋', name: 'Power Up',
    desc: 'Every 10 swaps in a slot, gain +1 of EVERY power-up.' },
];

// rng defaults to Math.random for the normal run path; daily-seed runs
// pass a seeded mulberry32 from src/game/rng.js so every player on the
// same calendar day sees the same draft.
export function pickRelicChoices(owned = [], n = 3, rng = Math.random) {
  const ownedSet = new Set(owned);
  const pool = RELICS.filter((r) => !ownedSet.has(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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
  { id: 'eclipse',     icon: '🌑', name: 'Eclipse',
    desc: 'Free moves! The move counter only ticks every OTHER swap.' },
  { id: 'gift-slot',   icon: '🎁', name: 'Gift Slot',
    desc: 'Start the slot with +1 of every power-up.' },
  { id: 'unicorn',     icon: '🦄', name: 'Unicorn Day',
    desc: 'Every match score is multiplied by a random ×0.5 to ×3.' },
  { id: 'sweet-tooth', icon: '🍭', name: 'Sweet Tooth',
    desc: 'Every special candy you create becomes a RAINBOW.' },
  { id: 'hammer-time', icon: '🔨', name: 'Hammer Time',
    desc: 'Hammers are FREE this slot — bank doesn\'t decrement.' },
  { id: 'lockpick',    icon: '🗝', name: 'Lockpick',
    desc: 'Slot starts with EVERY lock weakened by 1 level — easier crack.' },
  { id: 'treasure',    icon: '💰', name: 'Treasure Slot',
    desc: 'Finishing this slot grants +5 💎 on top of the usual reward.' },
  { id: 'surprise-life',icon: '💝', name: 'Surprise Life',
    desc: '+1 Life at the start of this slot. Pure defensive buff.' },
  { id: 'slow-down',   icon: '🐢', name: 'Slow Down',
    desc: 'The Eater skips this slot entirely. Plan your matches in peace.' },
  { id: 'big-money',   icon: '💵', name: 'Big Money',
    desc: '+10 💎 immediately at slot start. Pure gem income for the Skill Tree.' },
  { id: 'confetti-day',icon: '🎊', name: 'Confetti Day',
    desc: 'Every match earns a flat +50 score and a burst of confetti — pure party.' },
  { id: 'long-lunch',  icon: '🥪', name: 'Long Lunch',
    desc: '+10 moves at slot start. Take your time.' },
  { id: 'time-bonus',  icon: '⏰', name: 'Time Bonus',
    desc: 'On slot win, each leftover move converts to +30 score. Stacks with Crown of Sweetness (50/move).' },
  { id: 'eraser',      icon: '✏️', name: 'Eraser',
    desc: 'Clears 3 random tiles at slot start (could create a cascade — or just open the board).' },
  { id: 'bottomless-cup',icon: '🍵', name: 'Bottomless Cup',
    desc: 'Every match adds +20% to the Lucky bar. Trigger Lucky-MODE almost every move.' },
  { id: 'sweet-boost', icon: '🧁', name: 'Sweet Boost',
    desc: 'First 5 matches of every slot score ×2 (think Sugar Rush relic but more).' },
  { id: 'powerup-party', icon: '🎉', name: 'Powerup Party',
    desc: 'EVERY power-up is FREE this slot. Bank doesn\'t decrement on use.' },
  { id: 'buffet-day',  icon: '🥪', name: 'Buffet Day',
    desc: 'Every match counts double toward the objective. Slots end fast.' },
  { id: 'hammer-storm',icon: '🔨', name: 'Hammer Storm',
    desc: 'Start of slot, gain +3 Hammers. Smash through the obstacles.' },
  { id: 'bomb-cache',  icon: '💣', name: 'Bomb Cache',
    desc: 'Start of slot, gain +2 Color Bombs. Big boom potential.' },
  { id: 'diamond-mine', icon: '⛏', name: 'Diamond Mine',
    desc: 'Every 6 matches in this slot earns you +1 💎. Pure gem mining.' },
  { id: 'big-crit',    icon: '⚔️', name: 'Big Crit',
    desc: 'All cascades (chain ≥2) score ×4 this slot. Build them up.' },
  { id: 'mega-mode',   icon: '💪', name: 'Mega Mode',
    desc: 'Every match scores ×3 this slot. Stronger than Golden Hour.' },
  { id: 'bonus-round', icon: '🎰', name: 'Bonus Round',
    desc: '+10 💎 at slot start AND every match scores ×1.5 this slot.' },
  { id: 'snowstorm',   icon: '🌨', name: 'Snowstorm',
    desc: 'Every match earns a flat +10 per cleared tile (so a 5-tile match is +50 bonus score).' },
  { id: 'spell-power', icon: '🔮', name: 'Spell Power',
    desc: 'Wild auto-fire abilities (Lightning / Meteor / Bee Storm) trigger 2× faster this slot.' },
  { id: 'sweet-crit-day',icon: '💥', name: 'Sweet Crit Day',
    desc: '5+ tile matches score ×5 this slot. Stacks multiplicatively with everything.' },
  { id: 'lucky-stream',icon: '🍀', name: 'Lucky Stream',
    desc: 'Lucky bar fills 3× faster this slot. Burst-mode every few swaps.' },
  { id: 'coin-toss',   icon: '🪙', name: 'Coin Toss',
    desc: 'Every match has a 25% chance to drop a random power-up. Big variance.' },
  { id: 'power-friday',icon: '🎉', name: 'Power Friday',
    desc: 'Power-up bank cap doubled this slot (e.g. 9 → 18, 12 → 24).' },
  { id: 'lock-free-day',icon: '🗝', name: 'Lock-Free Day',
    desc: 'All locks vanish at slot start. Free movement.' },
];

export function isMutatorSlot(slot) {
  // Every slot ending in 5 (5, 15, 25, ...) and never a boss slot.
  return slot > 0 && slot % 5 === 0 && !BOSS_SLOTS.has(slot);
}

export function pickRandomMutator(rng = Math.random) {
  return MUTATORS[Math.floor(rng() * MUTATORS.length)];
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
export function pickUpgradeChoices(picked = [], n = 3, rng = Math.random) {
  // Allow repeats with previously-picked stack — stacking is a feature.
  const pool = UPGRADES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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
  // Phase-8u expansion
  { id: 'free-reroll-1',cost: 45, name: 'Free First Reroll',  desc: 'First upgrade reroll of every slot is free (no Shuffle cost).' },
  { id: 'crazy-sense',  cost: 50, name: 'Crazy Sense',        desc: 'Crazy tiles spawn 50% more often from big matches.' },
  { id: 'early-awaken', cost: 60, name: 'Early Awakening',    desc: 'Your class awakens with one fewer archetype upgrade than usual.' },
  { id: 'daily-bonus',  cost: 40, name: 'Daily Bonus',        desc: 'Earn +1 extra 💎 for every slot you clear (on top of the base 1 per slot).' },
  { id: 'generous-daily', cost: 50, name: 'Generous Daily',    desc: 'Your daily login gem bonus is doubled.' },
  { id: 'powerful-start', cost: 55, name: 'Powerful Start',    desc: 'Slot 1 of every run grants +2 of every power-up (instead of +1).' },
  { id: 'gem-magnet',     cost: 65, name: 'Gem Magnet',         desc: 'All gems earned at the end of a run +10%. Compounds with every other gem source.' },
  { id: 'boss-bounty',    cost: 55, name: 'Boss Bounty',        desc: 'Each boss defeated also grants +1 of a random power-up.' },
  { id: 'treasure-sense', cost: 50, name: 'Treasure Sense',     desc: 'Treasure mutator slots grant +5 extra gems (10 total).' },
  { id: 'lucky-aura',    cost: 80, name: 'Lucky Aura',          desc: 'In Roguelike runs, Lucky bar fills 25% faster on every slot. Compounds with Lucky Fast upgrades and Lucky synergy.' },
  { id: 'crit-eye',      cost: 70, name: 'Crit Eye',            desc: 'First match of every slot scores ×1.5. Stacks with Crimson Rose / Sugar Rush relics.' },
  { id: 'pocket-friend', cost: 75, name: 'Pocket Friend',       desc: 'Every run starts with 1 random relic already in your inventory.' },
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
  const perSlotBonus = (skillSet && skillSet.has && skillSet.has('daily-bonus')) ? 1 : 0;
  let gems = cleared + perSlotBonus * cleared;
  for (const boss of BOSS_SLOTS) {
    if (cleared >= boss) gems += bossBonus;
  }
  if (runComplete) gems += 50;
  if (skillSet && skillSet.has && skillSet.has('gem-magnet')) {
    gems = Math.floor(gems * 1.1);
  }
  return gems;
}
