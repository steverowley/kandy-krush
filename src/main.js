import { Board } from './game/board.js';
import { findMatches } from './game/match.js';
import { applyGravity } from './game/cascade.js';
import { calcScore } from './game/score.js';
import { renderBoard, setScore, flashMessage } from './ui/render.js';
import { attachInput } from './ui/input.js';

const COLS = 6;
const ROWS = 6;
const CANDY_TYPES = 6;

const state = {
  board: new Board(COLS, ROWS, CANDY_TYPES),
  score: 0,
  busy: false,
  selected: null,
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function messageFor(matches, cascadeLevel) {
  if (cascadeLevel >= 3) return 'Amazing!';
  if (cascadeLevel === 2) return 'Cascade!';
  if (matches.length >= 6) return 'Huge match!';
  if (matches.length >= 5) return 'Big match!';
  if (matches.length >= 4) return 'Nice!';
  return 'Match!';
}

async function onTap(pos) {
  if (state.busy) return;

  if (!state.selected) {
    state.selected = pos;
    renderBoard(state.board, state);
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
    return;
  }

  const a = state.selected;
  const b = pos;
  state.selected = null;
  await trySwap(a, b);
}

async function trySwap(a, b) {
  state.busy = true;
  state.board.swap(a, b);
  renderBoard(state.board, state);
  await delay(140);

  let matches = findMatches(state.board);
  if (matches.length === 0) {
    state.board.swap(a, b);
    renderBoard(state.board, state);
    flashMessage('Try another', 900);
    state.busy = false;
    return;
  }

  let cascadeLevel = 1;
  while (matches.length > 0) {
    state.board.clear(matches);
    state.score += calcScore(matches, cascadeLevel);
    setScore(state.score);
    flashMessage(messageFor(matches, cascadeLevel));
    renderBoard(state.board, state);
    await delay(240);
    applyGravity(state.board, CANDY_TYPES);
    renderBoard(state.board, state);
    await delay(240);
    matches = findMatches(state.board);
    cascadeLevel++;
  }

  state.busy = false;
}

function init() {
  state.board = new Board(COLS, ROWS, CANDY_TYPES);
  state.board.fillNoMatches();
  state.score = 0;
  state.selected = null;
  state.busy = false;
  setScore(0);
  flashMessage('');
  renderBoard(state.board, state);
}

document.getElementById('restart').addEventListener('click', init);
attachInput(onTap);
init();
