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
} from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createSettingsUI } from './ui/settings.js';
import { createLevelSelect } from './ui/levelSelect.js';
import { createAchievements } from './ui/achievements.js';
import * as sfx from './audio/sfx.js';
import * as speech from './audio/speech.js';
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
  progress: { type: {}, matches: 0, specials: 0, jellyRemaining: 0, jellyTotal: 0 },
  jellyMap: new Map(),
  lockMap: new Map(),
  resolved: false,
  almostFired: false,
  seenWelcome: persisted.seenWelcome,
  powerups: { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 },
  armedTool: null,
};

const POWERUP_DEFAULTS = { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 };
const PLUS_MOVES_BONUS = 3;

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

function scheduleHint() {
  cancelHint();
  hintTimer = setTimeout(() => {
    if (state.busy) {
      scheduleHint();
      return;
    }
    const swap = findAnyValidSwap(state.board);
    if (swap) showHintGlow(swap.a, swap.b);
  }, HINT_IDLE_MS);
}

async function ensureMovesAvailable() {
  if (hasAnyValidSwap(state.board)) return;
  flashMessage('Shuffle!', 1100);
  await delay(120);
  reshuffle(state.board, CANDY_TYPES);
  renderBoard(state.board, state);
}

function persist() {
  saveSave({
    highScore: state.highScore,
    streak: state.streak,
    lastPlayedDate: state.lastPlayedDate,
    seenWelcome: state.seenWelcome,
    settings: state.settings,
    levelProgress: state.levelProgress,
  });
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
  setLevelChip(
    state.level,
    state.settings.mode,
    state.level ? state.levelProgress.stars[state.level.id] || 0 : 0
  );
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
  if (state.settings.mode !== 'levels' || !state.level) return;
  if (state.movesRemaining > 0) {
    state.movesRemaining--;
    refreshLevelUI();
    bumpMoveCounter();
  }
}

function checkLevelOutcome() {
  if (state.resolved) return;
  if (state.settings.mode !== 'levels' || !state.level) return;
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
    const next = nextLevelId(state.level.id);
    if (next && next > (state.levelProgress.currentLevel || 0)) {
      state.levelProgress.currentLevel = next;
    }
    persist();
    spawnConfetti(improved && !firstClear ? 72 : 48);
    if (stars === 3) spawnStarRain(36);
    sfx.playObjectiveComplete(state.level.objective.kind);
    if (improved && !firstClear) {
      flashMessage(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}`, 1600);
      speech.speak(`New best! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
    } else {
      speech.speak(`Level complete! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
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
    speech.speak('Try again');
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
  if (state.busy || state.powerups.hammer <= 0) return;
  if (!state.board.cell(pos.c, pos.r)) return;
  state.busy = true;
  state.powerups.hammer--;
  setPowerupCounts(state.powerups);
  cancelHint();
  sfx.unlockAudio();
  sfx.playMatch(1, 1);
  speech.speak('Smash!');
  spawnPopSpecks([pos]);
  await animatePop([pos]);
  state.board.clear([pos]);
  decrementJellyAt([pos]);
  state.lockMap.delete(`${pos.c},${pos.r}`);
  renderBoard(state.board, state);
  await delay(120);
  const fallen = applyGravity(state.board, CANDY_TYPES);
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
  if (state.busy || state.powerups.colorBomb <= 0) return;
  const targetCell = state.board.cell(pos.c, pos.r);
  if (!targetCell || targetCell.type == null) return;
  const targetType = targetCell.type;
  state.busy = true;
  state.powerups.colorBomb--;
  setPowerupCounts(state.powerups);
  cancelHint();
  sfx.unlockAudio();

  const candidate = [];
  for (let r = 0; r < state.board.rows; r++) {
    for (let c = 0; c < state.board.cols; c++) {
      if (state.board.typeAt(c, r) === targetType) candidate.push({ c, r });
    }
  }
  const { clearable: positions, blocked: lockedBlocked } = splitByLock(candidate);
  flashMessage('Color bomb!', 1100);
  speech.speak('Color bomb!');
  spawnConfetti(28);
  sfx.playCascade();
  sfx.playMatch(positions.length, 2);
  spawnPopSpecks(positions);
  await animatePop(positions);
  state.board.clear(positions);
  decrementJellyAt(positions);
  if (lockedBlocked.length > 0) {
    decrementLockAt(lockedBlocked);
    for (const p of lockedBlocked) spawnTileSparkles(p.c, p.r, 8, { color: '#facc15' });
  }
  const clearedTypeList = positions.map(() => targetType);
  recordClearedTypes(clearedTypeList);
  state.progress.matches += 1;
  flashObjectiveProgress(0);
  const earned = calcScore(positions, 2);
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, positions, { color: '#FF006E' });
  achievements.onScore(state.score);
  await delay(180);
  const fallen = applyGravity(state.board, CANDY_TYPES);
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
  if (state.busy || state.powerups.plusMoves <= 0) return;
  if (state.settings.mode !== 'levels' || !state.level) {
    speech.speak('Plus moves only works in Levels');
    flashMessage('Levels mode only', 1100);
    return;
  }
  state.powerups.plusMoves--;
  setPowerupCounts(state.powerups);
  state.movesRemaining += PLUS_MOVES_BONUS;
  state.resolved = false;
  refreshLevelUI();
  bumpMoveCounter();
  flashMessage(`+${PLUS_MOVES_BONUS} moves!`, 1100);
  speech.speak(`Plus ${PLUS_MOVES_BONUS} moves`);
  hideLevelOverlay();
}

function useShuffle() {
  if (state.busy || state.powerups.shuffle <= 0) return;
  state.powerups.shuffle--;
  setPowerupCounts(state.powerups);
  state.armedTool = null;
  setArmedTool(null);
  cancelHint();
  sfx.unlockAudio();
  reshuffle(state.board, CANDY_TYPES);
  flashMessage('Shuffled!', 1000);
  speech.speak('Shuffled!');
  renderBoard(state.board, state);
  scheduleHint();
}

function armTool(tool) {
  if (state.busy) return;
  if (state.powerups[tool] <= 0) return;
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
  const earned = calcScore(cleared, 2);
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, cleared, { color: '#FF006E' });
  achievements.onScore(state.score);
  const banner = comboFanfare(combo.kind);
  flashMessage(banner);
  speech.speak(banner);
  showAchievement(banner);
  renderBoard(state.board, state);
  await delay(180);
  const fallen = applyGravity(state.board, CANDY_TYPES);
  renderBoard(state.board, state, { fallen });
  await delay(260);
}

async function trySwap(a, b) {
  state.busy = true;
  if (isLocked(a.c, a.r) || isLocked(b.c, b.r)) {
    sfx.playInvalid();
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
    });

  const { clearable: toClear, blocked: lockedBlocked } = splitByLock(candidate);
  const clearedTypes = toClear.map((p) => state.board.typeAt(p.c, p.r));

  sfx.playMatch(allCleared.size, cascadeLevel);
  if (cascadeLevel >= 2) {
    sfx.playCascade();
    showCascadeBanner(cascadeLevel);
  }
  if (cascadeLevel >= 3) spawnConfetti(20);
  if (cascadeLevel >= 4) {
    screenShake(7, 380);
    spawnConfetti(36);
  }
  if (allCleared.size >= 6) {
    flashMessage('HUGE MATCH!', 1200);
    screenShake(5, 300);
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

  const earned = calcScore([...allCleared], cascadeLevel);
  state.score += earned;
  setScore(state.score, { animate: true });
  spawnFloatingNumber(`+${earned.toLocaleString()}`, toClear);
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
  const fallen = applyGravity(state.board, CANDY_TYPES);
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
  };
  state.powerups = { ...POWERUP_DEFAULTS };
  state.armedTool = null;
  setArmedTool(null);
  setPowerupCounts(state.powerups);
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
  }
  state.progress.jellyTotal = total;
  state.progress.jellyRemaining = total;
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
    showLevelIntro(state.level, LEVELS.length, { bestStars, bestScore });
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
  }
  scheduleHint();
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
  if (state.settings.mode === 'levels') {
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
    speech.setSpeechEnabled(state.settings.speech);
    applyTheme(state.settings);
    persist();
    if (modeChanged) {
      if (state.settings.mode === 'levels') {
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

const levelSelect = createLevelSelect({
  getProgress: () => state.levelProgress,
  onChoose: (id) => startLevel(id),
});
document.getElementById('level-chip').addEventListener('click', () => {
  if (state.settings.mode === 'levels') levelSelect.show();
});

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
  if (state.settings.mode === 'levels') {
    startLevel(state.level ? state.level.id : state.levelProgress.currentLevel || 1);
  } else {
    startFreePlay();
  }
  sfx.playRestart();
});
attachInput(onTap);

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

if (state.seenWelcome) {
  init({ chime: false });
} else {
  init({ chime: false, announceLevel: false });
  showWelcome(() => {
    state.seenWelcome = true;
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
