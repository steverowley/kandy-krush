import { Board } from './game/board.js';
import { findMatches, deriveNewSpecials, activationClears, detectCombo, applyCombo } from './game/match.js';
import { applyGravity } from './game/cascade.js';
import { calcScore } from './game/score.js';
import { findAnyValidSwap, hasAnyValidSwap, reshuffle } from './game/hint.js';
import {
  LEVELS,
  getLevel,
  nextLevelId,
  isLastLevel,
  progressTowardObjective,
  starsForLevel,
} from './game/levels.js';
import {
  RUN_LENGTH,
  BOSS_SLOTS,
  getRoguelikeLevel,
  gemsEarned,
  UPGRADES,
  pickUpgradeChoices,
  categoryColor,
  SKILL_TREE,
  ownedSkills,
  RUN_LIVES_BASE,
} from './game/roguelike.js';
import {
  renderBoard,
  setScore,
  setBest,
  setStreak,
  flashMessage,
  applyTheme,
  animateSwap,
  animatePop,
  showHintGlow,
  clearHintGlow,
  showAchievement,
  setLevelUI,
  setLevelChip,
  showLevelComplete,
  showLevelFail,
  hideLevelOverlay,
  bumpMoveCounter,
  flashObjectiveDelta,
  showLevelIntro,
  showWelcome,
  showCascadeBanner,
  popNewSpecial,
  setPowerupCounts,
  setHammerArmed,
  setArmedTool,
  setComboMeter,
  setLuckyCharge,
  showChangelog,
  showUpgradePicker,
  showSkillTree,
} from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createSettingsUI } from './ui/settings.js';
import { createLevelSelect } from './ui/levelSelect.js';
import { createAchievements } from './ui/achievements.js';
import * as sfx from './audio/sfx.js';
import * as speech from './audio/speech.js';
import * as haptics from './audio/haptics.js';
import {
  spawnFloatingNumber,
  spawnTileSparkles,
  spawnPopSpecks,
  spawnConfetti,
  drawMatchTrails,
  spawnShockwave,
  spawnScreenFlash,
  screenShake,
  spawnStarRain,
  spawnLightningRow,
  spawnBlackHole,
  spawnSnake,
  spawnEater,
  showEaterTelegraph,
  clearEaterTelegraph,
} from './ui/particles.js';
import {
  load as loadSave,
  save as saveSave,
  bumpStreakForToday,
  resetProgress as resetProgressSave,
} from './storage/save.js';

const COLS = 6;
const ROWS = 6;
const CANDY_TYPES = 6;

const persistedRaw = loadSave();
const persisted = bumpStreakForToday(persistedRaw);

const state = {
  board: new Board(COLS, ROWS, CANDY_TYPES),
  score: 0,
  highScore: persisted.highScore,
  streak: persisted.streak,
  lastPlayedDate: persisted.lastPlayedDate,
  busy: false,
  selected: null,
  settings: { ...persisted.settings },
  levelProgress: { ...persisted.levelProgress },
  level: null,
  movesRemaining: 0,
  progress: {
    type: {},
    matches: 0,
    specials: 0,
    jellyRemaining: 0,
    jellyTotal: 0,
    ingredientsTotal: 0,
    ingredientsDropped: 0,
  },
  jellyMap: new Map(),
  lockMap: new Map(),
  resolved: false,
  almostFired: false,
  seenWelcome: persisted.seenWelcome,
  seenVersion: persisted.seenVersion,
  installPromptDismissedAt: persisted.installPromptDismissedAt || 0,
  armedTool: null,
  luckyCharge: 0,
  luckyReady: false,
  luckyMode: false,
  luckyModeRemaining: 0,
  comboLevel: 0,
  // Roguelike run state — currentSlot mirrors levelProgress.roguelike but
  // we also track whether the level we're playing is part of an active run.
  roguelike: persisted.roguelike || {
    currentSlot: 1, gems: 0, runsCompleted: 0, runsStarted: 0, bestSlot: 0,
  },
  inRoguelikeRun: false,
  // Upgrades collected during the current run. Reset when a run begins.
  runUpgrades: [],
};

function upgradeCount(id) {
  return state.runUpgrades.filter((u) => u === id).length;
}

// Counters for upgrades that trigger on a schedule. Reset per slot.
let lightningCounter = 0;
let eaterCounter = 0;
let eaterPendingColumn = -1;
const EATER_FROM_SLOT = 9;
const EATER_EVERY_MOVES = 5;
const EATER_BITE = 3;
function resetAbilityCounters() {
  lightningCounter = 0;
  eaterCounter = 0;
  eaterPendingColumn = -1;
  clearEaterTelegraph();
}

function pickEaterColumn() {
  if (!state.board) return -1;
  const cols = [];
  for (let c = 0; c < state.board.cols; c++) {
    for (let r = 0; r < EATER_BITE; r++) {
      if (!state.board.isIngredient(c, r) && (state.lockMap.get(`${c},${r}`) || 0) === 0) {
        cols.push(c);
        break;
      }
    }
  }
  if (cols.length === 0) return -1;
  return cols[Math.floor(Math.random() * cols.length)];
}

async function fireEater() {
  if (!state.board) return;
  const col = eaterPendingColumn >= 0 ? eaterPendingColumn : pickEaterColumn();
  eaterPendingColumn = -1;
  clearEaterTelegraph();
  if (col < 0) return;
  const positions = [];
  for (let r = 0; r < EATER_BITE && r < state.board.rows; r++) {
    if (state.board.isIngredient(col, r)) continue;
    if ((state.lockMap.get(`${col},${r}`) || 0) > 0) continue;
    positions.push({ c: col, r });
  }
  spawnEater(col, EATER_BITE);
  flashMessage('🦷 THE EATER!', 1600);
  speech.speak('The eater');
  haptics.epic();
  screenShake(7, 420);
  // Wait for the descend animation to bring the jaws down
  await delay(820);
  state.board.clear(positions);
  decrementJellyAt(positions);
  renderBoard(state.board, state);
  await delay(220);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
}

function maybeFireEater() {
  if (state.settings.mode !== 'roguelike') return;
  if (!state.level || !state.level.runSlot) return;
  if (state.level.runSlot < EATER_FROM_SLOT) return;
  if (state.level.isBoss) return; // bosses are punishing enough
  eaterCounter++;
  const movesUntilFire = EATER_EVERY_MOVES - eaterCounter;
  // Telegraph window: pick the column 2 moves early and show a warning
  // arrow above it each remaining turn (Slay-the-Spire intent reads).
  if (movesUntilFire === 2) {
    eaterPendingColumn = pickEaterColumn();
    if (eaterPendingColumn >= 0) {
      showEaterTelegraph(eaterPendingColumn, movesUntilFire);
      flashMessage('🦷 The Eater is coming…', 1400);
      speech.speak('The eater is coming');
    }
  } else if (movesUntilFire === 1 && eaterPendingColumn >= 0) {
    showEaterTelegraph(eaterPendingColumn, 1);
    flashMessage('🦷 The Eater is HERE next turn!', 1400);
  } else if (movesUntilFire <= 0) {
    eaterCounter = 0;
    setTimeout(() => fireEater(), 400);
  }
}

async function fireLightning() {
  if (!state.board) return;
  const r = Math.floor(Math.random() * state.board.rows);
  const positions = [];
  for (let c = 0; c < state.board.cols; c++) {
    if (state.board.isIngredient(c, r)) continue;
    if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
    positions.push({ c, r });
  }
  if (positions.length === 0) return;
  spawnLightningRow(r);
  flashMessage('⚡ LIGHTNING STRIKE!', 1200);
  speech.speak('Lightning strike');
  sfx.playMatch(positions.length, 2);
  haptics.epic();
  screenShake(6, 320);
  await delay(220);
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  decrementJellyAt(positions);
  renderBoard(state.board, state);
  await delay(140);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  // Cascade any resulting matches
  let result = findMatches(state.board);
  let lvl = 1;
  while (result.positions.length > 0) {
    await processMatchRound(result, lvl, null);
    result = findMatches(state.board);
    lvl++;
  }
}

function maybeTriggerLightning() {
  const stacks = upgradeCount('lightning');
  if (stacks <= 0) return;
  lightningCounter++;
  // Each stack reduces the threshold by 1, minimum every 2 matches.
  const threshold = Math.max(2, 4 - (stacks - 1));
  if (lightningCounter >= threshold) {
    lightningCounter = 0;
    fireLightning();
  }
}

// ---------- Crazy tiles ----------
const CRAZY_KINDS = ['tnt', 'void', 'bolt'];

function pickCrazyKind() {
  const weights = { tnt: 1, void: 1 + upgradeCount('void-touched'), bolt: 1 };
  let total = 0;
  for (const k of CRAZY_KINDS) total += weights[k] || 1;
  let pick = Math.random() * total;
  for (const k of CRAZY_KINDS) {
    pick -= weights[k] || 1;
    if (pick < 0) return k;
  }
  return 'tnt';
}

function findCrazyHostCell() {
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      const cell = state.board.cell(c, r);
      if (!cell || cell.crazy || cell.special || cell.ingredient) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function spawnCrazyTile(kind) {
  const target = findCrazyHostCell();
  if (!target) return;
  const cell = state.board.cell(target.c, target.r);
  cell.crazy = kind;
  renderBoard(state.board, state);
  spawnTileSparkles(target.c, target.r, 14, { color: '#FF006E' });
  const labels = { tnt: 'TNT', void: 'Void', bolt: 'Bolt' };
  flashMessage(`${labels[kind]} appeared! Pop it!`, 1500);
  haptics.specialBirth();
}

function maybeSpawnCrazyOnMatch(matchSize, cascadeLevel) {
  let chance = 0;
  if (matchSize >= 5) chance += 0.18;
  if (matchSize >= 6) chance += 0.14;
  if (cascadeLevel >= 3) chance += 0.10;
  if (cascadeLevel >= 5) chance += 0.10;
  if (chance <= 0) return;
  if (Math.random() > chance) return;
  spawnCrazyTile(pickCrazyKind());
}

async function triggerCrazyEffect(pos, kind) {
  let positions = [];
  if (kind === 'tnt') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = pos.c + dc, r = pos.r + dr;
        if (c < 0 || c >= state.board.cols) continue;
        if (r < 0 || r >= state.board.rows) continue;
        if (state.board.isIngredient(c, r)) continue;
        positions.push({ c, r });
      }
    }
    flashMessage('💣 BOOM!', 1300);
    speech.speak('Boom!');
    sfx.playMatch(positions.length, 2);
    haptics.epic();
    spawnConfetti(48);
    screenShake(8, 420);
  } else if (kind === 'void') {
    const candidates = [];
    for (let r = 0; r < state.board.rows; r++) {
      for (let c = 0; c < state.board.cols; c++) {
        if (state.board.isIngredient(c, r)) continue;
        if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
        candidates.push({ c, r });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    positions = candidates.slice(0, 8);
    flashMessage('🌀 VOID', 1500);
    speech.speak('Void!');
    haptics.combo();
    spawnBlackHole(positions);
    await delay(700);
  } else if (kind === 'bolt') {
    for (let c = 0; c < state.board.cols; c++) positions.push({ c, r: pos.r });
    for (let r = 0; r < state.board.rows; r++) {
      if (r !== pos.r) positions.push({ c: pos.c, r });
    }
    flashMessage('⚡ ZAP!', 1300);
    speech.speak('Zap!');
    sfx.playMatch(positions.length, 2);
    haptics.epic();
    spawnLightningRow(pos.r);
    screenShake(6, 320);
    await delay(220);
  }
  if (positions.length > 0) {
    spawnPopSpecks(positions);
    await animatePop(positions);
    state.board.clear(positions);
    decrementJellyAt(positions);
  }
  renderBoard(state.board, state);
  await delay(160);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
}

async function fireBlackHole() {
  const stacks = upgradeCount('black-hole');
  if (stacks <= 0) return;
  const candidates = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.isIngredient(c, r)) continue;
      if ((state.lockMap.get(`${c},${r}`) || 0) > 0) continue;
      candidates.push({ c, r });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(5 * stacks, candidates.length);
  const positions = candidates.slice(0, n);
  spawnBlackHole(positions);
  flashMessage('🌀 BLACK HOLE', 1600);
  speech.speak('Black hole');
  haptics.combo();
  await delay(750);
  state.board.clear(positions);
  decrementJellyAt(positions);
  renderBoard(state.board, state);
  await delay(160);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
}

function maybeFireSnake() {
  if (upgradeCount('hungry-snake') <= 0) return;
  const path = [];
  const visited = new Set();
  let c = Math.floor(Math.random() * state.board.cols);
  let r = Math.floor(Math.random() * state.board.rows);
  const key0 = `${c},${r}`;
  if (state.board.isIngredient(c, r) || state.lockMap.get(key0) > 0) {
    // try again from a corner
    c = 0; r = 0;
  }
  path.push({ c, r });
  visited.add(`${c},${r}`);
  const targetLen = 4 + upgradeCount('hungry-snake'); // grows with stacks
  while (path.length < targetLen) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let moved = false;
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= state.board.cols || nr < 0 || nr >= state.board.rows) continue;
      const k = `${nc},${nr}`;
      if (visited.has(k)) continue;
      if (state.board.isIngredient(nc, nr)) continue;
      if ((state.lockMap.get(k) || 0) > 0) continue;
      path.push({ c: nc, r: nr });
      visited.add(k);
      c = nc; r = nr;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  if (path.length < 2) return;
  spawnSnake(path);
  flashMessage('🐍 SNAKE FEAST', 1500);
  speech.speak('Snake');
  sfx.playCascade();
  haptics.combo();
  setTimeout(() => {
    state.board.clear(path);
    decrementJellyAt(path);
    renderBoard(state.board, state);
    setTimeout(() => {
      const fallen = gravityWithIngredients();
      renderBoard(state.board, state, { fallen });
    }, 180);
  }, 900);
}

function metaSkills() {
  return ownedSkills(state.roguelike.skills || {});
}
function hasMeta(id) { return metaSkills().has(id); }

function buyMetaSkill(id) {
  const skill = SKILL_TREE.find((s) => s.id === id);
  if (!skill) return false;
  if (hasMeta(id)) return false;
  if ((state.roguelike.gems || 0) < skill.cost) return false;
  state.roguelike.gems -= skill.cost;
  if (!state.roguelike.skills) state.roguelike.skills = {};
  state.roguelike.skills[id] = true;
  // Bigger Bank — bump POWERUP_CAP behaviour by widening when banking
  // is computed; the cap effectively becomes 12.
  persist();
  flashMessage(`Unlocked: ${skill.name}`, 1500);
  speech.speak(`Unlocked ${skill.name}`);
  haptics.specialBirth();
  refreshLevelUI();
  return true;
}

function effectivePowerupCap() {
  return hasMeta('bigger-bank') ? 12 : POWERUP_CAP;
}

function applyRunUpgradesOnSlotStart() {
  if (!state.inRoguelikeRun) return;
  state.movesRemaining += upgradeCount('moves+2') * 2;
  const cap = effectivePowerupCap();
  const bank = powerupBank();
  // Meta: Sweet Start — at slot 1 only
  if (hasMeta('sweet-start') && state.roguelike.currentSlot === 1) {
    bank.hammer = Math.min(cap, (bank.hammer || 0) + 1);
  }
  bank.hammer = Math.min(cap, (bank.hammer || 0) + upgradeCount('hammer+1'));
  bank.colorBomb = Math.min(cap, (bank.colorBomb || 0) + upgradeCount('slot-bomb'));
  bank.shuffle = Math.min(cap, (bank.shuffle || 0) + upgradeCount('slot-shuffle'));
  bank.plusMoves = Math.min(cap, (bank.plusMoves || 0) + upgradeCount('slot-plus3'));
  setPowerupCounts(bank);
  // Meta: Lucky Soul — Lucky starts at 25%
  if (hasMeta('lucky-soul')) {
    state.luckyCharge = Math.max(state.luckyCharge, 25);
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }
  // Reset ability counters at slot start
  resetAbilityCounters();
  // Trigger Black Hole on slot start, if owned (slight delay so the
  // intro card has time to dismiss).
  if (upgradeCount('black-hole') > 0) {
    setTimeout(() => fireBlackHole(), 1200);
  }
  if (upgradeCount('storm-caller') > 0) {
    setTimeout(() => {
      for (let i = 0; i < upgradeCount('storm-caller'); i++) spawnCrazyTile('bolt');
    }, 1300);
  }
}

function applyRunScoreMultiplier(amount, cascadeLevel = 1, matchSize = 0) {
  if (!state.inRoguelikeRun) return amount;
  let m = 1;
  m *= Math.pow(1.25, upgradeCount('score+25'));
  if (cascadeLevel >= 2) m *= Math.pow(1.5, upgradeCount('cascade-king'));
  if (matchSize >= 5) m *= Math.pow(2, upgradeCount('big-match'));
  if (hasMeta('score-sage')) m *= 1.1;
  return Math.round(amount * m);
}

function runLuckyRate() {
  let m = 1;
  for (let i = 0; i < upgradeCount('lucky-fast'); i++) m *= 1.5;
  return LUCKY_PER_MOVE * m;
}

// Changelog — newest entry first. APP_VERSION auto-derives from the
// top entry's id so adding a new entry here is enough to make the
// "What's new" modal re-appear on every player's next visit. No
// manual version bump needed for future releases.
const CHANGELOG_ENTRIES = [
  {
    id: '2026-05-25-8c',
    items: [
      '🏰 ROGUELIKE → 100 SLOTS. The run is now a real marathon: 100 slots, bosses every 10.',
      'Seven new bosses: Chocolate Snail (40), Padlock Pharaoh (50), Cherry Hydra (60), Echo Wraith (70), Lattice Queen (80), The Confectioner (90), and the FINAL BOSS — Candy Kraken (100) — 60 moves to score 12,000 with every obstacle in play.',
      'Run-complete bonus bumped from 20💎 to 50💎. Each boss still grants 5💎 (10💎 with Boss Slayer skill).',
    ],
  },
  {
    id: '2026-05-25-8b',
    items: [
      '🎯 100 LEVELS! Levels mode expanded from 39 to 100 across 12 themed chapters: Cherry Orchard, Combo Storm, Jelly Maze, Lock Tyrant, Special Lab, Cherry Forest, Match Marathon, Rainbow Rush, Stronghold, Cherry Vault, Jelly Castle, and Mastery.',
      'Level 100 — "Sweet Apocalypse" — is the summit: cherries + jelly + locks + 8,000 points in 50 moves.',
      'Smooth difficulty curve: every chapter introduces a new twist on familiar mechanics. Halfway-home gets its own jelly heavyweight at level 50.',
    ],
  },
  {
    id: '2026-05-25-8a',
    items: [
      '🎺 Roguelike music REPLACED with a Guile\'s-Theme-style 16-bit chiptune march — driving D-minor groove, square-wave melody, marching snare backbeat, octave-jumping bass.',
      'Drops the lo-fi pads + vinyl crackle in roguelike mode — the chiptune carries the whole vibe.',
      'Two looping songs alternate so the run doesn\'t get monotonous. 132 BPM keeps the tempo up.',
    ],
  },
  {
    id: '2026-05-25-7p',
    items: [
      '🦷 You can actually SEE The Eater now — repositioned + bigger entrance. It descends from above and the jaws land squarely over the top 3 cells of the target column.',
      'Slay-the-Spire-style telegraph: two moves before The Eater chomps, a hot-pink warning arrow appears above the doomed column with a countdown (2 → 1 → CHOMP). Plan around it.',
      'Reduce-motion users get the warning text without the bobbing arrow.',
    ],
  },
  {
    id: '2026-05-25-7o',
    items: [
      '💣🌀⚡ NEW: Crazy Tiles appear organically on the board after big matches and deep cascades. Pop them by matching for huge effects.',
      '💣 TNT — explodes in a 3×3 area. 🌀 Void — sucks 8 random tiles. ⚡ Bolt — clears its whole row + column.',
      'Three new upgrade cards boost crazy tiles: Bomb Maker (specials also drop TNT), Void Touched (Void spawns 2× more often), Storm Caller (a Bolt waits for you every slot start).',
      'So roguelike upgrades are now a real mix: passive bonuses + automatic abilities + crazy-tile spawners.',
    ],
  },
  {
    id: '2026-05-25-7n',
    items: [
      '🦷 HARD MODE bite! From Roguelike slot 9+, every 5 moves THE EATER drops down from above with a big jaw, eyes glowing, and chomps the top 3 candies of a random column.',
      'Eater respects locks, jelly, and cherries (it won\'t eat through them).',
      'Skips boss slots — those are already mean enough.',
      'More hard-mode mechanics coming: a moving Grumblock enemy and wandering-eye tiles are next.',
    ],
  },
  {
    id: '2025-05-24-7m',
    items: [
      '⚡ NEW upgrade: Lightning Strike — every 4 matches a real lightning bolt zigzags across the screen and clears a whole row.',
      '🌀 NEW upgrade: Black Hole — at the start of each slot, a vortex appears at the centre and SUCKS 5 random candies in spiraling.',
      '🐍 NEW upgrade: Hungry Snake — make a special candy and a green snake slithers across the board eating 4 random tiles in its wake.',
      'All three abilities stack — pick the same upgrade twice and it triggers more often / eats more / clears bigger.',
    ],
  },
  {
    id: '2025-05-24-7l',
    items: [
      'Roguelike theme rebuilt for readability — solid dark slate, pure white text, hot-pink + gold only on borders and chips. Every label, dialog, card and toast is now legible.',
      'Lives system added — every run starts with 3 lives (♥♥♥ on the chip). Failing a slot costs one life. Out of lives = run over.',
      'New meta skills in the Skill Tree: Extra Life (35 💎) and Two Extra Lives (70 💎) — bring more lives into every future run.',
      'Mode-switch animations rebuilt — each mode has its own drawn-out animation: a 1.6s blood-red iris-blast into Roguelike, a 1.3s sunshine burst into Levels, a 1.1s pastel sweep into Free Play.',
    ],
  },
  {
    id: '2025-05-24-7k',
    items: [
      'Roguelike progression FIXED — hitting the score target on a slot now actually shows the level-complete dialog. The win-check used to early-return for any mode that wasn\'t Levels.',
      'Move counter now ticks down in Roguelike mode too (same fix).',
      'High Contrast and Roguelike themes are now fully accessible — every label, hint, footer, dialog, card and toast has readable text on the dark background.',
      'Streak chip + install toast + cards all get proper dark-mode variants.',
    ],
  },
  {
    id: '2025-05-24-7j',
    items: [
      'Roguelike mode now SHOWS its goals mid-run — slot number, objective, move counter and progress bar all visible.',
      'Mode-switch animation — a wicked red-purple wipe blasts across the screen when entering Roguelike, a soft wipe for Levels/Free Play.',
      'Roguelike music switches to a darker dungeon progression (minor 7ths, lower bass).',
      'Manual Shuffle no longer wipes cherries on cherry levels.',
      '"What\'s new" notifications now appear on every update automatically.',
    ],
  },
  {
    id: '2025-05-24-7f',
    items: [
      'NEW: Roguelike mode — 30 slots with bosses at 10, 20, 30. Settings → Mode → Roguelike.',
      'Pick an upgrade between slots — buffs, consumables, or synergies. They stack within the run.',
      'Earn gems from runs and spend them in the Skill Tree (Settings → Skill Tree) for permanent boosts.',
      'Dedicated boss battles: Jelly Guardian (10), Lock Tyrant (20), Sweet King (30).',
      'Lucky bar reworked: drains when idle, bursts to ×3, sustains ×1.5 for 4 more matches.',
      'Install Sweet Match to your home screen — one-tap prompt on supported browsers.',
    ],
  },
];
const APP_VERSION = CHANGELOG_ENTRIES[0].id;
const CHANGELOG = CHANGELOG_ENTRIES[0].items;
const LUCKY_PER_MOVE = 12;            // % per successful swap
const LUCKY_INSTANT_MULTIPLIER = 3;   // burst on first match after fill
const LUCKY_MODE_MATCHES = 4;         // additional matches at lower mult
const LUCKY_MODE_MULTIPLIER = 1.5;
const LUCKY_DRAIN_AFTER_MS = 7000;    // idle before drain starts
const LUCKY_DRAIN_INTERVAL_MS = 250;
const LUCKY_DRAIN_PER_SEC = 6;        // % per second once draining
const SURPRISE_DROP_MIN_TILES = 6; // Match must clear this many tiles to roll
const SURPRISE_DROP_CHANCE = 0.28; // 28% on a 6+ match

const POWERUP_CAP = 9;
const PLUS_MOVES_BONUS = 3;

function powerupBank() {
  if (!state.levelProgress.powerupBank) {
    state.levelProgress.powerupBank = { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 };
  }
  return state.levelProgress.powerupBank;
}

function spendPowerup(kind) {
  const bank = powerupBank();
  if ((bank[kind] || 0) <= 0) return false;
  bank[kind]--;
  setPowerupCounts(bank);
  persist();
  return true;
}

function earnPowerups(stars) {
  const bank = powerupBank();
  const cap = effectivePowerupCap();
  bank.hammer = Math.min(cap, (bank.hammer || 0) + 1);
  if (stars >= 2) {
    bank.shuffle = Math.min(cap, (bank.shuffle || 0) + 1);
  }
  if (stars >= 3) {
    bank.colorBomb = Math.min(cap, (bank.colorBomb || 0) + 1);
    bank.plusMoves = Math.min(cap, (bank.plusMoves || 0) + 1);
  }
  setPowerupCounts(bank);
}

sfx.setMuted(!state.settings.sound);
speech.setSpeechEnabled(state.settings.speech);

const achievements = createAchievements({
  speak: (text) => speech.speak(text),
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const HINT_IDLE_MS = 7000;
let hintTimer = null;

function cancelHint() {
  clearTimeout(hintTimer);
  clearHintGlow();
}

function isSwappable(c, r) {
  if (state.board.isIngredient(c, r)) return false;
  if ((state.lockMap.get(`${c},${r}`) || 0) > 0) return false;
  return true;
}

function scheduleHint() {
  cancelHint();
  hintTimer = setTimeout(() => {
    if (state.busy) {
      scheduleHint();
      return;
    }
    const swap = findAnyValidSwap(state.board, isSwappable);
    if (swap) showHintGlow(swap.a, swap.b);
  }, HINT_IDLE_MS);
}

async function ensureMovesAvailable() {
  if (hasAnyValidSwap(state.board, isSwappable)) return;
  // Loud explanation so the player understands WHY the board is changing
  flashMessage('No moves — shuffling!', 1500);
  speech.speak('No moves. Shuffling.');
  haptics.invalid();
  await delay(280);
  // Spin-out animation across the whole board
  const tiles = document.querySelectorAll('#board .tile');
  tiles.forEach((t, i) => {
    t.style.animationDelay = `${i * 8}ms`;
    t.classList.add('shuffling');
  });
  await delay(520);
  preservingReshuffle();
  // Render with the intro-drop animation so new tiles cascade back in
  renderBoard(state.board, state, { intro: true });
  await delay(80);
}

// Shuffle the candies in place while keeping powered-up sweets,
// cherries (ingredients), jelly, and locks where they were. Tries
// a few arrangements until one has no initial matches AND a legal swap;
// falls back to a fresh fill if it can't find one.
function preservingReshuffle() {
  const board = state.board;
  const movable = [];
  const ingredientCells = [];
  const ingredientKeys = new Set();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      if (!cell) continue;
      if (cell.ingredient) {
        ingredientCells.push({ c, r, cell });
        ingredientKeys.add(`${c},${r}`);
      } else {
        movable.push(cell);
      }
    }
  }
  const slots = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!ingredientKeys.has(`${c},${r}`)) slots.push({ c, r });
    }
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const arr = movable.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    for (let i = 0; i < slots.length; i++) {
      board.set(slots[i].c, slots[i].r, arr[i]);
    }
    for (const p of ingredientCells) board.set(p.c, p.r, p.cell);
    if (
      findMatches(board).positions.length === 0 &&
      hasAnyValidSwap(board, isSwappable)
    ) {
      return;
    }
  }
  // Last resort: fresh fill (loses specials), but keep ingredients.
  board.fillNoMatches();
  for (const p of ingredientCells) board.set(p.c, p.r, p.cell);
}

// Animated mode-switch wipe. Wicked red-purple for Roguelike, soft
// cream-pink for Levels/Free Play. Respects reduce-motion.
function playModeTransition(mode) {
  const el = document.getElementById('mode-transition');
  if (!el) return;
  el.classList.remove('show', 'wicked', 'bright', 'levels');
  let cls = 'bright';
  let duration = 1100;
  if (mode === 'roguelike') {
    cls = 'wicked';
    duration = 1600;
    haptics.epic();
    sfx.playObjectiveComplete('specials');
    screenShake(8, 600);
  } else if (mode === 'levels') {
    cls = 'levels';
    duration = 1300;
    sfx.playRestart();
    haptics.specialBirth();
  } else {
    sfx.playSwap();
  }
  el.classList.add(cls);
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function persist() {
  saveSave({
    highScore: state.highScore,
    streak: state.streak,
    lastPlayedDate: state.lastPlayedDate,
    seenWelcome: state.seenWelcome,
    seenVersion: state.seenVersion,
    installPromptDismissedAt: state.installPromptDismissedAt || 0,
    settings: state.settings,
    levelProgress: state.levelProgress,
    roguelike: state.roguelike,
  });
}

// --- Install / Add to Home Screen prompt ---
// On Android (and other PWA-capable browsers) the browser fires
// `beforeinstallprompt`; we capture it and offer a custom Install
// button. On iOS Safari there's no programmatic prompt — we show
// "Tap Share → Add to Home Screen" instead. Dismissed prompts are
// remembered for ~7 days so we don't nag.
let deferredInstallPrompt = null;
const INSTALL_REMINDER_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function shouldShowInstallPrompt() {
  if (isStandalone()) return false;
  const dismissedAt = state.installPromptDismissedAt || 0;
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return days >= INSTALL_REMINDER_DAYS;
}

function showInstallToast(kind) {
  const toast = document.getElementById('install-toast');
  const title = document.getElementById('install-title');
  const body = document.getElementById('install-body');
  const cta = document.getElementById('install-cta');
  if (!toast || !title || !body || !cta) return;
  if (kind === 'ios') {
    title.textContent = 'Add Sweet Match to your home screen';
    body.textContent = "Tap the Share icon, then 'Add to Home Screen'.";
    cta.style.display = 'none';
  } else {
    title.textContent = 'Install Sweet Match';
    body.textContent = 'Get the game on your home screen for one-tap play.';
    cta.style.display = '';
  }
  toast.classList.remove('hidden');
}

function hideInstallToast() {
  const toast = document.getElementById('install-toast');
  if (toast) toast.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (shouldShowInstallPrompt()) showInstallToast('default');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallToast();
});

document.getElementById('install-cta').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  hideInstallToast();
  try {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch {}
  deferredInstallPrompt = null;
  state.installPromptDismissedAt = Date.now();
  persist();
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  hideInstallToast();
  state.installPromptDismissedAt = Date.now();
  persist();
});

// iOS doesn't fire beforeinstallprompt; show the manual instructions
// once on first load if we haven't installed yet.
if (isIOS() && shouldShowInstallPrompt()) {
  setTimeout(() => showInstallToast('ios'), 3000);
}

function maxLivesForRun() {
  let lives = RUN_LIVES_BASE;
  if (hasMeta('extra-life-1')) lives += 1;
  if (hasMeta('extra-life-2')) lives += 1;
  return lives;
}

function startRoguelikeRun() {
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
  }
  persist();
  playRoguelikeSlot(state.roguelike.currentSlot, { announce: true });
}

function playRoguelikeSlot(slot, { announce = true } = {}) {
  const lvl = getRoguelikeLevel(slot);
  cancelHint();
  hideLevelOverlay();
  state.level = lvl;
  resetBoard();
  applyLevelObstacles(state.level);
  state.movesRemaining = state.level.moves;
  applyRunUpgradesOnSlotStart();
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  if (announce) {
    state.busy = true;
    const done = () => { state.busy = false; scheduleHint(); };
    const p = showLevelIntro(state.level, RUN_LENGTH);
    if (p && typeof p.then === 'function') p.then(done);
    else done();
    if (lvl.isBoss) {
      // Boss fanfare on top of the intro card
      flashMessage(slot === 30 ? 'FINAL BOSS!' : 'BOSS BATTLE!', 1600);
      spawnScreenFlash('rgba(255, 0, 110, 0.45)');
      screenShake(8, 420);
      sfx.playObjectiveComplete('specials'); // sparkly chord
      haptics.epic();
    }
    speech.speak(
      `Slot ${slot} of ${RUN_LENGTH}.${lvl.isBoss ? ` Boss battle. ${lvl.name}.` : ''} ${lvl.hint}.`
    );
  } else {
    scheduleHint();
  }
}

function advanceRoguelikeAfterWin() {
  const slot = state.roguelike.currentSlot;
  state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, slot);
  if (slot >= RUN_LENGTH) {
    // Full run cleared
    const gems = gemsEarned(slot + 1, true, metaSkills());
    state.roguelike.gems = (state.roguelike.gems || 0) + gems;
    state.roguelike.runsCompleted = (state.roguelike.runsCompleted || 0) + 1;
    state.roguelike.currentSlot = 1;
    state.inRoguelikeRun = false;
    state.runUpgrades = [];
    persist();
    flashMessage(`RUN COMPLETE! +${gems} 💎`, 2400);
    speech.speak(`Run complete. You earned ${gems} gems.`);
    return;
  }
  state.roguelike.currentSlot = slot + 1;
  persist();
  // Boss slots and the final slot skip the upgrade picker; other slots
  // offer 3 choices before the next slot starts.
  const justFinished = slot;
  const isBossWin = BOSS_SLOTS.has(justFinished);
  if (isBossWin) {
    flashMessage('BOSS DEFEATED!', 2000);
    spawnConfetti(80);
    spawnStarRain(40);
    screenShake(7, 400);
    haptics.levelComplete();
    speech.speak('Boss defeated!');
    setTimeout(() => playRoguelikeSlot(state.roguelike.currentSlot), 1400);
  } else {
    const n = hasMeta('wider-choice') ? 4 : 3;
    const choices = pickUpgradeChoices(state.runUpgrades, n);
    showUpgradePicker(choices, state.runUpgrades, (chosen) => {
      state.runUpgrades.push(chosen.id);
      flashMessage(`Picked: ${chosen.name}`, 1200);
      speech.speak(`Picked ${chosen.name}`);
      setTimeout(() => playRoguelikeSlot(state.roguelike.currentSlot), 250);
    }, categoryColor);
  }
}

function endRoguelikeRun() {
  const reached = state.roguelike.currentSlot;
  const gems = gemsEarned(reached, false, metaSkills());
  state.roguelike.gems = (state.roguelike.gems || 0) + gems;
  state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, reached);
  state.roguelike.currentSlot = 1;
  state.inRoguelikeRun = false;
  state.runUpgrades = [];
  persist();
  flashMessage(`Run over. +${gems} 💎`, 2200);
  speech.speak(`Run over. You reached slot ${reached}. You earned ${gems} gems.`);
}

// Combo meter — visible chain depth during cascades
function updateComboMeter(level) {
  state.comboLevel = level;
  setComboMeter(level);
}

// Lucky charge — fills as you successfully play, gives a 2x score on
// the next successful match round when full.
let luckyDrainTimer = null;
let luckyLastBumpAt = 0;

function bumpLuckyCharge() {
  // Don't fill while ready (waiting to fire) or while in mode (would be lost).
  luckyLastBumpAt = Date.now();
  if (luckyDrainTimer) { clearTimeout(luckyDrainTimer); luckyDrainTimer = null; }
  if (state.luckyMode) {
    refreshLucky();
    return;
  }
  if (state.luckyReady) {
    refreshLucky();
    scheduleLuckyDrainCheck();
    return;
  }
  state.luckyCharge = Math.min(100, state.luckyCharge + runLuckyRate());
  if (state.luckyCharge >= 100) {
    state.luckyReady = true;
    state.luckyCharge = 100;
    flashMessage('LUCKY READY! Next match triples your score', 1800);
    speech.speak('Lucky ready. Your next match scores triple.');
    haptics.specialBirth();
    spawnConfetti(18);
  }
  refreshLucky();
  scheduleLuckyDrainCheck();
}

function scheduleLuckyDrainCheck() {
  if (luckyDrainTimer) clearTimeout(luckyDrainTimer);
  // Don't drain when ready, in mode, or already empty.
  if (state.luckyMode || state.luckyReady || state.luckyCharge <= 0) return;
  luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_AFTER_MS);
}

function drainLuckyTick() {
  if (state.luckyMode || state.luckyReady || state.luckyCharge <= 0) {
    luckyDrainTimer = null;
    return;
  }
  const idle = Date.now() - luckyLastBumpAt;
  if (idle < LUCKY_DRAIN_AFTER_MS) {
    luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_AFTER_MS - idle);
    return;
  }
  const drain = LUCKY_DRAIN_PER_SEC * (LUCKY_DRAIN_INTERVAL_MS / 1000);
  state.luckyCharge = Math.max(0, state.luckyCharge - drain);
  refreshLucky();
  if (state.luckyCharge > 0) {
    luckyDrainTimer = setTimeout(drainLuckyTick, LUCKY_DRAIN_INTERVAL_MS);
  } else {
    luckyDrainTimer = null;
  }
}

function refreshLucky() {
  setLuckyCharge(state.luckyCharge, {
    ready: state.luckyReady,
    mode: state.luckyMode,
    remaining: state.luckyModeRemaining,
    total: LUCKY_MODE_MATCHES,
  });
}

function consumeLuckyIfReady(baseScore) {
  // Mid-mode: every match within the window gets the ongoing multiplier,
  // counts toward the remaining tally, and ends mode when depleted.
  if (state.luckyMode) {
    state.luckyModeRemaining = Math.max(0, state.luckyModeRemaining - 1);
    if (state.luckyModeRemaining <= 0) {
      state.luckyMode = false;
      flashMessage('Lucky window over', 1200);
      speech.speak('Lucky window over');
    }
    refreshLucky();
    return Math.round(baseScore * LUCKY_MODE_MULTIPLIER);
  }
  if (!state.luckyReady) return baseScore;
  // Activation moment — burst + start mode
  state.luckyReady = false;
  state.luckyCharge = 0;
  state.luckyMode = true;
  state.luckyModeRemaining = LUCKY_MODE_MATCHES;
  refreshLucky();
  flashMessage(
    `LUCKY! ×${LUCKY_INSTANT_MULTIPLIER} now, then ×${LUCKY_MODE_MULTIPLIER} for ${LUCKY_MODE_MATCHES} matches`,
    2200
  );
  speech.speak(
    `Lucky! Triple score now, plus one and a half for the next ${LUCKY_MODE_MATCHES} matches.`
  );
  spawnConfetti(56);
  spawnScreenFlash('rgba(255, 214, 10, 0.45)');
  screenShake(6, 360);
  haptics.epic();
  // Lucky Strike synergy upgrade — also tops up a hammer
  if (state.inRoguelikeRun && upgradeCount('lucky-strike') > 0) {
    const bank = powerupBank();
    bank.hammer = Math.min(effectivePowerupCap(), (bank.hammer || 0) + upgradeCount('lucky-strike'));
    setPowerupCounts(bank);
  }
  return Math.round(baseScore * LUCKY_INSTANT_MULTIPLIER);
}

const SURPRISE_KINDS = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
const SURPRISE_LABELS = {
  hammer: 'Hammer',
  shuffle: 'Shuffle',
  colorBomb: 'Color Bomb',
  plusMoves: '+3 Moves',
};
const SURPRISE_BUTTON_IDS = {
  hammer: 'pu-hammer',
  shuffle: 'pu-shuffle',
  colorBomb: 'pu-colorbomb',
  plusMoves: 'pu-plusmoves',
};

// Big matches occasionally drop a free power-up — flying icon animates
// from the cleared tiles toward the matching power-up button, then the
// bank ticks up.
function maybeDropSurprise(positions, cascadeLevel) {
  if (!positions || positions.length < SURPRISE_DROP_MIN_TILES) return;
  // Chance scales slightly with cascade depth — deeper chains feel more
  // like Vampire Survivors / Survivor.io: rewards stacking on rewards.
  const chance = SURPRISE_DROP_CHANCE + Math.max(0, cascadeLevel - 1) * 0.04;
  if (Math.random() > chance) return;
  const kind = SURPRISE_KINDS[Math.floor(Math.random() * SURPRISE_KINDS.length)];
  // Centroid of the cleared tiles
  let sx = 0, sy = 0, n = 0;
  for (const p of positions) {
    const tile = document.querySelector(`#board .tile[data-c="${p.c}"][data-r="${p.r}"]`);
    if (!tile) continue;
    const rect = tile.getBoundingClientRect();
    sx += rect.left + rect.width / 2;
    sy += rect.top + rect.height / 2;
    n++;
  }
  if (n === 0) return;
  const fromX = sx / n;
  const fromY = sy / n;
  const targetBtn = document.getElementById(SURPRISE_BUTTON_IDS[kind]);
  if (!targetBtn) return;
  const tRect = targetBtn.getBoundingClientRect();
  const toX = tRect.left + tRect.width / 2;
  const toY = tRect.top + tRect.height / 2;
  flashMessage(`Free ${SURPRISE_LABELS[kind]}!`, 1300);
  speech.speak(`Free ${SURPRISE_LABELS[kind]}`);
  haptics.specialBirth();
  animateSurpriseIcon(kind, fromX, fromY, toX, toY, () => {
    const bank = powerupBank();
    bank[kind] = Math.min(POWERUP_CAP, (bank[kind] || 0) + 1);
    setPowerupCounts(bank);
    persist();
    targetBtn.classList.remove('surprise-land');
    void targetBtn.offsetWidth;
    targetBtn.classList.add('surprise-land');
    setTimeout(() => targetBtn.classList.remove('surprise-land'), 600);
  });
}

function animateSurpriseIcon(kind, fromX, fromY, toX, toY, onArrive) {
  const layer = document.getElementById('particles');
  if (!layer) { if (onArrive) onArrive(); return; }
  const dx = toX - fromX;
  const dy = toY - fromY;
  const el = document.createElement('div');
  el.className = 'particle surprise-icon';
  el.style.left = `${fromX}px`;
  el.style.top = `${fromY}px`;
  el.style.setProperty('--fly-dx', `${dx}px`);
  el.style.setProperty('--fly-dy', `${dy}px`);
  el.textContent = SURPRISE_LABELS[kind];
  layer.appendChild(el);
  setTimeout(() => {
    el.remove();
    if (onArrive) onArrive();
  }, 820);
}

function refreshLevelUI() {
  const p = progressTowardObjective(state.level, state.score, state.progress);
  setLevelUI({
    level: state.level,
    movesRemaining: state.movesRemaining,
    current: p.current,
    target: p.target,
    mode: state.settings.mode,
  });
  if (state.settings.mode === 'roguelike') {
    setLevelChip(state.level, 'roguelike', 0, {
      slot: state.roguelike.currentSlot,
      total: RUN_LENGTH,
      gems: state.roguelike.gems,
      isBoss: !!(state.level && state.level.isBoss),
      lives: state.roguelike.livesRemaining || 0,
      maxLives: maxLivesForRun(),
    });
  } else {
    setLevelChip(
      state.level,
      state.settings.mode,
      state.level ? state.levelProgress.stars[state.level.id] || 0 : 0
    );
  }
}

function recordClearedTypes(toClearWithTypes) {
  let objectiveDelta = 0;
  const obj = state.level && state.level.objective;
  const trackedType = obj && obj.kind === 'clearType' ? obj.type : null;
  for (const t of toClearWithTypes) {
    if (t == null) continue;
    state.progress.type[t] = (state.progress.type[t] || 0) + 1;
    if (t === trackedType) objectiveDelta++;
  }
  if (objectiveDelta > 0) flashObjectiveDelta(`+${objectiveDelta}`);
}

function flashObjectiveProgress(specialsCreatedCount) {
  const obj = state.level && state.level.objective;
  if (!obj) return;
  if (obj.kind === 'matches') flashObjectiveDelta('+1');
  else if (obj.kind === 'specials' && specialsCreatedCount > 0) {
    flashObjectiveDelta(`+${specialsCreatedCount}`);
  }
}

function consumeMove() {
  bumpLuckyCharge();
  maybeFireEater();
  // Free Play has unlimited moves. Levels and Roguelike both count down.
  if (state.settings.mode === 'free' || !state.level) return;
  if (state.movesRemaining > 0) {
    state.movesRemaining--;
    refreshLevelUI();
    bumpMoveCounter();
  }
}

function checkLevelOutcome() {
  if (state.resolved) return;
  // Free Play has no level objective. Levels and Roguelike both do.
  if (state.settings.mode === 'free' || !state.level) return;
  const p = progressTowardObjective(state.level, state.score, state.progress);
  if (!p.done && p.target > 0 && !state.almostFired) {
    const ratio = p.current / p.target;
    if (ratio >= 0.8) {
      state.almostFired = true;
      flashMessage('Almost there!', 1200);
      speech.speak('Almost there!');
    }
  }
  if (p.done) {
    state.resolved = true;
    const stars = starsForLevel(state.level, state.movesRemaining);
    const prev = state.levelProgress.stars[state.level.id] || 0;
    const improved = stars > prev;
    const firstClear = prev === 0;
    if (improved) state.levelProgress.stars[state.level.id] = stars;
    if (!state.levelProgress.bestScores) state.levelProgress.bestScores = {};
    const prevBest = state.levelProgress.bestScores[state.level.id] || 0;
    if (state.score > prevBest) {
      state.levelProgress.bestScores[state.level.id] = state.score;
    }
    earnPowerups(stars);
    const next = nextLevelId(state.level.id);
    if (next && next > (state.levelProgress.currentLevel || 0)) {
      state.levelProgress.currentLevel = next;
    }
    persist();
    spawnConfetti(improved && !firstClear ? 72 : 48);
    if (stars === 3) spawnStarRain(36);
    sfx.playObjectiveComplete(state.level.objective.kind);
    haptics.levelComplete();
    if (improved && !firstClear) {
      flashMessage(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}`, 1600);
      speech.speak(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
    } else {
      speech.speak(`Level complete! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
    }
    if (state.inRoguelikeRun) {
      const isLastSlot = state.roguelike.currentSlot >= RUN_LENGTH;
      showLevelComplete({
        level: { ...state.level, id: state.roguelike.currentSlot, name: state.level.name },
        stars,
        score: state.score,
        isLast: isLastSlot,
        onNext: () => {
          if (isLastSlot) {
            advanceRoguelikeAfterWin(); // shows banner, ends run
          } else {
            advanceRoguelikeAfterWin();
          }
        },
        onReplay: () => playRoguelikeSlot(state.roguelike.currentSlot),
      });
      return;
    }
    showLevelComplete({
      level: state.level,
      stars,
      score: state.score,
      isLast: isLastLevel(state.level.id),
      onNext: () => {
        if (isLastLevel(state.level.id)) {
          startLevel(state.levelProgress.currentLevel);
        } else {
          startLevel(state.levelProgress.currentLevel);
        }
      },
      onReplay: () => startLevel(state.level.id),
    });
    return;
  }
  if (state.movesRemaining <= 0) {
    state.resolved = true;
    sfx.playLevelFail();
    haptics.invalid();
    speech.speak('Try again');
    if (state.inRoguelikeRun) {
      const slotAtFail = state.roguelike.currentSlot;
      // Decrement a life. If lives remain, offer a retry.
      // If lives hit zero, the run is over.
      state.roguelike.livesRemaining = Math.max(0, (state.roguelike.livesRemaining || 0) - 1);
      persist();
      refreshLevelUI();
      if (state.roguelike.livesRemaining <= 0) {
        // Out of lives — end run; show terminal fail dialog.
        const reached = slotAtFail;
        const gems = gemsEarned(reached, false, metaSkills());
        state.roguelike.gems = (state.roguelike.gems || 0) + gems;
        state.roguelike.bestSlot = Math.max(state.roguelike.bestSlot || 0, reached);
        state.roguelike.currentSlot = 1;
        state.inRoguelikeRun = false;
        state.runUpgrades = [];
        persist();
        flashMessage(`Run over — out of lives. +${gems} 💎`, 2400);
        speech.speak(`Out of lives. Run over. You earned ${gems} gems.`);
        showLevelFail({
          level: { ...state.level, id: slotAtFail },
          score: state.score,
          canSkip: true, // we repurpose Skip as "Start new run"
          onReplay: () => startRoguelikeRun(),
          onSkip: () => startRoguelikeRun(),
        });
        return;
      }
      const livesLeft = state.roguelike.livesRemaining;
      flashMessage(`Life lost — ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left`, 1800);
      speech.speak(`Life lost. ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} remaining.`);
      showLevelFail({
        level: { ...state.level, id: slotAtFail },
        score: state.score,
        canSkip: false,
        onReplay: () => playRoguelikeSlot(slotAtFail),
        onSkip: () => {},
      });
      return;
    }
    const replayLevelId = state.level.id;
    showLevelFail({
      level: state.level,
      score: state.score,
      canSkip: !isLastLevel(state.level.id),
      onReplay: () => startLevel(replayLevelId),
      onSkip: () => {
        const next = nextLevelId(replayLevelId);
        if (next) {
          state.levelProgress.currentLevel = next;
          persist();
          startLevel(next);
        } else {
          startLevel(replayLevelId);
        }
      },
    });
  }
}

function messageFor({ matchCount, cascadeLevel, specialsCreated, specialsActivated }) {
  if (specialsActivated.includes('rainbow')) return 'Rainbow blast!';
  if (specialsCreated.some((s) => s.kind === 'rainbow')) return 'Rainbow!';
  if (specialsCreated.some((s) => s.kind && s.kind.startsWith('line'))) return 'Striped!';
  if (cascadeLevel >= 3) return 'Amazing!';
  if (cascadeLevel === 2) return 'Cascade!';
  if (matchCount >= 6) return 'Huge match!';
  if (matchCount >= 5) return 'Big match!';
  if (matchCount >= 4) return 'Nice!';
  return 'Match!';
}

function maybeUpdateBest() {
  if (state.score > state.highScore) {
    state.highScore = state.score;
    setBest(state.highScore);
    persist();
  }
}

async function useHammer(pos) {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.hammer || 0) <= 0) return;
  if (!state.board.cell(pos.c, pos.r)) return;
  const key = `${pos.c},${pos.r}`;
  if (state.lockMap.get(key) > 0 || state.jellyMap.get(key) > 0 || state.board.isIngredient(pos.c, pos.r)) {
    flashMessage('Hammer cannot break special blocks', 1200);
    sfx.playInvalid();
    haptics.invalid();
    return;
  }
  if (!spendPowerup('hammer')) return;
  state.busy = true;
  cancelHint();
  sfx.unlockAudio();
  sfx.playMatch(1, 1);
  haptics.powerup();
  speech.speak('Smash!');
  spawnPopSpecks([pos]);
  await animatePop([pos]);
  state.board.clear([pos]);
  renderBoard(state.board, state);
  await delay(120);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(220);

  let cascadeResult = findMatches(state.board);
  let cascadeLevel = 1;
  while (cascadeResult.positions.length > 0) {
    await processMatchRound(cascadeResult, cascadeLevel, null);
    cascadeResult = findMatches(state.board);
    cascadeLevel++;
  }

  maybeUpdateBest();
  refreshLevelUI();
  await ensureMovesAvailable();
  checkLevelOutcome();
  state.busy = false;
  if (!state.resolved) scheduleHint();
}

async function useColorBomb(pos) {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.colorBomb || 0) <= 0) return;
  const targetCell = state.board.cell(pos.c, pos.r);
  if (!targetCell || targetCell.type == null) return;
  const key = `${pos.c},${pos.r}`;
  if (state.lockMap.get(key) > 0 || state.jellyMap.get(key) > 0) {
    flashMessage('Bomb cannot target special blocks', 1200);
    sfx.playInvalid();
    haptics.invalid();
    return;
  }
  const targetType = targetCell.type;
  if (!spendPowerup('colorBomb')) return;
  state.busy = true;
  cancelHint();
  sfx.unlockAudio();

  // Bomb skips any tile that has jelly OR a lock — power-ups don't
  // affect special blocks per the design rule.
  const positions = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.typeAt(c, r) !== targetType) continue;
      const k = `${c},${r}`;
      if (state.lockMap.get(k) > 0) continue;
      if (state.jellyMap.get(k) > 0) continue;
      positions.push({ c, r });
    }
  }
  flashMessage('Color bomb!', 1100);
  speech.speak('Color bomb!');
  spawnConfetti(28);
  sfx.playCascade();
  sfx.playMatch(positions.length, 2);
  haptics.powerup();
  haptics.epic();
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  // Intentionally NOT decrementing jelly or locks — bombs skip those.
  const clearedTypeList = positions.map(() => targetType);
  recordClearedTypes(clearedTypeList);
  state.progress.matches += 1;
  flashObjectiveProgress(0);
  const earned = consumeLuckyIfReady(
    applyRunScoreMultiplier(calcScore(positions, 2), 2, positions.length)
  );
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, positions, { color: '#FF006E' });
  maybeDropSurprise(positions, 2);
  achievements.onScore(state.score);
  await delay(180);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(260);

  let cascadeResult = findMatches(state.board);
  let cascadeLevel = 2;
  while (cascadeResult.positions.length > 0) {
    await processMatchRound(cascadeResult, cascadeLevel, null);
    cascadeResult = findMatches(state.board);
    cascadeLevel++;
  }

  maybeUpdateBest();
  refreshLevelUI();
  await ensureMovesAvailable();
  checkLevelOutcome();
  state.busy = false;
  if (!state.resolved) scheduleHint();
}

function usePlusMoves() {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.plusMoves || 0) <= 0) return;
  if (state.settings.mode === 'free' || !state.level) {
    speech.speak('Plus moves only works when there are moves to count');
    flashMessage('Not in Free Play', 1100);
    return;
  }
  if (!spendPowerup('plusMoves')) return;
  state.movesRemaining += PLUS_MOVES_BONUS;
  state.resolved = false;
  refreshLevelUI();
  bumpMoveCounter();
  flashMessage(`+${PLUS_MOVES_BONUS} moves!`, 1100);
  speech.speak(`Plus ${PLUS_MOVES_BONUS} moves`);
  hideLevelOverlay();
}

async function useShuffle() {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank.shuffle || 0) <= 0) return;
  if (!spendPowerup('shuffle')) return;
  state.armedTool = null;
  setArmedTool(null);
  cancelHint();
  sfx.unlockAudio();
  state.busy = true;
  flashMessage('Shuffled!', 1100);
  speech.speak('Shuffled!');
  // Same spin-out animation as the auto-shuffle so the manual action
  // also reads as "the board is being rearranged" rather than a snap.
  const tiles = document.querySelectorAll('#board .tile');
  tiles.forEach((t, i) => {
    t.style.animationDelay = `${i * 6}ms`;
    t.classList.add('shuffling');
  });
  await delay(440);
  // Preserves specials AND ingredients (cherries). The old destructive
  // reshuffle was wiping cherries on cherry-objective levels.
  preservingReshuffle();
  renderBoard(state.board, state, { intro: true });
  state.busy = false;
  scheduleHint();
}

function armTool(tool) {
  if (state.busy) return;
  const bank = powerupBank();
  if ((bank[tool] || 0) <= 0) return;
  if (state.armedTool === tool) {
    state.armedTool = null;
    setArmedTool(null);
    return;
  }
  state.selected = null;
  renderBoard(state.board, state);
  state.armedTool = tool;
  setArmedTool(tool);
  if (tool === 'hammer') speech.speak('Tap a candy to smash');
  else if (tool === 'colorBomb') speech.speak('Tap a candy to clear its color');
}

document.getElementById('pu-hammer').addEventListener('click', () => {
  sfx.unlockAudio();
  armTool('hammer');
});

document.getElementById('pu-shuffle').addEventListener('click', (e) => {
  sfx.unlockAudio();
  useShuffle();
  if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
});

document.getElementById('pu-colorbomb').addEventListener('click', () => {
  sfx.unlockAudio();
  armTool('colorBomb');
});

document.getElementById('pu-plusmoves').addEventListener('click', (e) => {
  sfx.unlockAudio();
  usePlusMoves();
  if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
});

async function onTap(pos) {
  if (state.busy) return;
  if (state.armedTool === 'hammer') {
    state.armedTool = null;
    setArmedTool(null);
    await useHammer(pos);
    return;
  }
  if (state.armedTool === 'colorBomb') {
    state.armedTool = null;
    setArmedTool(null);
    await useColorBomb(pos);
    return;
  }
  cancelHint();
  sfx.unlockAudio();

  if (!state.selected) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
    haptics.tap();
    scheduleHint();
    return;
  }

  if (state.selected.c === pos.c && state.selected.r === pos.r) {
    state.selected = null;
    renderBoard(state.board, state);
    scheduleHint();
    return;
  }

  if (!state.board.adjacent(state.selected, pos)) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
    haptics.tap();
    scheduleHint();
    return;
  }

  const a = state.selected;
  const b = pos;
  state.selected = null;
  await trySwap(a, b);
}

function comboFanfare(kind) {
  switch (kind) {
    case 'double-rainbow': return 'WHOA!';
    case 'rainbow-stripes': return 'POW!';
    case 'rainbow-type': return 'Wow!';
    case 'stripes-pair': return 'BOOM!';
  }
  return 'Combo!';
}

async function runComboTurn(combo) {
  const candidate = applyCombo(state.board, combo);
  const { clearable: cleared, blocked: lockedBlocked } = splitByLock(candidate);
  const clearedTypes = cleared.map((p) => state.board.typeAt(p.c, p.r));
  sfx.playCascade();
  sfx.playMatch(cleared.length, 2);
  haptics.combo();
  spawnPopSpecks(cleared);
  spawnConfetti(combo.kind === 'double-rainbow' ? 40 : 22);
  await animatePop(cleared);
  state.board.clear(cleared);
  decrementJellyAt(cleared);
  if (lockedBlocked.length > 0) {
    decrementLockAt(lockedBlocked);
    for (const p of lockedBlocked) spawnTileSparkles(p.c, p.r, 8, { color: '#facc15' });
  }
  recordClearedTypes(clearedTypes);
  state.progress.matches += 1;
  flashObjectiveProgress(0);
  const earned = consumeLuckyIfReady(
    applyRunScoreMultiplier(calcScore(cleared, 2), 2, cleared.length)
  );
  state.score += earned;
  maybeDropSurprise(cleared, 2);
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, cleared, { color: '#FF006E' });
  achievements.onScore(state.score);
  const banner = comboFanfare(combo.kind);
  flashMessage(banner);
  speech.speak(banner);
  showAchievement(banner);
  renderBoard(state.board, state);
  await delay(180);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(260);
}

async function trySwap(a, b) {
  state.busy = true;
  if (state.board.isIngredient(a.c, a.r) || state.board.isIngredient(b.c, b.r)) {
    sfx.playInvalid();
    haptics.invalid();
    flashMessage('Cherries cannot be swapped', 1000);
    state.busy = false;
    scheduleHint();
    return;
  }
  if (isLocked(a.c, a.r) || isLocked(b.c, b.r)) {
    sfx.playInvalid();
    haptics.invalid();
    flashMessage('Locked!', 900);
    speech.speak('Locked');
    const lockedPos = isLocked(a.c, a.r) ? a : b;
    const tile = document.querySelector(
      `#board .tile[data-c="${lockedPos.c}"][data-r="${lockedPos.r}"]`
    );
    if (tile) {
      tile.classList.add('lock-shake');
      setTimeout(() => tile.classList.remove('lock-shake'), 420);
    }
    state.busy = false;
    scheduleHint();
    return;
  }
  sfx.playSwap();
  haptics.swap();
  await animateSwap(a, b);
  state.board.swap(a, b);
  renderBoard(state.board, state);

  const cellAtA = state.board.cell(a.c, a.r);
  const cellAtB = state.board.cell(b.c, b.r);
  const combo = detectCombo(cellAtA, cellAtB, a, b);

  if (combo) {
    consumeMove();
    await runComboTurn(combo);
    let cascadeResult = findMatches(state.board);
    let cascadeLevel = 2;
    while (cascadeResult.positions.length > 0) {
      await processMatchRound(cascadeResult, cascadeLevel, null);
      cascadeResult = findMatches(state.board);
      cascadeLevel++;
    }
    maybeUpdateBest();
    refreshLevelUI();
    await ensureMovesAvailable();
    checkLevelOutcome();
    state.busy = false;
    if (!state.resolved) scheduleHint();
    return;
  }

  let result = findMatches(state.board);
  if (result.positions.length === 0) {
    sfx.playInvalid();
    haptics.invalid();
    await animateSwap(a, b);
    state.board.swap(a, b);
    renderBoard(state.board, state);
    flashMessage('Try another', 900);
    state.busy = false;
    scheduleHint();
    return;
  }

  consumeMove();
  let cascadeLevel = 1;
  let swapTarget = b;
  while (result.positions.length > 0) {
    await processMatchRound(result, cascadeLevel, swapTarget);
    result = findMatches(state.board);
    cascadeLevel++;
    swapTarget = null;
  }

  maybeUpdateBest();
  refreshLevelUI();
  await ensureMovesAvailable();
  checkLevelOutcome();
  state.busy = false;
  if (!state.resolved) scheduleHint();
}

async function processMatchRound(result, cascadeLevel, swapTarget) {
  const specialsCreated = deriveNewSpecials(result.groups, swapTarget);
  const newSpecialKeys = new Set(specialsCreated.map((s) => `${s.c},${s.r}`));

  const activated = activationClears(state.board, result.positions);
  const specialsActivated = result.positions
    .map((p) => state.board.specialAt(p.c, p.r))
    .filter(Boolean);

  const allCleared = new Set();
  for (const p of result.positions) allCleared.add(`${p.c},${p.r}`);
  for (const p of activated) allCleared.add(`${p.c},${p.r}`);

  const candidate = [...allCleared]
    .filter((k) => !newSpecialKeys.has(k))
    .map((k) => {
      const [c, r] = k.split(',').map(Number);
      return { c, r };
    })
    .filter((p) => !state.board.isIngredient(p.c, p.r));

  const { clearable: toClear, blocked: lockedBlocked } = splitByLock(candidate);
  const clearedTypes = toClear.map((p) => state.board.typeAt(p.c, p.r));

  sfx.playMatch(allCleared.size, cascadeLevel);
  const matchIntensity = allCleared.size >= 5 ? 3 : allCleared.size >= 4 ? 2 : 1;
  haptics.match(matchIntensity);
  if (cascadeLevel >= 2) {
    sfx.playCascade();
    showCascadeBanner(cascadeLevel);
    haptics.cascade(cascadeLevel);
  }
  if (cascadeLevel >= 3) spawnConfetti(20);
  if (cascadeLevel >= 4) {
    screenShake(7, 380);
    spawnConfetti(36);
  }
  if (cascadeLevel >= 5) {
    spawnScreenFlash('rgba(255, 0, 110, 0.35)');
    spawnConfetti(48);
  }
  if (allCleared.size >= 6 && allCleared.size < 8) {
    flashMessage('HUGE MATCH!', 1200);
    screenShake(5, 300);
    haptics.epic();
  }
  if (allCleared.size >= 8) {
    flashMessage('EPIC MATCH!', 1400);
    screenShake(9, 460);
    spawnScreenFlash('rgba(255, 214, 10, 0.45)');
    spawnConfetti(60);
    haptics.epic();
  }

  // Collect any crazy tiles being cleared so we can trigger their
  // effects AFTER the regular clear settles.
  const crazyToTrigger = [];
  for (const p of toClear) {
    const cellHere = state.board.cell(p.c, p.r);
    if (cellHere && cellHere.crazy) {
      crazyToTrigger.push({ pos: p, kind: cellHere.crazy });
    }
  }

  drawMatchTrails(result.groups);
  spawnPopSpecks(toClear);
  await animatePop(toClear);
  state.board.clear(toClear);
  decrementJellyAt(toClear);
  if (lockedBlocked.length > 0) {
    decrementLockAt(lockedBlocked);
    for (const p of lockedBlocked) spawnTileSparkles(p.c, p.r, 8, { color: '#facc15' });
  }
  recordClearedTypes(clearedTypes);
  state.progress.matches += 1;
  state.progress.specials += specialsCreated.length;
  flashObjectiveProgress(specialsCreated.length);
  maybeTriggerLightning();
  if (specialsCreated.length > 0) {
    maybeFireSnake();
    // Bomb Maker upgrade — every special also spawns a TNT tile
    if (upgradeCount('bomb-maker') > 0) {
      for (let i = 0; i < upgradeCount('bomb-maker'); i++) {
        if (Math.random() < 0.5 * specialsCreated.length) spawnCrazyTile('tnt');
      }
    }
  }
  // Trigger crazy-tile pops (after clear, before scoring so the
  // visual chain reads in the right order).
  for (const { pos, kind } of crazyToTrigger) {
    await triggerCrazyEffect(pos, kind);
  }
  // Possibly spawn a new crazy tile from this match
  maybeSpawnCrazyOnMatch(allCleared.size, cascadeLevel);

  for (const s of specialsCreated) {
    state.board.set(s.c, s.r, { type: s.type, special: s.kind });
    spawnTileSparkles(s.c, s.r, s.kind === 'rainbow' ? 14 : 10);
    if (s.kind === 'rainbow') {
      spawnShockwave(s.c, s.r, { color: '#FF006E', size: 240 });
      spawnScreenFlash('rgba(255, 214, 10, 0.35)');
      flashMessage('RAINBOW!', 1200);
      screenShake(4, 280);
    } else {
      spawnShockwave(s.c, s.r, { color: '#FFD60A', size: 160 });
    }
  }
  renderBoard(state.board, state);
  for (const s of specialsCreated) popNewSpecial(s.c, s.r);
  if (specialsCreated.length > 0) haptics.specialBirth();

  const earned = consumeLuckyIfReady(
    applyRunScoreMultiplier(
      calcScore([...allCleared], cascadeLevel),
      cascadeLevel,
      allCleared.size
    )
  );
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, toClear);
  maybeDropSurprise(toClear, cascadeLevel);
  updateComboMeter(cascadeLevel);
  achievements.onScore(state.score);

  const ctx = {
    matchCount: allCleared.size,
    cascadeLevel,
    specialsCreated,
    specialsActivated,
  };
  const msg = messageFor(ctx);
  flashMessage(msg);
  speech.speak(msg);
  achievements.onMatch(ctx);

  await delay(160);
  const fallen = gravityWithIngredients();
  renderBoard(state.board, state, { fallen });
  await delay(260);
}

function resetBoard() {
  state.board = new Board(COLS, ROWS, CANDY_TYPES);
  state.board.fillNoMatches();
  if (!hasAnyValidSwap(state.board)) {
    reshuffle(state.board, CANDY_TYPES);
  }
  state.score = 0;
  state.selected = null;
  state.busy = false;
  state.resolved = false;
  state.almostFired = false;
  state.jellyMap = new Map();
  state.lockMap = new Map();
  state.progress = {
    type: {},
    matches: 0,
    specials: 0,
    jellyRemaining: 0,
    jellyTotal: 0,
    ingredientsTotal: 0,
    ingredientsDropped: 0,
  };
  state.armedTool = null;
  setArmedTool(null);
  setPowerupCounts(powerupBank());
  setScore(0);
  setBest(state.highScore);
  setStreak(state.streak);
  flashMessage('');
  achievements.onNewGame();
}

function applyLevelObstacles(level) {
  state.jellyMap = new Map();
  state.lockMap = new Map();
  let total = 0;
  let ingredientCount = 0;
  if (level && level.obstacles) {
    if (Array.isArray(level.obstacles.jelly)) {
      for (const spec of level.obstacles.jelly) {
        const [c, r, hits = 1] = spec;
        state.jellyMap.set(`${c},${r}`, hits);
        total += hits;
      }
    }
    if (Array.isArray(level.obstacles.locks)) {
      for (const spec of level.obstacles.locks) {
        const [c, r, hits = 1] = spec;
        state.lockMap.set(`${c},${r}`, hits);
      }
    }
    if (Array.isArray(level.obstacles.ingredients)) {
      for (const spec of level.obstacles.ingredients) {
        const [c, r] = spec;
        const cell = state.board.cell(c, r);
        if (cell) cell.ingredient = true;
        ingredientCount++;
      }
    }
  }
  state.progress.jellyTotal = total;
  state.progress.jellyRemaining = total;
  state.progress.ingredientsTotal = ingredientCount;
  state.progress.ingredientsDropped = 0;
}

// After every gravity settle, check the bottom row for ingredients
// that have arrived. Remove them, bump the counter, and (optionally)
// run another gravity pass to fill the freed cells.
function exitIngredients() {
  const bottom = state.board.rows - 1;
  const exited = [];
  for (let c = 0; c < state.board.cols; c++) {
    const cell = state.board.cell(c, bottom);
    if (cell && cell.ingredient) {
      exited.push({ c, r: bottom });
      state.board.set(c, bottom, null);
    }
  }
  if (exited.length === 0) return [];
  state.progress.ingredientsDropped += exited.length;
  spawnConfetti(20);
  for (const p of exited) spawnTileSparkles(p.c, p.r, 12, { color: '#FF006E' });
  const obj = state.level && state.level.objective;
  if (obj && obj.kind === 'dropIngredients') {
    flashObjectiveDelta(`+${exited.length}`);
  }
  speech.speak(exited.length === 1 ? 'Dropped!' : `Dropped ${exited.length}!`);
  haptics.drop();
  return exited;
}

function gravityWithIngredients() {
  const fallen = applyGravity(state.board, CANDY_TYPES);
  const exited = exitIngredients();
  if (exited.length > 0) {
    const more = applyGravity(state.board, CANDY_TYPES);
    for (const p of more) fallen.push(p);
  }
  return fallen;
}

function isLocked(c, r) {
  const n = state.lockMap.get(`${c},${r}`);
  return n != null && n > 0;
}

function splitByLock(positions) {
  const clearable = [];
  const blocked = [];
  for (const p of positions) {
    if (isLocked(p.c, p.r)) blocked.push(p);
    else clearable.push(p);
  }
  return { clearable, blocked };
}

function decrementLockAt(positions) {
  if (state.lockMap.size === 0) return 0;
  let dec = 0;
  for (const p of positions) {
    const k = `${p.c},${p.r}`;
    const n = state.lockMap.get(k);
    if (n && n > 0) {
      const next = n - 1;
      if (next === 0) state.lockMap.delete(k);
      else state.lockMap.set(k, next);
      dec++;
    }
  }
  return dec;
}

function decrementJellyAt(positions) {
  if (state.jellyMap.size === 0) return 0;
  let dec = 0;
  for (const p of positions) {
    const k = `${p.c},${p.r}`;
    const n = state.jellyMap.get(k);
    if (n && n > 0) {
      state.jellyMap.set(k, n - 1);
      dec++;
    }
  }
  if (dec > 0) {
    state.progress.jellyRemaining = Math.max(0, state.progress.jellyRemaining - dec);
    const obj = state.level && state.level.objective;
    if (obj && obj.kind === 'clearJelly') flashObjectiveDelta(`+${dec}`);
  }
  return dec;
}

function startLevel(levelId, { announce = true } = {}) {
  cancelHint();
  hideLevelOverlay();
  state.level = getLevel(levelId);
  resetBoard();
  applyLevelObstacles(state.level);
  state.movesRemaining = state.level.moves;
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  if (announce) {
    const bestStars = state.levelProgress.stars[state.level.id] || 0;
    const bestScore = (state.levelProgress.bestScores || {})[state.level.id] || 0;
    let bestPhrase = '';
    if (bestStars > 0 || bestScore > 0) {
      const parts = [];
      if (bestStars > 0) parts.push(`${bestStars} ${bestStars === 1 ? 'star' : 'stars'}`);
      if (bestScore > 0) parts.push(`${bestScore.toLocaleString()} points`);
      bestPhrase = ` Your best: ${parts.join(', ')}.`;
    }
    const tipPhrase = state.level.tip ? ` Tip: ${state.level.tip}` : '';
    speech.speak(
      `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.level.moves} moves.${bestPhrase}${tipPhrase}`
    );
    // Block input while intro is up; the intro resolves on tap or timeout.
    state.busy = true;
    const done = () => {
      state.busy = false;
      scheduleHint();
    };
    const p = showLevelIntro(state.level, LEVELS.length, { bestStars, bestScore });
    if (p && typeof p.then === 'function') p.then(done);
    else done();
  } else {
    scheduleHint();
  }
}

function startFreePlay() {
  cancelHint();
  hideLevelOverlay();
  state.level = null;
  resetBoard();
  state.movesRemaining = 0;
  refreshLevelUI();
  renderBoard(state.board, state, { intro: true });
  scheduleHint();
}

function init({ chime = false, announceLevel = true } = {}) {
  if (state.settings.mode === 'roguelike') {
    startRoguelikeRun();
  } else if (state.settings.mode === 'levels') {
    startLevel(state.levelProgress.currentLevel || 1, { announce: announceLevel });
  } else {
    startFreePlay();
  }
  if (chime) sfx.playRestart();
}

applyTheme(state.settings);

createSettingsUI({
  initial: state.settings,
  onChange: (next) => {
    const modeChanged = next.mode !== state.settings.mode;
    state.settings = { ...state.settings, ...next };
    sfx.setMuted(!state.settings.sound);
    sfx.setMusicEnabled(state.settings.music);
    sfx.setMusicMode(state.settings.mode);
    speech.setSpeechEnabled(state.settings.speech);
    applyTheme(state.settings);
    persist();
    if (modeChanged) {
      // Stepping out of an active run mid-game ends it and tallies gems.
      if (state.inRoguelikeRun && state.settings.mode !== 'roguelike') {
        endRoguelikeRun();
      }
      playModeTransition(state.settings.mode);
      if (state.settings.mode === 'roguelike') {
        startRoguelikeRun();
      } else if (state.settings.mode === 'levels') {
        startLevel(state.levelProgress.currentLevel || 1);
      } else {
        startFreePlay();
      }
    }
  },
  onResetProgress: () => {
    resetProgressSave({ settings: state.settings });
    speech.speak('Progress reset. Starting over.');
    location.reload();
  },
});

sfx.setMusicEnabled(state.settings.music);
sfx.setMusicMode(state.settings.mode);

const levelSelect = createLevelSelect({
  getProgress: () => state.levelProgress,
  onChoose: (id) => startLevel(id),
});
document.getElementById('level-chip').addEventListener('click', () => {
  if (state.settings.mode === 'levels') levelSelect.show();
});

const skillTreeBtn = document.getElementById('setting-skill-tree');
if (skillTreeBtn) {
  skillTreeBtn.addEventListener('click', () => {
    showSkillTree({
      skills: SKILL_TREE,
      gems: () => state.roguelike.gems || 0,
      owned: () => metaSkills(),
      onBuy: (id) => buyMetaSkill(id),
    });
  });
}

document.getElementById('help-open').addEventListener('click', () => {
  sfx.unlockAudio();
  showWelcome(() => {
    if (state.settings.mode === 'levels' && state.level) {
      speech.speak(
        `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.movesRemaining} moves left.`
      );
    }
  });
});

document.getElementById('restart').addEventListener('click', () => {
  sfx.unlockAudio();
  if (state.settings.mode === 'roguelike') {
    // Mid-run restart = forfeit the run from current slot
    if (state.inRoguelikeRun) endRoguelikeRun();
    startRoguelikeRun();
  } else if (state.settings.mode === 'levels') {
    startLevel(state.level ? state.level.id : state.levelProgress.currentLevel || 1);
  } else {
    startFreePlay();
  }
  sfx.playRestart();
});
async function onSwipe(origin, target) {
  if (state.busy) return;
  cancelHint();
  sfx.unlockAudio();
  // Treat the swipe as: select origin, then commit to target.
  // If origin or target is a tool-armed flow, fall back to taps.
  if (state.armedTool === 'hammer' || state.armedTool === 'colorBomb') {
    return onTap(origin);
  }
  state.selected = null;
  await trySwap(origin, target);
}

attachInput({ onTap, onSwap: onSwipe });

document.addEventListener(
  'pointerdown',
  (e) => {
    const target = e.target instanceof Element ? e.target.closest('button, .tile') : null;
    if (!target) return;
    if (target.disabled) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    const cs = getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  },
  { passive: true }
);

// Initialize lucky bar display
setLuckyCharge(0, false);

// Show changelog for returning players who haven't seen this version,
// only after the welcome flow (or instead of it, for returning players).
function maybeShowChangelog(after) {
  if (state.seenVersion === APP_VERSION || !state.seenWelcome) {
    if (after) after();
    return;
  }
  showChangelog(CHANGELOG, () => {
    state.seenVersion = APP_VERSION;
    persist();
    if (after) after();
  });
}

if (state.seenWelcome) {
  init({ chime: false });
  maybeShowChangelog();
} else {
  init({ chime: false, announceLevel: false });
  showWelcome(() => {
    state.seenWelcome = true;
    state.seenVersion = APP_VERSION; // first-time players have effectively "seen" it
    persist();
    sfx.unlockAudio();
    if (state.settings.mode === 'levels' && state.level) {
      showLevelIntro(state.level, LEVELS.length);
      speech.speak(
        `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.level.moves} moves.`
      );
    }
  });
}
persist();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch(() => {
        // No-op: PWA install just won't be available.
      });
  });
}
