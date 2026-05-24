import { findMatches } from './match.js';
import { makeCell } from './board.js';

export function findAnyValidSwap(board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (c + 1 < board.cols) {
        board.swap({ c, r }, { c: c + 1, r });
        const m = findMatches(board);
        board.swap({ c, r }, { c: c + 1, r });
        if (m.positions.length > 0) {
          return { a: { c, r }, b: { c: c + 1, r } };
        }
      }
      if (r + 1 < board.rows) {
        board.swap({ c, r }, { c, r: r + 1 });
        const m = findMatches(board);
        board.swap({ c, r }, { c, r: r + 1 });
        if (m.positions.length > 0) {
          return { a: { c, r }, b: { c, r: r + 1 } };
        }
      }
    }
  }
  return null;
}

export function hasAnyValidSwap(board) {
  return findAnyValidSwap(board) !== null;
}

export function reshuffle(board, candyTypes) {
  const attempts = 8;
  for (let i = 0; i < attempts; i++) {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        board.set(c, r, makeCell(Math.floor(Math.random() * candyTypes), null));
      }
    }
    if (findMatches(board).positions.length === 0 && hasAnyValidSwap(board)) {
      return;
    }
  }
  board.fillNoMatches();
}
