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
} from './ui/particles.js';
import {
  load as loadSave,
  save as saveSave,
  bumpStreakForToday,
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
  progress: { type: {}, matches: 0, specials: 0 },
  resolved: false,
  seenWelcome: persisted.seenWelcome,
};

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
  if (p.done) {
    state.resolved = true;
    const stars = starsForLevel(state.level, state.movesRemaining);
    const prev = state.levelProgress.stars[state.level.id] || 0;
    if (stars > prev) state.levelProgress.stars[state.level.id] = stars;
    const next = nextLevelId(state.level.id);
    if (next && next > (state.levelProgress.currentLevel || 0)) {
      state.levelProgress.currentLevel = next;
    }
    persist();
    spawnConfetti(48);
    sfx.playRestart();
    speech.speak(`Level complete! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
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
    sfx.playInvalid();
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

async function onTap(pos) {
  if (state.busy) return;
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
  const cleared = applyCombo(state.board, combo);
  const clearedTypes = cleared.map((p) => state.board.typeAt(p.c, p.r));
  sfx.playCascade();
  sfx.playMatch(cleared.length, 2);
  spawnPopSpecks(cleared);
  spawnConfetti(combo.kind === 'double-rainbow' ? 40 : 22);
  await animatePop(cleared);
  state.board.clear(cleared);
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

  const toClear = [...allCleared]
    .filter((k) => !newSpecialKeys.has(k))
    .map((k) => {
      const [c, r] = k.split(',').map(Number);
      return { c, r };
    });

  const clearedTypes = toClear.map((p) => state.board.typeAt(p.c, p.r));

  sfx.playMatch(allCleared.size, cascadeLevel);
  if (cascadeLevel >= 2) sfx.playCascade();
  if (cascadeLevel >= 3) spawnConfetti(20);

  spawnPopSpecks(toClear);
  await animatePop(toClear);
  state.board.clear(toClear);
  recordClearedTypes(clearedTypes);
  state.progress.matches += 1;
  state.progress.specials += specialsCreated.length;
  flashObjectiveProgress(specialsCreated.length);

  for (const s of specialsCreated) {
    state.board.set(s.c, s.r, { type: s.type, special: s.kind });
    spawnTileSparkles(s.c, s.r, s.kind === 'rainbow' ? 14 : 10);
  }

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

  renderBoard(state.board, state);
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
  state.progress = { type: {}, matches: 0, specials: 0 };
  setScore(0);
  setBest(state.highScore);
  setStreak(state.streak);
  flashMessage('');
  achievements.onNewGame();
}

function startLevel(levelId, { announce = true } = {}) {
  cancelHint();
  hideLevelOverlay();
  state.level = getLevel(levelId);
  resetBoard();
  state.movesRemaining = state.level.moves;
  refreshLevelUI();
  renderBoard(state.board, state);
  if (announce) {
    showLevelIntro(state.level, LEVELS.length);
    speech.speak(
      `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.level.moves} moves.`
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
  renderBoard(state.board, state);
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
});

const levelSelect = createLevelSelect({
  getProgress: () => state.levelProgress,
  onChoose: (id) => startLevel(id),
});
document.getElementById('level-chip').addEventListener('click', () => {
  if (state.settings.mode === 'levels') levelSelect.show();
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
