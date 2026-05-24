import { Board } from './game/board.js';
import { findMatches } from './game/match.js';
import { applyGravity } from './game/cascade.js';
import { calcScore } from './game/score.js';
import {
  renderBoard,
  setScore,
  setBest,
  flashMessage,
  applyTheme,
  animateSwap,
  animatePop,
} from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createSettingsUI } from './ui/settings.js';
import * as sfx from './audio/sfx.js';
import { load as loadSave, save as saveSave } from './storage/save.js';

const COLS = 6;
const ROWS = 6;
const CANDY_TYPES = 6;

const persisted = loadSave();

const state = {
  board: new Board(COLS, ROWS, CANDY_TYPES),
  score: 0,
  highScore: persisted.highScore,
  busy: false,
  selected: null,
  settings: { ...persisted.settings },
};

sfx.setMuted(!state.settings.sound);

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function persist() {
  saveSave({
    highScore: state.highScore,
    settings: state.settings,
  });
}

function messageFor(matches, cascadeLevel) {
  if (cascadeLevel >= 3) return 'Amazing!';
  if (cascadeLevel === 2) return 'Cascade!';
  if (matches.length >= 6) return 'Huge match!';
  if (matches.length >= 5) return 'Big match!';
  if (matches.length >= 4) return 'Nice!';
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
  sfx.unlockAudio();

  if (!state.selected) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
    return;
  }

  if (state.selected.c === pos.c && state.selected.r === pos.r) {
    state.selected = null;
    renderBoard(state.board, state);
    return;
  }

  if (!state.board.adjacent(state.selected, pos)) {
    state.selected = pos;
    renderBoard(state.board, state);
    sfx.playSelect();
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

  let matches = findMatches(state.board);
  if (matches.length === 0) {
    sfx.playInvalid();
    await animateSwap(a, b);
    state.board.swap(a, b);
    renderBoard(state.board, state);
    flashMessage('Try another', 900);
    state.busy = false;
    return;
  }

  let cascadeLevel = 1;
  while (matches.length > 0) {
    sfx.playMatch(matches.length, cascadeLevel);
    if (cascadeLevel >= 2) sfx.playCascade();
    await animatePop(matches);
    state.board.clear(matches);
    const earned = calcScore(matches, cascadeLevel);
    state.score += earned;
    setScore(state.score, { animate: true });
    flashMessage(messageFor(matches, cascadeLevel));
    renderBoard(state.board, state);
    await delay(160);
    const fallen = applyGravity(state.board, CANDY_TYPES);
    renderBoard(state.board, state, { fallen });
    await delay(260);
    matches = findMatches(state.board);
    cascadeLevel++;
  }

  maybeUpdateBest();
  state.busy = false;
}

function init({ chime = false } = {}) {
  state.board = new Board(COLS, ROWS, CANDY_TYPES);
  state.board.fillNoMatches();
  state.score = 0;
  state.selected = null;
  state.busy = false;
  setScore(0);
  setBest(state.highScore);
  flashMessage('');
  renderBoard(state.board, state);
  if (chime) sfx.playRestart();
}

applyTheme(state.settings);

createSettingsUI({
  initial: state.settings,
  onChange: (next) => {
    state.settings = { ...state.settings, ...next };
    sfx.setMuted(!state.settings.sound);
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
