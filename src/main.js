import { Board } from './game/board.js';
import { findMatches, deriveNewSpecials, activationClears } from './game/match.js';
import { applyGravity } from './game/cascade.js';
import { calcScore } from './game/score.js';
import { findAnyValidSwap, hasAnyValidSwap, reshuffle } from './game/hint.js';
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
} from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createSettingsUI } from './ui/settings.js';
import { createAchievements } from './ui/achievements.js';
import * as sfx from './audio/sfx.js';
import * as speech from './audio/speech.js';
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
    settings: state.settings,
  });
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

async function trySwap(a, b) {
  state.busy = true;
  sfx.playSwap();
  await animateSwap(a, b);
  state.board.swap(a, b);
  renderBoard(state.board, state);

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

  let cascadeLevel = 1;
  let swapTarget = b;
  while (result.positions.length > 0) {
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

    sfx.playMatch(allCleared.size, cascadeLevel);
    if (cascadeLevel >= 2) sfx.playCascade();

    await animatePop(toClear);
    state.board.clear(toClear);

    for (const s of specialsCreated) {
      state.board.set(s.c, s.r, { type: s.type, special: s.kind });
    }

    const earned = calcScore([...allCleared], cascadeLevel);
    state.score += earned;
    setScore(state.score, { animate: true });
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
    result = findMatches(state.board);
    cascadeLevel++;
    swapTarget = null;
  }

  maybeUpdateBest();
  await ensureMovesAvailable();
  state.busy = false;
  scheduleHint();
}

function init({ chime = false } = {}) {
  cancelHint();
  state.board = new Board(COLS, ROWS, CANDY_TYPES);
  state.board.fillNoMatches();
  if (!hasAnyValidSwap(state.board)) {
    reshuffle(state.board, CANDY_TYPES);
  }
  state.score = 0;
  state.selected = null;
  state.busy = false;
  setScore(0);
  setBest(state.highScore);
  setStreak(state.streak);
  flashMessage('');
  achievements.onNewGame();
  renderBoard(state.board, state);
  if (chime) sfx.playRestart();
  scheduleHint();
}

applyTheme(state.settings);

createSettingsUI({
  initial: state.settings,
  onChange: (next) => {
    state.settings = { ...state.settings, ...next };
    sfx.setMuted(!state.settings.sound);
    speech.setSpeechEnabled(state.settings.speech);
    applyTheme(state.settings);
    persist();
  },
});

document.getElementById('restart').addEventListener('click', () => {
  sfx.unlockAudio();
  init({ chime: true });
});
attachInput(onTap);
init({ chime: false });
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
