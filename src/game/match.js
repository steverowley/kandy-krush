export function findMatches(board) {
  const matches = new Set();
  const key = (c, r) => `${c},${r}`;

  for (let r = 0; r < board.rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= board.cols; c++) {
      const sameRun =
        c < board.cols &&
        board.at(c, r) !== null &&
        board.at(c, r) === board.at(runStart, r);
      if (!sameRun) {
        if (c - runStart >= 3) {
          for (let k = runStart; k < c; k++) matches.add(key(k, r));
        }
        runStart = c;
      }
    }
  }

  for (let c = 0; c < board.cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= board.rows; r++) {
      const sameRun =
        r < board.rows &&
        board.at(c, r) !== null &&
        board.at(c, r) === board.at(c, runStart);
      if (!sameRun) {
        if (r - runStart >= 3) {
          for (let k = runStart; k < r; k++) matches.add(key(c, k));
        }
        runStart = r;
      }
    }
  }

  return [...matches].map((s) => {
    const [c, r] = s.split(',').map(Number);
    return { c, r };
  });
}
