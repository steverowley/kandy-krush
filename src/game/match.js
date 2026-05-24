export function findMatches(board) {
  const positions = new Set();
  const groups = [];
  const key = (c, r) => `${c},${r}`;

  for (let r = 0; r < board.rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= board.cols; c++) {
      const t = c < board.cols ? board.typeAt(c, r) : null;
      const tStart = board.typeAt(runStart, r);
      const sameRun = t !== null && t === tStart;
      if (!sameRun) {
        const len = c - runStart;
        if (len >= 3 && tStart !== null) {
          const runPositions = [];
          for (let k = runStart; k < c; k++) {
            positions.add(key(k, r));
            runPositions.push({ c: k, r });
          }
          groups.push({
            orientation: 'h',
            length: len,
            type: tStart,
            positions: runPositions,
          });
        }
        runStart = c;
      }
    }
  }

  for (let c = 0; c < board.cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= board.rows; r++) {
      const t = r < board.rows ? board.typeAt(c, r) : null;
      const tStart = board.typeAt(c, runStart);
      const sameRun = t !== null && t === tStart;
      if (!sameRun) {
        const len = r - runStart;
        if (len >= 3 && tStart !== null) {
          const runPositions = [];
          for (let k = runStart; k < r; k++) {
            positions.add(key(c, k));
            runPositions.push({ c, r: k });
          }
          groups.push({
            orientation: 'v',
            length: len,
            type: tStart,
            positions: runPositions,
          });
        }
        runStart = r;
      }
    }
  }

  return {
    positions: [...positions].map((s) => {
      const [c, r] = s.split(',').map(Number);
      return { c, r };
    }),
    groups,
  };
}

export function deriveNewSpecials(groups, swapTarget) {
  const sorted = [...groups].sort((a, b) => b.length - a.length);
  const newSpecials = [];
  const used = new Set();
  const k = (c, r) => `${c},${r}`;
  for (const g of sorted) {
    if (g.length < 4) continue;
    let chosen = null;
    if (swapTarget) {
      chosen = g.positions.find(
        (p) => p.c === swapTarget.c && p.r === swapTarget.r
      );
    }
    if (!chosen) chosen = g.positions[Math.floor(g.positions.length / 2)];
    if (used.has(k(chosen.c, chosen.r))) continue;
    used.add(k(chosen.c, chosen.r));
    const kind =
      g.length >= 5 ? 'rainbow' : g.orientation === 'h' ? 'line-h' : 'line-v';
    newSpecials.push({ c: chosen.c, r: chosen.r, type: g.type, kind });
  }
  return newSpecials;
}

const STRIPES = new Set(['line-h', 'line-v']);

export function detectCombo(cellA, cellB, posA, posB) {
  if (!cellA || !cellB) return null;
  const sA = cellA.special;
  const sB = cellB.special;
  if (sA === 'rainbow' && sB === 'rainbow') {
    return { kind: 'double-rainbow', a: posA, b: posB };
  }
  if (sA === 'rainbow' && STRIPES.has(sB)) {
    return { kind: 'rainbow-stripes', type: cellB.type, a: posA, b: posB };
  }
  if (sB === 'rainbow' && STRIPES.has(sA)) {
    return { kind: 'rainbow-stripes', type: cellA.type, a: posA, b: posB };
  }
  if (sA === 'rainbow') {
    return { kind: 'rainbow-type', type: cellB.type, a: posA, b: posB };
  }
  if (sB === 'rainbow') {
    return { kind: 'rainbow-type', type: cellA.type, a: posA, b: posB };
  }
  if (STRIPES.has(sA) && STRIPES.has(sB)) {
    return { kind: 'stripes-pair', a: posA, b: posB };
  }
  return null;
}

export function applyCombo(board, combo) {
  const positions = new Set();
  const k = (c, r) => `${c},${r}`;
  positions.add(k(combo.a.c, combo.a.r));
  positions.add(k(combo.b.c, combo.b.r));

  if (combo.kind === 'double-rainbow') {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) positions.add(k(c, r));
    }
  } else if (combo.kind === 'rainbow-stripes') {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (board.typeAt(c, r) === combo.type) {
          for (let cc = 0; cc < board.cols; cc++) positions.add(k(cc, r));
          for (let rr = 0; rr < board.rows; rr++) positions.add(k(c, rr));
        }
      }
    }
  } else if (combo.kind === 'rainbow-type') {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (board.typeAt(c, r) === combo.type) positions.add(k(c, r));
      }
    }
  } else if (combo.kind === 'stripes-pair') {
    for (let c = 0; c < board.cols; c++) positions.add(k(c, combo.b.r));
    for (let r = 0; r < board.rows; r++) positions.add(k(combo.b.c, r));
    for (let c = 0; c < board.cols; c++) positions.add(k(c, combo.a.r));
    for (let r = 0; r < board.rows; r++) positions.add(k(combo.a.c, r));
  }

  return [...positions].map((s) => {
    const [c, r] = s.split(',').map(Number);
    return { c, r };
  });
}

export function activationClears(board, matchedPositions) {
  const extra = new Set();
  const k = (c, r) => `${c},${r}`;
  for (const p of matchedPositions) {
    const cell = board.cell(p.c, p.r);
    if (!cell || !cell.special) continue;
    if (cell.special === 'line-h') {
      for (let c = 0; c < board.cols; c++) extra.add(k(c, p.r));
    } else if (cell.special === 'line-v') {
      for (let r = 0; r < board.rows; r++) extra.add(k(p.c, r));
    } else if (cell.special === 'rainbow') {
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          if (board.typeAt(c, r) === cell.type) extra.add(k(c, r));
        }
      }
    }
  }
  return [...extra].map((s) => {
    const [c, r] = s.split(',').map(Number);
    return { c, r };
  });
}
